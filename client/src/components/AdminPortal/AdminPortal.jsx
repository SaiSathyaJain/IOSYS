import { useState, useEffect } from 'react';
import { inwardAPI, dashboardAPI } from '../../services/api';
import {
    Inbox, Plus, ClipboardList, Check, X, Search, Filter,
    Clock, CheckCircle2, AlertCircle, Calendar, Mail, User,
    FileText, RefreshCw, Eye, Edit3, ArrowDownToLine, Loader2
} from 'lucide-react';
import './AdminPortal.css';

function AdminPortal() {
    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [stats, setStats] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [teamFilter, setTeamFilter] = useState('all');
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [reassignData, setReassignData] = useState({
        assignedTeam: '',
        assignedToEmail: '',
        assignmentInstructions: '',
        dueDate: ''
    });
    const [formData, setFormData] = useState({
        means: '',
        particularsFromWhom: '',
        subject: '',
        signReceiptDateTime: '',
        assignedTeam: '',
        assignedToEmail: '',
        assignmentInstructions: '',
        dueDate: ''
    });

    const TEAM_EMAILS = {
        'UG': 'sathyajain9@gmail.com',
        'PG/PRO': 'saisathyajain@sssihl.edu.in',
        'PhD': 'results@sssihl.edu.in'
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        filterEntries();
    }, [entries, searchTerm, statusFilter, teamFilter]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [entriesRes, statsRes] = await Promise.all([
                inwardAPI.getAll(),
                dashboardAPI.getStats()
            ]);
            setEntries(entriesRes.data.entries);
            setStats(statsRes.data.stats);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterEntries = () => {
        let filtered = [...entries];

        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(e =>
                e.inwardNo?.toLowerCase().includes(term) ||
                e.subject?.toLowerCase().includes(term) ||
                e.particularsFromWhom?.toLowerCase().includes(term)
            );
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(e => e.assignmentStatus === statusFilter);
        }

        if (teamFilter !== 'all') {
            filtered = filtered.filter(e => e.assignedTeam === teamFilter);
        }

        setFilteredEntries(filtered);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await inwardAPI.create(formData);
            alert('Inward entry created successfully!');
            setShowForm(false);
            resetForm();
            loadData();
        } catch (error) {
            alert('Error creating entry: ' + error.message);
        }
    };

    const handleReassign = async (e) => {
        e.preventDefault();
        try {
            await inwardAPI.assign(selectedEntry.id, reassignData);
            alert(`Entry reassigned to ${reassignData.assignedTeam} team!`);
            setShowReassignModal(false);
            setSelectedEntry(null);
            loadData();
        } catch (error) {
            alert('Error reassigning: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            means: '', particularsFromWhom: '', subject: '',
            signReceiptDateTime: '', assignedTeam: '', assignedToEmail: '',
            assignmentInstructions: '', dueDate: ''
        });
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = { ...prev, [name]: value };
            if (name === 'assignedTeam' && TEAM_EMAILS[value]) {
                newData.assignedToEmail = TEAM_EMAILS[value];
            }
            return newData;
        });
    };

    const handleReassignChange = (e) => {
        const { name, value } = e.target;
        setReassignData(prev => {
            const newData = { ...prev, [name]: value };
            if (name === 'assignedTeam' && TEAM_EMAILS[value]) {
                newData.assignedToEmail = TEAM_EMAILS[value];
            }
            return newData;
        });
    };

    const openDetailsModal = (entry) => {
        setSelectedEntry(entry);
        setShowModal(true);
    };

    const openReassignModal = (entry) => {
        setSelectedEntry(entry);
        setReassignData({
            assignedTeam: entry.assignedTeam || '',
            assignedToEmail: entry.assignedToEmail || '',
            assignmentInstructions: entry.assignmentInstructions || '',
            dueDate: entry.dueDate ? formatDateForInput(entry.dueDate) : ''
        });
        setShowReassignModal(true);
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

    const formatDateForInput = (dateValue) => {
        if (!dateValue) return '';
        try {
            const date = dateValue._seconds
                ? new Date(dateValue._seconds * 1000)
                : new Date(dateValue);
            return date.toISOString().split('T')[0];
        } catch {
            return '';
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

    const isOverdue = (dueDate, status) => {
        if (!dueDate || status === 'Completed') return false;
        const due = dueDate._seconds ? new Date(dueDate._seconds * 1000) : new Date(dueDate);
        return due < new Date();
    };

    return (
        <div className="admin-portal animate-fade">
            {/* Header */}
            <div className="page-header">
                <h2 className="page-title"><Inbox className="icon-svg" /> Admin Portal</h2>
                <div className="header-actions">
                    <button className="btn btn-icon-only" onClick={loadData} disabled={loading} title="Refresh">
                        <RefreshCw size={18} className={loading ? 'spin' : ''} />
                    </button>
                    <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                        {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> New Entry</>}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card total">
                    <div className="stat-icon"><ArrowDownToLine size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.totalInward || 0}</div>
                        <div className="stat-label">Total Inward</div>
                    </div>
                </div>
                <div className="stat-card pending">
                    <div className="stat-icon"><Clock size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.pendingWork || 0}</div>
                        <div className="stat-label">Pending</div>
                    </div>
                </div>
                <div className="stat-card completed">
                    <div className="stat-icon"><CheckCircle2 size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.completedWork || 0}</div>
                        <div className="stat-label">Completed</div>
                    </div>
                </div>
                <div className="stat-card unassigned">
                    <div className="stat-icon"><AlertCircle size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{stats?.unassigned || 0}</div>
                        <div className="stat-label">Unassigned</div>
                    </div>
                </div>
            </div>

            {/* Search & Filters */}
            <div className="filters-bar">
                <div className="search-box">
                    <Search size={18} className="search-icon" />
                    <input
                        type="text"
                        placeholder="Search by number, subject, or sender..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                </div>
                <div className="filter-group">
                    <Filter size={18} />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="filter-select">
                        <option value="all">All Status</option>
                        <option value="Unassigned">Unassigned</option>
                        <option value="Pending">Pending</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Completed">Completed</option>
                    </select>
                    <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="filter-select">
                        <option value="all">All Teams</option>
                        <option value="UG">UG Team</option>
                        <option value="PG/PRO">PG/PRO Team</option>
                        <option value="PhD">PhD Team</option>
                    </select>
                </div>
            </div>

            {/* Create Form */}
            {showForm && (
                <div className="card form-card">
                    <h3 className="card-title"><Plus size={20} /> Create New Inward Entry</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Means *</label>
                                <select name="means" className="form-select" value={formData.means} onChange={handleChange} required>
                                    <option value="">Select...</option>
                                    <option value="Post">Post</option>
                                    <option value="Email">Email</option>
                                    <option value="Hand Delivery">Hand Delivery</option>
                                    <option value="Courier">Courier</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date & Time *</label>
                                <input type="datetime-local" name="signReceiptDateTime" className="form-input"
                                    value={formData.signReceiptDateTime} onChange={handleChange} required />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">From Whom *</label>
                            <input type="text" name="particularsFromWhom" className="form-input"
                                value={formData.particularsFromWhom} onChange={handleChange} required
                                placeholder="Name or organization" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Subject *</label>
                            <input type="text" name="subject" className="form-input"
                                value={formData.subject} onChange={handleChange} required
                                placeholder="Brief description of the correspondence" />
                        </div>

                        <hr className="divider" />
                        <h4 className="section-title"><ClipboardList size={20} /> Team Assignment</h4>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Assign to Team *</label>
                                <select name="assignedTeam" className="form-select" value={formData.assignedTeam} onChange={handleChange} required>
                                    <option value="">Select Team...</option>
                                    <option value="UG">UG Team</option>
                                    <option value="PG/PRO">PG/PRO Team</option>
                                    <option value="PhD">PhD Team</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Team Leader Email *</label>
                                <input type="email" name="assignedToEmail" className="form-input"
                                    value={formData.assignedToEmail} onChange={handleChange} required
                                    placeholder="Auto-filled based on team" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Due Date</label>
                            <input type="date" name="dueDate" className="form-input"
                                value={formData.dueDate} onChange={handleChange} />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Assignment Instructions</label>
                            <textarea name="assignmentInstructions" className="form-textarea"
                                value={formData.assignmentInstructions} onChange={handleChange}
                                placeholder="Special instructions for the team..." rows={3} />
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg">
                            <Check size={18} /> Create Entry
                        </button>
                    </form>
                </div>
            )}

            {/* Entries Table */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <ClipboardList size={20} /> Inward Entries
                        <span className="entry-count">({filteredEntries.length})</span>
                    </h3>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <Loader2 size={40} className="spin" />
                        <p>Loading entries...</p>
                    </div>
                ) : filteredEntries.length === 0 ? (
                    <div className="empty-state">
                        <Inbox size={48} />
                        <p>No entries found</p>
                        {(searchTerm || statusFilter !== 'all' || teamFilter !== 'all') && (
                            <button className="btn btn-secondary" onClick={() => {
                                setSearchTerm('');
                                setStatusFilter('all');
                                setTeamFilter('all');
                            }}>Clear Filters</button>
                        )}
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Inward No</th>
                                    <th>Subject</th>
                                    <th>From</th>
                                    <th>Team</th>
                                    <th>Status</th>
                                    <th>Due Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEntries.map(entry => (
                                    <tr key={entry.id} className={isOverdue(entry.dueDate, entry.assignmentStatus) ? 'overdue-row' : ''}>
                                        <td><strong>{entry.inwardNo}</strong></td>
                                        <td className="subject-cell">
                                            <div className="subject-text">{entry.subject}</div>
                                        </td>
                                        <td>{entry.particularsFromWhom}</td>
                                        <td>
                                            {entry.assignedTeam ? (
                                                <span className="badge badge-team">{entry.assignedTeam}</span>
                                            ) : (
                                                <span className="badge badge-none">-</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge badge-${getStatusColor(entry.assignmentStatus)}`}>
                                                {entry.assignmentStatus || 'Unassigned'}
                                            </span>
                                        </td>
                                        <td>
                                            {entry.dueDate ? (
                                                <span className={`due-date ${isOverdue(entry.dueDate, entry.assignmentStatus) ? 'overdue' : ''}`}>
                                                    <Calendar size={14} />
                                                    {formatDate(entry.dueDate)}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="btn-icon" onClick={() => openDetailsModal(entry)} title="View Details">
                                                    <Eye size={16} />
                                                </button>
                                                <button className="btn-icon" onClick={() => openReassignModal(entry)} title="Reassign">
                                                    <Edit3 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {showModal && selectedEntry && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><FileText size={20} /> Entry Details</h3>
                            <button className="btn-close" onClick={() => setShowModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-grid">
                                <div className="detail-item">
                                    <label>Inward No</label>
                                    <span className="detail-value highlight">{selectedEntry.inwardNo}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Status</label>
                                    <span className={`badge badge-${getStatusColor(selectedEntry.assignmentStatus)}`}>
                                        {selectedEntry.assignmentStatus || 'Unassigned'}
                                    </span>
                                </div>
                                <div className="detail-item full">
                                    <label>Subject</label>
                                    <span>{selectedEntry.subject}</span>
                                </div>
                                <div className="detail-item">
                                    <label><User size={14} /> From</label>
                                    <span>{selectedEntry.particularsFromWhom}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Means</label>
                                    <span>{selectedEntry.means}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Received</label>
                                    <span>{formatDate(selectedEntry.signReceiptDateTime)}</span>
                                </div>
                                {selectedEntry.assignedTeam && (
                                    <>
                                        <div className="detail-item">
                                            <label>Team</label>
                                            <span className="badge badge-team">{selectedEntry.assignedTeam}</span>
                                        </div>
                                        <div className="detail-item">
                                            <label><Mail size={14} /> Team Email</label>
                                            <span>{selectedEntry.assignedToEmail}</span>
                                        </div>
                                    </>
                                )}
                                <div className="detail-item">
                                    <label><Calendar size={14} /> Due Date</label>
                                    <span className={isOverdue(selectedEntry.dueDate, selectedEntry.assignmentStatus) ? 'overdue' : ''}>
                                        {formatDate(selectedEntry.dueDate)}
                                    </span>
                                </div>
                                {selectedEntry.assignmentInstructions && (
                                    <div className="detail-item full">
                                        <label>Instructions</label>
                                        <span className="instructions">{selectedEntry.assignmentInstructions}</span>
                                    </div>
                                )}
                                {selectedEntry.completionDate && (
                                    <div className="detail-item">
                                        <label>Completed</label>
                                        <span>{formatDate(selectedEntry.completionDate)}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                            <button className="btn btn-primary" onClick={() => {
                                setShowModal(false);
                                openReassignModal(selectedEntry);
                            }}>
                                <Edit3 size={16} /> Reassign
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reassign Modal */}
            {showReassignModal && selectedEntry && (
                <div className="modal-overlay" onClick={() => setShowReassignModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Edit3 size={20} /> Reassign Entry</h3>
                            <button className="btn-close" onClick={() => setShowReassignModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleReassign}>
                            <div className="modal-body">
                                <p className="modal-info">
                                    Reassigning: <strong>{selectedEntry.inwardNo}</strong> - {selectedEntry.subject}
                                </p>

                                <div className="form-group">
                                    <label className="form-label">Assign to Team *</label>
                                    <select name="assignedTeam" className="form-select"
                                        value={reassignData.assignedTeam} onChange={handleReassignChange} required>
                                        <option value="">Select Team...</option>
                                        <option value="UG">UG Team</option>
                                        <option value="PG/PRO">PG/PRO Team</option>
                                        <option value="PhD">PhD Team</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Team Leader Email *</label>
                                    <input type="email" name="assignedToEmail" className="form-input"
                                        value={reassignData.assignedToEmail} onChange={handleReassignChange} required />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Due Date</label>
                                    <input type="date" name="dueDate" className="form-input"
                                        value={reassignData.dueDate} onChange={handleReassignChange} />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Instructions</label>
                                    <textarea name="assignmentInstructions" className="form-textarea"
                                        value={reassignData.assignmentInstructions} onChange={handleReassignChange}
                                        placeholder="Updated instructions..." rows={3} />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowReassignModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    <Check size={16} /> Reassign
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default AdminPortal;
