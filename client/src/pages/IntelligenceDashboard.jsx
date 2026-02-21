import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell, Settings, Search, Download, Calendar,
    MoreHorizontal, TrendingUp, TrendingDown,
    GraduationCap, BookOpen, Microscope, ArrowLeft,
    Clock, AlertCircle, Layers, ArrowDownLeft, Send,
    ChevronRight, Shield
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer
} from 'recharts';
import { dashboardAPI, inwardAPI, outwardAPI } from '../services/api';
import './IntelligenceDashboard.css';

// ─── Circular progress indicator ──────────────────────────
const CircleProgress = ({ pct, color, size = 72 }) => {
    const sw = 6;
    const r = (size - sw) / 2;
    const circ = 2 * Math.PI * r;
    const offset = circ * (1 - Math.min(Math.max(pct, 0), 100) / 100);
    const c = size / 2;
    return (
        <svg width={size} height={size} className="id-circle-svg">
            <circle cx={c} cy={c} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={sw} />
            <circle
                cx={c} cy={c} r={r} fill="none"
                stroke={color} strokeWidth={sw}
                strokeDasharray={circ} strokeDashoffset={offset}
                strokeLinecap="round"
                transform={`rotate(-90 ${c} ${c})`}
                style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
            <text x={c} y={c + 4} textAnchor="middle" fill="#f0f6fc" fontSize={11} fontWeight="700">
                {pct}%
            </text>
        </svg>
    );
};

// ─── Chart tooltip ─────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="id-tooltip">
            <p className="id-tooltip-label">{label}</p>
            {payload.map(p => (
                <p key={p.dataKey} style={{ color: p.color, margin: '2px 0', fontSize: '0.8rem' }}>
                    {p.dataKey === 'inward' ? 'Inward' : 'Outward'}: <strong>{p.value}</strong>
                </p>
            ))}
        </div>
    );
};

// ─── Fallback data ─────────────────────────────────────────
const FALLBACK_CHART = [
    { month: 'Aug', inward: 180, outward: 120 },
    { month: 'Sep', inward: 220, outward: 155 },
    { month: 'Oct', inward: 195, outward: 170 },
    { month: 'Nov', inward: 280, outward: 200 },
    { month: 'Dec', inward: 310, outward: 225 },
    { month: 'Jan', inward: 350, outward: 265 },
    { month: 'Feb', inward: 410, outward: 290 },
];

const FALLBACK_TEAMS = [
    { name: 'UG Team', sub: 'Undergraduate Block', icon: 'ug', pct: 85, stat: 12, statLabel: 'Pending', avgTime: 1.2, hasOverdue: false, color: '#2f81f7' },
    { name: 'PG Team', sub: 'Postgraduate & PRO', icon: 'pg', pct: 92, stat: 84, statLabel: 'Pending', avgTime: 0.8, hasOverdue: false, color: '#d29922' },
    { name: 'PhD Team', sub: 'Research Wing', icon: 'phd', pct: 64, stat: 28, statLabel: 'Overdue', avgTime: 3.4, hasOverdue: true, color: '#f85149' },
];

const FALLBACK_ACTIVITY = [
    { id: 1, color: '#2f81f7', team: 'UG Team', teamColor: '#2f81f7', text: 'completed outward response', ref: '#OUT-992', time: '09:42 AM', attachment: null },
    { id: 2, color: '#f0a500', team: null, text: 'New inward #INW-2023-899 logged by Admin', ref: null, time: '10:15 AM', attachment: 'Receipt.pdf' },
    { id: 3, color: '#f85149', team: 'PhD Team', teamColor: '#f85149', text: 'has 3 items overdue > 48hrs.', ref: null, time: '11:30 AM', isAlert: true, attachment: null },
    { id: 4, color: '#8b949e', team: null, text: 'System backup completed successfully.', ref: null, time: 'Yesterday', attachment: null },
    { id: 5, color: '#f0a500', team: 'PG Team', teamColor: '#d29922', text: 'assigned 5 new tasks.', ref: null, time: 'Yesterday', attachment: null },
];

