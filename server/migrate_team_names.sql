-- One-time migration: rename team identifiers UG/PG-PRO/PhD -> UPAS/PPAS/DPAS
UPDATE inward SET assigned_team = 'UPAS' WHERE assigned_team = 'UG';
UPDATE inward SET assigned_team = 'PPAS' WHERE assigned_team = 'PG/PRO';
UPDATE inward SET assigned_team = 'UPAS/PPAS' WHERE assigned_team = 'UG/PG';
UPDATE inward SET assigned_team = 'DPAS' WHERE assigned_team = 'PhD';

UPDATE inward_deleted SET assigned_team = 'UPAS' WHERE assigned_team = 'UG';
UPDATE inward_deleted SET assigned_team = 'PPAS' WHERE assigned_team = 'PG/PRO';
UPDATE inward_deleted SET assigned_team = 'UPAS/PPAS' WHERE assigned_team = 'UG/PG';
UPDATE inward_deleted SET assigned_team = 'DPAS' WHERE assigned_team = 'PhD';

UPDATE outward SET created_by_team = 'UPAS' WHERE created_by_team = 'UG';
UPDATE outward SET created_by_team = 'PPAS' WHERE created_by_team = 'PG/PRO';
UPDATE outward SET created_by_team = 'UPAS/PPAS' WHERE created_by_team = 'UG/PG';
UPDATE outward SET created_by_team = 'DPAS' WHERE created_by_team = 'PhD';

UPDATE push_subscriptions SET team = 'UPAS' WHERE team = 'UG';
UPDATE push_subscriptions SET team = 'PPAS' WHERE team = 'PG/PRO';
UPDATE push_subscriptions SET team = 'UPAS/PPAS' WHERE team = 'UG/PG';
UPDATE push_subscriptions SET team = 'DPAS' WHERE team = 'PhD';

UPDATE inbox_queue SET ai_team = 'UPAS' WHERE ai_team = 'UG';
UPDATE inbox_queue SET ai_team = 'PPAS' WHERE ai_team = 'PG/PRO';
UPDATE inbox_queue SET ai_team = 'UPAS/PPAS' WHERE ai_team = 'UG/PG';
UPDATE inbox_queue SET ai_team = 'DPAS' WHERE ai_team = 'PhD';
