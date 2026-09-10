-- One-time bulk close of the legacy open outward backlog.
--
-- Outward entries are now closed on submission, so the only open cases left are
-- ones created before that change. This clears the backlog so the weekly boss
-- report (which lists open outward only) reflects reality.
--
-- Scoped to dispatches older than 7 days: anything more recent may still be
-- genuinely awaiting acknowledgement, and staff are actively closing those as
-- receipts come back.
--
-- ALREADY RUN against production on 2026-09-10: closed 98 entries, leaving the
-- 12 dispatches from the previous 7 days open. DO NOT RE-RUN — the "> 7 days"
-- window is relative, so running it again would close whatever has since aged
-- past 7 days. Treat this as a spent one-time script.
--
-- Nothing in the app reopens a case, so the 98 ids below are the only way back:
--
--   UPDATE outward SET case_closed = 0 WHERE id IN (
--     4,5,6,7,10,11,31,39,40,47,64,65,66,67,68,69,70,71,72,73,74,75,76,77,78,
--     79,80,81,82,83,92,93,94,95,99,115,116,136,137,150,168,169,171,173,175,
--     176,177,178,179,180,181,182,187,188,190,191,192,193,194,195,199,200,201,
--     204,205,206,207,208,209,210,211,212,213,214,215,216,217,218,223,224,226,
--     227,229,230,231,232,233,236,238,239,240,241,242,243,244,245,246,247
--   );
--
-- The audit rows use the same action and wording as the normal close route
-- (outwardRouter.put('/:id/close')) so existing audit views still read them,
-- with "(bulk close)" appended to mark how it happened.

INSERT INTO audit_log (action, actor, description, inward_no)
SELECT
    'OUTWARD_CLOSED',
    COALESCE(created_by_team || ' Team', 'Team'),
    COALESCE(created_by_team || ' Team', 'Team') || ' closed outward entry ' || outward_no || ' (bulk close)',
    NULL
FROM outward
WHERE case_closed = 0
  AND julianday('now') - julianday(sign_receipt_datetime) > 7;

UPDATE outward
SET case_closed = 1,
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE case_closed = 0
  AND julianday('now') - julianday(sign_receipt_datetime) > 7;