// ─── Helpers ───────────────────────────────────────────────
const toDate = (v) => {
    if (!v) return null;
    try { return v._seconds ? new Date(v._seconds * 1000) : new Date(v); }
    catch { return null; }
};

const formatActivityTime = (v) => {
    const d = toDate(v);
    if (!d) return 'Recently';
    const diff = Math.floor((Date.now() - d) / 86400000);
    if (diff === 0) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
    if (diff === 1) return 'Yesterday';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
};

const generateChartData = (inwardEntries, outwardEntries) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const data = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (6 - i), 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const count = (arr) => arr.filter(e => {
            const dt = toDate(e.signReceiptDateTime || e.createdAt);
            return dt && `${dt.getFullYear()}-${dt.getMonth()}` === key;
        }).length;
        return { month: months[d.getMonth()], inward: count(inwardEntries), outward: count(outwardEntries) };
    });
    return data.some(d => d.inward > 0 || d.outward > 0) ? data : FALLBACK_CHART;
};

// ─── Team icon component ───────────────────────────────────
const TeamIcon = ({ type }) => {
    if (type === 'ug') return <GraduationCap size={17} />;
    if (type === 'pg') return <BookOpen size={17} />;
    return <Microscope size={17} />;
};

// ─── Main component ────────────────────────────────────────
const IntelligenceDashboard = () => {
    const navigate = useNavigate();

    const [stats, setStats] = useState(null);
    const [teamData, setTeamData] = useState(FALLBACK_TEAMS);
    const [chartData, setChartData] = useState(FALLBACK_CHART);
    const [recentActivity, setRecentActivity] = useState(FALLBACK_ACTIVITY);
    const [outwardTotal, setOutwardTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        try {
            const [statsRes, teamsRes, inwardRes, outwardRes] = await Promise.allSettled([
                dashboardAPI.getStats(),
                dashboardAPI.getAllTeams(),
                inwardAPI.getAll(),
                outwardAPI.getAll(),
            ]);

            // Stats
            if (statsRes.status === 'fulfilled') {
                setStats(statsRes.value.data?.stats || statsRes.value.data || null);
            }

            // Entries
            const inwardEntries = inwardRes.status === 'fulfilled'
                ? (inwardRes.value.data?.entries || inwardRes.value.data || []) : [];
            const outwardEntries = outwardRes.status === 'fulfilled'
                ? (outwardRes.value.data?.entries || outwardRes.value.data || []) : [];

            setOutwardTotal(outwardEntries.length);
            setChartData(generateChartData(inwardEntries, outwardEntries));

            // Team data
            if (teamsRes.status === 'fulfilled') {
                const rawTeams = teamsRes.value.data?.teams || teamsRes.value.data || [];
                if (rawTeams.length > 0) {
                    const META = {
                        UG: { name: 'UG Team', sub: 'Undergraduate Block', icon: 'ug', color: '#2f81f7' },
                        PG: { name: 'PG Team', sub: 'Postgraduate & PRO', icon: 'pg', color: '#d29922' },
                        PhD: { name: 'PhD Team', sub: 'Research Wing', icon: 'phd', color: '#f85149' },
                    };
                    setTeamData(rawTeams.map(t => {
                        const key = t.team || t.name || 'UG';
                        const meta = META[key] || { name: key, sub: 'Department', icon: 'ug', color: '#2f81f7' };
                        const total = (t.completed || 0) + (t.pending || 0);
                        const pct = total > 0 ? Math.round((t.completed / total) * 100) : 0;
                        const hasOverdue = (t.overdue || 0) > 0;
                        return {
                            ...meta, pct,
                            stat: hasOverdue ? (t.overdue || 0) : (t.pending || 0),
                            statLabel: hasOverdue ? 'Overdue' : 'Pending',
                            avgTime: t.avgTime || t.avgResolutionDays || 0,
                            hasOverdue,
                        };
                    }));
                }
            }

            // Recent activity from real entries
            if (inwardEntries.length > 0 || outwardEntries.length > 0) {
                const acts = [
                    ...outwardEntries.slice(0, 2).map(e => ({
                        id: e.id || Math.random(),
                        color: '#2f81f7',
                        team: e.createdByTeam ? `${e.createdByTeam} Team` : null,
                        teamColor: '#2f81f7',
                        text: e.createdByTeam ? 'completed outward response' : 'Outward entry created',
                        ref: e.outwardNo ? `#${e.outwardNo}` : null,
                        time: formatActivityTime(e.signReceiptDateTime || e.createdAt),
                        attachment: null,
                    })),
                    ...inwardEntries.slice(0, 3).map(e => ({
                        id: e.id || Math.random(),
                        color: '#f0a500',
                        team: null,
                        text: `New inward${e.inwardNo ? ' #' + e.inwardNo : ''} logged by Admin`,
                        ref: null,
                        time: formatActivityTime(e.signReceiptDateTime || e.createdAt),
                        attachment: null,
                    })),
                ];
                if (acts.length > 0) setRecentActivity(acts.slice(0, 5));
            }
        } catch (err) {
            console.error('Intelligence dashboard load error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    const s = {
        totalInward: stats?.totalInward || 0,
        totalOutward: outwardTotal || stats?.totalOutward || 0,
        pending: stats?.pendingWork || 0,
        urgent: stats?.urgent || Math.ceil((stats?.pendingWork || 0) * 0.19),
        avgRes: stats?.avgResolutionDays || stats?.avgTime || null,
    };

    return (
        <div className="id-root">
            {/* ── Header ── */}
            <header className="id-header">
                <div className="id-brand">
                    <div className="id-brand-icon"><Shield size={17} /></div>
                    <div>
                        <div className="id-brand-name">Luminous Depth</div>
                        <div className="id-brand-sub">SSSIHL ADMIN PORTAL</div>
                    </div>
                </div>

                <div className="id-search-wrap">
                    <Search size={14} className="id-search-ico" />
                    <input className="id-search-input" placeholder="Search correspondence..." />
                </div>

                <div className="id-header-right">
                    <button className="id-ico-btn" onClick={() => navigate('/admin')}>
                        <Bell size={17} />
                    </button>
                    <button className="id-ico-btn"><Settings size={17} /></button>
                    <div className="id-user">
                        <div className="id-user-text">
                            <span className="id-user-name">Admin User</span>
                            <span className="id-user-role">SUPER ADMIN</span>
                        </div>
                        <div className="id-avatar">AU</div>
                    </div>
                </div>
            </header>

            {/* ── Main ── */}
            <main className="id-main">

                {/* Title row */}
                <div className="id-title-row">
                    <div>
                        <h1 className="id-title">Intelligence Dashboard</h1>
                        <p className="id-subtitle">Operational throughput &amp; velocity analytics across all departments.</p>
                    </div>
                    <div className="id-title-actions">
                        <button className="id-btn-ghost">
                            <Calendar size={14} /> Last 30 Days
                        </button>
                        <button className="id-btn-primary">
                            <Download size={14} /> Export Report
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="id-stats-grid">
                    {[
                        { label: 'TOTAL INWARD', value: s.totalInward.toLocaleString(), badge: <><TrendingUp size={11} /> 12%</>, badgeClass: 'success', BgIcon: ArrowDownLeft },
                        { label: 'TOTAL OUTWARD', value: s.totalOutward.toLocaleString(), badge: <><TrendingUp size={11} /> 5%</>, badgeClass: 'success', BgIcon: Send },
                        { label: 'PENDING ACTIONS', value: s.pending, badge: <><AlertCircle size={11} /> {s.urgent} Urgent</>, badgeClass: 'warning', BgIcon: Layers },
                        { label: 'AVG RESOLUTION', value: s.avgRes ? `${s.avgRes}d` : '—', badge: <><TrendingDown size={11} /> 2%</>, badgeClass: 'danger', BgIcon: Clock },
                    ].map(({ label, value, badge, badgeClass, BgIcon }, i) => (
                        <div key={i} className="id-stat-card">
                            <div className="id-stat-bg-icon"><BgIcon size={52} /></div>
                            <div className="id-stat-label">{label}</div>
                            <div className="id-stat-value">{loading ? '—' : value}</div>
                            <span className={`id-stat-badge ${badgeClass}`}>{badge}</span>
                        </div>
                    ))}
                </div>

                {/* Chart + Activity */}
                <div className="id-mid-grid">
                    {/* Volume Analytics */}
                    <div className="id-card id-chart-card">
                        <div className="id-chart-hdr">
                            <div>
                                <h3 className="id-card-title">Volume Analytics</h3>
                                <p className="id-card-sub">Inward vs Outward correspondence over time</p>
                            </div>
                            <div className="id-legend">
                                <span><i className="id-dot" style={{ background: '#2f81f7' }} />Inward</span>
                                <span><i className="id-dot id-dot-outline" />Outward</span>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -22, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#2f81f7" stopOpacity={0.28} />
                                        <stop offset="95%" stopColor="#2f81f7" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f0a500" stopOpacity={0.22} />
                                        <stop offset="95%" stopColor="#f0a500" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="month" tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#8b949e', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.08)' }} />
                                <Area type="monotone" dataKey="inward" stroke="#2f81f7" strokeWidth={2.5} fill="url(#gIn)" dot={false} activeDot={{ r: 4, fill: '#2f81f7', strokeWidth: 0 }} />
                                <Area type="monotone" dataKey="outward" stroke="#f0a500" strokeWidth={2.5} fill="url(#gOut)" dot={false} activeDot={{ r: 4, fill: '#f0a500', strokeWidth: 0 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Recent Activity */}
                    <div className="id-card id-activity-card">
                        <div className="id-activity-hdr">
                            <h3 className="id-card-title">Recent Activity</h3>
                            <button className="id-ico-btn-sm"><MoreHorizontal size={15} /></button>
                        </div>
                        <div className="id-activity-list">
                            {recentActivity.map((item, i) => (
                                <div key={item.id || i} className="id-act-item">
                                    <span className="id-act-dot" style={{ background: item.color }} />
                                    <div className="id-act-body">
                                        <span className="id-act-time">{item.time}</span>
                                        <p className="id-act-text">
                                            {item.isAlert && 'Alert: '}
                                            {item.team && <span style={{ color: item.teamColor, fontWeight: 600 }}>{item.team}</span>}
                                            {item.team ? ` ${item.text}` : item.text}
                                            {item.ref && <span className="id-act-ref"> {item.ref}</span>}
                                        </p>
                                        {item.attachment && <span className="id-act-attach">📎 {item.attachment}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="id-view-log" onClick={() => navigate('/admin')}>
                            View Full Activity Log <ChevronRight size={13} />
                        </button>
                    </div>
                </div>

                {/* Team cards */}
                <div className="id-teams-grid">
                    {teamData.map((team, i) => (
                        <div key={i} className="id-card id-team-card" style={{ '--tc': team.color }}>
                            <div className="id-team-hdr">
                                <div>
                                    <h4 className="id-team-name">{team.name}</h4>
                                    <p className="id-team-sub">{team.sub}</p>
                                </div>
                                <span className="id-team-icon" style={{ color: team.color, background: `${team.color}22` }}>
                                    <TeamIcon type={team.icon} />
                                </span>
                            </div>
                            <div className="id-team-stats">
                                <CircleProgress pct={team.pct} color={team.color} size={72} />
                                <div className="id-team-nums">
                                    <div className="id-team-count" style={{ color: team.hasOverdue ? '#f85149' : '#f0f6fc' }}>
                                        {team.stat}
                                    </div>
                                    <div className="id-team-count-lbl">{team.statLabel}</div>
                                    <div className="id-team-avg">{team.avgTime}d <span>Avg Time</span></div>
                                </div>
                            </div>
                            <button
                                className={`id-team-btn${team.hasOverdue ? ' danger' : ''}`}
                                style={!team.hasOverdue ? { color: team.color, borderColor: `${team.color}66` } : {}}
                                onClick={() => navigate(`/team/${team.name.split(' ')[0].toLowerCase()}`)}
                            >
                                {team.hasOverdue ? 'Attention Needed' : 'View Details'}
                            </button>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default IntelligenceDashboard;
