import { useState, useEffect } from 'react';
import { dashboardAPI } from '../../services/api';
import { BarChart3, Hourglass, CheckCircle2, ArrowDownToLine, ArrowUpFromLine, Users } from 'lucide-react';
import './Dashboard.css';

function Dashboard() {
    const [stats, setStats] = useState(null);
    const [teamStats, setTeamStats] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [statsRes, teamsRes] = await Promise.all([
                dashboardAPI.getStats(),
                dashboardAPI.getAllTeams()
            ]);
            setStats(statsRes.data.stats);
            setTeamStats(teamsRes.data.teamStats);
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return <div className="loading">Loading dashboard...</div>;
    }

    return (
        <div className="dashboard animate-fade">
            <h2 className="page-title"><BarChart3 className="icon-svg" /> Admin Dashboard</h2>

            {/* Overall Stats */}
            <div className="stats-grid">
                <div className="stat-card pending">
                    <div className="stat-value">{stats?.pendingWork || 0}</div>
                    <div className="stat-label"><Hourglass size={16} /> Pending Work</div>
                </div>
                <div className="stat-card completed">
                    <div className="stat-value">{stats?.completedWork || 0}</div>
                    <div className="stat-label"><CheckCircle2 size={16} /> Completed Work</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats?.totalInward || 0}</div>
                    <div className="stat-label"><ArrowDownToLine size={16} /> Total Inward</div>
                </div>
                <div className="stat-card">
                    <div className="stat-value">{stats?.totalOutward || 0}</div>
                    <div className="stat-label"><ArrowUpFromLine size={16} /> Total Outward</div>
                </div>
            </div>

            {/* Team Stats */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"><Users size={20} /> Team Performance</h3>
                </div>
                <div className="team-grid">
                    {teamStats.map(team => (
                        <div key={team.team} className="team-card">
                            <h4 className="team-name">{team.team} Team</h4>
                            <div className="team-stats">
                                <div className="team-stat">
                                    <span className="team-stat-value">{team.total}</span>
                                    <span className="team-stat-label">Assigned</span>
                                </div>
                                <div className="team-stat pending">
                                    <span className="team-stat-value">{team.pending}</span>
                                    <span className="team-stat-label">Pending</span>
                                </div>
                                <div className="team-stat completed">
                                    <span className="team-stat-value">{team.completed}</span>
                                    <span className="team-stat-label">Completed</span>
                                </div>
                            </div>
                            <div className="team-progress">
                                <div
                                    className="progress-bar"
                                    style={{ width: `${team.total ? (team.completed / team.total) * 100 : 0}%` }}
                                ></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;
