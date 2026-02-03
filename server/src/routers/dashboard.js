import { Hono } from 'hono';

export const dashboardRouter = new Hono();

// Helper to get count
const getCount = async (db, table, conditions = [], params = []) => {
    let query = `SELECT count(*) as count FROM ${table}`;
    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }
    const result = await db.prepare(query).bind(...params).first();
    return result ? result.count : 0;
};

// Get overall stats
dashboardRouter.get('/stats', async (c) => {
    try {
        const db = c.env.DB;
        const [totalInward, totalOutward, pendingWork, completedWork, unassigned] = await Promise.all([
            getCount(db, 'inward'),
            getCount(db, 'outward'),
            getCount(db, 'inward', ["(assignment_status = 'Pending' OR assignment_status = 'In Progress')"]),
            getCount(db, 'inward', ["assignment_status = 'Completed'"]),
            getCount(db, 'inward', ["(assignment_status = 'Unassigned' OR assigned_team IS NULL)"])
        ]);

        return c.json({
            success: true,
            stats: { totalInward, totalOutward, pendingWork, completedWork, unassigned }
        });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Get team-specific stats
dashboardRouter.get('/team/:team', async (c) => {
    try {
        const db = c.env.DB;
        const team = c.req.param('team');

        const [pending, inProgress, completed, totalOutward] = await Promise.all([
            getCount(db, 'inward', ['assigned_team = ?', "assignment_status = 'Pending'"], [team]),
            getCount(db, 'inward', ['assigned_team = ?', "assignment_status = 'In Progress'"], [team]),
            getCount(db, 'inward', ['assigned_team = ?', "assignment_status = 'Completed'"], [team]),
            getCount(db, 'outward', ['created_by_team = ?'], [team])
        ]);

        return c.json({
            success: true,
            team,
            stats: {
                totalAssigned: pending + inProgress + completed,
                pending,
                inProgress,
                completed,
                totalOutward
            }
        });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});

// Get all teams summary
dashboardRouter.get('/teams', async (c) => {
    try {
        const db = c.env.DB;
        const teams = ['UG', 'PG/PRO', 'PhD'];

        const teamStats = await Promise.all(teams.map(async (team) => {
            const [total, pending, completed] = await Promise.all([
                getCount(db, 'inward', ['assigned_team = ?'], [team]),
                getCount(db, 'inward', ['assigned_team = ?', "assignment_status = 'Pending'"], [team]),
                getCount(db, 'inward', ['assigned_team = ?', "assignment_status = 'Completed'"], [team])
            ]);

            return { team, total, pending, completed };
        }));

        return c.json({ success: true, teamStats });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});
