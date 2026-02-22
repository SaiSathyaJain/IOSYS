import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronDown, CheckCircle, Clock, AlertCircle, FileText, ArrowLeft, Loader2, RefreshCw, Sun, Moon } from 'lucide-react';
import { dashboardAPI, inwardAPI } from '../services/api';
import './AdminDashboard.css';

const AdminDashboard = () => {
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [adminUserPhoto, setAdminUserPhoto] = useState("https://ui-avatars.com/api/?name=Admin&background=random");
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');

    useEffect(() => {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    useEffect(() => {
        loadData();
        const user = localStorage.getItem('adminUser');
        if (user) {
            try {
                setAdminUserPhoto(JSON.parse(user).picture);
            } catch (e) { }
        }
    }, []);

    useEffect(() => {
        if (searchQuery) {
            const term = searchQuery.toLowerCase();
            setFilteredEntries(entries.filter(e =>
                e.inwardNo?.toLowerCase().includes(term) ||
                e.subject?.toLowerCase().includes(term) ||
                e.particularsFromWhom?.toLowerCase().includes(term)
            ));
        } else {
            setFilteredEntries(entries);
        }
    }, [searchQuery, entries]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [entriesRes, statsRes] = await Promise.all([
                inwardAPI.getAll(),
                dashboardAPI.getStats()
            ]);
            setEntries(entriesRes.data.entries || []);
            setStats(statsRes.data.stats || {});
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateValue) => {
        if (!dateValue) return '-';
        try {
            const date = dateValue._seconds ? new Date(dateValue._seconds * 1000) : new Date(dateValue);
            return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return '-'; }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'Completed': return 'success';
            case 'In Progress': return 'warning';
            case 'Pending': return 'warning';
            default: return 'danger';
        }
    };

    const renderStats = [
        { label: 'TOTAL INWARDS', value: stats?.totalInward || 0, trend: 'All Time', trendColor: 'var(--text-secondary)', icon: <FileText size={24} /> },
        { label: 'PENDING', value: stats?.pendingWork || 0, trend: 'Action Req', trendColor: 'var(--status-danger)', icon: <Clock size={24} /> },
        { label: 'COMPLETED', value: stats?.completedWork || 0, trend: 'Done', trendColor: 'var(--status-success)', icon: <CheckCircle size={24} /> },
        { label: 'UNASSIGNED', value: stats?.unassigned || 0, trend: 'Needs Team', trendColor: 'var(--status-warning)', icon: <AlertCircle size={24} /> },
    ];

    return (
        <div className="admin-dashboard">
            {/* Top Header */}
            <header className="dashboard-header">
                <div className="header-left">
                    <button className="back-btn" onClick={() => navigate('/')}>
                        <ArrowLeft size={20} />
                    </button>
                    <div className="logo-small" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <img src="/sssihl-icon.jpg" alt="SSSIHL" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }} />
                        SSSIHL <span>| Correspondence</span>
                    </div>
                </div>
                <div className="header-nav">
                    <button className="nav-tab active">Dashboard</button>
                    <button className="nav-tab" onClick={() => navigate('/admin/intelligence')}>Intelligence</button>
                    <button className="nav-tab" onClick={loadData}>
                        <RefreshCw size={14} className={loading ? 'spin' : ''} style={{ marginRight: '6px' }} /> Refresh
                    </button>
                </div>
                <div className="header-user">
                    <button className="back-btn" onClick={() => setIsDarkMode(!isDarkMode)} title="Toggle theme">
                        {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                    <div className="user-info">
                        <span className="name">Admin User</span>
                        <span className="role">Administrator</span>
                    </div>
                    <img src={adminUserPhoto} alt="Profile" className="avatar-small" />
                </div>
            </header>

            <main className="dashboard-content">
                <div className="page-title animate-stagger-1">
                    <h1>Entry Management</h1>
                    <p>Monitor, route, and manage all incoming correspondence across the institution.</p>
                </div>

                {/* Stats Row */}
                <div className="stats-grid animate-stagger-2">
                    {renderStats.map((stat, idx) => (
                        <div key={idx} className="stat-card glass-card">
                            <div className="stat-header">
                                <span className="stat-label">{stat.label}</span>
                                <div className="stat-icon">{stat.icon}</div>
                            </div>
                            <div className="stat-value">{loading ? '...' : stat.value}</div>
                            <div className="stat-trend" style={{ color: stat.trendColor }}>
                                {stat.trend}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Action Bar */}
                <div className="action-bar animate-stagger-3">
                    <div className="search-box">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search by ID, Subject, or Sender..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <button
                        className="btn-primary"
                        onClick={() => navigate('/admin/entry')}
                    >
                        + NEW ENTRY
                    </button>
                </div>

                {/* Table Area */}
                <div className="table-container glass-card animate-stagger-3">
                    {loading ? (
                        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            <Loader2 size={32} className="spin" style={{ margin: '0 auto 1rem' }} />
                            <p>Loading entries...</p>
                        </div>
                    ) : (
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>ID REF</th>
                                    <th>SUBJECT / DETAILS</th>
                                    <th>SENDER / DEPT</th>
                                    <th>TEAM</th>
                                    <th>STATUS</th>
                                    <th>DUE DATE</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEntries.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>No entries found.</td>
                                    </tr>
                                ) : (
                                    filteredEntries.map((entry, idx) => (
                                        <tr key={idx} className="interactive-row">
                                            <td className="cell-id">{entry.inwardNo || 'N/A'}</td>
                                            <td className="cell-subject">{entry.subject}</td>
                                            <td className="cell-sender">{entry.particularsFromWhom}</td>
                                            <td>{entry.assignedTeam || '-'}</td>
                                            <td>
                                                <span className={`status-badge ${getStatusColor(entry.assignmentStatus)}`}>
                                                    {entry.assignmentStatus || 'Unassigned'}
                                                </span>
                                            </td>
                                            <td className="cell-date">{formatDate(entry.dueDate)}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
