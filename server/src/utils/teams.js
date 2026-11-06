// Canonical team identifiers. PPAS and UPAS/PPAS were merged into UPAS —
// anything still referring to them (older AI output, stale clients) maps to UPAS.
export const TEAMS = ['UPAS', 'DPAS'];

const LEGACY_TEAMS = {
    'PPAS': 'UPAS',
    'UPAS/PPAS': 'UPAS',
};

// Assignment value meaning "every team": one shared inward entry that shows up
// in each team's portal, and whose notifications go to each team.
export const ALL_TEAM = 'All Team';

// SQL condition for "this entry belongs to team ?" — binds one param, the team.
export const TEAM_MATCH_SQL = `assigned_team IN (?, '${ALL_TEAM}')`;

// The real teams behind an assignment value.
export const teamsFor = (team) => (team === ALL_TEAM ? TEAMS : [team]);

export const teamLabel = (team) => (team === ALL_TEAM ? ALL_TEAM : `${team} Team`);

export function normalizeTeam(team) {
    if (!team) return team;
    const upper = String(team).trim().toUpperCase();
    return LEGACY_TEAMS[upper] || (TEAMS.includes(upper) ? upper : team);
}
