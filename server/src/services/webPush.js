// CF Workers compatible Web Push (RFC 8291 + RFC 8292)
// Uses only SubtleCrypto — no Node.js dependencies

function b64url(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function concat(...arrays) {
    const total = arrays.reduce((s, a) => s + a.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const arr of arrays) { out.set(arr, offset); offset += arr.length; }
    return out;
}

async function hkdf(salt, ikm, info, length) {
    const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits(
        { name: 'HKDF', hash: 'SHA-256', salt, info },
        key,
        length * 8
    );
    return new Uint8Array(bits);
}

// RFC 8291: encrypt push payload
async function encryptPayload(subscription, payload) {
    const clientPublicKey = fromB64url(subscription.keys.p256dh);
    const authSecret = fromB64url(subscription.keys.auth);
    const plaintext = new TextEncoder().encode(
        typeof payload === 'string' ? payload : JSON.stringify(payload)
    );

    // Server ephemeral ECDH key pair
    const serverKeyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']
    );
    const serverPublicKeyRaw = new Uint8Array(
        await crypto.subtle.exportKey('raw', serverKeyPair.publicKey)
    );

    // Import client public key for ECDH
    const clientKey = await crypto.subtle.importKey(
        'raw', clientPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []
    );

    // ECDH shared secret
    const sharedSecret = new Uint8Array(
        await crypto.subtle.deriveBits(
            { name: 'ECDH', public: clientKey },
            serverKeyPair.privateKey,
            256
        )
    );

    // Random salt
    const salt = crypto.getRandomValues(new Uint8Array(16));

    // RFC 8291 key derivation
    const keyInfo = concat(
        new TextEncoder().encode('WebPush: info\0'),
        clientPublicKey,
        serverPublicKeyRaw
    );
    const prkKey = await hkdf(authSecret, sharedSecret, keyInfo, 32);

    const cek = await hkdf(salt, prkKey, new TextEncoder().encode('Content-Encoding: aes128gcm\0'), 16);
    const nonce = await hkdf(salt, prkKey, new TextEncoder().encode('Content-Encoding: nonce\0'), 12);

    // Encrypt
    const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
    const paddedPlaintext = concat(plaintext, new Uint8Array([0x02]));
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cekKey, paddedPlaintext)
    );

    // Build aes128gcm content: salt(16) + rs(4) + keyid_len(1) + server_pub(65) + ciphertext
    const rsBytes = new Uint8Array(4);
    new DataView(rsBytes.buffer).setUint32(0, 4096, false);

    return concat(salt, rsBytes, new Uint8Array([serverPublicKeyRaw.length]), serverPublicKeyRaw, ciphertext);
}

// RFC 8292: VAPID JWT
async function createVapidJwt(env, endpoint) {
    const url = new URL(endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const now = Math.floor(Date.now() / 1000);

    const enc = obj => b64url(new TextEncoder().encode(JSON.stringify(obj)));
    const signingInput = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({
        aud: audience,
        exp: now + 43200,
        sub: `mailto:${env.VAPID_EMAIL}`
    })}`;

    const privateKey = await crypto.subtle.importKey(
        'jwk',
        JSON.parse(env.VAPID_PRIVATE_KEY_JWK),
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign']
    );

    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        privateKey,
        new TextEncoder().encode(signingInput)
    );

    return `${signingInput}.${b64url(signature)}`;
}

// Send a Web Push notification to a single subscription
export async function sendPushNotification(env, subscription, payload) {
    const { endpoint } = subscription;
    const body = await encryptPayload(subscription, payload);
    const jwt = await createVapidJwt(env, endpoint);

    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Authorization': `vapid t=${jwt},k=${env.VAPID_PUBLIC_KEY}`,
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aes128gcm',
            'TTL': '86400',
        },
        body,
    });

    // 201 = success, 410 = subscription expired
    if (!res.ok && res.status !== 201) {
        const text = await res.text();
        const err = new Error(`Push failed ${res.status}: ${text}`);
        err.status = res.status;
        throw err;
    }

    return res.status;
}

// Send push to all subscriptions for a given team (or all if no team match)
export async function sendTeamPushNotifications(env, db, team, payload) {
    const { results: subs } = await db.prepare(
        'SELECT * FROM push_subscriptions WHERE team = ?'
    ).bind(team).all();

    if (subs.length === 0) return;

    const expiredEndpoints = [];

    await Promise.allSettled(
        subs.map(async sub => {
            try {
                await sendPushNotification(env, {
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth }
                }, payload);
            } catch (err) {
                if (err.status === 410) expiredEndpoints.push(sub.endpoint);
                else console.error(`Push error for ${sub.endpoint}:`, err.message);
            }
        })
    );

    // Clean up expired subscriptions
    for (const ep of expiredEndpoints) {
        await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(ep).run()
            .catch(() => {});
    }
}
