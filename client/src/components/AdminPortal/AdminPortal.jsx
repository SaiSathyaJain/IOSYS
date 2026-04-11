import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { inwardAPI, dashboardAPI, outwardAPI, notesAPI, auditAPI, aiAPI } from '../../services/api';
import {
    Inbox, Plus, ClipboardList, Check, X, Search, Filter,
    Clock, CheckCircle2, AlertCircle, Calendar, Mail, User,
    FileText, RefreshCw, Eye, Edit3, ArrowDownToLine, Loader2, Download,
    Sun, Moon, ArrowLeft, Printer, Sparkles
} from 'lucide-react';
import ChatBot from '../ChatBot/ChatBot';
import './AdminPortal.css';

const ALLOWED_EMAIL = 'coeofficeinward@sssihl.edu.in';

function AdminPortal() {
    const navigate = useNavigate();
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');
    const [adminUser, setAdminUser] = useState(() => {
        try { return JSON.parse(localStorage.getItem('adminUser')); } catch { return null; }
    });
    const [userPhoto, setUserPhoto] = useState(null);
    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [stats, setStats] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [tooltip, setTooltip] = useState({ text: '', x: 0, y: 0, visible: false });
    const [adminPage, setAdminPage] = useState('registers');
    const [auditLogs, setAuditLogs] = useState([]);
    const [auditPage, setAuditPage] = useState(1);
    const [auditTotalPages, setAuditTotalPages] = useState(1);
    const [auditTotal, setAuditTotal] = useState(0);
    const [auditLoading, setAuditLoading] = useState(false);
    const [inwardPage, setInwardPage] = useState(1);
    const INWARD_PAGE_SIZE = 20;
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [teamFilter, setTeamFilter] = useState('all');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [showReassignModal, setShowReassignModal] = useState(false);
    const [closingModal, setClosingModal] = useState(null); // 'details' | 'reassign' | 'form' | 'notes' | 'assignSuccess'
    const [assignSuccess, setAssignSuccess] = useState(null); // { inwardNo, team, email, subject }
    const [createSuccess, setCreateSuccess] = useState(null); // { inwardNo, subject } — no team assigned

    const closeWithAnimation = (which, fn) => {
        setClosingModal(which);
        setTimeout(() => { setClosingModal(null); fn(); }, 190);
    };
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
        signReceiptDateTime: new Date().toISOString(),
        assignedTeam: '',
        assignedToEmail: '',
        assignmentInstructions: '',
        dueDate: '',
        remarks: ''
    });
    const [smartFillLoading, setSmartFillLoading] = useState(false);
    const [smartFillResult, setSmartFillResult] = useState(null);
    const [printDate, setPrintDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [notesEntries, setNotesEntries] = useState([]);
    const [notesTab, setNotesTab] = useState('REGISTRAR');
    const [showNotesForm, setShowNotesForm] = useState(false);
    const [notesFormData, setNotesFormData] = useState({ slNo: '', outwardNo: '', date: '', description: '', remarks: '' });
    const [notesLoading, setNotesLoading] = useState(false);

    const TEAM_EMAILS = {
        'UG': 'coeoffice@sssihl.edu.in',
        'PG/PRO': 'coeoffice@sssihl.edu.in',
        'PhD': 'coeoffice@sssihl.edu.in'
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
    }, [entries, searchTerm, statusFilter, teamFilter, dateFrom, dateTo]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [entriesRes, statsRes] = await Promise.all([
                inwardAPI.getAll(),
                dashboardAPI.getStats()
            ]);
            setEntries(entriesRes.data.entries || []);
            setStats(statsRes.data.stats || {});
            setInwardPage(1);
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

        if (dateFrom) {
            const from = new Date(dateFrom);
            filtered = filtered.filter(e => {
                const d = e.signReceiptDatetime ? new Date(e.signReceiptDatetime) : null;
                return d && d >= from;
            });
        }

        if (dateTo) {
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);
            filtered = filtered.filter(e => {
                const d = e.signReceiptDatetime ? new Date(e.signReceiptDatetime) : null;
                return d && d <= to;
            });
        }

        setFilteredEntries(filtered);
        setInwardPage(1);
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

            const newId = response.data.id;
            if (formData.assignedTeam && newId) {
                await inwardAPI.assign(newId, {
                    assignedTeam: formData.assignedTeam,
                    assignedToEmail: formData.assignedToEmail,
                    assignmentInstructions: formData.assignmentInstructions,
                    dueDate: formData.dueDate
                });
                setAssignSuccess({
                    inwardNo: response.data.inwardNo,
                    team: formData.assignedTeam,
                    email: formData.assignedToEmail,
                    subject: formData.subject,
                });
            } else {
                setCreateSuccess({
                    inwardNo: response.data.inwardNo,
                    subject: formData.subject,
                });
            }
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

            setAssignSuccess({
                inwardNo: selectedEntry.inwardNo,
                team: reassignData.assignedTeam,
                email: reassignData.assignedToEmail,
                subject: selectedEntry.subject,
            });
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
            signReceiptDateTime: new Date().toISOString(), assignedTeam: '', assignedToEmail: '',
            assignmentInstructions: '', dueDate: '', remarks: ''
        });
        setSmartFillResult(null);
    };

    const handleSmartFill = async () => {
        const subject = formData.subject.trim();
        if (!subject) return;
        setSmartFillLoading(true);
        setSmartFillResult(null);
        try {
            const res = await aiAPI.extract(subject);
            const fields = res.data.fields || {};
            const filled = [];
            setFormData(prev => {
                const next = { ...prev };
                // Don't overwrite subject — user already typed it
                if (fields.assignedTeam) { next.assignedTeam = fields.assignedTeam; next.assignedToEmail = TEAM_EMAILS[fields.assignedTeam] || ''; filled.push('Team'); }
                if (fields.dueDate)      { next.dueDate = fields.dueDate;            filled.push('Due Date'); }
                if (fields.remarks)      { next.remarks = fields.remarks;            filled.push('Remarks'); }
                return next;
            });
            setSmartFillResult(filled.length > 0 ? `✓ Filled: ${filled.join(', ')}` : 'Could not determine team or due date from subject.');
        } catch (err) {
            setSmartFillResult('Error: ' + (err.response?.data?.message || err.message));
        } finally {
            setSmartFillLoading(false);
        }
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
                formatDate(entry.signReceiptDatetime),
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

    const handleGoogleSuccess = (credentialResponse) => {
        try {
            const payload = JSON.parse(atob(credentialResponse.credential.split('.')[1]));
            if (payload.email !== ALLOWED_EMAIL) {
                alert(`Access denied. Only ${ALLOWED_EMAIL} is authorised.`);
                return;
            }
            const user = { email: payload.email, name: payload.name, picture: payload.picture };
            localStorage.setItem('adminUser', JSON.stringify(user));
            setAdminUser(user);
        } catch {
            alert('Login failed. Please try again.');
        }
    };

    const handleLogout = () => {
        googleLogout();
        localStorage.removeItem('adminUser');
        setAdminUser(null);
    };

    if (!adminUser) {
        return (
            <div className="ap-login-screen" data-theme={isDarkMode ? 'dark' : 'light'}>
                <div className="ap-login-card">
                    <img src="/sssihl-icon.jpg" alt="SSSIHL" className="ap-login-logo" />
                    <h2 className="ap-login-title">Admin Portal</h2>
                    <p className="ap-login-sub">Sign in with your authorised SSSIHL Google account to continue.</p>
                    <div className="ap-login-btn-wrap">
                        <GoogleLogin
                            onSuccess={handleGoogleSuccess}
                            onError={() => alert('Google login failed. Please try again.')}
                            theme={isDarkMode ? 'filled_black' : 'outline'}
                            size="large"
                            shape="rectangular"
                            text="signin_with"
                        />
                    </div>
                    <p className="ap-login-hint">Only <strong>{ALLOWED_EMAIL}</strong> has access.</p>
                </div>
            </div>
        );
    }

    const handlePrint = async () => {
        const [yyyy, mm, dd] = printDate.split('-');
        const displayDate = `${dd}/${mm}/${yyyy}`;

        let allEntries = entries;
        try {
            const res = await inwardAPI.getAll();
            allEntries = res.data.entries || [];
        } catch (e) {
            console.warn('Using cached entries for print');
        }

        // Extract date from inwardNo (format: INW/DD/MM/YYYY-NNNN)
        const dayEntries = allEntries.filter(e => {
            const match = (e.inwardNo || '').match(/^INW\/(\d{2})\/(\d{2})\/(\d{4})-/);
            if (!match) return false;
            const [, d, m, y] = match;
            return `${y}-${m}-${d}` === printDate;
        });

        const rows = dayEntries.map((e, i) => `
            <tr>
                <td>${i + 1}</td>
                <td>${e.inwardNo || '-'}</td>
                <td>${e.means || '-'}</td>
                <td>${(e.particularsFromWhom || '-').replace(/</g, '&lt;')}</td>
                <td>${(e.subject || '-').replace(/</g, '&lt;')}</td>
                <td>${e.assignedTeam || '-'}</td>
                <td>${(e.fileReference || '-').replace(/</g, '&lt;')}</td>
                <td>${(e.remarks || '-').replace(/</g, '&lt;')}</td>
                <td></td>
            </tr>`).join('');

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Inward Register — ${displayDate}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; padding: 24px; color: #111; }
    .header { text-align: center; margin-bottom: 16px; }
    .header h2 { font-size: 15px; font-weight: 700; letter-spacing: 0.02em; }
    .header p { font-size: 11px; color: #555; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { background: #1d4ed8; color: #fff; font-weight: 600; padding: 6px 8px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    td { padding: 5px 8px; border-bottom: 1px solid #ddd; vertical-align: top; }
    tr:nth-child(even) td { background: #f8fafc; }
    .footer { margin-top: 14px; font-size: 9px; color: #999; text-align: right; }
    @page { size: landscape; margin: 15mm; }
  </style>
</head>
<body>
  <div class="header">
    <h2>SSSIHL — Inward Register</h2>
    <p>Date: <strong>${displayDate}</strong> &nbsp;|&nbsp; Total Entries: <strong>${dayEntries.length}</strong></p>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:4%">Sl.</th>
        <th style="width:13%">Inward No.</th>
        <th style="width:7%">Mode</th>
        <th style="width:13%">From</th>
        <th style="width:20%">Particulars</th>
        <th style="width:9%">Assigned To</th>
        <th style="width:10%">File Ref</th>
        <th style="width:12%">Remarks</th>
        <th style="width:12%">Signature</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="8" style="text-align:center;padding:16px;color:#888;">No entries found for this date</td></tr>'}
    </tbody>
  </table>
  <div class="footer">Printed on ${new Date().toLocaleString('en-IN')} &mdash; SSSIHL Inward/Outward System</div>
</body>
</html>`;

        const win = window.open('', '_blank');
        if (!win) { alert('Please allow pop-ups for this site and try again.'); return; }
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 500);
    };

    const loadAuditLogs = async (page = 1) => {
        setAuditLoading(true);
        try {
            const res = await auditAPI.getLogs(page);
            setAuditLogs(res.data.logs || []);
            setAuditTotalPages(res.data.totalPages || 1);
            setAuditTotal(res.data.total || 0);
            setAuditPage(page);
        } catch (err) {
            console.error('Error loading audit logs:', err);
        } finally {
            setAuditLoading(false);
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
                    <button className={`ap-nav-tab${adminPage === 'registers' ? ' active' : ''}`} onClick={() => setAdminPage('registers')}>
                        Registers
                    </button>
                    <button className="ap-nav-tab" onClick={() => navigate('/admin/dashboard')}>
                        Intelligence
                    </button>
                    <button className={`ap-nav-tab${adminPage === 'auditlog' ? ' active' : ''}`} onClick={() => { setAdminPage('auditlog'); loadAuditLogs(1); }}>
                        Audit Log
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
                    <div className="ap-user-pill" style={{ cursor: 'pointer' }} onClick={handleLogout} title="Sign out">
                        <div className="ap-user-info">
                            <span className="ap-user-role">{adminUser.name || 'Admin'}</span>
                            <span className="ap-user-status">
                                <span className="ap-online-dot" />
                                Sign out
                            </span>
                        </div>
                        <div className="ap-avatar-wrap">
                            <img src={adminUser.picture || "https://ui-avatars.com/api/?name=Admin&background=475569&color=ffffff"} alt="Profile" className="ap-avatar" />
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


            {/* Create Entry Modal */}
            {showForm && (
                <div className={`modal-overlay${closingModal === 'form' ? ' closing' : ''}`} onClick={() => closeWithAnimation('form', () => { setShowForm(false); resetForm(); })}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Plus size={20} /> Create New Inward Entry</h3>
                            <button className="btn-close" onClick={() => closeWithAnimation('form', () => { setShowForm(false); resetForm(); })}>
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
                                        <label className="form-label">Date *</label>
                                        <DatePicker
                                            selected={formData.signReceiptDateTime ? new Date(formData.signReceiptDateTime) : null}
                                            onChange={(date) => {
                                                if (date) {
                                                    const now = new Date();
                                                    date.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
                                                }
                                                setFormData(prev => ({ ...prev, signReceiptDateTime: date ? date.toISOString() : '' }));
                                            }}
                                            dateFormat="dd MMM yyyy"
                                            placeholderText="Select date"
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
                                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <span>Subject *</span>
                                        {smartFillResult && (
                                            <span className={`smart-fill-result${smartFillResult.startsWith('Error') ? ' smart-fill-result--error' : ''}`}>
                                                {smartFillResult}
                                            </span>
                                        )}
                                    </label>
                                    <div className="smart-fill-input-wrap">
                                        <input type="text" name="subject" className="form-input"
                                            value={formData.subject} onChange={e => { handleChange(e); setSmartFillResult(null); }} required
                                            placeholder="Type subject then click ✦ to auto-fill team, due date & remarks" />
                                        <button
                                            type="button"
                                            className={`smart-fill-btn${smartFillLoading ? ' loading' : ''}`}
                                            onClick={handleSmartFill}
                                            disabled={smartFillLoading || !formData.subject.trim()}
                                            title="Auto-fill from subject"
                                        >
                                            {smartFillLoading
                                                ? <Loader2 size={14} className="spin-icon" />
                                                : <Sparkles size={14} />
                                            }
                                        </button>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Remarks</label>
                                    <textarea name="remarks" className="form-textarea"
                                        value={formData.remarks} onChange={handleChange}
                                        placeholder="Any remarks..." rows={2} />
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
                                <button type="button" className="btn btn-secondary" onClick={() => closeWithAnimation('form', () => { setShowForm(false); resetForm(); })}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    <Check size={18} /> Create Entry
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {adminPage === 'registers' && <>
            {/* Entries Table */}
            <div className="card">
                <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 className="card-title">
                        <ClipboardList size={20} /> Inward Entries
                        <span className="entry-count">({filteredEntries.length}{filteredEntries.length !== entries.length ? ` of ${entries.length}` : ''})</span>
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>From</span>
                            <input
                                type="date"
                                className="form-input"
                                value={dateFrom}
                                onChange={e => setDateFrom(e.target.value)}
                                style={{ padding: '0.35rem 0.5rem', fontSize: '0.82rem', width: 'auto' }}
                            />
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>To</span>
                            <input
                                type="date"
                                className="form-input"
                                value={dateTo}
                                onChange={e => setDateTo(e.target.value)}
                                style={{ padding: '0.35rem 0.5rem', fontSize: '0.82rem', width: 'auto' }}
                            />
                            {(dateFrom || dateTo) && (
                                <button
                                    className="btn btn-secondary"
                                    onClick={() => { setDateFrom(''); setDateTo(''); }}
                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }}
                                    title="Clear date filter"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </div>
                        <div style={{ width: '1px', height: '24px', background: 'var(--border-color)', margin: '0 0.1rem' }} />
                        <input
                            type="date"
                            className="form-input"
                            value={printDate}
                            onChange={e => setPrintDate(e.target.value)}
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem', width: 'auto' }}
                        />
                        <button className="btn btn-secondary ap-nav-action-btn" onClick={handlePrint} title="Print entries for selected date">
                            <Printer size={15} /> Print
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <Loader2 size={40} className="spin" />
                        <p>Loading entries...</p>
                    </div>
                ) : entries.length === 0 ? (
                    <div className="empty-state">
                        <Inbox size={48} />
                        <p>No entries found</p>
                    </div>
                ) : filteredEntries.length === 0 ? (
                    <div className="empty-state">
                        <Filter size={36} />
                        <p>No entries match the selected date range</p>
                        <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={() => { setDateFrom(''); setDateTo(''); }}>Clear Filter</button>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Sl.No.</th>
                                    <th>Date of Inward</th>
                                    <th>Mode</th>
                                    <th>From</th>
                                    <th>Particulars</th>
                                    <th>Assigned To</th>
                                    <th>File Ref</th>
                                    <th>Remarks</th>
                                    <th>Signature</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEntries.slice((inwardPage - 1) * INWARD_PAGE_SIZE, inwardPage * INWARD_PAGE_SIZE).map((entry, index) => (
                                    <tr key={entry.id} className={isOverdue(entry.dueDate, entry.assignmentStatus) ? 'overdue-row' : ''} style={{ animationDelay: `${index * 0.04}s` }}>
                                        <td>{(inwardPage - 1) * INWARD_PAGE_SIZE + index + 1}</td>
                                        <td>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatDate(entry.signReceiptDatetime)}</div>
                                            <strong style={{ fontSize: '0.78rem', fontFamily: 'monospace' }}>{entry.inwardNo}</strong>
                                        </td>
                                        <td>{entry.means || '-'}</td>
                                        <td>{entry.particularsFromWhom}</td>
                                        <td className="subject-cell">
                                            <div
                                                className="subject-text"
                                                onMouseEnter={e => setTooltip({ text: entry.subject, x: e.clientX, y: e.clientY, visible: true })}
                                                onMouseMove={e => setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }))}
                                                onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                                            >{entry.subject}</div>
                                        </td>
                                        <td>
                                            {entry.assignedTeam ? (
                                                <span className="badge badge-team">{entry.assignedTeam}</span>
                                            ) : (
                                                <span className="badge badge-none">-</span>
                                            )}
                                        </td>
                                        <td>{entry.fileReference || '-'}</td>
                                        <td>{entry.remarks || '-'}</td>
                                        <td></td>
                                        <td>
                                            <div className="action-buttons">
                                                <button className="btn-icon" onClick={() => openDetailsModal(entry)} title="View Details">
                                                    <Eye size={16} />
                                                </button>
                                                <button className="btn-icon" onClick={() => openReassignModal(entry)} title={entry.assignedTeam ? 'Reassign' : 'Assign'}>
                                                    <Edit3 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredEntries.length > INWARD_PAGE_SIZE && (() => {
                            const totalPages = Math.ceil(filteredEntries.length / INWARD_PAGE_SIZE);
                            const pct = totalPages > 1 ? ((inwardPage - 1) / (totalPages - 1)) * 100 : 0;
                            return (
                                <div className="table-pagination">
                                    <span className="table-note">
                                        Showing {(inwardPage - 1) * INWARD_PAGE_SIZE + 1}–{Math.min(inwardPage * INWARD_PAGE_SIZE, filteredEntries.length)} of {filteredEntries.length}
                                    </span>
                                    <div className="slider-pagination">
                                        <button className="page-arrow" disabled={inwardPage === 1} onClick={() => setInwardPage(p => p - 1)}>‹</button>
                                        <div className="slider-wrap">
                                            <input
                                                type="range"
                                                className="page-slider"
                                                min={1} max={totalPages} value={inwardPage}
                                                style={{ '--pct': `${pct}%` }}
                                                onChange={e => setInwardPage(Number(e.target.value))}
                                            />
                                        </div>
                                        <button className="page-arrow" disabled={inwardPage === totalPages} onClick={() => setInwardPage(p => p + 1)}>›</button>
                                        <span className="page-badge">{inwardPage} <span className="page-of">/ {totalPages}</span></span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>

            {/* Create Success Modal (no team assigned) */}
            {createSuccess && (
                <div className={`modal-overlay${closingModal === 'createSuccess' ? ' closing' : ''}`}
                    onClick={() => closeWithAnimation('createSuccess', () => setCreateSuccess(null))}>
                    <div className="modal" style={{maxWidth: 420}} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title" style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                                <span style={{color:'#22c55e',display:'flex'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>
                                Entry Created Successfully
                            </h2>
                            <button className="btn-close" onClick={() => closeWithAnimation('createSuccess', () => setCreateSuccess(null))}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
                                <div className="detail-item">
                                    <label>Inward No.</label>
                                    <span style={{fontFamily:'monospace',fontWeight:700,color:'var(--primary)'}}>{createSuccess.inwardNo}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Subject</label>
                                    <span>{createSuccess.subject}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Assignment</label>
                                    <span style={{color:'var(--text-secondary)'}}>Not assigned — use the Assign button to assign a team later.</span>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={() => closeWithAnimation('createSuccess', () => setCreateSuccess(null))}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Assignment Success Modal */}
            {assignSuccess && (
                <div className={`modal-overlay${closingModal === 'assignSuccess' ? ' closing' : ''}`}
                    onClick={() => closeWithAnimation('assignSuccess', () => setAssignSuccess(null))}>
                    <div className="modal" style={{maxWidth: 460}} onClick={e => e.stopPropagation()}>
                        <div className="modal-header" style={{borderBottom: '1px solid var(--border-color)'}}>
                            <h2 className="modal-title" style={{display:'flex',alignItems:'center',gap:'0.5rem'}}>
                                <span style={{color:'#22c55e',display:'flex'}}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg></span>
                                Entry Assigned Successfully
                            </h2>
                            <button className="btn-close" onClick={() => closeWithAnimation('assignSuccess', () => setAssignSuccess(null))}>×</button>
                        </div>
                        <div className="modal-body">
                            <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
                                <div className="detail-item">
                                    <label>Inward No.</label>
                                    <span style={{fontFamily:'monospace',fontWeight:700,color:'var(--primary)'}}>{assignSuccess.inwardNo}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Subject</label>
                                    <span>{assignSuccess.subject}</span>
                                </div>
                                <div className="detail-item">
                                    <label>Assigned To</label>
                                    <span className="badge badge-team">{assignSuccess.team}</span>
                                </div>
                                {assignSuccess.email && (
                                    <div className="detail-item">
                                        <label>Email Notified</label>
                                        <span>{assignSuccess.email}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={() => closeWithAnimation('assignSuccess', () => setAssignSuccess(null))}>Done</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Details Modal */}
            {showModal && selectedEntry && (
                <div className={`modal-overlay${closingModal === 'details' ? ' closing' : ''}`} onClick={() => closeWithAnimation('details', () => setShowModal(false))}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><FileText size={20} /> Entry Details</h3>
                            <button className="btn-close" onClick={() => closeWithAnimation('details', () => setShowModal(false))}>
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
                            <button className="btn btn-secondary" onClick={() => closeWithAnimation('details', () => setShowModal(false))}>Close</button>
                            <button className="btn btn-primary" onClick={() => {
                                closeWithAnimation('details', () => { setShowModal(false); openReassignModal(selectedEntry); });
                            }}>
                                <Edit3 size={16} /> {selectedEntry?.assignedTeam ? 'Reassign' : 'Assign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Reassign Modal */}
            {showReassignModal && selectedEntry && (
                <div className={`modal-overlay${closingModal === 'reassign' ? ' closing' : ''}`} onClick={() => closeWithAnimation('reassign', () => setShowReassignModal(false))}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Edit3 size={20} /> {selectedEntry?.assignedTeam ? 'Reassign Entry' : 'Assign Entry'}</h3>
                            <button className="btn-close" onClick={() => closeWithAnimation('reassign', () => setShowReassignModal(false))}>
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
                                <button type="button" className="btn btn-secondary" onClick={() => closeWithAnimation('reassign', () => setShowReassignModal(false))}>Cancel</button>
                                <button type="submit" className="btn btn-primary">
                                    <Check size={16} /> {selectedEntry?.assignedTeam ? 'Reassign' : 'Assign'}
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
                <div className="notes-feed">
                    {filteredNotes.length === 0 ? (
                        <div className="empty-state">
                            <FileText size={40} />
                            <p>No notes yet</p>
                        </div>
                    ) : filteredNotes.map(n => (
                        <div key={n.id} className={`note-strip note-strip--${n.note_type === 'REGISTRAR' ? 'reg' : 'vc'}`}>
                            <div className="note-strip__left">
                                <span className="note-strip__outward">{n.outward_no}</span>
                                <span className="note-strip__sl">#{n.sl_no}</span>
                            </div>
                            <div className="note-strip__body">
                                <div className="note-strip__desc">{n.description}</div>
                                {n.remarks && <div className="note-strip__remarks">{n.remarks}</div>}
                            </div>
                            <div className="note-strip__right">
                                <span className="note-strip__date">{formatDate(n.date)}</span>
                                <button className="btn-icon" onClick={() => handleNoteDelete(n.id)} title="Delete">
                                    <X size={14} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Notes Drawer */}
            {showNotesForm && (
                <div className={`modal-overlay ap-drawer-overlay${closingModal === 'notes' ? ' closing' : ''}`} onClick={() => closeWithAnimation('notes', () => setShowNotesForm(false))}>
                    <div className="ap-notes-drawer" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><FileText size={18} /> Add Note</h3>
                            <button className="btn-close" onClick={() => closeWithAnimation('notes', () => setShowNotesForm(false))}>
                                <X size={20} />
                            </button>
                        </div>
                        <div className="notes-drawer-toggle">
                            <button type="button" className={notesTab === 'REGISTRAR' ? 'active' : ''} onClick={() => setNotesTab('REGISTRAR')}>
                                Registrar
                            </button>
                            <button type="button" className={notesTab === 'VC' ? 'active' : ''} onClick={() => setNotesTab('VC')}>
                                Vice Chancellor
                            </button>
                        </div>
                        <form onSubmit={handleNotesSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
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
                                    <textarea className="form-textarea" required rows={4}
                                        value={notesFormData.description}
                                        onChange={e => setNotesFormData(p => ({ ...p, description: e.target.value }))}
                                        placeholder="Brief description of the note..." />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Remarks</label>
                                    <textarea className="form-textarea" rows={3}
                                        value={notesFormData.remarks}
                                        onChange={e => setNotesFormData(p => ({ ...p, remarks: e.target.value }))}
                                        placeholder="Any additional remarks..." />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => closeWithAnimation('notes', () => setShowNotesForm(false))}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={notesLoading}>
                                    <Check size={16} /> {notesLoading ? 'Saving…' : 'Save Note'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            </>}

            {/* Audit Log Section */}
            {adminPage === 'auditlog' && (
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <ClipboardList size={20} /> Audit Log
                            <span className="entry-count">({auditTotal})</span>
                        </h3>
                    </div>
                    {auditLoading ? (
                        <div className="loading-state">
                            <Loader2 size={40} className="spin" />
                            <p>Loading audit log...</p>
                        </div>
                    ) : auditLogs.length === 0 ? (
                        <div className="empty-state">
                            <ClipboardList size={48} />
                            <p>No activity recorded yet</p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Actor</th>
                                        <th>Action</th>
                                        <th>Details</th>
                                        <th>Entry Ref</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {auditLogs.map(log => (
                                        <tr key={log.id}>
                                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                {new Date(log.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>{log.actor}</span>
                                            </td>
                                            <td>
                                                <span className={`badge badge-${
                                                    log.action === 'ENTRY_CREATED' ? 'pending' :
                                                    log.action === 'ENTRY_ASSIGNED' ? 'success' :
                                                    log.action === 'STATUS_CHANGED' ? 'warning' :
                                                    log.action === 'OUTWARD_CREATED' ? 'team' : 'none'
                                                }`} style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                                                    {log.action.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: '0.82rem' }}>{log.description}</td>
                                            <td style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--primary)' }}>
                                                {log.inward_no || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {auditTotalPages > 1 && (() => {
                                const pct = auditTotalPages > 1 ? ((auditPage - 1) / (auditTotalPages - 1)) * 100 : 0;
                                return (
                                    <div className="table-pagination">
                                        <span className="table-note">
                                            Page {auditPage} of {auditTotalPages} &mdash; {auditTotal} total entries
                                        </span>
                                        <div className="slider-pagination">
                                            <button className="page-arrow" disabled={auditPage === 1} onClick={() => loadAuditLogs(auditPage - 1)}>‹</button>
                                            <div className="slider-wrap">
                                                <input
                                                    type="range"
                                                    className="page-slider"
                                                    min={1} max={auditTotalPages} value={auditPage}
                                                    style={{ '--pct': `${pct}%` }}
                                                    onChange={e => loadAuditLogs(Number(e.target.value))}
                                                />
                                            </div>
                                            <button className="page-arrow" disabled={auditPage === auditTotalPages} onClick={() => loadAuditLogs(auditPage + 1)}>›</button>
                                            <span className="page-badge">{auditPage} <span className="page-of">/ {auditTotalPages}</span></span>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            <ChatBot />

            {/* Subject Tooltip */}
            {tooltip.visible && (
                <div className="subject-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
                    {tooltip.text}
                </div>
            )}
        </div>
        </div>
    );
}

export default AdminPortal;
