-- Sample notifications and messages for testing

-- Insert sample notifications
INSERT INTO notifications (user_email, title, message, type, is_read, created_at) VALUES
('saisathyajain@sssihl.edu.in', 'New inward entry created', 'A new inward entry has been created and assigned to UG team', 'info', 0, datetime('now', '-1 hour')),
('saisathyajain@sssihl.edu.in', 'Task overdue', 'Inward entry INW/2026/001 is overdue', 'warning', 0, datetime('now', '-3 hours')),
('saisathyajain@sssihl.edu.in', 'Task completed', 'Task INW/2026/002 has been completed successfully', 'success', 1, datetime('now', '-6 hours')),
('saisathyajain@sssihl.edu.in', 'New team member added', 'A new member has been added to the PG/PRO team', 'info', 0, datetime('now', '-1 day')),
('saisathyajain@sssihl.edu.in', 'Report generated', 'Monthly report for January 2026 is ready', 'success', 1, datetime('now', '-2 days'));

-- Insert sample messages
INSERT INTO messages (from_email, to_email, subject, body, is_read, created_at) VALUES
('admin@sssihl.edu.in', 'saisathyajain@sssihl.edu.in', 'New assignment for UG team', 'You have been assigned a new inward entry. Please review.', 0, datetime('now', '-2 hours')),
('results@sssihl.edu.in', 'saisathyajain@sssihl.edu.in', 'Task completion confirmation', 'Your task has been marked as completed. Thank you!', 0, datetime('now', '-5 hours')),
('admin@sssihl.edu.in', 'saisathyajain@sssihl.edu.in', 'Update required on entry', 'Please update the status of entry INW/2026/003', 0, datetime('now', '-1 day'));
