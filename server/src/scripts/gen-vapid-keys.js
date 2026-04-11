// Run once with: node src/scripts/gen-vapid-keys.js
// Copy the output into server/.dev.vars and CF secrets + client/.env

import { webcrypto } from 'node:crypto';
const { subtle } = webcrypto;

const keyPair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify']
);

const privateJwk = await subtle.exportKey('jwk', keyPair.privateKey);
const publicJwk  = await subtle.exportKey('jwk', keyPair.publicKey);

// Public key as base64url uncompressed point (04 || x || y) — needed by the browser
const x = Buffer.from(publicJwk.x, 'base64');
const y = Buffer.from(publicJwk.y, 'base64');
const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y]);
const publicKeyBase64url = uncompressed.toString('base64url');

console.log('\n=== Copy these into server/.dev.vars ===\n');
console.log(`VAPID_PUBLIC_KEY=${publicKeyBase64url}`);
console.log(`VAPID_PRIVATE_KEY_JWK=${JSON.stringify(privateJwk)}`);
console.log(`VAPID_EMAIL=coeofficeinward@sssihl.edu.in`);
console.log('\n=== Copy this into client/.env ===\n');
console.log(`VITE_VAPID_PUBLIC_KEY=${publicKeyBase64url}`);
console.log('\n=== Then run these to set CF production secrets ===\n');
console.log(`npx wrangler secret put VAPID_PUBLIC_KEY`);
console.log(`npx wrangler secret put VAPID_PRIVATE_KEY_JWK`);
console.log(`npx wrangler secret put VAPID_EMAIL`);
console.log('');
