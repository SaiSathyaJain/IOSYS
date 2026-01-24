import express from 'express';

const router = express.Router();

// Helper to get count
const getCount = async (supabase, table, filter = {}) => {
  let query = supabase.from(table).select('*', { count: 'exact', head: true });

  if (filter.status) {
    if (Array.isArray(filter.status)) {
      query = query.in('assignment_status', filter.status);
    } else {
      query = query.eq('assignment_status', filter.status);
    }
  }

  if (filter.team) {
    query = query.eq('assigned_team', filter.team);
  }

  if (filter.createdByTeam) {
    query = query.eq('created_by_team', filter.createdByTeam);
  }

  if (filter.orUnassigned) {
    query = query.or('assignment_status.eq.Unassigned,assigned_team.is.null');
  }

  const { count, error } = await query;
  if (error) throw error;
  return count;
};

// Get overall stats
router.get('/stats', async (req, res) => {
  try {
    const [totalInward, totalOutward, pendingWork, completedWork, unassigned] = await Promise.all([
      getCount(req.supabase, 'inward'),
      getCount(req.supabase, 'outward'),
      getCount(req.supabase, 'inward', { status: ['Pending', 'In Progress'] }),
      getCount(req.supabase, 'inward', { status: 'Completed' }),
      getCount(req.supabase, 'inward', { orUnassigned: true })
    ]);

    res.json({
      success: true,
      stats: { totalInward, totalOutward, pendingWork, completedWork, unassigned }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get team-specific stats
router.get('/team/:team', async (req, res) => {
  try {
    const { team } = req.params;

    const [pending, inProgress, completed, totalOutward] = await Promise.all([
      getCount(req.supabase, 'inward', { team, status: 'Pending' }),
      getCount(req.supabase, 'inward', { team, status: 'In Progress' }),
      getCount(req.supabase, 'inward', { team, status: 'Completed' }),
      getCount(req.supabase, 'outward', { createdByTeam: team })
    ]);

    res.json({
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get all teams summary
router.get('/teams', async (req, res) => {
  try {
    const teams = ['UG', 'PG/PRO', 'PhD'];

    // Process teams in parallel
    const teamStats = await Promise.all(teams.map(async (team) => {
      const [total, pending, completed] = await Promise.all([
        getCount(req.supabase, 'inward', { team }),
        getCount(req.supabase, 'inward', { team, status: 'Pending' }),
        getCount(req.supabase, 'inward', { team, status: 'Completed' })
      ]);

      return {
        team,
        total,
        pending,
        completed
      };
    }));

    res.json({ success: true, teamStats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
