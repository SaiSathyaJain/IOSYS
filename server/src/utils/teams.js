// Canonical team identifiers. PPAS and UPAS/PPAS were merged into UPAS —
// anything still referring to them (older AI output, stale clients) maps to UPAS.
export const TEAMS = ['UPAS', 'DPAS'];

const LEGACY_TEAMS = {
    'PPAS': 'UPAS',
    'UPAS/PPAS': 'UPAS',
};

export function normalizeTeam(team) {
    if (!team) return team;
    const upper = String(team).trim().toUpperCase();
    return LEGACY_TEAMS[upper] || (TEAMS.includes(upper) ? upper : team);
}
