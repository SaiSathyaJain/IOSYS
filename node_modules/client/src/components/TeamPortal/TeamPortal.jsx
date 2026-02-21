import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { outwardAPI, inwardAPI, dashboardAPI } from '../../services/api';
import {
    Clock, CheckCircle, ArrowRight, Calendar, Plus, X,
    ClipboardList, Check, FileText, Search, RefreshCw, Eye,
    ArrowUpFromLine, Hourglass, Loader2, AlertTriangle, Link2, Lock, ChevronLeft
} from 'lucide-react';
import './TeamPortal.css';

const TEAM_MAP = { 'ug': 'UG', 'pg-pro': 'PG/PRO', 'phd': 'PhD' };

function TeamPortal() {
    const { teamSlug } = useParams();
    const navigate = useNavigate();
    const selectedTeam = TEAM_MAP[teamSlug] || '';

    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [pendingInward, setPendingInward] = useState([]);
    const [teamStats, setTeamStats] = useState(null);
    const [viewTeam, setViewTeam] = useState(selectedTeam);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
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
        loadEntries();
    }, [viewTeam]);

    useEffect(() => {
        filterEntries();
    }, [entries, searchTerm]);

    // Loads pending assignments + stats (always scoped to own team)
    const loadData = async () => {
        setLoading(true);
        try {
            const inwardRes = await inwardAPI.getAll();

            const pending = (inwardRes.data.entries || []).filter(e => {
                const matchesTeam = !selectedTeam || e.assignedTeam === selectedTeam;
                const matchesStatus = e.assignmentStatus === 'Pending' || e.assignmentStatus === 'In Progress';
                return e.assignedTeam && matchesTeam && matchesStatus;
            });
            setPendingInward(pending);

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

    // Loads outward entries for the currently viewed team (may differ from own team)
    const loadEntries = async () => {
        try {
            const outwardRes = await outwardAPI.getAll(viewTeam);
            setEntries(outwardRes.data.entries || []);
        } catch (error) {
            console.error('Error loading entries:', error);
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

            // Save user email to localStorage for Messages access
            if (formData.teamMemberEmail) {
                const user = { email: formData.teamMemberEmail.trim(), type: 'team' };
                localStorage.setItem('teamUser', JSON.stringify(user));
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
        if (!window.confirm('Are you sure you want to close this case? This will also mark the linked inward entry as completed.')) {
            return;
        }
        try {
            await outwardAPI.closeCase(id);
            alert('Case closed successfully!');
            loadEntries();
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
            <div className="tp-header">
                <div className="tp-header-left">
                    <button className="tp-back-btn" onClick={() => navigate('/team')}>
                        <ChevronLeft size={16} /> All Teams
                    </button>
                    <h2 className="tp-title">{selectedTeam} Team Portal</h2>
                    <p className="tp-subtitle">{selectedTeam} — Assignments &amp; Outward Entries</p>
                </div>
                <div className="tp-header-right">
                    <button className="tp-refresh-btn" onClick={() => { loadData(); loadEntries(); }} disabled={loading} title="Refresh">
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="tp-stats">
                <div className="tp-stat tp-stat-blue">
                    <ClipboardList size={18} />
                    <div>
                        <div className="tp-stat-num">{teamStats?.totalAssigned || 0}</div>
                        <div className="tp-stat-lbl">Total Assigned</div>
                    </div>
                </div>
                <div className="tp-stat tp-stat-amber">
                    <Hourglass size={18} />
                    <div>
                        <div className="tp-stat-num">{teamStats?.pending || 0}</div>
                        <div className="tp-stat-lbl">Pending</div>
                    </div>
                </div>
                <div className="tp-stat tp-stat-green">
                    <CheckCircle size={18} />
                    <div>
                        <div className="tp-stat-num">{teamStats?.completed || 0}</div>
                        <div className="tp-stat-lbl">Completed</div>
                    </div>
                </div>
                <div className="tp-stat tp-stat-indigo">
                    <ArrowUpFromLine size={18} />
                    <div>
                        <div className="tp-stat-num">{teamStats?.totalOutward || 0}</div>
                        <div className="tp-stat-lbl">Outward Sent</div>
                    </div>
                </div>
            </div>

            {/* Pending Assignments */}
            <div className="tp-section">
                <div className="tp-section-header">
                    <div className="tp-section-title">
                        <Clock size={16} />
                        Pending Assignments
                        <span className="tp-count">{pendingInward.length}</span>
                    </div>
                </div>

                {loading ? (
                    <div className="tp-loading">
                        <Loader2 size={32} className="spin" />
                        <span>Loading...</span>
                    </div>
                ) : pendingInward.length === 0 ? (
                    <div className="tp-empty">
                        <CheckCircle size={40} />
                        <p>All caught up! No pending assignments.</p>
                    </div>
                ) : (
                    <div className="tp-assignments-wrap">
                    <div className="tp-assignments">
                        {pendingInward.map(entry => (
                            <div key={entry.id} className={`tp-assignment-item ${isOverdue(entry.dueDate) ? 'overdue' : isDueSoon(entry.dueDate) ? 'due-soon' : ''}`}>
                                <div className="tp-ai-top">
                                    <div className="tp-ai-meta">
                                        <span className="tp-ai-no">{entry.inwardNo}</span>
                                        <span className="tp-badge-team">{entry.assignedTeam}</span>
                                        {entry.dueDate && (
                                            <span className={`tp-due ${isOverdue(entry.dueDate) ? 'overdue' : isDueSoon(entry.dueDate) ? 'soon' : ''}`}>
                                                {isOverdue(entry.dueDate) ? <AlertTriangle size={12} /> : <Calendar size={12} />}
                                                {isOverdue(entry.dueDate) ? 'Overdue: ' : 'Due: '}{formatDate(entry.dueDate)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="tp-ai-body">
                                    <h4 className="tp-ai-subject">{entry.subject}</h4>
                                    <p className="tp-ai-from">From: {entry.particularsFromWhom}</p>
                                    {entry.assignmentInstructions && (
                                        <div className="tp-ai-note">
                                            <FileText size={12} />
                                            {entry.assignmentInstructions}
                                        </div>
                                    )}
                                </div>
                                <div className="tp-ai-actions">
                                    <select className="tp-status-select" value={entry.assignmentStatus}
                                        onChange={(e) => handleStatusUpdate(entry.id, e.target.value)}>
                                        <option value="Pending">Pending</option>
                                        <option value="In Progress">In Progress</option>
                                    </select>
                                    <button className="tp-process-btn" onClick={() => handleProcess(entry)}>
                                        Process <ArrowRight size={13} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    </div>
                )}
            </div>

            {/* Create Outward Form — Modal */}
            {showForm && (
                <div className="modal-overlay drawer-overlay" onClick={() => { setShowForm(false); resetForm(); }}>
                    <div className="modal drawer" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Plus size={20} /> Create Outward Entry</h3>
                            <button className="btn-close" onClick={() => { setShowForm(false); resetForm(); }}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            {formData.linkedInwardId && (
                                <div className="linked-notice">
                                    <Link2 size={16} />
                                    <span>Linked to inward entry — this will mark it as completed</span>
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
                                <div className="modal-footer" style={{padding: '1rem 0 0', border: 'none'}}>
                                    <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm(); }}>
                                        Cancel
                                    </button>
                                    <button type="submit" className="btn btn-primary">
                                        <Check size={18} /> Create Outward Entry
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}

            {/* Outward History */}
            <div className="tp-section">
                <div className="tp-section-header">
                    <div className="tp-section-title">
                        <ClipboardList size={16} />
                        Outward History
                        {viewTeam !== selectedTeam && <span className="tp-view-label"> — {viewTeam} Team</span>}
                        <span className="tp-count">{filteredEntries.length}</span>
                    </div>
                    <div className="tp-view-tabs">
                        <button
                            className={`tp-view-tab${viewTeam === selectedTeam ? ' active' : ''}`}
                            onClick={() => setViewTeam(selectedTeam)}
                        >My Team</button>
                        {Object.entries(TEAM_MAP)
                            .filter(([, name]) => name !== selectedTeam)
                            .map(([slug, name]) => (
                                <button
                                    key={slug}
                                    className={`tp-view-tab${viewTeam === name ? ' active' : ''}`}
                                    onClick={() => setViewTeam(name)}
                                >{name}</button>
                            ))
                        }
                    </div>
                    <div className="tp-search">
                        <Search size={14} />
                        <input type="text" placeholder="Search..." value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)} />
                    </div>
                </div>

                {loading ? (
                    <div className="tp-loading">
                        <Loader2 size={32} className="spin" />
                        <span>Loading...</span>
                    </div>
                ) : filteredEntries.length === 0 ? (
                    <div className="tp-empty">
                        <ArrowUpFromLine size={40} />
                        <p>No outward entries yet.</p>
                    </div>
                ) : (
                    <div className="tp-table-wrap">
                        <table className="tp-table">
                            <thead>
                                <tr>
                                    <th>Outward No</th>
                                    <th>Subject</th>
                                    <th>To</th>
                                    <th>Team</th>
                                    <th>Status</th>
                                    <th>Date</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEntries.map(entry => (
                                    <tr key={entry.id}>
                                        <td className="tp-outward-no">{entry.outwardNo}</td>
                                        <td className="tp-subject-cell">{entry.subject}</td>
                                        <td>{entry.toWhom}</td>
                                        <td><span className="tp-badge-team">{entry.createdByTeam}</span></td>
                                        <td>
                                            <div className="tp-status-cell">
                                                {entry.caseClosed
                                                    ? <span className="tp-badge-closed"><Lock size={10} /> Closed</span>
                                                    : <span className="tp-badge-open">Open</span>}
                                                {entry.linkedInwardId &&
                                                    <span className="tp-badge-linked"><Link2 size={10} /> Linked</span>}
                                            </div>
                                        </td>
                                        <td className="tp-date">{formatDate(entry.createdAt)}</td>
                                        <td>
                                            <div className="tp-row-actions">
                                                <button onClick={() => openDetailsModal(entry)} title="View">
                                                    <Eye size={14} />
                                                </button>
                                                {!entry.caseClosed && viewTeam === selectedTeam && (
                                                    <button onClick={() => handleCloseCase(entry.id)} title="Close Case" className="close-btn">
                                                        <Lock size={14} />
                                                    </button>
                                                )}
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
                            {!selectedEntry.caseClosed && viewTeam === selectedTeam && (
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
