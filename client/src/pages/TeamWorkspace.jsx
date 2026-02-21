import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bell, Search, Edit2, Plus, Clock, FileText, CheckCircle, ArrowRight, Loader2, X, Lock, Link2, Calendar } from 'lucide-react';
import { dashboardAPI, inwardAPI, outwardAPI } from '../services/api';
import './TeamWorkspace.css';

const TEAM_MAP = { 'ug': 'UG', 'pg-pro': 'PG/PRO', 'phd': 'PhD' };

const TeamWorkspace = () => {
    const { teamId } = useParams();
    const navigate = useNavigate();
    const selectedTeam = TEAM_MAP[teamId] || '';

    const [activeTab, setActiveTab] = useState('history');
    const [entries, setEntries] = useState([]);
    const [pendingInward, setPendingInward] = useState([]);
    const [teamStats, setTeamStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        means: '', toWhom: '', subject: '', sentBy: '',
        signReceiptDateTime: '', caseClosed: false, fileReference: '',
        postalTariff: '', dueDate: '', linkedInwardId: '',
        createdByTeam: selectedTeam || '', teamMemberEmail: '',
        ackRec: '', crossNo: '', receiptNo: ''
    });

    useEffect(() => {
        if (!selectedTeam) navigate('/team');
        loadData();
        loadEntries();
    }, [selectedTeam]);

    const loadData = async () => {
        setLoading(true);
        try {
            const inwardRes = await inwardAPI.getAll();
            const pending = (inwardRes.data.entries || []).filter(e => {
                const matchesTeam = e.assignedTeam === selectedTeam;
                const matchesStatus = e.assignmentStatus === 'Pending' || e.assignmentStatus === 'In Progress';
                return matchesTeam && matchesStatus;
            });
            setPendingInward(pending);

            if (selectedTeam) {
                const statsRes = await dashboardAPI.getTeamStats(selectedTeam);
                setTeamStats(statsRes.data.stats || {});
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadEntries = async () => {
        try {
            const outwardRes = await outwardAPI.getAll(selectedTeam);
            setEntries(outwardRes.data.entries || []);
        } catch (error) {
            console.error(error);
        }
    };

    const handleProcess = (inwardEntry) => {
        setFormData({
            ...formData,
            subject: `Re: ${inwardEntry.subject}`,
            toWhom: inwardEntry.particularsFromWhom,
            linkedInwardId: inwardEntry.id,
            createdByTeam: selectedTeam,
            fileReference: inwardEntry.fileReference || ''
        });
        setShowForm(true);
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await inwardAPI.updateStatus(id, status);
            loadData();
        } catch (error) {
            alert('Error updating status: ' + error.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await outwardAPI.create(formData);
            if (formData.teamMemberEmail) {
                localStorage.setItem('teamUser', JSON.stringify({ email: formData.teamMemberEmail.trim(), type: 'team' }));
            }
            alert('Outward entry created successfully!');
            setShowForm(false);
            resetForm();
            loadData();
            loadEntries();
        } catch (error) {
            alert('Error creating entry: ' + error.message);
        }
    };

    const handleCloseCase = async (id) => {
        if (!window.confirm('Are you sure you want to close this case? This will also mark the linked inward entry as completed.')) return;
        try {
            await outwardAPI.closeCase(id);
            alert('Case closed successfully!');
            loadEntries();
            loadData();
        } catch (error) {
            alert('Error closing case: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            means: '', toWhom: '', subject: '', sentBy: '',
            signReceiptDateTime: '', caseClosed: false, fileReference: '',
            postalTariff: '', dueDate: '', linkedInwardId: '',
            createdByTeam: selectedTeam, teamMemberEmail: '',
            ackRec: '', crossNo: '', receiptNo: ''
        });
    };

    const formatDate = (dateValue) => {
        if (!dateValue) return '-';
        try {
            const date = dateValue._seconds ? new Date(dateValue._seconds * 1000) : new Date(dateValue);
            return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return '-'; }
    };

    const isOverdue = (dueDate) => {
        if (!dueDate) return false;
        const due = dueDate._seconds ? new Date(dueDate._seconds * 1000) : new Date(dueDate);
        return due < new Date();
    };

    const filteredOutward = entries.filter(e =>
        !searchTerm || e.outwardNo?.toLowerCase().includes(searchTerm.toLowerCase()) || e.subject?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="team-workspace">
            {/* Header */}
            <header className="workspace-header">
                <div className="header-brand interactive" onClick={() => navigate('/team')}>
                    <div className="logo-icon-small">🎓</div>
                    <div>
                        <h2 className="brand-title">Luminous Depth</h2>
                        <p className="brand-subtitle">SSSIHL Team Workspace</p>
                    </div>
                </div>

                <div className="header-nav">
                    <button className="nav-tab active">Workspace</button>
                    <button className="nav-tab" onClick={() => { loadData(); loadEntries(); }}>Refresh</button>
                </div>

                <div className="header-actions">
                    <button className="icon-btn">
                        <Bell size={18} />
                        <span className="badge"></span>
                    </button>
                    <div className="user-profile-small">
                        <div className="user-text">
                            <span className="user-name">{selectedTeam} Team</span>
                            <span className="user-role">Department</span>
                        </div>
                        <img src="https://i.pravatar.cc/150?img=12" alt="Avatar" className="avatar" />
                    </div>
                </div>
            </header>

            <main className="workspace-main">
                {/* Left Column: Pending Tasks */}
                <div className="task-sidebar animate-stagger-1">
                    <div className="sidebar-header">
                        <h3>Pending Assignments <span className="count-badge">{pendingInward.length}</span></h3>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            Completed: {teamStats?.completed || 0} / {teamStats?.totalAssigned || 0}
                        </div>
                    </div>

                    <div className="task-list">
                        {loading ? (
                            <div style={{ textAlign: 'center', padding: '2rem' }}>
                                <Loader2 size={24} className="spin" />
                            </div>
                        ) : pendingInward.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                                <CheckCircle size={32} style={{ margin: '0 auto 1rem', color: 'var(--status-success)' }} />
                                <p>All caught up!</p>
                            </div>
                        ) : (
                            pendingInward.map((task, idx) => (
                                <div key={task.id} className="task-card interactive glass-card" style={{ animationDelay: `${idx * 0.1}s` }}>
                                    <div className="task-meta">
                                        <span className="task-id">{task.inwardNo}</span>
                                        <span className={`due-badge ${isOverdue(task.dueDate) ? 'danger' : 'warning'}`}>
                                            {task.dueDate && <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} />{formatDate(task.dueDate)}</span>}
                                        </span>
                                    </div>
                                    <h4>{task.subject}</h4>
                                    <p>From: {task.particularsFromWhom}</p>
                                    {task.assignmentInstructions && <div style={{ fontSize: '12px', marginTop: '8px', fontStyle: 'italic' }}><FileText size={12} /> {task.assignmentInstructions}</div>}

                                    <div className="task-footer" style={{ marginTop: '1rem' }}>
                                        <select
                                            value={task.assignmentStatus}
                                            onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                                            style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}
                                        >
                                            <option value="Pending">Pending</option>
                                            <option value="In Progress">In Progress</option>
                                        </select>
                                        <button className="process-btn" onClick={() => handleProcess(task)}>
                                            Process <ArrowRight size={14} style={{ marginLeft: '4px' }} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Right Column: Main Work Area */}
                <div className="work-area animate-stagger-2">
                    <div className="work-area-panel glass-card">

                        {/* Tabs */}
                        <div className="panel-tabs">
                            <button
                                className={`panel-tab ${activeTab === 'history' ? 'active' : ''}`}
                                onClick={() => setActiveTab('history')}
                            >
                                <Clock size={16} /> Outward History
                            </button>

                            <div className="search-wrapper" style={{ marginLeft: 'auto' }}>
                                <Search size={14} className="search-icon" />
                                <input type="text" placeholder="Search outward..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                            </div>
                        </div>

                        {/* List Header */}
                        <div className="list-header" style={{ gridTemplateColumns: '1.2fr 1fr 2fr 1.5fr 1fr' }}>
                            <div className="col-draft-id">OUTWARD NO</div>
                            <div className="col-ref">REF INWARD</div>
                            <div className="col-subject">SUBJECT / TO</div>
                            <div className="col-date">DATE</div>
                            <div className="col-action">ACTION</div>
                        </div>

                        {/* List Content */}
                        <div className="list-content">
                            {filteredOutward.length === 0 ? (
                                <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No outward entries found.</div>
                            ) : (
                                filteredOutward.map((entry, idx) => (
                                    <div key={entry.id} className="list-row interactive-row" style={{ gridTemplateColumns: '1.2fr 1fr 2fr 1.5fr 1fr' }}>
                                        <div className="col-draft-id code-font">{entry.outwardNo}</div>
                                        <div className="col-ref code-font text-muted">
                                            {entry.linkedInwardId ? <Link2 size={12} /> : '-'} {entry.linkedInwardId || 'None'}
                                        </div>
                                        <div className="col-subject">
                                            <div className="subject-title">{entry.subject}</div>
                                            <div className="subject-meta">To: {entry.toWhom}</div>
                                        </div>
                                        <div className="col-date text-muted">{formatDate(entry.createdAt)}</div>
                                        <div className="col-action">
                                            {entry.caseClosed ? (
                                                <span style={{ fontSize: '12px', color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '4px' }}><Lock size={12} /> Closed</span>
                                            ) : (
                                                <button onClick={() => handleCloseCase(entry.id)} style={{ fontSize: '12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', padding: '4px 8px', color: 'var(--text-primary)', cursor: 'pointer' }}>Close Case</button>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* FAB */}
                        <button className="fab-button btn-primary animate-stagger-3" onClick={() => { resetForm(); setShowForm(true); }}>
                            <Plus size={20} /> CREATE OUTWARD ENTRY
                        </button>
                    </div>
                </div>
            </main>

            {/* Modal for Creating Outward */}
            {showForm && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="glass-card" style={{ width: '600px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2>{formData.linkedInwardId ? 'Process Assignment' : 'Create Outward Entry'}</h2>
                            <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer' }}><X size={24} /></button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>YOUR EMAIL *</label>
                                    <input type="email" name="teamMemberEmail" value={formData.teamMemberEmail} onChange={e => setFormData({ ...formData, teamMemberEmail: e.target.value })} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>MEANS *</label>
                                    <select name="means" value={formData.means} onChange={e => setFormData({ ...formData, means: e.target.value })} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }}>
                                        <option value="">Select...</option>
                                        <option value="Post">Post</option>
                                        <option value="Email">Email</option>
                                        <option value="Hand Delivery">Hand Delivery</option>
                                        <option value="Courier">Courier</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>TO WHOM *</label>
                                <input type="text" name="toWhom" value={formData.toWhom} onChange={e => setFormData({ ...formData, toWhom: e.target.value })} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                            </div>

                            <div>
                                <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>SUBJECT *</label>
                                <input type="text" name="subject" value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>SENT BY *</label>
                                    <input type="text" name="sentBy" value={formData.sentBy} onChange={e => setFormData({ ...formData, sentBy: e.target.value })} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>DATE & TIME *</label>
                                    <input type="datetime-local" name="signReceiptDateTime" value={formData.signReceiptDateTime} onChange={e => setFormData({ ...formData, signReceiptDateTime: e.target.value })} required style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>POSTAL TARIFF (RS)</label>
                                    <input type="number" name="postalTariff" value={formData.postalTariff} onChange={e => setFormData({ ...formData, postalTariff: e.target.value })} style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-primary)' }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '24px' }}>
                                    <input type="checkbox" name="caseClosed" checked={formData.caseClosed} onChange={e => setFormData({ ...formData, caseClosed: e.target.checked })} id="caseClosed" style={{ width: '18px', height: '18px' }} />
                                    <label htmlFor="caseClosed" style={{ color: 'var(--status-danger)' }}>Mark Case as Closed</label>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
                                <button type="button" onClick={() => setShowForm(false)} style={{ padding: '10px 20px', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" style={{ padding: '10px 20px', background: 'var(--primary-color)', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Submit Outward</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamWorkspace;
