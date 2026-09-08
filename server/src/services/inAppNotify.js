/**
 * In-app notifications — writes rows the notification bell reads back.
 *
 * A notification is addressed to a person (recipientEmail), a team
 * (recipientTeam), or both. Every helper here swallows its own errors:
 * a failed notification must never break the action that triggered it.
 */

const TEAM_SLUG = { 'UPAS': 'upas', 'DPAS': 'dpas' };

export const teamLink = (team) => `/team/${TEAM_SLUG[team] || 'upas'}`;

export const adminEmail = (env) => env.ADMIN_EMAIL || 'coeofficeinward@sssihl.edu.in';

/**
 * Insert one notification. Returns true on success, false if it was dropped.
 */
export async function notify(db, {
    type,
    title,
    body = '',
    recipientEmail = null,
    recipientTeam = null,
    inwardNo = null,
    entryId = null,
    link = null,
}) {
    if (!recipientEmail && !recipientTeam) return false;
    try {
        await db.prepare(`
            INSERT INTO notifications
                (type, title, body, recipient_email, recipient_team, inward_no, entry_id, link)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            type, title, body,
            recipientEmail, recipientTeam,
            inwardNo, entryId, link
        ).run();
        return true;
    } catch (err) {
        console.error('notify failed:', err.message);
        return false;
    }
}

/**
 * Insert several notifications, ignoring individual failures.
 */
export async function notifyMany(db, items) {
    await Promise.allSettled(items.map(item => notify(db, item)));
}
