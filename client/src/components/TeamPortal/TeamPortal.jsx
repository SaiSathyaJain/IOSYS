import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { outwardAPI, inwardAPI, dashboardAPI } from '../../services/api';
import {
    Clock, CheckCircle, ArrowRight, AlertCircle, Calendar, Plus, X,
    ClipboardList, Check, FileText, Search, RefreshCw, Eye, Send,
    ArrowUpFromLine, Hourglass, Loader2, AlertTriangle, Link2, Lock, Mail
} from 'lucide-react';
import './TeamPortal.css';

function TeamPortal() {
    const navigate = useNavigate();
    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [pendingInward, setPendingInward] = useState([]);
    const [teamStats, setTeamStats] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedTeam, setSelectedTeam] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [formData, setFormData] = useState({
        means: '',
        toWhom: '',
        subject: '',
        sentBy: '',
        signReceiptDateTime: '',
        caseClosed: false,
        fileReference: '',
        postalTariff: '',
        dueDate: '',
        linkedInwardId: '',
        createdByTeam: '',
        teamMemberEmail: '',
        ackRec: '',
        crossNo: '',
        receiptNo: ''
    });

    useEffect(() => {
        loadData();
    }, [selectedTeam]);

    useEffect(() => {
        filterEntries();
    }, [entries, searchTerm]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [outwardRes, inwardRes] = await Promise.all([
                outwardAPI.getAll(selectedTeam),
                inwardAPI.getAll()
            ]);
            setEntries(outwardRes.data.entries || []);

            const pending = (inwardRes.data.entries || []).filter(e => {
                const matchesTeam = !selectedTeam || e.assignedTeam === selectedTeam;
                const matchesStatus = e.assignmentStatus === 'Pending' || e.assignmentStatus === 'In Progress';
                return e.assignedTeam && matchesTeam && matchesStatus;
            });
            setPendingInward(pending);

            // Load team stats if team selected
            if (selectedTeam) {
                const statsRes = await dashboardAPI.getTeamStats(selectedTeam);
                setTeamStats(statsRes.data.stats || {});
            } else {
                const statsRes = await dashboardAPI.getStats();
                const stats = statsRes.data.stats || {};
                setTeamStats({
                    totalAssigned: (stats.pendingWork || 0) + (stats.completedWork || 0),
                    pending: stats.pendingWork || 0,
                    completed: stats.completedWork || 0,
                    totalOutward: stats.totalOutward || 0
                });
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterEntries = () => {
        if (!searchTerm) {
            setFilteredEntries(entries);
            return;
        }
        const term = searchTerm.toLowerCase();
        const filtered = entries.filter(e =>
            e.outwardNo?.toLowerCase().includes(term) ||
            e.subject?.toLowerCase().includes(term) ||
            e.toWhom?.toLowerCase().includes(term)
        );
        setFilteredEntries(filtered);
    };

    const handleProcess = (inwardEntry) => {
        setFormData({
            ...formData,
            subject: `Re: ${inwardEntry.subject}`,
            toWhom: inwardEntry.particularsFromWhom,
            linkedInwardId: inwardEntry.id,
            createdByTeam: selectedTeam || inwardEntry.assignedTeam || '',
            fileReference: inwardEntry.fileReference || ''
        });
        setShowForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
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
            alert('Outward entry created successfully!');
            setShowForm(false);
            resetForm();
            loadData();
        } catch (error) {
            alert('Error creating entry: ' + error.message);
        }
    };

    const handleCloseCase = async (id) => {
        if (!window.confirm('Are you sure you want to close this case? This will also mark the linked inward entry as completed.')) {
            return;
        }
        try {
            await outwardAPI.closeCase(id);
            alert('Case closed successfully!');
            loadData();
            setShowDetailsModal(false);
        } catch (error) {
            alert('Error closing case: ' + error.message);
        }
    };

    const resetForm = () => {
        setFormData({
            means: '', toWhom: '', subject: '', sentBy: '',
            signReceiptDateTime: '', caseClosed: false, fileReference: '',
            postalTariff: '', dueDate: '', linkedInwardId: '',
            createdByTeam: selectedTeam || '', teamMemberEmail: '',
            ackRec: '', crossNo: '', receiptNo: ''
        });
    };

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
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

    const isOverdue = (dueDate) => {
        if (!dueDate) return false;
        const due = dueDate._seconds ? new Date(dueDate._seconds * 1000) : new Date(dueDate);
        return due < new Date();
    };

    const isDueSoon = (dueDate) => {
        if (!dueDate) return false;
        const due = dueDate._seconds ? new Date(dueDate._seconds * 1000) : new Date(dueDate);
        const today = new Date();
        const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 3;
    };

    const openDetailsModal = (entry) => {
        setSelectedEntry(entry);
        setShowDetailsModal(true);
    };

    return (
        <div className="team-portal animate-fade">
            {/* Header */}
            <div className="page-header">
                <h2 className="page-title"><Send className="icon-svg" /> Team Portal</h2>
                <div className="header-actions">
                    <select className="form-select team-filter" value={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value)}>
                        <option value="">All Teams</option>
                        <option value="UG">UG Team</option>
                        <option value="PG/PRO">PG/PRO Team</option>
                        <option value="PhD">PhD Team</option>
                    </select>
                    <button className="btn btn-icon-only" onClick={loadData} disabled={loading} title="Refresh">
                        <RefreshCw size={18} className={loading ? 'spin' : ''} />
                    </button>
                    <button className="btn btn-primary" onClick={() => {
                        setShowForm(!showForm);
                        if (!showForm) resetForm();
                    }}>
                        {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> New Outward</>}
                    </button>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="stats-grid">
                <div className="stat-card assignments">
                    <div className="stat-icon"><ClipboardList size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{teamStats?.totalAssigned || 0}</div>
                        <div className="stat-label">Total Assigned</div>
                    </div>
                </div>
                <div className="stat-card pending">
                    <div className="stat-icon"><Hourglass size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{teamStats?.pending || 0}</div>
                        <div className="stat-label">Pending</div>
                    </div>
                </div>
                <div className="stat-card completed">
                    <div className="stat-icon"><CheckCircle size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{teamStats?.completed || 0}</div>
                        <div className="stat-label">Completed</div>
                    </div>
                </div>
                <div className="stat-card outward">
                    <div className="stat-icon"><ArrowUpFromLine size={24} /></div>
                    <div className="stat-content">
                        <div className="stat-value">{teamStats?.totalOutward || 0}</div>
                        <div className="stat-label">Outward Sent</div>
                    </div>
                </div>
            </div>

            {/* Pending Assignments */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <Clock size={20} style={{ color: '#f59e0b' }} />
                        Pending Assignments
                        <span className="entry-count">({pendingInward.length})</span>
                    </h3>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <Loader2 size={40} className="spin" />
                        <p>Loading assignments...</p>
                    </div>
                ) : pendingInward.length === 0 ? (
                    <div className="empty-state success">
                        <CheckCircle size={48} />
                        <p>No pending assignments!</p>
                        <span>All caught up. Great work!</span>
                    </div>
                ) : (
                    <div className="assignments-grid">
                        {pendingInward.map(entry => (
                            <div key={entry.id} className={`assignment-card ${isOverdue(entry.dueDate) ? 'overdue' : isDueSoon(entry.dueDate) ? 'due-soon' : ''}`}>
                                <div className="assignment-header">
                                    <span className="inward-no">{entry.inwardNo}</span>
                                    <span className="badge badge-team">{entry.assignedTeam}</span>
                                </div>
                                <h4 className="assignment-subject">{entry.subject}</h4>
                                <p className="assignment-from">From: {entry.particularsFromWhom}</p>

                                {entry.assignmentInstructions && (
                                    <div className="assignment-instructions">
                                        <FileText size={14} />
                                        <span>{entry.assignmentInstructions}</span>
                                    </div>
                                )}

                                <div className="assignment-meta">
                                    {entry.dueDate && (
                                        <div className={`due-info ${isOverdue(entry.dueDate) ? 'overdue' : isDueSoon(entry.dueDate) ? 'due-soon' : ''}`}>
                                            {isOverdue(entry.dueDate) ? <AlertTriangle size={14} /> : <Calendar size={14} />}
                                            <span>{isOverdue(entry.dueDate) ? 'Overdue: ' : 'Due: '}{formatDate(entry.dueDate)}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="assignment-actions">
                                    <select
                                        className="form-select status-select"
                                        value={entry.assignmentStatus}
                                        onChange={(e) => handleStatusUpdate(entry.id, e.target.value)}
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="In Progress">In Progress</option>
                                    </select>
                                    <button className="btn btn-secondary btn-sm btn-icon-text" onClick={() => navigate('/team/messages')} title="Message Admin">
                                        <Mail size={14} />
                                    </button>
                                    <button className="btn btn-primary btn-sm" onClick={() => handleProcess(entry)}>
                                        Process <ArrowRight size={14} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Create Outward Form */}
            {showForm && (
                <div className="card form-card">
                    <h3 className="card-title"><Plus size={20} /> Create Outward Entry</h3>

                    {formData.linkedInwardId && (
                        <div className="linked-notice">
                            <Link2 size={16} />
                            <span>Linked to inward entry - this will mark it as completed</span>
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Your Team *</label>
                                <select name="createdByTeam" className="form-select" value={formData.createdByTeam} onChange={handleChange} required>
                                    <option value="">Select Team...</option>
                                    <option value="UG">UG Team</option>
                                    <option value="PG/PRO">PG/PRO Team</option>
                                    <option value="PhD">PhD Team</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Your Email *</label>
                                <input type="email" name="teamMemberEmail" className="form-input"
                                    value={formData.teamMemberEmail} onChange={handleChange} required
                                    placeholder="your@email.com" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Link to Inward Entry</label>
                            <select name="linkedInwardId" className="form-select" value={formData.linkedInwardId} onChange={handleChange}>
                                <option value="">No link - Independent outward</option>
                                {pendingInward.map(entry => (
                                    <option key={entry.id} value={entry.id}>
                                        {entry.inwardNo} - {entry.subject}
                                    </option>
                                ))}
                            </select>
                        </div>

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
                            <label className="form-label">To Whom *</label>
                            <input type="text" name="toWhom" className="form-input"
                                value={formData.toWhom} onChange={handleChange} required
                                placeholder="Recipient name or organization" />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Subject *</label>
                            <input type="text" name="subject" className="form-input"
                                value={formData.subject} onChange={handleChange} required
                                placeholder="Subject of the correspondence" />
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Sent By *</label>
                                <input type="text" name="sentBy" className="form-input"
                                    value={formData.sentBy} onChange={handleChange} required
                                    placeholder="Your name" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">File Reference</label>
                                <input type="text" name="fileReference" className="form-input"
                                    value={formData.fileReference} onChange={handleChange}
                                    placeholder="Optional file reference" />
                            </div>
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Postal Tariff (Rs.)</label>
                                <input type="number" name="postalTariff" className="form-input"
                                    value={formData.postalTariff} onChange={handleChange}
                                    placeholder="0" min="0" />
                            </div>
                            <div className="form-group checkbox-wrapper">
                                <label className="checkbox-label">
                                    <input type="checkbox" name="caseClosed"
                                        checked={formData.caseClosed} onChange={handleChange} />
                                    <span className="checkmark"></span>
                                    Mark Case as Closed
                                </label>
                            </div>
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Ack Rec</label>
                                <input type="text" name="ackRec" className="form-input"
                                    value={formData.ackRec} onChange={handleChange}
                                    placeholder="Acknowledgement received" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Cross No.</label>
                                <input type="text" name="crossNo" className="form-input"
                                    value={formData.crossNo} onChange={handleChange}
                                    placeholder="Cross reference number" />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Receipt No.</label>
                            <input type="text" name="receiptNo" className="form-input"
                                value={formData.receiptNo} onChange={handleChange}
                                placeholder="Receipt number" />
                        </div>

                        <button type="submit" className="btn btn-primary btn-lg">
                            <Check size={18} /> Create Outward Entry
                        </button>
                    </form>
                </div>
            )}

            {/* Outward History */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title">
                        <ClipboardList size={20} /> Outward History
                        <span className="entry-count">({filteredEntries.length})</span>
                    </h3>
                    <div className="search-box-small">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search outward..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <Loader2 size={40} className="spin" />
                        <p>Loading history...</p>
                    </div>
                ) : filteredEntries.length === 0 ? (
                    <div className="empty-state">
                        <ArrowUpFromLine size={48} />
                        <p>No outward entries yet</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Outward No</th>
                                    <th>Subject</th>
                                    <th>To</th>
                                    <th>Team</th>
                                    <th>Status</th>
                                    <th>Linked</th>
                                    <th>Date</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEntries.map(entry => (
                                    <tr key={entry.id}>
                                        <td><strong>{entry.outwardNo}</strong></td>
                                        <td className="subject-cell">{entry.subject}</td>
                                        <td>{entry.toWhom}</td>
                                        <td><span className="badge badge-team">{entry.createdByTeam}</span></td>
                                        <td>
                                            {entry.caseClosed ? (
                                                <span className="badge badge-completed"><Lock size={12} /> Closed</span>
                                            ) : (
                                                <span className="badge badge-pending">Open</span>
                                            )}
                                        </td>
                                        <td>
                                            {entry.linkedInwardId ? (
                                                <span className="badge badge-linked">
                                                    <Link2 size={12} /> Linked
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td>{formatDate(entry.createdAt)}</td>
                                        <td>
                                            <button className="btn-icon" onClick={() => openDetailsModal(entry)} title="View Details">
                                                <Eye size={16} />
                                            </button>
                                            {!entry.caseClosed && (
                                                <button className="btn-icon" onClick={() => handleCloseCase(entry.id)} title="Close Case" style={{ marginLeft: '0.5rem', color: '#10b981' }}>
                                                    <Lock size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Details Modal */}
            {showDetailsModal && selectedEntry && (
                <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><FileText size={20} /> Outward Details</h3>
                            <button className="btn-close" onClick={() => setShowDetailsModal(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-grid">
                                <div className="detail-item">
                                    <label>Outward No</label>
                                    <span className="detail-value highlight">{selectedEntry.outwardNo}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Team</label>
                                    <span className="badge badge-team">{selectedEntry.createdByTeam}</span>
                                </div>
                                <div className="detail-item full">
                                    <label>Subject</label>
                                    <span>{selectedEntry.subject}</span>
                                </div>
                                <div className="detail-item">
                                    <label>To</label>
                                    <span>{selectedEntry.toWhom}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Sent By</label>
                                    <span>{selectedEntry.sentBy}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Means</label>
                                    <span>{selectedEntry.means}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Date</label>
                                    <span>{formatDate(selectedEntry.signReceiptDateTime)}</span>
                                </div>
                                {selectedEntry.fileReference && (
                                    <div className="detail-item">
                                        <label>File Reference</label>
                                        <span>{selectedEntry.fileReference}</span>
                                    </div>
                                )}
                                {selectedEntry.postalTariff > 0 && (
                                    <div className="detail-item">
                                        <label>Postal Tariff</label>
                                        <span>Rs. {selectedEntry.postalTariff}</span>
                                    </div>
                                )}
                                <div className="detail-item">
                                    <label>Linked Inward</label>
                                    <span>{selectedEntry.linkedInwardId || 'None'}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Case Closed</label>
                                    <span>{selectedEntry.caseClosed ? 'Yes' : 'No'}</span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            {!selectedEntry.caseClosed && (
                                <button className="btn btn-primary" onClick={() => handleCloseCase(selectedEntry.id)}>
                                    <Lock size={16} /> Close Case
                                </button>
                            )}
                            <button className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TeamPortal;
