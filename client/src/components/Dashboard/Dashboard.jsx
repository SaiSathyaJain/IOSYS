import { useState, useEffect } from 'react';
import { dashboardAPI, inwardAPI, outwardAPI } from '../../services/api';
import {
    BarChart3, Hourglass, CheckCircle2, ArrowDownToLine, ArrowUpFromLine,
    Users, ChevronRight, X, Clock, TrendingUp, Calendar, FileText,
    RefreshCw, Loader2, ArrowLeft, AlertCircle
} from 'lucide-react';
import './Dashboard.css';

function Dashboard() {
    const [stats, setStats] = useState(null);
    const [teamStats, setTeamStats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [teamDetail, setTeamDetail] = useState(null);
    const [teamEntries, setTeamEntries] = useState([]);
    const [teamOutward, setTeamOutward] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
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

    const loadTeamDetail = async (teamName) => {
        setDetailLoading(true);
        setSelectedTeam(teamName);
        try {
            const [detailRes, inwardRes, outwardRes] = await Promise.all([
                dashboardAPI.getTeamStats(teamName),
                inwardAPI.getAll(),
                outwardAPI.getAll(teamName)
            ]);

            setTeamDetail(detailRes.data.stats);

            // Filter inward entries for this team
            const teamInward = inwardRes.data.entries.filter(e => e.assignedTeam === teamName);
            setTeamEntries(teamInward);
            setTeamOutward(outwardRes.data.entries);
        } catch (error) {
            console.error('Error loading team detail:', error);
        } finally {
            setDetailLoading(false);
        }
    };

    const closeTeamDetail = () => {
        setSelectedTeam(null);
        setTeamDetail(null);
        setTeamEntries([]);
        setTeamOutward([]);
    };

    const formatDate = (dateValue) => {
        if (!dateValue) return '-';
        try {
            const date = dateValue._seconds
                ? new Date(dateValue._seconds * 1000)
                : new Date(dateValue);
            return date.toLocaleDateString('en-IN', {
                day: '2-digit', month: 'short', year: 'numeric'
            });
        } catch {
            return '-';
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Completed': return 'success';
            case 'In Progress': return 'warning';
            case 'Pending': return 'pending';
            default: return 'unassigned';
        }
    };

    const getCompletionRate = (team) => {
        if (!team.total) return 0;
        return Math.round((team.completed / team.total) * 100);
    };

    if (loading) {
        return (
            <div className="loading-state">
                <Loader2 size={40} className="spin" />
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="dashboard animate-fade">
            <div className="page-header">
                <h2 className="page-title"><BarChart3 className="icon-svg" /> Admin Dashboard</h2>
                <button className="btn btn-icon-only" onClick={loadData} title="Refresh">
                    <RefreshCw size={18} />
                </button>
            </div>

            {/* Overall Stats */}
            <div className="stats-grid">
                <div className="stat-card total">
                    <div className="stat-icon"><ArrowDownToLine size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.totalInward || 0}</div>
                        <div className="stat-label">Total Inward</div>
                    </div>
                </div>
                <div className="stat-card pending">
                    <div className="stat-icon"><Hourglass size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.pendingWork || 0}</div>
                        <div className="stat-label">Pending Work</div>
                    </div>
                </div>
                <div className="stat-card completed">
                    <div className="stat-icon"><CheckCircle2 size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.completedWork || 0}</div>
                        <div className="stat-label">Completed</div>
                    </div>
                </div>
                <div className="stat-card outward">
                    <div className="stat-icon"><ArrowUpFromLine size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.totalOutward || 0}</div>
                        <div className="stat-label">Total Outward</div>
                    </div>
                </div>
            </div>

            {/* Team Performance Overview */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"><Users size={20} /> Team Performance</h3>
                    <span className="header-hint">Click a team to view details</span>
                </div>
                <div className="team-grid">
                    {teamStats.map(team => (
                        <div
                            key={team.team}
                            className={`team-card ${selectedTeam === team.team ? 'active' : ''}`}
                            onClick={() => loadTeamDetail(team.team)}
                        >
                            <div className="team-card-header">
                                <h4 className="team-name">{team.team} Team</h4>
                                <ChevronRight size={20} className="team-arrow" />
                            </div>
                            <div className="team-stats-row">
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
                            <div className="team-progress-wrapper">
                                <div className="progress-label">
                                    <span>Completion Rate</span>
                                    <span className="progress-percent">{getCompletionRate(team)}%</span>
                                </div>
                                <div className="team-progress">
                                    <div
                                        className="progress-bar"
                                        style={{ width: `${getCompletionRate(team)}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Team Detail Panel */}
            {selectedTeam && (
                <div className="team-detail-panel animate-fade">
                    <div className="card">
                        <div className="card-header">
                            <div className="detail-header-left">
                                <button className="btn-back" onClick={closeTeamDetail}>
                                    <ArrowLeft size={18} />
                                </button>
                                <h3 className="card-title">
                                    <TrendingUp size={20} />
                                    {selectedTeam} Team Statistics
                                </h3>
                            </div>
                            <button className="btn-close-panel" onClick={closeTeamDetail}>
                                <X size={20} />
                            </button>
                        </div>

                        {detailLoading ? (
                            <div className="loading-state small">
                                <Loader2 size={32} className="spin" />
                                <p>Loading team data...</p>
                            </div>
                        ) : (
                            <>
                                {/* Team Stats Summary */}
                                <div className="team-detail-stats">
                                    <div className="detail-stat">
                                        <div className="detail-stat-icon assigned">
                                            <FileText size={20} />
                                        </div>
                                        <div className="detail-stat-info">
                                            <span className="detail-stat-value">{teamDetail?.totalAssigned || 0}</span>
                                            <span className="detail-stat-label">Total Assigned</span>
                                        </div>
                                    </div>
                                    <div className="detail-stat">
                                        <div className="detail-stat-icon pending">
                                            <Clock size={20} />
                                        </div>
                                        <div className="detail-stat-info">
                                            <span className="detail-stat-value">{teamDetail?.pending || 0}</span>
                                            <span className="detail-stat-label">Pending</span>
                                        </div>
                                    </div>
                                    <div className="detail-stat">
                                        <div className="detail-stat-icon in-progress">
                                            <Hourglass size={20} />
                                        </div>
                                        <div className="detail-stat-info">
                                            <span className="detail-stat-value">{teamDetail?.inProgress || 0}</span>
                                            <span className="detail-stat-label">In Progress</span>
                                        </div>
                                    </div>
                                    <div className="detail-stat">
                                        <div className="detail-stat-icon completed">
                                            <CheckCircle2 size={20} />
                                        </div>
                                        <div className="detail-stat-info">
                                            <span className="detail-stat-value">{teamDetail?.completed || 0}</span>
                                            <span className="detail-stat-label">Completed</span>
                                        </div>
                                    </div>
                                    <div className="detail-stat">
                                        <div className="detail-stat-icon outward">
                                            <ArrowUpFromLine size={20} />
                                        </div>
                                        <div className="detail-stat-info">
                                            <span className="detail-stat-value">{teamDetail?.totalOutward || 0}</span>
                                            <span className="detail-stat-label">Outward Sent</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Completion Progress */}
                                <div className="completion-section">
                                    <h4>Completion Progress</h4>
                                    <div className="large-progress-wrapper">
                                        <div className="large-progress">
                                            <div
                                                className="large-progress-bar"
                                                style={{
                                                    width: `${teamDetail?.totalAssigned
                                                        ? (teamDetail.completed / teamDetail.totalAssigned) * 100
                                                        : 0}%`
                                                }}
                                            ></div>
                                        </div>
                                        <span className="large-progress-text">
                                            {teamDetail?.totalAssigned
                                                ? Math.round((teamDetail.completed / teamDetail.totalAssigned) * 100)
                                                : 0}% Complete
                                        </span>
                                    </div>
                                </div>

                                {/* Assigned Entries Table */}
                                <div className="entries-section">
                                    <h4><FileText size={18} /> Assigned Inward Entries ({teamEntries.length})</h4>
                                    {teamEntries.length === 0 ? (
                                        <div className="empty-state-small">
                                            <AlertCircle size={24} />
                                            <p>No entries assigned to this team</p>
                                        </div>
                                    ) : (
                                        <div className="table-container">
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>Inward No</th>
                                                        <th>Subject</th>
                                                        <th>From</th>
                                                        <th>Status</th>
                                                        <th>Due Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {teamEntries.slice(0, 10).map(entry => (
                                                        <tr key={entry.id}>
                                                            <td><strong>{entry.inwardNo}</strong></td>
                                                            <td className="subject-cell">{entry.subject}</td>
                                                            <td>{entry.particularsFromWhom}</td>
                                                            <td>
                                                                <span className={`badge badge-${getStatusColor(entry.assignmentStatus)}`}>
                                                                    {entry.assignmentStatus}
                                                                </span>
                                                            </td>
                                                            <td>{formatDate(entry.dueDate)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {teamEntries.length > 10 && (
                                                <p className="table-note">Showing 10 of {teamEntries.length} entries</p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Outward Entries */}
                                <div className="entries-section">
                                    <h4><ArrowUpFromLine size={18} /> Outward Entries ({teamOutward.length})</h4>
                                    {teamOutward.length === 0 ? (
                                        <div className="empty-state-small">
                                            <AlertCircle size={24} />
                                            <p>No outward entries from this team</p>
                                        </div>
                                    ) : (
                                        <div className="table-container">
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>Outward No</th>
                                                        <th>Subject</th>
                                                        <th>To</th>
                                                        <th>Sent By</th>
                                                        <th>Date</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {teamOutward.slice(0, 10).map(entry => (
                                                        <tr key={entry.id}>
                                                            <td><strong>{entry.outwardNo}</strong></td>
                                                            <td className="subject-cell">{entry.subject}</td>
                                                            <td>{entry.toWhom}</td>
                                                            <td>{entry.sentBy}</td>
                                                            <td>{formatDate(entry.createdAt)}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                            {teamOutward.length > 10 && (
                                                <p className="table-note">Showing 10 of {teamOutward.length} entries</p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default Dashboard;
