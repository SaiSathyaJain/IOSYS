import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { outwardAPI, inwardAPI, dashboardAPI } from '../../services/api';
import {
    Clock, CheckCircle2, ArrowRight, Calendar, Plus, X,
    ClipboardList, Check, FileText, Search, RefreshCw, Eye,
    ArrowUpFromLine, ArrowLeft, Loader2, AlertTriangle, Link2, Lock,
    Sun, Moon, LayoutDashboard, Send, History, User, Download
} from 'lucide-react';
import ChatBot from '../ChatBot/ChatBot';
import './TeamPortal.css';

const TEAM_MAP = { 'ug': 'UG', 'pg-pro': 'PG/PRO', 'phd': 'PhD' };

function TeamPortal() {
    const { teamSlug } = useParams();
    const navigate = useNavigate();
    const selectedTeam = TEAM_MAP[teamSlug] || '';

    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');
    const [activePage, setActivePage] = useState('dashboard');
    const [pendingFilter, setPendingFilter] = useState('all');
    const [showLimit, setShowLimit] = useState(5);
    const [entries, setEntries] = useState([]);
    const [filteredEntries, setFilteredEntries] = useState([]);
    const [pendingInward, setPendingInward] = useState([]);
    const [teamStats, setTeamStats] = useState(null);
    const [viewTeam, setViewTeam] = useState(selectedTeam);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [pendingSearch, setPendingSearch] = useState('');
    const [completedSearch, setCompletedSearch] = useState('');
    const [outwardPage, setOutwardPage] = useState(1);
    const OUTWARD_PAGE_SIZE = 20;
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState(null);
    const [showInwardModal, setShowInwardModal] = useState(false);
    const [completeModal, setCompleteModal] = useState(null); // holds entry id
    const [completeFileRef, setCompleteFileRef] = useState('');
    const [remarksModal, setRemarksModal] = useState(null); // holds entry
    const [remarksText, setRemarksText] = useState('');
    const [selectedInwardEntry, setSelectedInwardEntry] = useState(null);
    const [completedInward, setCompletedInward] = useState([]);
    const [formData, setFormData] = useState({
        means: '', toWhom: '', subject: '', sentBy: '',
        signReceiptDateTime: '', caseClosed: false, fileReference: '',
        postalTariff: '', dueDate: '', linkedInwardId: '',
        createdByTeam: selectedTeam || '', teamMemberEmail: '',
        ackRec: '', crossNo: '', receiptNo: '', remarks: ''
    });

    // Close topmost open modal on Escape
    useEffect(() => {
        const onEsc = (e) => {
            if (e.key !== 'Escape') return;
            if (completeModal)    { setCompleteModal(null); return; }
            if (remarksModal)     { setRemarksModal(null); return; }
            if (showInwardModal)  { setShowInwardModal(false); return; }
            if (showDetailsModal) { setShowDetailsModal(false); return; }
            if (showForm)         { setShowForm(false); }
        };
        document.addEventListener('keydown', onEsc);
        return () => document.removeEventListener('keydown', onEsc);
    }, [completeModal, remarksModal, showInwardModal, showDetailsModal, showForm]);

    useEffect(() => {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    useEffect(() => { loadData(); }, [selectedTeam]);
    useEffect(() => { loadEntries(); }, [viewTeam]);
    useEffect(() => { filterEntries(); }, [entries, searchTerm]);
    const [pushEnabled, setPushEnabled] = useState(false);
    useEffect(() => {
        if (selectedTeam) checkPushStatus();
    }, [selectedTeam]);

    const loadData = async () => {
        setLoading(true);
        try {
            const inwardRes = await inwardAPI.getAll();
            const allAssigned = (inwardRes.data.entries || []).filter(e =>
                e.assignedTeam && (!selectedTeam || e.assignedTeam === selectedTeam)
            );
            const pending = allAssigned.filter(e =>
                e.assignmentStatus === 'Pending' || e.assignmentStatus === 'In Progress'
            );
            const completed = allAssigned.filter(e => e.assignmentStatus === 'Completed');
            setPendingInward(pending);
            setCompletedInward(completed);
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

    const loadEntries = async () => {
        try {
            const outwardRes = await outwardAPI.getAll(viewTeam);
            setEntries(outwardRes.data.entries || []);
        } catch (error) {
            console.error('Error loading entries:', error);
        }
    };

    const filterEntries = () => {
        setOutwardPage(1);
        if (!searchTerm) { setFilteredEntries(entries); return; }
        const term = searchTerm.toLowerCase();
        setFilteredEntries(entries.filter(e =>
            e.outwardNo?.toLowerCase().includes(term) ||
            e.subject?.toLowerCase().includes(term) ||
            e.toWhom?.toLowerCase().includes(term)
        ));
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

    const handleMarkComplete = (id) => {
        setCompleteFileRef('');
        setCompleteModal(id);
    };

    const submitMarkComplete = async (e) => {
        e.preventDefault();
        try {
            await inwardAPI.updateStatus(completeModal, 'Completed', completeFileRef, `${selectedTeam} Team`);
            setCompleteModal(null);
            loadData();
        } catch (error) {
            alert('Error marking complete: ' + error.message);
        }
    };

    const openRemarksModal = (entry) => {
        setRemarksText(entry.remarks || '');
        setRemarksModal(entry);
    };

    const submitRemarks = async (e) => {
        e.preventDefault();
        try {
            await inwardAPI.updateRemarks(remarksModal.id, remarksText, `${selectedTeam} Team`);
            setRemarksModal(null);
            loadData();
        } catch (error) {
            alert('Error saving remarks: ' + error.message);
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
        if (!window.confirm('Are you sure you want to close this case?')) return;
        try {
            await outwardAPI.closeCase(id);
            alert('Case closed successfully!');
            loadEntries();
            setShowDetailsModal(false);
        } catch (error) {
            alert('Error closing case: ' + error.message);
        }
    };

    const checkPushStatus = async () => {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        if (Notification.permission === 'granted') {
            await navigator.serviceWorker.register('/sw.js');
            const reg = await navigator.serviceWorker.ready;
            const existing = await reg.pushManager.getSubscription();
            if (existing) setPushEnabled(true);
        }
    };

    const registerPush = async () => {
        try {
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                alert('Push notifications are not supported in this browser.');
                return;
            }
            const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
            if (!vapidKey) { console.error('VAPID public key not configured'); return; }

            const permission = await Notification.requestPermission();
            if (permission !== 'granted') { alert('Notification permission denied.'); return; }

            await navigator.serviceWorker.register('/sw.js');
            const reg = await navigator.serviceWorker.ready;
            const keyBytes = Uint8Array.from(
                atob(vapidKey.replace(/-/g, '+').replace(/_/g, '/')),
                c => c.charCodeAt(0)
            );

            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: keyBytes
            });

            const sub = subscription.toJSON();
            await fetch(`${import.meta.env.VITE_API_URL || '/api'}/push/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: sub.endpoint, keys: sub.keys, team: selectedTeam })
            });
            setPushEnabled(true);
        } catch (err) {
            console.error('Push registration failed:', err.message);
            alert('Could not enable notifications: ' + err.message);
        }
    };

    const resetForm = () => {
        setFormData({
            means: '', toWhom: '', subject: '', sentBy: '',
            signReceiptDateTime: '', caseClosed: false, fileReference: '',
            postalTariff: '', dueDate: '', linkedInwardId: '',
            createdByTeam: selectedTeam || '', teamMemberEmail: '',
            ackRec: '', crossNo: '', receiptNo: '', remarks: ''
        });
    };

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const formatDate = (dateValue) => {
        if (!dateValue) return '-';
        try {
            const date = dateValue._seconds ? new Date(dateValue._seconds * 1000) : new Date(dateValue);
            return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return '-'; }
    };

    const formatHeaderDate = () => new Date().toLocaleDateString('en-US', {
        weekday: 'long', day: 'numeric', month: 'short', year: 'numeric'
    });

    const isOverdue = (dueDate) => {
        if (!dueDate) return false;
        const due = dueDate._seconds ? new Date(dueDate._seconds * 1000) : new Date(dueDate);
        return due < new Date();
    };

    const isDueSoon = (dueDate) => {
        if (!dueDate) return false;
        const due = dueDate._seconds ? new Date(dueDate._seconds * 1000) : new Date(dueDate);
        const diffDays = Math.ceil((due - new Date()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 3;
    };

    const applyInwardSearch = (list, term) => {
        if (!term) return list;
        const t = term.toLowerCase();
        return list.filter(e =>
            e.inwardNo?.toLowerCase().includes(t) ||
            e.subject?.toLowerCase().includes(t) ||
            e.particularsFromWhom?.toLowerCase().includes(t)
        );
    };

    const getFilteredPending = () => {
        let base;
        switch (pendingFilter) {
            case 'overdue': base = pendingInward.filter(e => isOverdue(e.dueDate)); break;
            case 'recent':  base = [...pendingInward].slice(0, 5); break;
            default:        base = pendingInward;
        }
        return applyInwardSearch(base, pendingSearch);
    };

    const getFilteredCompleted = () => applyInwardSearch(completedInward, completedSearch);

    const overdueCount     = pendingInward.filter(e => isOverdue(e.dueDate)).length;
    const displayedPending = getFilteredPending().slice(0, showLimit);
    const totalFiltered   = getFilteredPending().length;
    const completionRate  = teamStats?.totalAssigned > 0
        ? ((teamStats.completed || 0) / teamStats.totalAssigned * 100).toFixed(1)
        : '0.0';
    const linkedInwardEntry = formData.linkedInwardId
        ? pendingInward.find(e => String(e.id) === String(formData.linkedInwardId))
        : null;

    const navItems = [
        { id: 'dashboard', label: 'DASHBOARD', icon: <LayoutDashboard size={15} /> },
        { id: 'pending',   label: 'PENDING',   icon: <Clock size={15} /> },
        { id: 'completed', label: 'COMPLETED', icon: <CheckCircle2 size={15} /> },
        { id: 'history',   label: 'HISTORY',   icon: <History size={15} /> },
        { id: 'profile',   label: 'PROFILE',   icon: <User size={15} /> },
    ];

    return (
        <motion.div
            className={`tp-app${isDarkMode ? ' dark' : ''}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
        >
            {/* ── Sidebar ── */}
            <aside className="tp-sidebar">
                <div className="tp-sidebar-logo">
                    <img src="/sssihl-icon.jpg" alt="SSSIHL" className="tp-sidebar-logo-img" />
                    <div>
                        <div className="tp-logo-title">SSSIHL · IOSYS</div>
                        <div className="tp-logo-sub">INWARD OUTWARD</div>
                    </div>
                </div>
                <nav className="tp-sidebar-nav">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            className={`tp-nav-item${activePage === item.id ? ' active' : ''}`}
                            onClick={() => setActivePage(item.id)}
                        >
                            {item.icon}
                            <span>{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="tp-sidebar-footer" onClick={() => navigate('/team')} title="Back to team selection">
                    {selectedTeam} TEAM
                </div>
            </aside>

            {/* ── Main ── */}
            <main className="tp-main">
                {/* Header */}
                <div className="tp-main-header">
                    <div className="tp-main-header-left">
                        <button className="tp-back-btn" onClick={() => navigate('/team')} title="Back to team selection">
                            <ArrowLeft size={15} />
                        </button>
                        <h1 className="tp-main-title">{navItems.find(n => n.id === activePage)?.label.charAt(0) + navItems.find(n => n.id === activePage)?.label.slice(1).toLowerCase() || 'Dashboard'}</h1>
                        <span className="tp-main-date">{formatHeaderDate()}</span>
                    </div>
                    <div className="tp-main-header-right">
                        <button className="tp-export-btn"><Download size={14} /> Export</button>
                        {!pushEnabled && 'Notification' in window && Notification.permission !== 'denied' && (
                            <button className="tp-export-btn" onClick={registerPush} title="Enable push notifications" style={{ gap: '0.35rem' }}>
                                🔔 Enable Notifications
                            </button>
                        )}
                        <button className="tp-new-outward-btn" onClick={() => setShowForm(true)}>
                            <Plus size={15} /> + New Outward
                        </button>
<button className="tp-theme-btn" onClick={() => { document.body.classList.add('theme-transitioning'); setIsDarkMode(v => !v); setTimeout(() => document.body.classList.remove('theme-transitioning'), 350); }} title="Toggle theme">
                            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                        </button>
                    </div>
                </div>

                <div className="tp-content">
                <AnimatePresence mode="wait">

                {/* ── PROFILE page ── */}
                {activePage === 'profile' && (
                    <motion.div key="profile" className="tp-card" style={{maxWidth:480}} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
                        <div className="tp-card-header">
                            <div className="tp-card-title-row"><User size={16} className="tp-icon-muted"/><h3>Team Profile</h3></div>
                        </div>
                        <div style={{padding:'1rem 1.25rem',display:'flex',flexDirection:'column',gap:'0.75rem'}}>
                            <div className="detail-item"><label>Team</label><span className="badge badge-team">{selectedTeam}</span></div>
                            <div className="detail-item"><label>Portal</label><span>{selectedTeam} Team Portal</span></div>
                            <div className="detail-item"><label>Total Assigned</label><span>{teamStats?.totalAssigned || 0}</span></div>
                            <div className="detail-item"><label>Pending</label><span>{teamStats?.pending || 0}</span></div>
                            <div className="detail-item"><label>Completed</label><span>{teamStats?.completed || 0}</span></div>
                            <div className="detail-item"><label>Outward Sent</label><span>{teamStats?.totalOutward || 0}</span></div>
                            <div className="detail-item"><label>Completion Rate</label><span>{completionRate}%</span></div>
                        </div>
                    </motion.div>
                )}

                {/* ── COMPLETED page ── */}
                {activePage === 'completed' && (
                    <motion.div key="completed" className="tp-card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
                        <div className="tp-card-header">
                            <div className="tp-card-title-row">
                                <CheckCircle2 size={16} className="tp-icon-muted"/>
                                <h3>Completed Assignments</h3>
                                <span className="tp-count-pill">{completedInward.length}</span>
                            </div>
                            <div className="tp-search-wrap">
                                <Search size={13}/>
                                <input type="text" placeholder="Search completed..."
                                    value={completedSearch} onChange={e => setCompletedSearch(e.target.value)}/>
                            </div>
                        </div>
                        {loading ? (
                            <div className="tp-center-state"><Loader2 size={24} className="spin"/></div>
                        ) : getFilteredCompleted().length === 0 ? (
                            <div className="tp-center-state"><CheckCircle2 size={32} style={{opacity:0.3}}/><p>{completedSearch ? 'No matches found.' : 'No completed assignments yet.'}</p></div>
                        ) : (
                            <motion.div className="tp-assign-list" variants={{ animate: { transition: { staggerChildren: 0.05 } } }} initial="initial" animate="animate">
                                {getFilteredCompleted().map(entry => (
                                    <motion.div key={entry.id} className="tp-assign-card" variants={{ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.16 } } }}>
                                        <div className="tp-ac-row">
                                            <div className="tp-ac-badges">
                                                <span className="tp-inward-no">{entry.inwardNo}</span>
                                                <span className="tp-team-chip">{entry.assignedTeam}</span>
                                            </div>
                                            <span className="tp-status-chip" style={{background:'#d1fae5',color:'#065f46'}}>COMPLETED</span>
                                        </div>
                                        <h4 className="tp-ac-subject">{entry.subject}</h4>
                                        <p className="tp-ac-from">From: <strong>{entry.particularsFromWhom}</strong></p>
                                        <div className="tp-ac-actions">
                                            <button className="tp-ac-btn view" onClick={() => { setSelectedInwardEntry(entry); setShowInwardModal(true); }}>VIEW DETAILS</button>
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        )}
                    </motion.div>
                )}

                {/* ── PENDING page ── */}
                {activePage === 'pending' && (
                    <motion.div key="pending" className="tp-card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
                        <div className="tp-card-header">
                            <div className="tp-card-title-row">
                                <Clock size={16} className="tp-icon-muted"/>
                                <h3>Pending Assignments</h3>
                                <span className="tp-count-pill">{pendingInward.length}</span>
                                {overdueCount > 0 && <span className="tp-overdue-pill">{overdueCount} OVERDUE</span>}
                            </div>
                            <div className="tp-history-controls">
                                <div className="tp-filter-tabs">
                                    {['all','overdue','recent'].map(f => (
                                        <button key={f} className={`tp-ftab${pendingFilter===f?' active':''}`}
                                            onClick={() => { setPendingFilter(f); setShowLimit(5); }}>
                                            {f.charAt(0).toUpperCase()+f.slice(1)}
                                        </button>
                                    ))}
                                </div>
                                <div className="tp-search-wrap">
                                    <Search size={13}/>
                                    <input type="text" placeholder="Search pending..."
                                        value={pendingSearch} onChange={e => setPendingSearch(e.target.value)}/>
                                </div>
                            </div>
                        </div>
                        {loading ? (
                            <div className="tp-center-state"><Loader2 size={24} className="spin"/></div>
                        ) : displayedPending.length === 0 ? (
                            <div className="tp-center-state"><CheckCircle2 size={32} style={{opacity:0.3}}/><p>{pendingSearch ? 'No matches found.' : `No ${pendingFilter !== 'all' ? pendingFilter : 'pending'} assignments.`}</p></div>
                        ) : (
                            <motion.div className="tp-assign-list" variants={{ animate: { transition: { staggerChildren: 0.05 } } }} initial="initial" animate="animate">
                                {displayedPending.map(entry => (
                                    <motion.div key={entry.id} className={`tp-assign-card${isOverdue(entry.dueDate)?' overdue':isDueSoon(entry.dueDate)?' due-soon':''}`} variants={{ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0, transition: { duration: 0.16 } } }}>
                                        <div className="tp-ac-row">
                                            <div className="tp-ac-badges">
                                                <span className="tp-inward-no">{entry.inwardNo}</span>
                                                <span className="tp-team-chip">{entry.assignedTeam}</span>
                                                {entry.dueDate && (
                                                    <span className={`tp-due-chip${isOverdue(entry.dueDate)?' overdue':isDueSoon(entry.dueDate)?' soon':''}`}>
                                                        {isOverdue(entry.dueDate) ? <AlertTriangle size={10}/> : <Calendar size={10}/>}
                                                        {isOverdue(entry.dueDate) ? `Overdue · ${formatDate(entry.dueDate)}` : `Due Soon · ${formatDate(entry.dueDate)}`}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="tp-status-chip">{entry.assignmentStatus || 'PENDING'}</span>
                                        </div>
                                        <h4 className="tp-ac-subject">{entry.subject}</h4>
                                        <p className="tp-ac-from">From: <strong>{entry.particularsFromWhom}</strong>{entry.assignmentInstructions && <> · <em>{entry.assignmentInstructions}</em></>}</p>
                                        <div className="tp-ac-actions">
                                            <button className="tp-ac-btn view" onClick={() => { setSelectedInwardEntry(entry); setShowInwardModal(true); }}>VIEW DETAILS</button>
                                            <button className="tp-ac-btn complete" onClick={() => handleMarkComplete(entry.id)}>MARK COMPLETE</button>
                                            <button className="tp-ac-btn forward" onClick={() => handleProcess(entry)}>FORWARD</button>
                                        </div>
                                    </motion.div>
                                ))}
                                {totalFiltered > showLimit && (
                                    <button className="tp-load-more" onClick={() => setShowLimit(showLimit + 5)}>
                                        Showing {showLimit} of {totalFiltered} — Load more
                                    </button>
                                )}
                            </motion.div>
                        )}
                    </motion.div>
                )}

                {/* ── OUTWARD / HISTORY page ── */}
                {activePage === 'history' && (
                    <motion.div key="history" className="tp-card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
                        <div className="tp-card-header">
                            <div className="tp-card-title-row">
                                <Send size={16} className="tp-icon-muted"/>
                                <h3>Outward History</h3>
                                <span className="tp-count-pill">{filteredEntries.length}</span>
                            </div>
                            <div className="tp-history-controls">
                                <div className="tp-team-tabs">
                                    {Object.entries(TEAM_MAP).filter(([,n]) => n !== selectedTeam).map(([slug, name]) => (
                                        <button key={slug}
                                            className={`tp-team-tab${viewTeam === name ? ' active' : ''}`}
                                            onClick={() => setViewTeam(viewTeam === name ? selectedTeam : name)}>
                                            {name}
                                        </button>
                                    ))}
                                </div>
                                <div className="tp-search-wrap">
                                    <Search size={13}/>
                                    <input type="text" placeholder="Search history..."
                                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                                </div>
                            </div>
                        </div>
                        {filteredEntries.length === 0 ? (
                            <div className="tp-center-state"><ArrowUpFromLine size={28} style={{opacity:0.3}}/><p>No outward entries yet.</p></div>
                        ) : (
                            <div className="tp-table-wrap">
                                <table className="tp-history-table">
                                    <thead><tr>
                                        <th>OUTWARD NO</th><th>SUBJECT</th><th>RECIPIENT</th>
                                        <th>TEAM</th><th>STATUS</th><th>DATE</th><th>ACTIONS</th>
                                    </tr></thead>
                                    <tbody>
                                        {filteredEntries.slice((outwardPage - 1) * OUTWARD_PAGE_SIZE, outwardPage * OUTWARD_PAGE_SIZE).map(entry => (
                                            <tr key={entry.id}>
                                                <td className="tp-outward-link">{entry.outwardNo}</td>
                                                <td className="tp-subject-cell">{entry.subject?.length > 50 ? entry.subject.slice(0,50)+'...' : entry.subject}</td>
                                                <td>{entry.toWhom}</td>
                                                <td><span className="tp-team-chip">{entry.createdByTeam}</span></td>
                                                <td>
                                                    <div className="tp-status-tags">
                                                        {entry.caseClosed ? <span className="tp-badge-closed">CLOSED</span> : <span className="tp-badge-open">OPEN</span>}
                                                        {entry.linkedInwardId && <span className="tp-badge-linked">LINKED</span>}
                                                    </div>
                                                </td>
                                                <td className="tp-date-cell">{formatDate(entry.createdAt)}</td>
                                                <td>
                                                    <div className="tp-row-btns">
                                                        <button onClick={() => { setSelectedEntry(entry); setShowDetailsModal(true); }} title="View"><Eye size={13}/></button>
                                                        {!entry.caseClosed && viewTeam === selectedTeam && (
                                                            <button onClick={() => handleCloseCase(entry.id)} title="Close" className="close-btn"><Lock size={13}/></button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {filteredEntries.length > OUTWARD_PAGE_SIZE && (() => {
                                    const totalPages = Math.ceil(filteredEntries.length / OUTWARD_PAGE_SIZE);
                                    const pct = totalPages > 1 ? ((outwardPage - 1) / (totalPages - 1)) * 100 : 0;
                                    return (
                                        <div className="table-pagination">
                                            <span className="table-note">
                                                Showing {(outwardPage - 1) * OUTWARD_PAGE_SIZE + 1}–{Math.min(outwardPage * OUTWARD_PAGE_SIZE, filteredEntries.length)} of {filteredEntries.length}
                                            </span>
                                            <div className="slider-pagination">
                                                <button className="page-arrow" disabled={outwardPage === 1} onClick={() => setOutwardPage(p => p - 1)}>‹</button>
                                                <div className="slider-wrap">
                                                    <input
                                                        type="range"
                                                        className="page-slider"
                                                        min={1} max={totalPages} value={outwardPage}
                                                        style={{ '--pct': `${pct}%` }}
                                                        onChange={e => setOutwardPage(Number(e.target.value))}
                                                    />
                                                </div>
                                                <button className="page-arrow" disabled={outwardPage === totalPages} onClick={() => setOutwardPage(p => p + 1)}>›</button>
                                                <span className="page-badge">{outwardPage} <span className="page-of">/ {totalPages}</span></span>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                        <div className="tp-table-footer">Showing {Math.min(outwardPage * OUTWARD_PAGE_SIZE, filteredEntries.length)} of {filteredEntries.length} results ({entries.length} total)</div>
                    </motion.div>
                )}

                {/* ── DASHBOARD page ── */}
                {activePage === 'dashboard' && (
                <motion.div key="dashboard" style={{ width: '100%' }} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
                    {/* Stats */}
                    <div className="tp-stats-row">
                        <div className="tp-stat-card">
                            <div className="tp-stat-lbl">TOTAL ASSIGNED</div>
                            <div className="tp-stat-val">{teamStats?.totalAssigned || 0}</div>
                            <div className="tp-stat-sub">All time total</div>
                            <div className="tp-stat-bar"><div className="tp-bar-fill blue" style={{width:'70%'}}/></div>
                        </div>
                        <div className="tp-stat-card">
                            <div className="tp-stat-lbl">PENDING</div>
                            <div className="tp-stat-val orange">{teamStats?.pending || 0}</div>
                            {overdueCount > 0
                                ? <div className="tp-stat-sub warn"><AlertTriangle size={11}/> {overdueCount} overdue</div>
                                : <div className="tp-stat-sub">Active tasks</div>}
                            <div className="tp-stat-bar"><div className="tp-bar-fill orange" style={{width: teamStats?.totalAssigned ? `${(teamStats.pending/teamStats.totalAssigned)*100}%` : '0%'}}/></div>
                        </div>
                        <div className="tp-stat-card">
                            <div className="tp-stat-lbl">COMPLETED</div>
                            <div className="tp-stat-val green">{teamStats?.completed || 0}</div>
                            <div className="tp-stat-sub green">{completionRate}% completion rate</div>
                            <div className="tp-stat-bar"><div className="tp-bar-fill green" style={{width:`${completionRate}%`}}/></div>
                        </div>
                        <div className="tp-stat-card">
                            <div className="tp-stat-lbl">OUTWARD SENT</div>
                            <div className="tp-stat-val purple">{teamStats?.totalOutward || 0}</div>
                            <div className="tp-stat-sub">This session activity</div>
                            <div className="tp-stat-bar"><div className="tp-bar-fill purple" style={{width:'30%'}}/></div>
                        </div>
                    </div>

                    {/* Pending Assignments */}
                    <div className="tp-card">
                            <div className="tp-card-header">
                                <div className="tp-card-title-row">
                                    <Clock size={16} className="tp-icon-muted"/>
                                    <h3>Pending Assignments</h3>
                                    <span className="tp-count-pill">{pendingInward.length}</span>
                                    {overdueCount > 0 && <span className="tp-overdue-pill">{overdueCount} OVERDUE</span>}
                                </div>
                                <div className="tp-history-controls">
                                    <div className="tp-filter-tabs">
                                        {['all','overdue','recent'].map(f => (
                                            <button key={f}
                                                className={`tp-ftab${pendingFilter===f?' active':''}`}
                                                onClick={() => { setPendingFilter(f); setShowLimit(5); }}>
                                                {f.charAt(0).toUpperCase()+f.slice(1)}
                                            </button>
                                        ))}
                                    </div>
                                    <div className="tp-search-wrap">
                                        <Search size={13}/>
                                        <input type="text" placeholder="Search pending..."
                                            value={pendingSearch} onChange={e => setPendingSearch(e.target.value)}/>
                                    </div>
                                </div>
                            </div>

                            {loading ? (
                                <div className="tp-center-state"><Loader2 size={24} className="spin"/></div>
                            ) : displayedPending.length === 0 ? (
                                <div className="tp-center-state">
                                    <CheckCircle2 size={32} style={{opacity:0.3}}/>
                                    <p>{pendingSearch ? 'No matches found.' : `No ${pendingFilter !== 'all' ? pendingFilter : 'pending'} assignments.`}</p>
                                </div>
                            ) : (
                                <div className="tp-assign-list">
                                    {displayedPending.map(entry => (
                                        <div key={entry.id} className={`tp-assign-card${isOverdue(entry.dueDate)?' overdue':isDueSoon(entry.dueDate)?' due-soon':''}`}>
                                            <div className="tp-ac-row">
                                                <div className="tp-ac-badges">
                                                    <span className="tp-inward-no">{entry.inwardNo}</span>
                                                    <span className="tp-team-chip">{entry.assignedTeam}</span>
                                                    {entry.dueDate && (
                                                        <span className={`tp-due-chip${isOverdue(entry.dueDate)?' overdue':isDueSoon(entry.dueDate)?' soon':''}`}>
                                                            {isOverdue(entry.dueDate) ? <AlertTriangle size={10}/> : <Calendar size={10}/>}
                                                            {isOverdue(entry.dueDate) ? `Overdue · ${formatDate(entry.dueDate)}` : `Due Soon · ${formatDate(entry.dueDate)}`}
                                                        </span>
                                                    )}
                                                </div>
                                                <span className="tp-status-chip">{entry.assignmentStatus || 'PENDING'}</span>
                                            </div>
                                            <h4 className="tp-ac-subject">{entry.subject}</h4>
                                            <p className="tp-ac-from">
                                                From: <strong>{entry.particularsFromWhom}</strong>
                                                {entry.assignmentInstructions && <> · <em>{entry.assignmentInstructions}</em></>}
                                            </p>
                                            <div className="tp-ac-actions">
                                                <button className="tp-ac-btn view" onClick={() => { setSelectedInwardEntry(entry); setShowInwardModal(true); }}>VIEW DETAILS</button>
                                                <button className="tp-ac-btn complete" onClick={() => handleMarkComplete(entry.id)}>MARK COMPLETE</button>
                                                <button className="tp-ac-btn remarks" onClick={() => openRemarksModal(entry)}>REMARKS</button>
                                                <button className="tp-ac-btn forward" onClick={() => handleProcess(entry)}>FORWARD</button>
                                            </div>
                                        </div>
                                    ))}
                                    {totalFiltered > showLimit && (
                                        <button className="tp-load-more" onClick={() => setShowLimit(showLimit + 5)}>
                                            Showing {showLimit} of {totalFiltered} — Load more
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>


                    {/* Outward History */}
                    <div className="tp-card">
                        <div className="tp-card-header">
                            <div className="tp-card-title-row">
                                <Send size={16} className="tp-icon-muted"/>
                                <h3>Outward History</h3>
                                <span className="tp-count-pill">{filteredEntries.length}</span>
                            </div>
                            <div className="tp-history-controls">
                                <div className="tp-team-tabs">
                                    {Object.entries(TEAM_MAP).filter(([,n]) => n !== selectedTeam).map(([slug, name]) => (
                                        <button key={slug}
                                            className={`tp-team-tab${viewTeam === name ? ' active' : ''}`}
                                            onClick={() => setViewTeam(viewTeam === name ? selectedTeam : name)}>
                                            {name}
                                        </button>
                                    ))}
                                </div>
                                <div className="tp-search-wrap">
                                    <Search size={13}/>
                                    <input type="text" placeholder="Search history..."
                                        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/>
                                </div>
                            </div>
                        </div>

                        {filteredEntries.length === 0 ? (
                            <div className="tp-center-state">
                                <ArrowUpFromLine size={28} style={{opacity:0.3}}/>
                                <p>No outward entries yet.</p>
                            </div>
                        ) : (
                            <div className="tp-table-wrap">
                                <table className="tp-history-table">
                                    <thead>
                                        <tr>
                                            <th>OUTWARD NO</th>
                                            <th>SUBJECT</th>
                                            <th>RECIPIENT</th>
                                            <th>TEAM</th>
                                            <th>STATUS</th>
                                            <th>DATE</th>
                                            <th>ACTIONS</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredEntries.map(entry => (
                                            <tr key={entry.id}>
                                                <td className="tp-outward-link">{entry.outwardNo}</td>
                                                <td className="tp-subject-cell">{entry.subject?.length > 50 ? entry.subject.slice(0,50)+'...' : entry.subject}</td>
                                                <td>{entry.toWhom}</td>
                                                <td><span className="tp-team-chip">{entry.createdByTeam}</span></td>
                                                <td>
                                                    <div className="tp-status-tags">
                                                        {entry.caseClosed
                                                            ? <span className="tp-badge-closed">CLOSED</span>
                                                            : <span className="tp-badge-open">OPEN</span>}
                                                        {entry.linkedInwardId && <span className="tp-badge-linked">LINKED</span>}
                                                    </div>
                                                </td>
                                                <td className="tp-date-cell">{formatDate(entry.createdAt)}</td>
                                                <td>
                                                    <div className="tp-row-btns">
                                                        <button onClick={() => { setSelectedEntry(entry); setShowDetailsModal(true); }} title="View"><Eye size={13}/></button>
                                                        {!entry.caseClosed && viewTeam === selectedTeam && (
                                                            <button onClick={() => handleCloseCase(entry.id)} title="Close" className="close-btn"><Lock size={13}/></button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div className="tp-table-footer">Showing {filteredEntries.length} results of {entries.length}</div>
                    </div>
                </motion.div>)}
                </AnimatePresence>

                </div>
            </main>

            {/* Create Outward Modal — Two-panel drawer */}
            {showForm && (
                <div className="modal-overlay drawer-overlay" onClick={() => { setShowForm(false); resetForm(); }}>
                    <div className="modal drawer tp-two-panel-drawer" onClick={e => e.stopPropagation()}>

                        {/* LEFT PANEL — inward context */}
                        <div className="tp-drawer-left">
                            <div className="tp-dl-header">
                                <Link2 size={14}/>
                                <span>Linked Inward</span>
                            </div>

                            {linkedInwardEntry ? (
                                <div className="tp-dl-body">
                                    <div className="tp-dl-badge">{linkedInwardEntry.inwardNo}</div>
                                    <div className="tp-dl-field">
                                        <span className="tp-dl-key">Subject</span>
                                        <span className="tp-dl-val">{linkedInwardEntry.subject}</span>
                                    </div>
                                    <div className="tp-dl-field">
                                        <span className="tp-dl-key">From</span>
                                        <span className="tp-dl-val">{linkedInwardEntry.particularsFromWhom}</span>
                                    </div>
                                    <div className="tp-dl-field">
                                        <span className="tp-dl-key">Team</span>
                                        <span className="tp-dl-val">{linkedInwardEntry.assignedTeam}</span>
                                    </div>
                                    <div className="tp-dl-field">
                                        <span className="tp-dl-key">Due</span>
                                        <span className="tp-dl-val">{formatDate(linkedInwardEntry.dueDate)}</span>
                                    </div>
                                    {linkedInwardEntry.assignmentInstructions && (
                                        <div className="tp-dl-field">
                                            <span className="tp-dl-key">Instructions</span>
                                            <span className="tp-dl-val">{linkedInwardEntry.assignmentInstructions}</span>
                                        </div>
                                    )}
                                    <div className="tp-dl-notice"><CheckCircle2 size={13}/> Submitting will mark this as Completed</div>
                                </div>
                            ) : (
                                <div className="tp-dl-empty">
                                    <FileText size={28}/>
                                    <p>No inward entry linked</p>
                                    <span>This will be an independent outward entry</span>
                                </div>
                            )}

                            <div className="tp-dl-select-wrap">
                                <label className="tp-dl-select-label">Link to Inward</label>
                                <select name="linkedInwardId" className="tp-dl-select" value={formData.linkedInwardId} onChange={handleChange}>
                                    <option value="">None (independent)</option>
                                    {pendingInward.map(e => <option key={e.id} value={e.id}>{e.inwardNo} – {e.subject?.slice(0,35)}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* RIGHT PANEL — form */}
                        <div className="tp-drawer-right">
                            <div className="modal-header">
                                <h3><Plus size={18}/> Create Outward Entry</h3>
                                <button className="btn-close" onClick={() => { setShowForm(false); resetForm(); }}><X size={18}/></button>
                            </div>
                            <div className="modal-body">
                                <form id="outward-form" onSubmit={handleSubmit}>
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
                                            <input type="email" name="teamMemberEmail" className="form-input" value={formData.teamMemberEmail} onChange={handleChange} required placeholder="your@email.com"/>
                                        </div>
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
                                            <input type="datetime-local" name="signReceiptDateTime" className="form-input" value={formData.signReceiptDateTime} onChange={handleChange} required/>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">To Whom</label>
                                        <input type="text" name="toWhom" className="form-input" value={formData.toWhom} onChange={handleChange} placeholder="Recipient name or organization"/>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Subject</label>
                                        <input type="text" name="subject" className="form-input" value={formData.subject} onChange={handleChange} placeholder="Subject"/>
                                    </div>
                                    <div className="grid-2">
                                        <div className="form-group">
                                            <label className="form-label">Sent By *</label>
                                            <input type="text" name="sentBy" className="form-input" value={formData.sentBy} onChange={handleChange} required placeholder="Your name"/>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">File Reference *</label>
                                            <input type="text" name="fileReference" className="form-input" value={formData.fileReference} onChange={handleChange} required placeholder="e.g. F/2024/001"/>
                                        </div>
                                    </div>
                                    <div className="grid-2">
                                        <div className="form-group">
                                            <label className="form-label">Postal Tariff (Rs.)</label>
                                            <input type="number" name="postalTariff" className="form-input" value={formData.postalTariff} onChange={handleChange} placeholder="0" min="0"/>
                                        </div>
                                        <div className="form-group checkbox-wrapper">
                                            <label className="checkbox-label">
                                                <input type="checkbox" name="caseClosed" checked={formData.caseClosed} onChange={handleChange}/>
                                                Mark Case as Closed
                                            </label>
                                        </div>
                                    </div>
                                    <div className="grid-2">
                                        <div className="form-group">
                                            <label className="form-label">Ack Rec</label>
                                            <input type="text" name="ackRec" className="form-input" value={formData.ackRec} onChange={handleChange} placeholder="Acknowledgement received"/>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Cross No.</label>
                                            <input type="text" name="crossNo" className="form-input" value={formData.crossNo} onChange={handleChange} placeholder="Cross reference"/>
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Receipt No.</label>
                                        <input type="text" name="receiptNo" className="form-input" value={formData.receiptNo} onChange={handleChange} placeholder="Receipt number"/>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Remarks</label>
                                        <textarea name="remarks" className="form-input" value={formData.remarks} onChange={handleChange} placeholder="Enter remarks..." rows="2"/>
                                    </div>
                                </form>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</button>
                                <button type="submit" form="outward-form" className="btn btn-primary"><Check size={16}/> Create Outward Entry</button>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Outward Details Modal */}
            {showDetailsModal && selectedEntry && (
                <div className="modal-overlay" onClick={() => setShowDetailsModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><FileText size={20}/> Outward Details</h3>
                            <button className="btn-close" onClick={() => setShowDetailsModal(false)}><X size={20}/></button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-grid">
                                <div className="detail-item"><label>Outward No</label><span className="detail-value highlight">{selectedEntry.outwardNo}</span></div>
                                <div className="detail-item"><label>Team</label><span className="badge badge-team">{selectedEntry.createdByTeam}</span></div>
                                <div className="detail-item full"><label>Subject</label><span>{selectedEntry.subject}</span></div>
                                <div className="detail-item"><label>To</label><span>{selectedEntry.toWhom}</span></div>
                                <div className="detail-item"><label>Sent By</label><span>{selectedEntry.sentBy}</span></div>
                                <div className="detail-item"><label>Means</label><span>{selectedEntry.means}</span></div>
                                <div className="detail-item"><label>Date</label><span>{formatDate(selectedEntry.signReceiptDateTime)}</span></div>
                                {selectedEntry.postalTariff > 0 && <div className="detail-item"><label>Postal Tariff</label><span>Rs. {selectedEntry.postalTariff}</span></div>}
                                <div className="detail-item"><label>Case Closed</label><span>{selectedEntry.caseClosed ? 'Yes' : 'No'}</span></div>
                                {selectedEntry.remarks && <div className="detail-item full"><label>Remarks</label><span>{selectedEntry.remarks}</span></div>}
                            </div>
                        </div>
                        <div className="modal-footer">
                            {!selectedEntry.caseClosed && viewTeam === selectedTeam && (
                                <button className="btn btn-primary" onClick={() => handleCloseCase(selectedEntry.id)}><Lock size={16}/> Close Case</button>
                            )}
                            <button className="btn btn-secondary" onClick={() => setShowDetailsModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Remarks Modal */}
            {remarksModal && (
                <div className="modal-overlay" onClick={() => setRemarksModal(null)}>
                    <div className="modal" style={{maxWidth: 460}} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title">Remarks — {remarksModal.inwardNo}</h2>
                            <button className="modal-close" onClick={() => setRemarksModal(null)}><X size={18}/></button>
                        </div>
                        <form onSubmit={submitRemarks}>
                            <div style={{padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                                <p style={{margin: 0, fontSize: '0.8125rem', color: 'var(--text-secondary)'}}>
                                    {remarksModal.subject}
                                </p>
                                <div className="form-group" style={{margin: 0}}>
                                    <label className="form-label">Remarks</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={5}
                                        placeholder="Add your remarks here..."
                                        value={remarksText}
                                        onChange={e => setRemarksText(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setRemarksModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Save Remarks</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Mark Complete — File Reference Modal */}
            {completeModal && (
                <div className="modal-overlay" onClick={() => setCompleteModal(null)}>
                    <div className="modal" style={{maxWidth: 420}} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2 className="modal-title"><CheckCircle2 size={16}/> Mark as Complete</h2>
                            <button className="modal-close" onClick={() => setCompleteModal(null)}><X size={18}/></button>
                        </div>
                        <form onSubmit={submitMarkComplete}>
                            <div style={{padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                                <p style={{margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)'}}>
                                    Please enter the file reference before marking this entry as complete.
                                </p>
                                <div className="form-group" style={{margin: 0}}>
                                    <label className="form-label">File Reference *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="e.g. F/2024/001"
                                        value={completeFileRef}
                                        onChange={e => setCompleteFileRef(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setCompleteModal(null)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Mark Complete</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Inward Details Modal */}
            {showInwardModal && selectedInwardEntry && (
                <div className="modal-overlay" onClick={() => setShowInwardModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><FileText size={20}/> Assignment Details</h3>
                            <button className="btn-close" onClick={() => setShowInwardModal(false)}><X size={20}/></button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-grid">
                                <div className="detail-item"><label>Inward No</label><span className="detail-value highlight">{selectedInwardEntry.inwardNo}</span></div>
                                <div className="detail-item"><label>Team</label><span className="badge badge-team">{selectedInwardEntry.assignedTeam}</span></div>
                                <div className="detail-item full"><label>Subject</label><span>{selectedInwardEntry.subject}</span></div>
                                <div className="detail-item"><label>From</label><span>{selectedInwardEntry.particularsFromWhom}</span></div>
                                <div className="detail-item"><label>Status</label><span>{selectedInwardEntry.assignmentStatus}</span></div>
                                <div className="detail-item"><label>Due Date</label><span>{formatDate(selectedInwardEntry.dueDate)}</span></div>
                                {selectedInwardEntry.assignmentInstructions && <div className="detail-item full"><label>Instructions</label><span>{selectedInwardEntry.assignmentInstructions}</span></div>}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-primary" onClick={() => { setShowInwardModal(false); handleProcess(selectedInwardEntry); }}><ArrowRight size={16}/> Forward</button>
                            <button className="btn btn-secondary" onClick={() => setShowInwardModal(false)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            <ChatBot storageKey="iosys_chat_team" />
        </motion.div>
    );
}

export default TeamPortal;
