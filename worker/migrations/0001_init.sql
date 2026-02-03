-- Inward table
CREATE TABLE IF NOT EXISTS inward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inward_no TEXT NOT NULL UNIQUE,
    means TEXT NOT NULL,
    particulars_from_whom TEXT NOT NULL,
    subject TEXT NOT NULL,
    assigned_to TEXT,
    sign_receipt_datetime TEXT NOT NULL,
    file_reference TEXT DEFAULT '',
    assigned_team TEXT,
    assigned_to_email TEXT,
    assignment_instructions TEXT DEFAULT '',
    assignment_date TEXT,
    assignment_status TEXT DEFAULT 'Unassigned',
    due_date TEXT,
    completion_date TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Outward table
CREATE TABLE IF NOT EXISTS outward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outward_no TEXT NOT NULL UNIQUE,
    means TEXT NOT NULL,
    to_whom TEXT NOT NULL,
    subject TEXT NOT NULL,
    sent_by TEXT NOT NULL,
    sign_receipt_datetime TEXT NOT NULL,
    case_closed INTEGER DEFAULT 0,
    file_reference TEXT DEFAULT '',
    postal_tariff REAL DEFAULT 0,
    due_date TEXT,
    linked_inward_id INTEGER,
    created_by_team TEXT NOT NULL,
    team_member_email TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (linked_inward_id) REFERENCES inward(id)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_inward_status ON inward(assignment_status);
CREATE INDEX IF NOT EXISTS idx_inward_team ON inward(assigned_team);
CREATE INDEX IF NOT EXISTS idx_outward_team ON outward(created_by_team);
CREATE INDEX IF NOT EXISTS idx_outward_linked ON outward(linked_inward_id);
