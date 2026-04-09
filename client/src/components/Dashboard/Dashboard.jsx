import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardAPI, inwardAPI, outwardAPI } from '../../services/api';
import {
    Hourglass, CheckCircle2, ArrowDownToLine, ArrowUpFromLine,
    Users, ChevronRight, X, Clock, TrendingUp, FileText,
    RefreshCw, Loader2, ArrowLeft, AlertCircle, Sun, Moon, Activity,
    Search, Filter
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ResponsiveContainer
} from 'recharts';
import './Dashboard.css';

const RingProgress = ({ percent, color }) => {
    const size = 76, stroke = 6;
    const r = (size - stroke * 2) / 2;
    const cx = size / 2, cy = size / 2;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (Math.min(percent, 100) / 100) * circumference;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring-svg">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(128,128,128,0.12)" strokeWidth={stroke} />
            <circle
                cx={cx} cy={cy} r={r} fill="none"
                stroke={color} strokeWidth={stroke}
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${cx} ${cy})`}
                style={{ transition: 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)' }}
            />
            <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill={color}>
                {percent}%
            </text>
        </svg>
    );
};

const TEAM_COLORS = ['#3B82F6', '#8B5CF6', '#10B981'];

function Dashboard() {
    const navigate = useNavigate();
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');
    const [userPhoto, setUserPhoto] = useState(null);
    const [stats, setStats] = useState(null);
    const [teamStats, setTeamStats] = useState([]);
    const [chartData, setChartData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [teamDetail, setTeamDetail] = useState(null);
    const [teamEntries, setTeamEntries] = useState([]);
    const [teamOutward, setTeamOutward] = useState([]);
    const [detailLoading, setDetailLoading] = useState(false);
    const [showAllInward, setShowAllInward] = useState(false);
    const [showAllOutward, setShowAllOutward] = useState(false);
    const [allEntries, setAllEntries] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [teamFilter, setTeamFilter] = useState('all');

    useEffect(() => {
        loadData();
        const user = localStorage.getItem('adminUser');
        if (user) {
            try { setUserPhoto(JSON.parse(user).picture); } catch (e) {}
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [statsRes, teamsRes, chartRes, entriesRes] = await Promise.allSettled([
                dashboardAPI.getStats(),
                dashboardAPI.getAllTeams(),
                dashboardAPI.getChartData(),
                inwardAPI.getAll()
            ]);
            setStats(statsRes.status === 'fulfilled' ? statsRes.value.data.stats || {} : {});
            setTeamStats(teamsRes.status === 'fulfilled' ? teamsRes.value.data.teamStats || [] : []);
            setChartData(chartRes.status === 'fulfilled' ? chartRes.value.data.chartData || [] : []);
            setAllEntries(entriesRes.status === 'fulfilled' ? entriesRes.value.data.entries || [] : []);
        } catch (error) {
            console.error('Error loading dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTeamDetail = async (teamName) => {
        setDetailLoading(true);
        setSelectedTeam(teamName);
        setShowAllInward(false);
        setShowAllOutward(false);
        try {
            const [detailRes, inwardRes, outwardRes] = await Promise.all([
                dashboardAPI.getTeamStats(teamName),
                inwardAPI.getAll(),
                outwardAPI.getAll(teamName)
            ]);
            setTeamDetail(detailRes.data.stats || {});
            const teamInward = (inwardRes.data.entries || []).filter(e => e.assignedTeam === teamName);
            setTeamEntries(teamInward);
            setTeamOutward(outwardRes.data.entries || []);
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
            <div className="dash-loading">
                <Loader2 size={36} className="spin" />
                <p>Loading dashboard…</p>
            </div>
        );
    }

    return (
        <div className="ap-page-wrapper">
            <nav className="ap-top-nav">
                <div className="ap-nav-left">
                    <button className="ap-back-btn" onClick={() => navigate('/')} title="Back to home">
                        <ArrowLeft size={18} />
                    </button>
                    <img src="/sssihl-icon.jpg" alt="SSSIHL" style={{ width: '30px', height: '30px', borderRadius: '7px', objectFit: 'cover' }} />
                    <span className="ap-nav-brand">SSSIHL</span>
                </div>

                <div className="ap-nav-tabs">
                    <button className="ap-nav-tab" onClick={() => navigate('/admin')}>
                        Registers
                    </button>
                    <button className="ap-nav-tab active" onClick={() => navigate('/admin/dashboard')}>
                        Intelligence
                    </button>
                </div>

                <div className="ap-nav-right">
                    <button className="btn btn-icon-only" onClick={loadData} disabled={loading} title="Refresh">
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    </button>
                    <div className="ap-nav-divider" />
                    <button className="ap-theme-btn" onClick={() => setIsDarkMode(!isDarkMode)} title="Toggle theme">
                        {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
                    </button>
                    <div className="ap-user-pill">
                        <div className="ap-user-info">
                            <span className="ap-user-role">Admin</span>
                            <span className="ap-user-status">
                                <span className="ap-online-dot" />
                                Online
                            </span>
                        </div>
                        <div className="ap-avatar-wrap">
                            <img src={userPhoto || "https://ui-avatars.com/api/?name=Admin&background=475569&color=ffffff"} alt="Profile" className="ap-avatar" />
                            <span className="ap-status-dot" />
                        </div>
                    </div>
                </div>
            </nav>

            <div className="dash-body">

                {/* Page Header */}
                <div className="dash-header">
                    <div className="dash-title-group">
                        <div className="dash-title-icon"><Activity size={20} /></div>
                        <div>
                            <h2 className="dash-title">Correspondence Intelligence</h2>
                            <p className="dash-subtitle">Overview of inward &amp; outward correspondence activity</p>
                        </div>
                    </div>
                </div>

                {/* Search & Filters */}
                {(() => {
                    const filtered = allEntries.filter(e => {
                        const matchSearch = !searchTerm ||
                            e.inwardNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            e.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            e.particularsFromWhom?.toLowerCase().includes(searchTerm.toLowerCase());
                        const matchStatus = statusFilter === 'all' || e.assignmentStatus === statusFilter;
                        const matchTeam = teamFilter === 'all' || e.assignedTeam === teamFilter;
                        return matchSearch && matchStatus && matchTeam;
                    });
                    const isFiltering = searchTerm || statusFilter !== 'all' || teamFilter !== 'all';
                    return (
                        <>
                            <div className="filters-bar">
                                <div className="search-box">
                                    <Search size={18} className="search-icon" />
                                    <input
                                        type="text"
                                        placeholder="Search by inward no., subject, or sender..."
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="search-input"
                                    />
                                </div>
                                <div className="filter-group">
                                    <Filter size={18} />
                                    <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="filter-select">
                                        <option value="all">All Status</option>
                                        <option value="Unassigned">Unassigned</option>
                                        <option value="Pending">Pending</option>
                                        <option value="In Progress">In Progress</option>
                                        <option value="Completed">Completed</option>
                                    </select>
                                    <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)} className="filter-select">
                                        <option value="all">All Teams</option>
                                        <option value="UG">UG Team</option>
                                        <option value="PG/PRO">PG/PRO Team</option>
                                        <option value="PhD">PhD Team</option>
                                    </select>
                                    {isFiltering && (
                                        <button className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} onClick={() => { setSearchTerm(''); setStatusFilter('all'); setTeamFilter('all'); }}>
                                            Clear
                                        </button>
                                    )}
                                </div>
                            </div>
                            {isFiltering && (
                                <div className="card animate-fade" style={{ marginBottom: '1.5rem' }}>
                                    <div className="card-header">
                                        <h3 className="card-title"><FileText size={18} /> Search Results <span className="entry-count">({filtered.length})</span></h3>
                                    </div>
                                    {filtered.length === 0 ? (
                                        <div className="empty-state"><FileText size={36} /><p>No entries match your search</p></div>
                                    ) : (
                                        <div className="table-container">
                                            <table className="table">
                                                <thead>
                                                    <tr>
                                                        <th>Inward No.</th>
                                                        <th>Date</th>
                                                        <th>From</th>
                                                        <th>Subject</th>
                                                        <th>Team</th>
                                                        <th>Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {filtered.map(e => (
                                                        <tr key={e.id}>
                                                            <td><strong style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{e.inwardNo}</strong></td>
                                                            <td style={{ fontSize: '0.82rem' }}>{formatDate(e.signReceiptDatetime)}</td>
                                                            <td>{e.particularsFromWhom}</td>
                                                            <td className="subject-cell"><div className="subject-text">{e.subject}</div></td>
                                                            <td>{e.assignedTeam ? <span className="badge badge-team">{e.assignedTeam}</span> : <span className="badge badge-none">-</span>}</td>
                                                            <td><span className={`badge badge-${getStatusColor(e.assignmentStatus)}`}>{e.assignmentStatus || 'Unassigned'}</span></td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    );
                })()}

                {/* Stat Cards */}
                <div className="stat-grid">
                    <div className="stat-card total">
                        <div className="stat-icon-box">
                            <ArrowDownToLine size={22} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.totalInward ?? 0}</div>
                            <div className="stat-label">Total Inward</div>
                        </div>
                        <div className="stat-bg-orb" />
                    </div>
                    <div className="stat-card pending">
                        <div className="stat-icon-box">
                            <Hourglass size={22} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.pendingWork ?? 0}</div>
                            <div className="stat-label">Pending Work</div>
                        </div>
                        <div className="stat-bg-orb" />
                    </div>
                    <div className="stat-card completed">
                        <div className="stat-icon-box">
                            <CheckCircle2 size={22} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.completedWork ?? 0}</div>
                            <div className="stat-label">Completed</div>
                        </div>
                        <div className="stat-bg-orb" />
                    </div>
                    <div className="stat-card outward">
                        <div className="stat-icon-box">
                            <ArrowUpFromLine size={22} />
                        </div>
                        <div className="stat-content">
                            <div className="stat-value">{stats?.totalOutward ?? 0}</div>
                            <div className="stat-label">Total Outward</div>
                        </div>
                        <div className="stat-bg-orb" />
                    </div>
                </div>

                {/* Volume Analytics Chart */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <div className="dash-card-title">
                            <TrendingUp size={18} />
                            <span>Volume Analytics</span>
                        </div>
                        <span className="dash-card-hint">Last 6 months</span>
                    </div>
                    <div className="chart-area">
                        {chartData.length === 0 || !chartData.some(d => d.inward > 0 || d.outward > 0) ? (
                            <div className="chart-empty">No correspondence data in the last 6 months</div>
                        ) : (
                            <ResponsiveContainer width="100%" height={260}>
                                <AreaChart data={chartData} margin={{ top: 10, right: 20, left: -16, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradInward" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradOutward" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" vertical={false} />
                                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 12, fill: '#64748B' }} axisLine={false} tickLine={false} allowDecimals={false} domain={[0, 'dataMax + 1']} />
                                    <Tooltip
                                        contentStyle={{ background: '#0D1526', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '0.85rem', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
                                        labelStyle={{ color: '#E2E8F0', fontWeight: 600, marginBottom: '4px' }}
                                        itemStyle={{ color: '#94A3B8' }}
                                        cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }}
                                    />
                                    <Legend
                                        wrapperStyle={{ fontSize: '0.8rem', color: '#64748B', paddingTop: '12px' }}
                                        iconType="circle"
                                        iconSize={8}
                                    />
                                    <Area type="monotone" dataKey="inward" name="Inward" stroke="#3B82F6" strokeWidth={2.5} fill="url(#gradInward)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                                    <Area type="monotone" dataKey="outward" name="Outward" stroke="#8B5CF6" strokeWidth={2.5} fill="url(#gradOutward)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Team Performance */}
                <div className="dash-card">
                    <div className="dash-card-header">
                        <div className="dash-card-title">
                            <Users size={18} />
                            <span>Team Performance</span>
                        </div>
                        <span className="dash-card-hint">Click a team to drill down</span>
                    </div>
                    <div className="team-grid">
                        {teamStats.map((team, i) => (
                            <div
                                key={team.team}
                                className={`team-card ${selectedTeam === team.team ? 'active' : ''}`}
                                onClick={() => loadTeamDetail(team.team)}
                                style={{ '--team-color': TEAM_COLORS[i % TEAM_COLORS.length] }}
                            >
                                <div className="team-card-top">
                                    <h4 className="team-name">{team.team} Team</h4>
                                    <ChevronRight size={16} className="team-arrow" />
                                </div>
                                <div className="team-card-body">
                                    <RingProgress percent={getCompletionRate(team)} color={TEAM_COLORS[i % TEAM_COLORS.length]} />
                                    <div className="team-stats-cols">
                                        <div className="team-stat-item">
                                            <span className="tsi-value">{team.total}</span>
                                            <span className="tsi-label">Assigned</span>
                                        </div>
                                        <div className="team-stat-item amber">
                                            <span className="tsi-value">{team.pending}</span>
                                            <span className="tsi-label">Pending</span>
                                        </div>
                                        <div className="team-stat-item green">
                                            <span className="tsi-value">{team.completed}</span>
                                            <span className="tsi-label">Done</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Team Detail Panel */}
                {selectedTeam && (
                    <div className="dash-card detail-panel">
                        <div className="dash-card-header">
                            <div className="detail-header-left">
                                <button className="btn-back" onClick={closeTeamDetail}>
                                    <ArrowLeft size={16} />
                                </button>
                                <div className="dash-card-title">
                                    <TrendingUp size={18} />
                                    <span>{selectedTeam} Team — Detail</span>
                                </div>
                            </div>
                            <button className="btn-close-panel" onClick={closeTeamDetail}>
                                <X size={18} />
                            </button>
                        </div>

                        {detailLoading ? (
                            <div className="dash-loading-inline">
                                <Loader2 size={28} className="spin" />
                                <span>Loading team data…</span>
                            </div>
                        ) : (
                            <>
                                {/* Detail Stats Row */}
                                <div className="detail-stats-row">
                                    <div className="detail-stat-card assigned">
                                        <div className="dsc-icon"><FileText size={18} /></div>
                                        <div className="dsc-value">{teamDetail?.totalAssigned ?? 0}</div>
                                        <div className="dsc-label">Total Assigned</div>
                                    </div>
                                    <div className="detail-stat-card pending">
                                        <div className="dsc-icon"><Clock size={18} /></div>
                                        <div className="dsc-value">{teamDetail?.pending ?? 0}</div>
                                        <div className="dsc-label">Pending</div>
                                    </div>
                                    <div className="detail-stat-card in-progress">
                                        <div className="dsc-icon"><Hourglass size={18} /></div>
                                        <div className="dsc-value">{teamDetail?.inProgress ?? 0}</div>
                                        <div className="dsc-label">In Progress</div>
                                    </div>
                                    <div className="detail-stat-card completed">
                                        <div className="dsc-icon"><CheckCircle2 size={18} /></div>
                                        <div className="dsc-value">{teamDetail?.completed ?? 0}</div>
                                        <div className="dsc-label">Completed</div>
                                    </div>
                                    <div className="detail-stat-card outward">
                                        <div className="dsc-icon"><ArrowUpFromLine size={18} /></div>
                                        <div className="dsc-value">{teamDetail?.totalOutward ?? 0}</div>
                                        <div className="dsc-label">Outward Sent</div>
                                    </div>
                                </div>

                                {/* Completion Progress Bar */}
                                <div className="completion-row">
                                    <span className="completion-label">Completion Progress</span>
                                    <div className="completion-track">
                                        <div
                                            className="completion-fill"
                                            style={{
                                                width: `${teamDetail?.totalAssigned
                                                    ? Math.round((teamDetail.completed / teamDetail.totalAssigned) * 100)
                                                    : 0}%`
                                            }}
                                        />
                                    </div>
                                    <span className="completion-pct">
                                        {teamDetail?.totalAssigned
                                            ? Math.round((teamDetail.completed / teamDetail.totalAssigned) * 100)
                                            : 0}%
                                    </span>
                                </div>

                                {/* Inward Entries Table */}
                                <div className="entries-section">
                                    <h4 className="entries-title">
                                        <FileText size={16} />
                                        Assigned Inward Entries
                                        <span className="entries-count">{teamEntries.length}</span>
                                    </h4>
                                    {teamEntries.length === 0 ? (
                                        <div className="empty-inline">
                                            <AlertCircle size={20} />
                                            <span>No entries assigned to this team</span>
                                        </div>
                                    ) : (
                                        <div className="table-wrap">
                                            <table className="data-table">
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
                                                    {(showAllInward ? teamEntries : teamEntries.slice(0, 10)).map(entry => (
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
                                                <div className="table-show-more">
                                                    <span className="table-note">
                                                        Showing {showAllInward ? teamEntries.length : 10} of {teamEntries.length} entries
                                                    </span>
                                                    <button className="btn-show-more" onClick={() => setShowAllInward(v => !v)}>
                                                        {showAllInward ? 'Show less ↑' : `Show all ${teamEntries.length} ↓`}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Outward Entries Table */}
                                <div className="entries-section">
                                    <h4 className="entries-title">
                                        <ArrowUpFromLine size={16} />
                                        Outward Entries
                                        <span className="entries-count">{teamOutward.length}</span>
                                    </h4>
                                    {teamOutward.length === 0 ? (
                                        <div className="empty-inline">
                                            <AlertCircle size={20} />
                                            <span>No outward entries from this team</span>
                                        </div>
                                    ) : (
                                        <div className="table-wrap">
                                            <table className="data-table">
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
                                                    {(showAllOutward ? teamOutward : teamOutward.slice(0, 10)).map(entry => (
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
                                                <div className="table-show-more">
                                                    <span className="table-note">
                                                        Showing {showAllOutward ? teamOutward.length : 10} of {teamOutward.length} entries
                                                    </span>
                                                    <button className="btn-show-more" onClick={() => setShowAllOutward(v => !v)}>
                                                        {showAllOutward ? 'Show less ↑' : `Show all ${teamOutward.length} ↓`}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default Dashboard;
