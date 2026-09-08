/**
 * Pull a JSON object out of a model reply.
 *
 * Reasoning models narrate before answering, and some wrap the result in
 * markdown fences, so a bare JSON.parse of the raw content often fails.
 */
export function extractJsonObject(raw) {
    const cleaned = String(raw || '').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    return match ? match[0] : cleaned;
}
