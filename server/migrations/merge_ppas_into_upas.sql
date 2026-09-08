-- One-time migration: merge PPAS and UPAS/PPAS into a single UPAS team.
-- Mirrors the table coverage of migrate_team_names.sql.
UPDATE inward SET assigned_team = 'UPAS' WHERE assigned_team IN ('PPAS', 'UPAS/PPAS');

UPDATE inward_deleted SET assigned_team = 'UPAS' WHERE assigned_team IN ('PPAS', 'UPAS/PPAS');

UPDATE outward SET created_by_team = 'UPAS' WHERE created_by_team IN ('PPAS', 'UPAS/PPAS');

UPDATE push_subscriptions SET team = 'UPAS' WHERE team IN ('PPAS', 'UPAS/PPAS');

UPDATE inbox_queue SET ai_team = 'UPAS' WHERE ai_team IN ('PPAS', 'UPAS/PPAS');
