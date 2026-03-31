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

// Get chart data
dashboardRouter.get('/chart-data', async (c) => {
    try {
        const db = c.env.DB;
        
        // Fetch dates from both tables
        const inwardRows = await db.prepare("SELECT sign_receipt_datetime FROM inward").all();
        const outwardRows = await db.prepare("SELECT sign_receipt_datetime FROM outward").all();
        
        // Initialize last 6 months
        const months = [];
        const chartDataMap = {};
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthStr = d.toLocaleString('en-US', { month: 'short' });
            const key = monthStr;
            months.push(key);
            chartDataMap[key] = { month: key, inward: 0, outward: 0 };
        }
        
        // Safely parse date
        const parseDate = (val) => {
            if (!val) return null;
            return val._seconds ? new Date(val._seconds * 1000) : new Date(val);
        };

        // Populate inward
        (inwardRows.results || []).forEach(row => {
            const d = parseDate(row.sign_receipt_datetime);
            if (d) {
                const key = d.toLocaleString('en-US', { month: 'short' });
                if (chartDataMap[key]) chartDataMap[key].inward++;
            }
        });

        // Populate outward
        (outwardRows.results || []).forEach(row => {
            const d = parseDate(row.sign_receipt_datetime);
            if (d) {
                const key = d.toLocaleString('en-US', { month: 'short' });
                if (chartDataMap[key]) chartDataMap[key].outward++;
            }
        });

        const chartData = months.map(m => chartDataMap[m]);
        
        return c.json({ success: true, chartData });
    } catch (error) {
        return c.json({ success: false, message: error.message }, 500);
    }
});
