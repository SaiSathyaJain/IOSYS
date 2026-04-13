/**
 * Inbox Poller — reads unread Gmail messages, AI-extracts fields,
 * inserts into inbox_queue for admin review.
 * Triggered by cron every 30 minutes.
 */

async function getAccessToken(env) {
    if (!env.GMAIL_CLIENT_ID || !env.GMAIL_CLIENT_SECRET || !env.GMAIL_REFRESH_TOKEN) {
        throw new Error('Gmail OAuth secrets not configured (GMAIL_CLIENT_ID / GMAIL_CLIENT_SECRET / GMAIL_REFRESH_TOKEN missing)');
    }
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id:     env.GMAIL_CLIENT_ID,
            client_secret: env.GMAIL_CLIENT_SECRET,
            refresh_token: env.GMAIL_REFRESH_TOKEN,
            grant_type:    'refresh_token',
        }),
    });
    const data = await res.json();
    if (!data.access_token) {
        throw new Error(`Gmail token exchange failed: ${data.error || 'unknown'} — ${data.error_description || ''}`);
    }
    return data.access_token;
}

function decodeBase64Url(data) {
    try {
        return atob(data.replace(/-/g, '+').replace(/_/g, '/'));
    } catch {
        return '';
    }
}

function extractBodyText(payload) {
    // Simple (non-multipart) message
    if (payload.body?.data) {
        return decodeBase64Url(payload.body.data);
    }
    if (!payload.parts) return '';

    // Search recursively through parts
    const findText = (parts) => {
        for (const part of parts) {
            if (part.mimeType === 'text/plain' && part.body?.data) {
                return decodeBase64Url(part.body.data);
            }
            if (part.parts) {
                const found = findText(part.parts);
                if (found) return found;
            }
        }
        // Fallback to HTML stripped of tags
        for (const part of parts) {
            if (part.mimeType === 'text/html' && part.body?.data) {
                const html = decodeBase64Url(part.body.data);
                return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            }
        }
        return '';
    };

    return findText(payload.parts);
}

function parseFrom(fromHeader) {
    // "Display Name <email@domain.com>" or just "email@domain.com"
    const match = fromHeader.match(/^(.*?)\s*<([^>]+)>$/);
    if (match) {
        return {
            name:  match[1].trim().replace(/^"|"$/g, ''),
            email: match[2].trim(),
        };
    }
    return { name: '', email: fromHeader.trim() };
}

async function extractFieldsWithAI(env, subject, bodyText, senderName) {
    if (!env.OPENROUTER_API_KEY) return {};
    const today = new Date().toISOString().split('T')[0];
    const prompt = `Extract fields from this email for a university document management system. Return ONLY valid JSON — no explanation, no markdown.

Sender: ${senderName}
Subject: ${subject}
Body preview: ${bodyText.slice(0, 500)}

Fields to extract:
- "particularsFromWhom": sender name or organization (string)
- "assignedTeam": which team should handle it — "UG" (undergraduate matters), "PG/PRO" (postgraduate/professional), "PhD" (doctoral research), or "" if unclear (string)
- "dueDate": YYYY-MM-DD — 7 days from ${today} if urgent/exam-related, 14 days if normal, "" if not applicable (string)
- "remarks": one short sentence about the key action needed, or "" (string)

Return ONLY the JSON object:`;

    try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${env.OPENROUTER_API_KEY}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://iosys.coeofficeinward.workers.dev',
                'X-Title': 'IOSYS Inbox Poller',
            },
            body: JSON.stringify({
                model: 'nvidia/nemotron-3-nano-30b-a3b:free',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 200,
                temperature: 0.1,
            }),
        });
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content || '{}';
        const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(jsonStr);
    } catch {
        return {};
    }
}

/**
 * Poll Gmail inbox, insert new emails into inbox_queue.
 * Returns a result summary object — throws on fatal config errors.
 */
export async function pollInbox(env) {
    const result = { processed: 0, skipped: 0, errors: [], total: 0 };

    // This will throw if secrets are missing — caller sees the error
    const accessToken = await getAccessToken(env);

    // Fetch unread messages (max 15 per poll)
    // Exclude Gmail auto-categories (Promotions, Updates, Social, Forums) and limit to last 2 days
    const gmailQuery = encodeURIComponent(
        'is:unread in:inbox -category:promotions -category:updates -category:social -category:forums newer_than:2d'
    );
    const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${gmailQuery}&maxResults=15`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!listRes.ok) {
        const text = await listRes.text();
        throw new Error(`Gmail list failed (${listRes.status}): ${text.slice(0, 200)}`);
    }
    const listData = await listRes.json();
    const messages = listData.messages || [];
    result.total = messages.length;

    for (const msg of messages) {
        try {
            // Deduplication — skip if already in queue
            const existing = await env.DB.prepare(
                'SELECT id FROM inbox_queue WHERE gmail_message_id = ?'
            ).bind(msg.id).first();
            if (existing) { result.skipped++; continue; }

            // Fetch full message details
            const detailRes = await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
                { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            const detail = await detailRes.json();

            // Parse headers
            const headers    = detail.payload?.headers || [];
            const getHeader  = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
            const fromHeader = getHeader('From');
            const subject    = getHeader('Subject') || '(No subject)';
            const dateHeader = getHeader('Date');
            const receivedAt = dateHeader
                ? new Date(dateHeader).toISOString()
                : new Date().toISOString();

            const { name: fromName, email: fromEmail } = parseFrom(fromHeader);

            // Skip advertisement / automated emails based on subject keywords
            const AD_KEYWORDS = [
                'unsubscribe', 'newsletter', 'no-reply', 'noreply', 'do not reply',
                'opt-out', 'mailing list', 'automated', 'promotion', 'promotional',
                'offer', 'discount', 'deal', 'sale', '% off',
            ];
            const subjectLower = subject.toLowerCase();
            const fromEmailLower = fromEmail.toLowerCase();
            const isAd = AD_KEYWORDS.some(kw => subjectLower.includes(kw) || fromEmailLower.includes(kw));
            if (isAd) { result.skipped++; continue; }

            // Extract body
            const bodyText    = extractBodyText(detail.payload || {});
            const bodyPreview = bodyText.slice(0, 800).trim();

            // AI field extraction (optional — doesn't block if it fails)
            const aiFields = await extractFieldsWithAI(
                env,
                subject,
                bodyPreview,
                fromName || fromEmail
            );

            // Insert into inbox_queue FIRST — only mark as read on success
            await env.DB.prepare(`
                INSERT INTO inbox_queue
                    (gmail_message_id, gmail_thread_id, from_email, from_name, subject,
                     body_preview, received_at, ai_from, ai_means, ai_team, ai_due_date, ai_remarks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                msg.id,
                msg.threadId || msg.id,
                fromEmail,
                fromName,
                subject,
                bodyPreview,
                receivedAt,
                aiFields.particularsFromWhom || fromName || fromEmail,
                'Email',
                aiFields.assignedTeam  || '',
                aiFields.dueDate       || '',
                aiFields.remarks       || ''
            ).run();

            // Mark email as read only after successful INSERT
            await fetch(
                `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}/modify`,
                {
                    method: 'POST',
                    headers: {
                        Authorization:  `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ removeLabelIds: ['UNREAD'] }),
                }
            );

            result.processed++;
        } catch (err) {
            result.errors.push({ messageId: msg.id, error: err.message });
        }
    }

    return result;
}
