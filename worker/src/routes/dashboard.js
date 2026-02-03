import { Hono } from 'hono';

const app = new Hono();

// Helper to get count with filters
const getCount = async (db, table, filters = {}) => {
  let query = `SELECT COUNT(*) as count FROM ${table} WHERE 1=1`;
  const params = [];

  if (filters.status) {
    if (Array.isArray(filters.status)) {
      const placeholders = filters.status.map(() => '?').join(', ');
      query += ` AND assignment_status IN (${placeholders})`;
      params.push(...filters.status);
    } else {
      query += ' AND assignment_status = ?';
      params.push(filters.status);
    }
  }

  if (filters.team) {
    query += ' AND assigned_team = ?';
    params.push(filters.team);
  }

  if (filters.createdByTeam) {
    query += ' AND created_by_team = ?';
    params.push(filters.createdByTeam);
  }

  if (filters.orUnassigned) {
    query = `SELECT COUNT(*) as count FROM ${table} WHERE assignment_status = 'Unassigned' OR assigned_team IS NULL`;
  }

  const stmt = params.length > 0
    ? db.prepare(query).bind(...params)
    : db.prepare(query);

  const result = await stmt.first();
  return result?.count || 0;
};

// Get overall stats
app.get('/stats', async (c) => {
  try {
    const db = c.env.DB;

    const [totalInward, totalOutward, pendingWork, completedWork, unassigned] = await Promise.all([
      getCount(db, 'inward'),
      getCount(db, 'outward'),
      getCount(db, 'inward', { status: ['Pending', 'In Progress'] }),
      getCount(db, 'inward', { status: 'Completed' }),
      getCount(db, 'inward', { orUnassigned: true })
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
app.get('/team/:team', async (c) => {
  try {
    const db = c.env.DB;
    const team = c.req.param('team');

    const [pending, inProgress, completed, totalOutward] = await Promise.all([
      getCount(db, 'inward', { team, status: 'Pending' }),
      getCount(db, 'inward', { team, status: 'In Progress' }),
      getCount(db, 'inward', { team, status: 'Completed' }),
      getCount(db, 'outward', { createdByTeam: team })
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
app.get('/teams', async (c) => {
  try {
    const db = c.env.DB;
    const teams = ['UG', 'PG/PRO', 'PhD'];

    const teamStats = await Promise.all(teams.map(async (team) => {
      const [total, pending, completed] = await Promise.all([
        getCount(db, 'inward', { team }),
        getCount(db, 'inward', { team, status: 'Pending' }),
        getCount(db, 'inward', { team, status: 'Completed' })
      ]);

      return { team, total, pending, completed };
    }));

    return c.json({ success: true, teamStats });
  } catch (error) {
    return c.json({ success: false, message: error.message }, 500);
  }
});

export default app;
