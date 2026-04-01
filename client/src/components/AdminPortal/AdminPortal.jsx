import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { inwardAPI, dashboardAPI, outwardAPI, notesAPI } from '../../services/api';
import {
    Inbox, Plus, ClipboardList, Check, X, Search, Filter,
    Clock, CheckCircle2, AlertCircle, Calendar, Mail, User,
    FileText, RefreshCw, Eye, Edit3, ArrowDownToLine, Loader2, Download,
    Sun, Moon, ArrowLeft
} from 'lucide-react';
import './AdminPortal.css';

function AdminPortal() {
    const navigate = useNavigate();
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');
    const [userPhoto, setUserPhoto] = useState(null);
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
    const [notesEntries, setNotesEntries] = useState([]);
    const [notesTab, setNotesTab] = useState('REGISTRAR');
    const [showNotesForm, setShowNotesForm] = useState(false);
    const [notesFormData, setNotesFormData] = useState({ slNo: '', outwardNo: '', date: '', description: '', remarks: '' });
    const [notesLoading, setNotesLoading] = useState(false);

    const TEAM_EMAILS = {
        'UG': 'sathyajain9@gmail.com',
        'PG/PRO': 'saisathyajain@sssihl.edu.in',
        'PhD': 'results@sssihl.edu.in'
    };

    useEffect(() => {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    useEffect(() => {
        loadData();
        const user = localStorage.getItem('adminUser');
        if (user) {
            try { setUserPhoto(JSON.parse(user).picture); } catch (e) {}
        }
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
            setEntries(entriesRes.data.entries || []);
            setStats(statsRes.data.stats || {});
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
        try {
            const notesRes = await notesAPI.getAll();
            setNotesEntries(notesRes.data.entries || []);
        } catch (error) {
            console.error('Error loading notes:', error);
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
            const response = await inwardAPI.create(formData);
            console.log('Server Response:', response.data);

            let message = 'Inward entry created successfully!';
            if (response.data.emailStatus) {
                if (response.data.emailStatus === 'sent') {
                    message += ` Email sent to ${formData.assignedToEmail}`;
                } else if (response.data.emailStatus === 'skipped') {
                    console.warn('Email skipped');
                } else if (response.data.emailStatus.startsWith('failed')) {
                    message += `\n\nWarning: Email failed - ${response.data.emailStatus}`;
                    console.error('Email failed:', response.data.emailStatus);
                }
            }

            alert(message);
            setShowForm(false);
            resetForm();
            loadData();
        } catch (error) {
            console.error('Error creating entry:', error);
            alert('Error creating entry: ' + error.message);
        }
    };

    const handleReassign = async (e) => {
        e.preventDefault();
        try {
            const response = await inwardAPI.assign(selectedEntry.id, reassignData);
            console.log('Reassign Response:', response.data);

            let message = `Entry reassigned to ${reassignData.assignedTeam} team!`;

            if (response.data.emailStatus) {
                if (response.data.emailStatus === 'sent') {
                    message += ` Email sent to ${reassignData.assignedToEmail}`;
                } else if (response.data.emailStatus === 'skipped') {
                    console.warn('Email skipped');
                } else if (response.data.emailStatus.startsWith('failed')) {
                    message += `\n\nWarning: Email failed - ${response.data.emailStatus}`;
                    console.error('Email failed:', response.data.emailStatus);
                }
            } else if (response.data.message) {
                // Fallback for current message or if emailStatus wasn't provided
                if (response.data.emailStatus !== 'sent' && !response.data.emailStatus && response.data.message.includes('Notification sent')) {
                    // if it wasn't sent, do nothing more here to avoid confusion because backend sets custom message
                }
            }

            if (response.data.emailStatus && response.data.emailStatus.startsWith('failed')) {
                alert(message);
            } else {
                alert(response.data.message || message);
            }
            setShowReassignModal(false);
            setSelectedEntry(null);
            loadData();
        } catch (error) {
            console.error('Error reassigning:', error);
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
            if (name === 'assignedTeam') {
                newData.assignedToEmail = TEAM_EMAILS[value] || '';
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

    const downloadOutwardReport = async () => {
        try {
            const res = await outwardAPI.getAll();
            const entries = res.data.entries;

            // CSV Headers matching the required format
            const headers = ['Serial No.', 'Ack Rec', 'Cross No.', 'Date', 'File Reference', 'Address', 'Particular', 'Due Date', 'Receipt No.', 'Postal Amount'];

            // Convert entries to CSV rows
            const rows = entries.map((entry, index) => [
                index + 1,
                entry.ackRec || '',
                entry.crossNo || '',
                formatDate(entry.signReceiptDateTime),
                entry.fileReference || '',
                entry.toWhom || '',
                entry.subject || '',
                formatDate(entry.dueDate),
                entry.receiptNo || '',
                entry.postalTariff || 0
            ]);

            // Build CSV content
            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
            ].join('\n');

            // Download
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `Outward_Expenditure_Report_${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            URL.revokeObjectURL(link.href);
        } catch (error) {
            alert('Error downloading report: ' + error.message);
        }
    };

    const filteredNotes = notesEntries.filter(n => n.note_type === notesTab);

    const handleNotesSubmit = async (e) => {
        e.preventDefault();
        setNotesLoading(true);
        try {
            await notesAPI.create({ noteType: notesTab, ...notesFormData });
            setShowNotesForm(false);
            setNotesFormData({ slNo: '', outwardNo: '', date: '', description: '', remarks: '' });
            await loadData();
        } catch (err) {
            alert('Failed to save note: ' + err.message);
        } finally {
            setNotesLoading(false);
        }
    };

    const handleNoteDelete = async (id) => {
        if (!confirm('Delete this note?')) return;
        try {
            await notesAPI.remove(id);
            await loadData();
        } catch (err) {
            alert('Failed to delete note: ' + err.message);
        }
    };

    return (
        <div className="ap-page-wrapper">
            {/* Top Navbar */}
            <nav className="ap-top-nav">
                <div className="ap-nav-left">
                    <button className="ap-back-btn" onClick={() => navigate('/')} title="Back to home">
                        <ArrowLeft size={18} />
                    </button>
                    <img src="/sssihl-icon.jpg" alt="SSSIHL" style={{ width: '30px', height: '30px', borderRadius: '7px', objectFit: 'cover' }} />
                    <span className="ap-nav-brand">SSSIHL</span>
                </div>

                <div className="ap-nav-tabs">
                    <button className="ap-nav-tab active" onClick={() => navigate('/admin')}>
                        Registers
                    </button>
                    <button className="ap-nav-tab" onClick={() => navigate('/admin/dashboard')}>
                        Intelligence
                    </button>
                </div>

                <div className="ap-nav-right">
                    <button className="btn btn-secondary ap-nav-action-btn" onClick={downloadOutwardReport} title="Download Outward Expenditure Report">
                        <Download size={16} /> Export Report
                    </button>
                    <button className="btn btn-icon-only" onClick={loadData} disabled={loading} title="Refresh">
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    </button>
                    <button className="btn btn-primary ap-nav-action-btn" onClick={() => setShowForm(true)}>
                        <Plus size={16} /> New Entry
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

        <div className="admin-portal animate-fade">
            {/* Header */}
            <div className="page-header">
                <h2 className="page-title"><Inbox className="icon-svg" /> Admin Portal</h2>
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

            {/* Create Entry Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => { setShowForm(false); resetForm(); }}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Plus size={20} /> Create New Inward Entry</h3>
                            <button className="btn-close" onClick={() => { setShowForm(false); resetForm(); }}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body">
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
                                        <DatePicker
                                            selected={formData.signReceiptDateTime ? new Date(formData.signReceiptDateTime) : null}
                                            onChange={(date) => setFormData(prev => ({ ...prev, signReceiptDateTime: date ? date.toISOString() : '' }))}
                                            showTimeSelect
                                            timeFormat="HH:mm"
                                            timeIntervals={15}
                                            dateFormat="dd MMM yyyy, HH:mm"
                                            placeholderText="Select date & time"
                                            className="form-input"
                                            calendarClassName="ap-calendar"
                                            required
                                        />
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

                                <div className="section-block">
                                    <h4 className="section-title"><ClipboardList size={16} /> Team Assignment <span className="section-optional">(optional — can be done later)</span></h4>

                                    <div className="grid-2">
                                        <div className="form-group">
                                            <label className="form-label">Assign to Team</label>
                                            <select name="assignedTeam" className="form-select" value={formData.assignedTeam} onChange={handleChange}>
                                                <option value="">Leave Unassigned</option>
                                                <option value="UG">UG Team</option>
                                                <option value="PG/PRO">PG/PRO Team</option>
                                                <option value="PhD">PhD Team</option>
                                            </select>
                                        </div>
                                        {formData.assignedTeam && (
                                            <div className="form-group">
                                                <label className="form-label">Team Leader Email {formData.assignedTeam ? '*' : ''}</label>
                                                <input type="email" name="assignedToEmail" className="form-input"
                                                    value={formData.assignedToEmail} onChange={handleChange}
                                                    required={!!formData.assignedTeam}
                                                    placeholder="Auto-filled based on team" />
                                            </div>
                                        )}
                                    </div>

                                    {formData.assignedTeam && (
                                        <>
                                            <div className="grid-2">
                                                <div className="form-group">
                                                    <label className="form-label">Due Date</label>
                                                    <input type="date" name="dueDate" className="form-input"
                                                        value={formData.dueDate} onChange={handleChange} />
                                                </div>
                                            </div>

                                            <div className="form-group">
                                                <label className="form-label">Assignment Instructions</label>
                                                <textarea name="assignmentInstructions" className="form-textarea"
                                                    value={formData.assignmentInstructions} onChange={handleChange}
                                                    placeholder="Special instructions for the team..." rows={2} />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    <Check size={18} /> Create Entry
                                </button>
                            </div>
                        </form>
                    </div>
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
            {/* Notes Register Card */}
            <div className="card animate-fade" style={{ marginTop: '1.5rem' }}>
                <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 className="card-title">
                        <FileText size={20} /> Notes Register
                    </h3>
                    <button className="btn btn-primary" onClick={() => setShowNotesForm(true)}>
                        <Plus size={16} /> Add Note
                    </button>
                </div>
                <div className="notes-tab-bar">
                    <button className={notesTab === 'REGISTRAR' ? 'active' : ''} onClick={() => setNotesTab('REGISTRAR')}>
                        Notes to Registrar
                    </button>
                    <button className={notesTab === 'VC' ? 'active' : ''} onClick={() => setNotesTab('VC')}>
                        Notes to Vice Chancellor
                    </button>
                </div>
                {filteredNotes.length === 0 ? (
                    <div className="empty-state">
                        <FileText size={40} />
                        <p>No notes yet</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Sl No.</th>
                                    <th>Outward No.</th>
                                    <th>Date</th>
                                    <th>Description</th>
                                    <th>Remarks</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredNotes.map(n => (
                                    <tr key={n.id}>
                                        <td><strong>{n.sl_no}</strong></td>
                                        <td>{n.outward_no}</td>
                                        <td>{formatDate(n.date)}</td>
                                        <td className="subject-cell"><div className="subject-text">{n.description}</div></td>
                                        <td>{n.remarks || '-'}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="btn-icon" onClick={() => handleNoteDelete(n.id)} title="Delete">
                                                    <X size={16} />
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

            {/* Notes Form Modal */}
            {showNotesForm && (
                <div className="modal-overlay" onClick={() => setShowNotesForm(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><FileText size={20} /> Add Note — {notesTab === 'REGISTRAR' ? 'Registrar' : 'Vice Chancellor'}</h3>
                            <button className="btn-close" onClick={() => setShowNotesForm(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleNotesSubmit}>
                            <div className="modal-body">
                                <div className="grid-2">
                                    <div className="form-group">
                                        <label className="form-label">Sl No. *</label>
                                        <input className="form-input" required
                                            value={notesFormData.slNo}
                                            onChange={e => setNotesFormData(p => ({ ...p, slNo: e.target.value }))}
                                            placeholder="e.g. 1" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Outward No. *</label>
                                        <input className="form-input" required
                                            value={notesFormData.outwardNo}
                                            onChange={e => setNotesFormData(p => ({ ...p, outwardNo: e.target.value }))}
                                            placeholder="e.g. OTW/2025/001" />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Date *</label>
                                    <input type="date" className="form-input" required
                                        value={notesFormData.date}
                                        onChange={e => setNotesFormData(p => ({ ...p, date: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description *</label>
                                    <textarea className="form-textarea" required rows={3}
                                        value={notesFormData.description}
                                        onChange={e => setNotesFormData(p => ({ ...p, description: e.target.value }))}
                                        placeholder="Brief description of the note..." />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Remarks</label>
                                    <textarea className="form-textarea" rows={2}
                                        value={notesFormData.remarks}
                                        onChange={e => setNotesFormData(p => ({ ...p, remarks: e.target.value }))}
                                        placeholder="Any additional remarks..." />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowNotesForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={notesLoading}>
                                    <Check size={16} /> {notesLoading ? 'Saving…' : 'Save Note'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
        </div>
    );
}

export default AdminPortal;
