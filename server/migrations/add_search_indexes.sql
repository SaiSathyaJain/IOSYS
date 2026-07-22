CREATE INDEX IF NOT EXISTS idx_inward_subject ON inward(subject);
CREATE INDEX IF NOT EXISTS idx_inward_particulars ON inward(particulars_from_whom);
CREATE INDEX IF NOT EXISTS idx_outward_to_whom ON outward(to_whom);
CREATE INDEX IF NOT EXISTS idx_outward_subject ON outward(subject);
