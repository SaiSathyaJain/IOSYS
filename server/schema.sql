-- Inward Table
CREATE TABLE IF NOT EXISTS inward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inward_no TEXT UNIQUE NOT NULL,
    means TEXT,
    particulars_from_whom TEXT,
    subject TEXT,
    sign_receipt_datetime TEXT,
    file_reference TEXT,
    assigned_team TEXT,
    assigned_to_email TEXT,
    assignment_instructions TEXT,
    assignment_date TEXT,
    assignment_status TEXT DEFAULT 'Unassigned',
    due_date TEXT,
    completion_date TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Outward Table
CREATE TABLE IF NOT EXISTS outward (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outward_no TEXT UNIQUE NOT NULL,
    means TEXT,
    to_whom TEXT,
    subject TEXT,
    sent_by TEXT,
    sign_receipt_datetime TEXT,
    case_closed INTEGER DEFAULT 0,
    file_reference TEXT,
    postal_tariff REAL,
    due_date TEXT,
    linked_inward_id INTEGER,
    created_by_team TEXT,
    team_member_email TEXT,
    remarks TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (linked_inward_id) REFERENCES inward(id)
);

-- Notes Table
CREATE TABLE IF NOT EXISTS notes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    note_type   TEXT NOT NULL,
    sl_no       TEXT NOT NULL,
    outward_no  TEXT NOT NULL,
    date        TEXT NOT NULL,
    description TEXT NOT NULL,
    remarks     TEXT,
    created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_inward_status ON inward(assignment_status);
CREATE INDEX IF NOT EXISTS idx_inward_assigned_team ON inward(assigned_team);
CREATE INDEX IF NOT EXISTS idx_outward_created_by_team ON outward(created_by_team);
CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(note_type);
