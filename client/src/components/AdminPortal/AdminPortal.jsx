import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { GoogleLogin, googleLogout } from '@react-oauth/google';
import { inwardAPI, dashboardAPI, outwardAPI, notesAPI, auditAPI, aiAPI, inboxQueueAPI, recycleBinAPI } from '../../services/api';
import {
    Inbox, Plus, ClipboardList, Check, X, Search, Filter,
    Clock, CheckCircle2, AlertCircle, Calendar, Mail, User,
    FileText, RefreshCw, Eye, Edit3, ArrowDownToLine, Loader2, Download,
    Sun, Moon, ArrowLeft, Printer, Sparkles, Trash2, RotateCcw
} from 'lucide-react';
import ChatBot from '../ChatBot/ChatBot';
import './AdminPortal.css';

const ADMIN_EMAIL = 'coeofficeinward@sssihl.edu.in';
const BOSS_EMAIL  = 'controller@sssihl.edu.in';
const ALLOWED_EMAILS = [ADMIN_EMAIL, BOSS_EMAIL];

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
    const [inwardTab, setInwardTab] = useState('all');
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
        subject: '',
        assignedTeam: '',
        assignedToEmail: '',
        assignmentInstructions: '',
        dueDate: ''
    });
    const MANUAL_INWARD_MEANS = ['Post', 'Hand Delivery', 'Courier'];

    const [formData, setFormData] = useState({
        means: '',
        inwardNo: '',
        inwardNoSuffix: '',
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

    // AI Agent — Create from Email
    const [showEmailModal, setShowEmailModal] = useState(false);
    const [emailPasteText, setEmailPasteText] = useState('');
    const [emailAnalyzing, setEmailAnalyzing] = useState(false);

    // AI Agent — Auto-assign
    const [autoAssignLoadingId, setAutoAssignLoadingId] = useState(null);

    // Bulk auto-assign
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [bulkAssigning, setBulkAssigning] = useState(false);
    const [bulkResults, setBulkResults] = useState(null); // { done, failed }

    // Duplicate detection
    const [duplicateWarnings, setDuplicateWarnings] = useState([]);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [recycleBin, setRecycleBin] = useState([]);
    const [recycleBinLoading, setRecycleBinLoading] = useState(false);
    const [restoreLoadingId, setRestoreLoadingId] = useState(null);
    const [permDeleteConfirmId, setPermDeleteConfirmId] = useState(null);

    // Inbox Queue
    const [inboxItems, setInboxItems]       = useState([]);
    const [inboxCount, setInboxCount]       = useState(0);
    const [inboxLoading, setInboxLoading]   = useState(false);
    const [inboxAcceptItem, setInboxAcceptItem] = useState(null); // item being confirmed
    const [inboxAcceptData, setInboxAcceptData] = useState({});   // editable fields
    const [inboxAccepting, setInboxAccepting]   = useState(false);
    const [inboxAiLoading, setInboxAiLoading]   = useState(false);
    const [inboxQueuePage, setInboxQueuePage]   = useState(1);
    const INBOX_PAGE_SIZE = 5;
    const [inboxViewItem, setInboxViewItem]     = useState(null); // email body viewer

    // ChatBot — jump to entry & reminder banner
    const [highlightedInwardNo, setHighlightedInwardNo] = useState(null);
    const [dueReminderBanners, setDueReminderBanners] = useState([]);

    // Buddha Purnima — 28 Apr 2026, auto-hides at 21:00 IST
    const isBuddhaPurnima = (() => {
        const istNow = new Date(Date.now() + 5.5 * 3600000);
        return true; // TEMP: restore to May 1 check after testing
    })();
    const [showFestival, setShowFestival] = useState(isBuddhaPurnima);
    const [bpBannerDismissed, setBpBannerDismissed] = useState(false);
    const [bpPaused, setBpPaused] = useState(false);
    const bpCanvasRef = useRef(null);

    useEffect(() => {
        if (!showFestival) return;
        const canvas = bpCanvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
        resize();
        window.addEventListener('resize', resize);

        // Mouse tracking for repulsion
        const mouse = { x: -9999, y: -9999 };
        const onMouseMove = (e) => { mouse.x = e.clientX; mouse.y = e.clientY; };
        window.addEventListener('mousemove', onMouseMove);

        // ── Petals ──
        const LAYER = [
            { scale: 0.55, speedMul: 0.55, alpha: 0.09 },
            { scale: 0.78, speedMul: 0.78, alpha: 0.14 },
            { scale: 1.00, speedMul: 1.00, alpha: 0.20 },
        ];
        const makePetal = (x, y, burst) => {
            const l = burst ? 2 : Math.floor(Math.random() * 3);
            return {
                x: x ?? Math.random() * window.innerWidth,
                y: y ?? -20 - Math.random() * window.innerHeight,
                r: (7 + Math.random() * 11) * LAYER[l].scale,
                speed: (0.5 + Math.random() * 0.9) * LAYER[l].speedMul,
                swayAmp: 0.8 + Math.random() * 1.8,
                swayFreq: 0.012 + Math.random() * 0.018,
                swayPhase: Math.random() * Math.PI * 2,
                flip: Math.random() * Math.PI * 2,
                flipSpeed: 0.025 + Math.random() * 0.035,
                angle: Math.random() * Math.PI * 2,
                spin: (Math.random() - 0.5) * 0.02,
                alpha: LAYER[l].alpha,
                vx: burst ? (Math.random() - 0.5) * 6 : 0,
                vy: burst ? -3 - Math.random() * 3 : 0,
                layer: l,
                isBurst: !!burst,
                life: burst ? 1 : null,
            };
        };
        const petals = Array.from({ length: 35 }, () => {
            const p = makePetal();
            p.y = Math.random() * window.innerHeight;
            return p;
        });
        const onClick = (e) => {
            for (let i = 0; i < 14; i++) petals.push(makePetal(e.clientX, e.clientY, true));
        };
        window.addEventListener('click', onClick);

        // ── Golden incense particles ──
        const makeParticle = (init) => ({
            x: Math.random() * window.innerWidth,
            y: init ? Math.random() * window.innerHeight : window.innerHeight + 5,
            vy: 0.35 + Math.random() * 0.75,
            swayAmp: 0.4 + Math.random() * 1.0,
            swayFreq: 0.008 + Math.random() * 0.015,
            swayPhase: Math.random() * Math.PI * 2,
            size: 1.2 + Math.random() * 2.2,
            baseAlpha: 0.25 + Math.random() * 0.45,
            sparkle: Math.random() < 0.28,
            progress: init ? Math.random() : 0,
        });
        const particles = Array.from({ length: 45 }, () => makeParticle(true));

        let t = 0;
        let raf;
        const draw = () => {
            t++;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.progress += p.vy / canvas.height;
                p.y -= p.vy;
                p.x += p.swayAmp * Math.sin(p.swayFreq * t + p.swayPhase);
                if (p.progress >= 1 || p.y < -10) { Object.assign(p, makeParticle(false)); return; }
                const fadeIn  = Math.min(p.progress * 6, 1);
                const fadeOut = 1 - Math.pow(p.progress, 1.6);
                const alpha   = p.baseAlpha * fadeIn * fadeOut;
                if (alpha <= 0.01) return;
                ctx.save();
                ctx.globalAlpha = alpha;
                if (p.sparkle) {
                    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 3.5);
                    g.addColorStop(0, '#fef9c3'); g.addColorStop(0.4, '#fbbf24'); g.addColorStop(1, 'transparent');
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3.5, 0, Math.PI * 2); ctx.fill();
                    ctx.strokeStyle = '#fef08a'; ctx.lineWidth = 0.6; ctx.globalAlpha = alpha * 0.6;
                    const s = p.size * 2.5;
                    ctx.beginPath();
                    ctx.moveTo(p.x - s, p.y); ctx.lineTo(p.x + s, p.y);
                    ctx.moveTo(p.x, p.y - s); ctx.lineTo(p.x, p.y + s);
                    ctx.stroke();
                } else {
                    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2.5);
                    g.addColorStop(0, '#fde68a'); g.addColorStop(0.5, '#f59e0b'); g.addColorStop(1, 'transparent');
                    ctx.fillStyle = g;
                    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 2.5, 0, Math.PI * 2); ctx.fill();
                }
                ctx.restore();
            });
            // Petals
            for (let i = petals.length - 1; i >= 0; i--) {
                const p = petals[i];
                p.x += p.swayAmp * Math.sin(p.swayFreq * t + p.swayPhase);
                p.y += p.speed;
                p.angle += p.spin;
                p.flip += p.flipSpeed;
                const dx = p.x - mouse.x, dy = p.y - mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 130 && dist > 0) {
                    const force = (130 - dist) / 130;
                    p.vx += (dx / dist) * force * 2.5;
                    p.vy += (dy / dist) * force * 2.5;
                }
                p.vx *= 0.90; p.vy *= 0.90;
                p.x += p.vx; p.y += p.vy;
                if (p.isBurst) {
                    p.life -= 0.007;
                    if (p.life <= 0) { petals.splice(i, 1); continue; }
                } else if (p.y > canvas.height + 20) {
                    p.y = -20; p.x = Math.random() * canvas.width;
                }
                const alpha = p.isBurst ? p.alpha * p.life * 3 : p.alpha;
                const flipX = Math.abs(Math.cos(p.flip));
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.scale(flipX, 1);
                ctx.globalAlpha = Math.min(alpha, 0.9);
                ctx.beginPath();
                ctx.ellipse(0, -p.r * 0.55, p.r * 0.42, p.r, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#f9a8d4'; ctx.fill();
                ctx.beginPath();
                ctx.ellipse(0, -p.r * 0.55, p.r * 0.22, p.r * 0.55, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#fce7f3'; ctx.fill();
                ctx.restore();
            }

            raf = requestAnimationFrame(draw);
        };
        draw();

        // auto-hide at 21:00 IST
        const istNow = new Date(Date.now() + 5.5 * 3600000);
        const msUntil21 = (21 * 60 - (istNow.getUTCHours() * 60 + istNow.getUTCMinutes())) * 60000;
        let hideTimer;
        if (msUntil21 > 0) hideTimer = setTimeout(() => setShowFestival(false), msUntil21);
        return () => {
            cancelAnimationFrame(raf);
            clearTimeout(hideTimer);
            window.removeEventListener('resize', resize);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('click', onClick);
        };
    }, [showFestival]);

    // Close topmost open modal on Escape — placed after all modal state declarations
    useEffect(() => {
        const onEsc = (e) => {
            if (e.key !== 'Escape') return;
            if (inboxAcceptItem)   { setInboxAcceptItem(null); return; }
            if (inboxViewItem)     { setInboxViewItem(null); return; }
            if (showModal)         { closeWithAnimation('details', () => setShowModal(false)); return; }
            if (showReassignModal) { closeWithAnimation('reassign', () => setShowReassignModal(false)); return; }
            if (showNotesForm)     { closeWithAnimation('notes', () => setShowNotesForm(false)); return; }
            if (createSuccess)     { closeWithAnimation('createSuccess', () => setCreateSuccess(null)); return; }
            if (assignSuccess)     { closeWithAnimation('assignSuccess', () => setAssignSuccess(null)); return; }
            if (showForm)          { closeWithAnimation('form', () => setShowForm(false)); return; }
            if (showEmailModal)    { setShowEmailModal(false); }
        };
        document.addEventListener('keydown', onEsc);
        return () => document.removeEventListener('keydown', onEsc);
    }, [inboxAcceptItem, inboxViewItem, showModal, showReassignModal, showNotesForm, createSuccess, assignSuccess, showForm, showEmailModal]);

    // Track previous inbox count to detect new arrivals
    const prevInboxCountRef = useRef(null);

    // Request browser notification permission once (admin only)
    useEffect(() => {
        if (adminUser?.email === ADMIN_EMAIL && 'Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }, [adminUser]);

    // Background inbox count poll every 2 min — fires notifications on any tab
    useEffect(() => {
        if (adminUser?.email !== ADMIN_EMAIL) return;
        const poll = setInterval(async () => {
            try {
                const res = await inboxQueueAPI.getCount();
                const newCount = res.data.count || 0;
                if (prevInboxCountRef.current !== null && newCount > prevInboxCountRef.current) {
                    const added = newCount - prevInboxCountRef.current;
                    if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification('New Email in Inbox Queue', {
                            body: `${added} new email${added > 1 ? 's' : ''} arrived and ${added > 1 ? 'are' : 'is'} waiting for review.`,
                            icon: '/favicon.ico',
                        });
                    }
                    setInboxCount(newCount);
                }
                prevInboxCountRef.current = newCount;
            } catch { /* ignore */ }
        }, 2 * 60 * 1000);
        return () => clearInterval(poll);
    }, [adminUser]);

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
        // Check for due reminders
        try {
            const reminders = JSON.parse(localStorage.getItem('iosys_reminders') || '[]');
            const today = new Date().toISOString().split('T')[0];
            const due = reminders.filter(r => !r.dismissed && r.dueDate <= today);
            if (due.length > 0) setDueReminderBanners(due);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        filterEntries();
    }, [entries, searchTerm, statusFilter, teamFilter, dateFrom, dateTo]);

    // Auto-refresh inbox every 30 min when inbox tab is active
    useEffect(() => {
        if (adminPage !== 'inbox') return;
        setInboxQueuePage(1);
        const interval = setInterval(() => {
            loadInboxItems();
        }, 30 * 60 * 1000);
        return () => clearInterval(interval);
    }, [adminPage]);

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
        try {
            const countRes = await inboxQueueAPI.getCount();
            setInboxCount(countRes.data.count || 0);
        } catch { /* ignore */ }
    };

    const loadInboxItems = async () => {
        setInboxLoading(true);
        try {
            const res = await inboxQueueAPI.getItems('pending');
            const newItems = res.data.items || [];
            const newCount = res.data.pendingCount || 0;

            prevInboxCountRef.current = newCount;

            setInboxItems(newItems);
            setInboxCount(newCount);
            setInboxQueuePage(1);
        } catch (err) {
            console.error('Error loading inbox queue:', err);
        } finally {
            setInboxLoading(false);
        }
    };

    const openInboxAccept = async (item) => {
        const baseData = {
            particularsFromWhom:    item.ai_from || item.from_name || item.from_email,
            subject:                item.subject,
            means:                  'Email',
            signReceiptDateTime:    item.received_at,
            assignedTeam:           item.ai_team || '',
            assignedToEmail:        item.ai_team ? (TEAM_EMAILS[item.ai_team] || '') : '',
            assignmentInstructions: '',
            dueDate:                item.ai_due_date || '',
            remarks:                item.ai_remarks  || '',
        };

        // If AI already suggested a team during polling, open modal immediately
        if (item.ai_team) {
            setInboxAcceptData(baseData);
            setInboxAcceptItem(item);
            return;
        }

        // No AI team yet — fetch suggestion first, show spinner on the button
        setInboxAiLoading(item.id);
        try {
            const aiRes = await aiAPI.suggestAssign({
                subject: item.subject,
                from:    item.from_name || item.from_email,
                remarks: item.ai_remarks || '',
                means:   'Email',
            });
            const s = aiRes.data.suggestion || {};
            if (s.assignedTeam) {
                baseData.assignedTeam           = s.assignedTeam;
                baseData.assignedToEmail        = TEAM_EMAILS[s.assignedTeam] || '';
                baseData.assignmentInstructions = s.assignmentInstructions || '';
                baseData.dueDate                = s.dueDate || baseData.dueDate;
            }
        } catch {
            // AI failed — open modal anyway, admin fills team manually
        } finally {
            setInboxAiLoading(null);
        }

        setInboxAcceptData(baseData);
        setInboxAcceptItem(item);
    };

    const handleInboxAccept = async () => {
        if (!inboxAcceptItem) return;
        setInboxAccepting(true);
        const acceptedId = inboxAcceptItem.id;
        try {
            await inboxQueueAPI.accept(acceptedId, inboxAcceptData);
            // Remove immediately from the list (optimistic update)
            setInboxAcceptItem(null);
            setInboxItems(prev => prev.filter(i => i.id !== acceptedId));
            setInboxCount(prev => Math.max(0, prev - 1));
            loadData();
        } catch (err) {
            alert('Failed to accept: ' + (err.response?.data?.message || err.message));
        } finally {
            setInboxAccepting(false);
        }
    };

    const handleInboxReject = async (id) => {
        try {
            await inboxQueueAPI.reject(id);
            setInboxItems(prev => prev.filter(i => i.id !== id));
            setInboxCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            alert('Failed to reject: ' + (err.response?.data?.message || err.message));
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
            let submitData = formData;
            if (MANUAL_INWARD_MEANS.includes(formData.means) && formData.inwardNo?.trim() && formData.signReceiptDateTime) {
                const d = new Date(formData.signReceiptDateTime);
                const dd = d.getDate().toString().padStart(2, '0');
                const mm = (d.getMonth() + 1).toString().padStart(2, '0');
                const yyyy = d.getFullYear();
                const prefix = `INW/${dd}/${mm}/${yyyy}-`;
                const suffix = formData.inwardNoSuffix?.trim() ? `-${formData.inwardNoSuffix.trim()}` : '';
                submitData = { ...formData, inwardNo: prefix + formData.inwardNo.trim() + suffix };
            }
            const response = await inwardAPI.create(submitData);
            const newId      = response.data.id;
            const inwardNo   = response.data.inwardNo;

            if (formData.assignedTeam && newId) {
                // Admin manually picked a team — assign directly
                await inwardAPI.assign(newId, {
                    assignedTeam:           formData.assignedTeam,
                    assignedToEmail:        formData.assignedToEmail,
                    assignmentInstructions: formData.assignmentInstructions,
                    dueDate:                formData.dueDate,
                });
                setAssignSuccess({
                    inwardNo, team: formData.assignedTeam,
                    email: formData.assignedToEmail, subject: formData.subject,
                });
            } else if (newId) {
                // No team selected — get AI suggestion, then let admin approve via reassign modal
                setShowForm(false);
                resetForm();
                loadData();
                setCreateSuccess({ inwardNo, subject: formData.subject });
                try {
                    const aiRes = await aiAPI.suggestAssign({
                        subject: formData.subject,
                        from:    formData.particularsFromWhom,
                        remarks: formData.remarks,
                        means:   formData.means,
                    });
                    const s = aiRes.data.suggestion || {};
                    if (s.assignedTeam) {
                        setReassignData({
                            assignedTeam:           s.assignedTeam,
                            assignedToEmail:        TEAM_EMAILS[s.assignedTeam] || '',
                            assignmentInstructions: s.assignmentInstructions || '',
                            dueDate:                s.dueDate || '',
                        });
                        const entryRes = await inwardAPI.get(newId);
                        setSelectedEntry(entryRes.data.entry);
                        setShowReassignModal(true);
                    }
                } catch {
                    // AI failed silently — entry stays unassigned
                }
                return;
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
            means: '', inwardNo: '', inwardNoSuffix: '', particularsFromWhom: '', subject: '',
            signReceiptDateTime: new Date().toISOString(), assignedTeam: '', assignedToEmail: '',
            assignmentInstructions: '', dueDate: '', remarks: ''
        });
        setSmartFillResult(null);
        setDuplicateWarnings([]);
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

    // AI Agent: analyze pasted email text → populate create form
    const handleAnalyzeEmail = async () => {
        if (!emailPasteText.trim()) return;
        setEmailAnalyzing(true);
        try {
            const res = await aiAPI.extract(emailPasteText);
            const fields = res.data.fields || {};
            setFormData(prev => ({
                ...prev,
                particularsFromWhom: fields.particularsFromWhom || prev.particularsFromWhom,
                subject:             fields.subject             || prev.subject,
                means:               fields.means              || prev.means,
                assignedTeam:        fields.assignedTeam        || prev.assignedTeam,
                assignedToEmail:     fields.assignedTeam ? (TEAM_EMAILS[fields.assignedTeam] || '') : prev.assignedToEmail,
                dueDate:             fields.dueDate             || prev.dueDate,
                remarks:             fields.remarks             || prev.remarks,
            }));
            setShowEmailModal(false);
            setEmailPasteText('');
            setShowForm(true);
        } catch (err) {
            alert('AI extraction failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setEmailAnalyzing(false);
        }
    };

    const handleDeleteEntry = async (id) => {
        try {
            await inwardAPI.delete(id);
            setEntries(prev => prev.filter(e => e.id !== id));
            setFilteredEntries(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            alert('Failed to delete entry: ' + err.message);
        } finally {
            setDeleteConfirmId(null);
        }
    };

    const loadRecycleBin = async () => {
        setRecycleBinLoading(true);
        try {
            const res = await recycleBinAPI.getAll();
            setRecycleBin(res.data.entries || []);
        } catch (err) {
            console.error('Failed to load recycle bin:', err);
        } finally {
            setRecycleBinLoading(false);
        }
    };

    const handleRestore = async (id) => {
        setRestoreLoadingId(id);
        try {
            await recycleBinAPI.restore(id);
            setRecycleBin(prev => prev.filter(e => e.id !== id));
            // Reload inward entries so restored entry appears
            const res = await inwardAPI.getAll();
            setEntries(res.data.entries);
            setFilteredEntries(res.data.entries);
        } catch (err) {
            alert('Restore failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setRestoreLoadingId(null);
        }
    };

    const handlePermDelete = async (id) => {
        try {
            await recycleBinAPI.permanentDelete(id);
            setRecycleBin(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            alert('Failed to permanently delete: ' + err.message);
        } finally {
            setPermDeleteConfirmId(null);
        }
    };

    // AI Agent: suggest team assignment for an unassigned entry
    const handleAutoAssign = async (entry) => {
        setAutoAssignLoadingId(entry.id);
        try {
            const res = await aiAPI.suggestAssign({
                subject: entry.subject,
                from:    entry.particularsFromWhom,
                remarks: entry.remarks,
                means:   entry.means,
            });
            const s = res.data.suggestion || {};
            // Pre-fill the reassign modal with AI suggestion
            setReassignData({
                assignedTeam:            s.assignedTeam || '',
                assignedToEmail:         s.assignedTeam ? (TEAM_EMAILS[s.assignedTeam] || '') : '',
                assignmentInstructions:  s.assignmentInstructions || '',
                dueDate:                 s.dueDate || '',
            });
            setSelectedEntry(entry);
            setShowReassignModal(true);
        } catch (err) {
            alert('Auto-assign failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setAutoAssignLoadingId(null);
        }
    };

    const checkDuplicates = (sender, subject) => {
        if (!sender.trim() || !subject.trim()) { setDuplicateWarnings([]); return; }
        const stopWords = new Set(['the','a','an','of','in','to','for','on','at','by','is','are','was','were','and','or','with','from','re','regarding','reg']);
        const tokenize = str => str.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w));
        const senderTokens  = new Set(tokenize(sender));
        const subjectTokens = new Set(tokenize(subject));
        const matches = entries.filter(e => {
            const eSender  = tokenize(e.particularsFromWhom || '');
            const eSubject = tokenize(e.subject || '');
            const senderHit  = eSender.some(w => senderTokens.has(w));
            const subjectHits = eSubject.filter(w => subjectTokens.has(w)).length;
            return senderHit && subjectHits >= 2;
        });
        setDuplicateWarnings(matches.slice(0, 3));
    };

    const handleBulkAutoAssign = async () => {
        const toAssign = entries.filter(e => selectedIds.has(e.id) && !e.assignedTeam);
        if (toAssign.length === 0) return;
        setBulkAssigning(true);
        setBulkResults(null);
        let done = 0, failed = 0;
        for (const entry of toAssign) {
            try {
                const res = await aiAPI.suggestAssign({
                    subject: entry.subject,
                    from:    entry.particularsFromWhom,
                    remarks: entry.remarks,
                    means:   entry.means,
                });
                const s = res.data.suggestion || {};
                if (s.assignedTeam) {
                    await inwardAPI.assign(entry.id, {
                        subject:                entry.subject,
                        assignedTeam:           s.assignedTeam,
                        assignedToEmail:        TEAM_EMAILS[s.assignedTeam] || '',
                        assignmentInstructions: s.assignmentInstructions || '',
                        dueDate:                s.dueDate || '',
                    });
                    done++;
                } else {
                    failed++;
                }
            } catch {
                failed++;
            }
        }
        setBulkResults({ done, failed });
        setSelectedIds(new Set());
        setBulkAssigning(false);
        await loadData();
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

    const handleFindEntry = (inwardNo) => {
        setAdminPage('registers');
        setInwardTab('all');
        setSearchTerm(inwardNo);
        setInwardPage(1);
        setHighlightedInwardNo(inwardNo);
        setTimeout(() => setHighlightedInwardNo(null), 4000);
    };

    const dismissReminderBanner = (id) => {
        setDueReminderBanners(prev => prev.filter(r => r.id !== id));
        try {
            const all = JSON.parse(localStorage.getItem('iosys_reminders') || '[]');
            localStorage.setItem('iosys_reminders', JSON.stringify(
                all.map(r => r.id === id ? { ...r, dismissed: true } : r)
            ));
        } catch { /* ignore */ }
    };

    const openDetailsModal = (entry) => {
        setSelectedEntry(entry);
        setShowModal(true);
    };

    const openReassignModal = (entry) => {
        setSelectedEntry(entry);
        setReassignData({
            subject: entry.subject || '',
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
            if (!ALLOWED_EMAILS.includes(payload.email)) {
                alert(`Access denied. This portal is restricted to authorised SSSIHL accounts.`);
                return;
            }
            const user = {
                email: payload.email,
                name: payload.name,
                picture: payload.picture,
                role: payload.email === BOSS_EMAIL ? 'boss' : 'admin',
            };
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
                    <p className="ap-login-hint">Restricted to authorised SSSIHL accounts.</p>
                </div>
            </div>
        );
    }

    const isAdmin = adminUser?.role === 'admin' || adminUser?.email === ADMIN_EMAIL;

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
        <motion.div
            className="ap-page-wrapper"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
        >
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
                    {isAdmin && (
                        <button className={`ap-nav-tab ap-nav-tab--inbox${adminPage === 'inbox' ? ' active' : ''}`} onClick={() => { setAdminPage('inbox'); loadInboxItems(); }}>
                            Inbox
                            {inboxCount > 0 && <span className="inbox-badge">{inboxCount}</span>}
                        </button>
                    )}
                    {isAdmin && (
                        <button className={`ap-nav-tab${adminPage === 'recycle' ? ' active' : ''}`} onClick={() => { setAdminPage('recycle'); loadRecycleBin(); }}>
                            <Trash2 size={13} style={{ marginRight: '5px', verticalAlign: 'middle' }} />
                            Recycle Bin
                            {recycleBin.length > 0 && <span className="inbox-badge" style={{ background: '#f87171' }}>{recycleBin.length}</span>}
                        </button>
                    )}
                </div>

                <div className="ap-nav-right">
                    <button className="btn btn-secondary ap-nav-action-btn" onClick={downloadOutwardReport} title="Download Outward Expenditure Report">
                        <Download size={16} /> Export Report
                    </button>
                    <button className="btn btn-icon-only" onClick={loadData} disabled={loading} title="Refresh">
                        <RefreshCw size={16} className={loading ? 'spin' : ''} />
                    </button>
                    {isAdmin && (<>
                        <button className="btn btn-ghost ap-nav-action-btn" onClick={() => setShowEmailModal(true)} title="Create entry from pasted email or letter">
                            <Sparkles size={15} /> From Email
                        </button>
                        <button className="btn btn-primary ap-nav-action-btn" onClick={() => setShowForm(true)}>
                            <Plus size={16} /> New Entry
                        </button>
                    </>)}
                    <div className="ap-nav-divider" />
                    <button className="ap-theme-btn" onClick={() => { document.body.classList.add('theme-transitioning'); setIsDarkMode(v => !v); setTimeout(() => document.body.classList.remove('theme-transitioning'), 350); }} title="Toggle theme">
                        {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
                    </button>
                    <div className="ap-user-pill" style={{ cursor: 'pointer' }} onClick={handleLogout} title="Sign out">
                        <div className="ap-user-info">
                            <span className="ap-user-role">{adminUser.name || (isAdmin ? 'Admin' : 'Controller')}</span>
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
            {/* Buddha Purnima decoration — May 1 2026 only, auto-hides at 21:00 IST */}
            {showFestival && (
                <>
                    {!bpPaused && <canvas ref={bpCanvasRef} className="bp-canvas" />}
                    {!bpBannerDismissed && (
                        <div className="bp-banner">
                            <span className="bp-glow" />
                            <span className="bp-lotus">🪷</span>
                            <div className="bp-text">
                                <span className="bp-title">Sai Ram — Buddha Purnima Greetings</span>
                                <span className="bp-sub">May the light of the Enlightened One guide us with wisdom, peace and compassion.</span>
                            </div>
                            <button className="bp-dismiss" onClick={() => setBpBannerDismissed(true)} title="Dismiss">✕</button>
                        </div>
                    )}
                    <button
                        className="bp-toggle"
                        onClick={() => setBpPaused(p => !p)}
                        title={bpPaused ? 'Resume animation' : 'Pause animation'}
                    >
                        {bpPaused ? '▶' : '⏸'}
                    </button>
                </>
            )}

            {/* Reminder banners */}
            {dueReminderBanners.map(r => (
                <div key={r.id} className="reminder-banner">
                    <span className="reminder-banner-icon">🔔</span>
                    <span className="reminder-banner-text">
                        <strong>Reminder due:</strong> {r.note}
                        {r.entryNo && <span className="reminder-banner-no"> ({r.entryNo})</span>}
                    </span>
                    <button className="reminder-banner-dismiss" onClick={() => dismissReminderBanner(r.id)}>✕</button>
                </div>
            ))}

            {/* Header */}
            <div className="page-header">
                <h2 className="page-title"><Inbox className="icon-svg" /> Admin Portal</h2>
            </div>


            {/* AI Agent — Create from Email Modal */}
            {showEmailModal && (
                <div className="modal-overlay" onClick={() => { setShowEmailModal(false); setEmailPasteText(''); }}>
                    <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Sparkles size={18} /> Create Entry from Email / Letter</h3>
                            <button className="modal-close" onClick={() => { setShowEmailModal(false); setEmailPasteText(''); }}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <p className="agent-email-hint">Paste the full email or letter text below. AI will extract the sender, subject, mode, team, and due date automatically.</p>
                            <textarea
                                className="form-textarea agent-email-textarea"
                                rows={10}
                                placeholder="Paste email or letter content here…"
                                value={emailPasteText}
                                onChange={e => setEmailPasteText(e.target.value)}
                                autoFocus
                            />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => { setShowEmailModal(false); setEmailPasteText(''); }}>Cancel</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleAnalyzeEmail}
                                disabled={emailAnalyzing || !emailPasteText.trim()}
                            >
                                {emailAnalyzing
                                    ? <><Loader2 size={15} className="spin" /> Analyzing…</>
                                    : <><Sparkles size={15} /> Analyze & Fill Form</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            )}

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
                                        <select name="means" className="form-select" value={formData.means} onChange={async e => { handleChange(e); if (MANUAL_INWARD_MEANS.includes(e.target.value)) { try { const res = await inwardAPI.getNextNo(); setFormData(prev => ({ ...prev, inwardNo: res.data.nextNo, inwardNoSuffix: '' })); } catch {} } else { setFormData(prev => ({ ...prev, inwardNo: '', inwardNoSuffix: '' })); } }} required>
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

                                {MANUAL_INWARD_MEANS.includes(formData.means) && (
                                    <div className="form-group">
                                        <label className="form-label">Inward No.</label>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            {/* Main number: prefix + editable number */}
                                            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                                <span style={{
                                                    fontFamily: 'monospace',
                                                    padding: '0 10px',
                                                    height: '38px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    background: 'var(--input-bg, rgba(255,255,255,0.05))',
                                                    border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                                                    borderRight: 'none',
                                                    borderRadius: '6px 0 0 6px',
                                                    color: 'var(--text-secondary, #94a3b8)',
                                                    whiteSpace: 'nowrap',
                                                    fontSize: '13px',
                                                }}>
                                                    {formData.signReceiptDateTime ? (() => {
                                                        const d = new Date(formData.signReceiptDateTime);
                                                        const dd = d.getDate().toString().padStart(2, '0');
                                                        const mm = (d.getMonth() + 1).toString().padStart(2, '0');
                                                        const yyyy = d.getFullYear();
                                                        return `INW/${dd}/${mm}/${yyyy}-`;
                                                    })() : 'INW/DD/MM/YYYY-'}
                                                </span>
                                                <input
                                                    type="text"
                                                    name="inwardNo"
                                                    className="form-input"
                                                    value={formData.inwardNo}
                                                    onChange={handleChange}
                                                    placeholder="0113"
                                                    style={{ fontFamily: 'monospace', borderRadius: '0 6px 6px 0', width: '80px' }}
                                                />
                                            </div>
                                            {/* Optional suffix */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
                                                <span style={{
                                                    fontFamily: 'monospace',
                                                    padding: '0 8px',
                                                    height: '38px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    background: 'var(--input-bg, rgba(255,255,255,0.05))',
                                                    border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
                                                    borderRight: 'none',
                                                    borderRadius: '6px 0 0 6px',
                                                    color: 'var(--text-secondary, #94a3b8)',
                                                    fontSize: '13px',
                                                }}>-</span>
                                                <input
                                                    type="text"
                                                    name="inwardNoSuffix"
                                                    className="form-input"
                                                    value={formData.inwardNoSuffix}
                                                    onChange={handleChange}
                                                    placeholder="10 (optional)"
                                                    style={{ fontFamily: 'monospace', borderRadius: '0 6px 6px 0', width: '110px' }}
                                                />
                                            </div>
                                        </div>
                                        {formData.inwardNo && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px', fontFamily: 'monospace' }}>
                                                Preview: {formData.signReceiptDateTime ? (() => {
                                                    const d = new Date(formData.signReceiptDateTime);
                                                    const dd = d.getDate().toString().padStart(2, '0');
                                                    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
                                                    const yyyy = d.getFullYear();
                                                    return `INW/${dd}/${mm}/${yyyy}-${formData.inwardNo}${formData.inwardNoSuffix?.trim() ? `-${formData.inwardNoSuffix.trim()}` : ''}`;
                                                })() : formData.inwardNo}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="form-group">
                                    <label className="form-label">From Whom *</label>
                                    <input type="text" name="particularsFromWhom" className="form-input"
                                        value={formData.particularsFromWhom}
                                        onChange={e => { handleChange(e); checkDuplicates(e.target.value, formData.subject); }}
                                        required placeholder="Name or organization" />
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
                                            value={formData.subject}
                                            onChange={e => { handleChange(e); setSmartFillResult(null); checkDuplicates(formData.particularsFromWhom, e.target.value); }}
                                            required placeholder="Type subject then click ✦ to auto-fill team, due date & remarks" />
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
                            {duplicateWarnings.length > 0 && (
                                <div className="duplicate-warning">
                                    <div className="duplicate-warning-title">⚠️ Possible duplicates found</div>
                                    {duplicateWarnings.map(e => (
                                        <div key={e.id} className="duplicate-warning-item">
                                            <span className="duplicate-warning-no">{e.inwardNo?.startsWith('NOINW-') ? '-' : e.inwardNo}</span>
                                            <span className="duplicate-warning-from">{e.particularsFromWhom}</span>
                                            <span className="duplicate-warning-subject">{e.subject}</span>
                                        </div>
                                    ))}
                                    <div className="duplicate-warning-hint">Review before saving to avoid duplicate entries.</div>
                                </div>
                            )}
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

            <AnimatePresence mode="wait">
            {adminPage === 'registers' && (
            <motion.div key="registers" style={{ width: '100%' }} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
            {/* Entries Table */}
            <div className="card">
                <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <h3 className="card-title">
                            <ClipboardList size={20} /> Inward Entries
                            <span className="entry-count">{(() => { const tabFiltered = inwardTab === 'manual' ? filteredEntries.filter(e => MANUAL_INWARD_MEANS.includes(e.means)) : filteredEntries; return `(${tabFiltered.length}${tabFiltered.length !== entries.length ? ` of ${entries.length}` : ''})`; })()}</span>
                        </h3>
                        <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px' }}>
                            <button
                                className={`btn${inwardTab === 'all' ? ' btn-primary' : ' btn-ghost'}`}
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}
                                onClick={() => { setInwardTab('all'); setInwardPage(1); }}
                            >All</button>
                            <button
                                className={`btn${inwardTab === 'manual' ? ' btn-primary' : ' btn-ghost'}`}
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.75rem' }}
                                onClick={() => { setInwardTab('manual'); setInwardPage(1); }}
                            >Manual</button>
                        </div>
                    </div>
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
                        {/* Bulk action bar */}
                        {isAdmin && selectedIds.size > 0 && (
                            <div className="bulk-action-bar">
                                <span className="bulk-action-count"><strong>{selectedIds.size}</strong> entr{selectedIds.size === 1 ? 'y' : 'ies'} selected</span>
                                <button className="btn btn-primary bulk-assign-btn" onClick={handleBulkAutoAssign} disabled={bulkAssigning}>
                                    {bulkAssigning
                                        ? <><Loader2 size={14} className="spin" /> Assigning…</>
                                        : <><Sparkles size={14} /> AI Auto-assign {selectedIds.size}</>
                                    }
                                </button>
                                <button className="btn btn-ghost" style={{ fontSize: '0.8rem' }} onClick={() => setSelectedIds(new Set())} disabled={bulkAssigning}>Clear</button>
                            </div>
                        )}
                        {bulkResults && (
                            <div className={`bulk-results ${bulkResults.failed > 0 ? 'bulk-results--warn' : 'bulk-results--ok'}`}>
                                ✓ Auto-assigned {bulkResults.done} entr{bulkResults.done === 1 ? 'y' : 'ies'}.
                                {bulkResults.failed > 0 && ` ${bulkResults.failed} could not be assigned (AI unclear).`}
                                <button className="bulk-results-close" onClick={() => setBulkResults(null)}>✕</button>
                            </div>
                        )}
                        <div className="inward-list">
                            {/* Header strip */}
                            <div className="inward-list-header">
                                {isAdmin && <span className="ilh-check" />}
                                <span className="ilh-seq">#</span>
                                <span className="ilh-entry">Entry / Date</span>
                                <span className="ilh-spacer" />
                                <span className="ilh-team">Team · Status</span>
                                <span className="ilh-actions">Actions</span>
                            </div>

                            {(() => {
                                const pagedEntries = (inwardTab === 'manual' ? filteredEntries.filter(e => MANUAL_INWARD_MEANS.includes(e.means)) : filteredEntries).slice((inwardPage - 1) * INWARD_PAGE_SIZE, inwardPage * INWARD_PAGE_SIZE);
                                return pagedEntries.map((entry, index) => {
                                    const seq = entry.sequenceNo ?? (inwardPage - 1) * INWARD_PAGE_SIZE + index + 1;
                                    const inwardNo = entry.inwardNo?.startsWith('NOINW-') ? '-' : entry.inwardNo;
                                    const overdue = isOverdue(entry.dueDate, entry.assignmentStatus);
                                    const highlighted = highlightedInwardNo && entry.inwardNo === highlightedInwardNo;
                                    const statusKey = (entry.assignmentStatus || 'unassigned').toLowerCase().replace(/\s+/g, '-');
                                    return (
                                        <motion.div
                                            key={entry.id}
                                            className={['inward-card', overdue ? 'inward-card--overdue' : '', highlighted ? 'inward-card--highlighted' : ''].filter(Boolean).join(' ')}
                                            variants={{ initial: { opacity: 0, y: 6 }, animate: { opacity: 1, y: 0, transition: { duration: 0.14 } } }}
                                            initial="initial"
                                            animate="animate"
                                        >
                                            {/* Top row */}
                                            <div className="ic-top">
                                                {isAdmin && (
                                                    <div className="ic-check">
                                                        {!entry.assignedTeam && (
                                                            <input type="checkbox"
                                                                checked={selectedIds.has(entry.id)}
                                                                onChange={e => setSelectedIds(prev => {
                                                                    const next = new Set(prev);
                                                                    e.target.checked ? next.add(entry.id) : next.delete(entry.id);
                                                                    return next;
                                                                })}
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                                <span className="ic-seq">{seq}</span>
                                                <span className="ic-no">{inwardNo}</span>
                                                <div className="ic-meta">
                                                    <span className="ic-date">{formatDate(entry.signReceiptDatetime)}</span>
                                                    {entry.means && <span className="ic-mode">{entry.means}</span>}
                                                    {entry.fileReference && <span className="ic-fileref">{entry.fileReference}</span>}
                                                    {entry.dueDate && (
                                                        <span className={`ic-due${overdue ? ' ic-due--overdue' : ''}`}>
                                                            Due {entry.dueDate}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="ic-badges">
                                                    {entry.assignedTeam
                                                        ? <span className="badge badge-team">{entry.assignedTeam}</span>
                                                        : <span className="ic-unassigned">Unassigned</span>
                                                    }
                                                    <span className={`badge badge-status badge-status--${statusKey}`}>
                                                        {entry.assignmentStatus || 'Unassigned'}
                                                    </span>
                                                </div>
                                                <div className="ic-actions">
                                                    <button className="btn-icon" onClick={() => openDetailsModal(entry)} title="View Details">
                                                        <Eye size={15} />
                                                    </button>
                                                    {isAdmin && (<>
                                                        {!entry.assignedTeam && (
                                                            <button
                                                                className={`btn-icon btn-icon--ai${autoAssignLoadingId === entry.id ? ' loading' : ''}`}
                                                                onClick={() => handleAutoAssign(entry)}
                                                                disabled={autoAssignLoadingId === entry.id}
                                                                title="AI: suggest team assignment"
                                                            >
                                                                {autoAssignLoadingId === entry.id ? <Loader2 size={13} className="spin" /> : <Sparkles size={13} />}
                                                            </button>
                                                        )}
                                                        <button className="btn-icon" onClick={() => openReassignModal(entry)} title={entry.assignedTeam ? 'Reassign' : 'Assign'}>
                                                            <Edit3 size={15} />
                                                        </button>
                                                        {deleteConfirmId === entry.id ? (
                                                            <>
                                                                <button className="btn-icon btn-icon--danger" onClick={() => handleDeleteEntry(entry.id)} title="Confirm delete"><Check size={13} /></button>
                                                                <button className="btn-icon" onClick={() => setDeleteConfirmId(null)} title="Cancel"><X size={13} /></button>
                                                            </>
                                                        ) : (
                                                            <button className="btn-icon btn-icon--danger-soft" onClick={() => setDeleteConfirmId(entry.id)} title="Delete entry"><Trash2 size={14} /></button>
                                                        )}
                                                    </>)}
                                                </div>
                                            </div>
                                            {/* Bottom row */}
                                            <div className="ic-bottom">
                                                <span className="ic-from">{entry.particularsFromWhom}</span>
                                                <span className="ic-arrow">→</span>
                                                <span
                                                    className="ic-subject"
                                                    onMouseEnter={e => setTooltip({ text: entry.subject, x: e.clientX, y: e.clientY, visible: true })}
                                                    onMouseMove={e => setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }))}
                                                    onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                                                >{entry.subject}</span>
                                                {entry.remarks && (
                                                    <span
                                                        className="ic-remarks"
                                                        onMouseEnter={e => setTooltip({ text: entry.remarks, x: e.clientX, y: e.clientY, visible: true })}
                                                        onMouseMove={e => setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }))}
                                                        onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                                                    >{entry.remarks}</span>
                                                )}
                                            </div>
                                        </motion.div>
                                    );
                                });
                            })()}
                        </div>
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
                                    <span style={{fontFamily:'monospace',fontWeight:700,color:'var(--primary)'}}>{createSuccess.inwardNo?.startsWith('NOINW-') ? '-' : createSuccess.inwardNo}</span>
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
                                    <span style={{fontFamily:'monospace',fontWeight:700,color:'var(--primary)'}}>{assignSuccess.inwardNo?.startsWith('NOINW-') ? '-' : assignSuccess.inwardNo}</span>
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
                                    <span className="detail-value highlight">{selectedEntry.inwardNo?.startsWith('NOINW-') ? '-' : selectedEntry.inwardNo}</span>
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
                            {isAdmin && (
                                <button className="btn btn-primary" onClick={() => {
                                    closeWithAnimation('details', () => { setShowModal(false); openReassignModal(selectedEntry); });
                                }}>
                                    <Edit3 size={16} /> {selectedEntry?.assignedTeam ? 'Reassign' : 'Assign'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Reassign Modal */}
            {showReassignModal && selectedEntry && (
                <div className={`modal-overlay${closingModal === 'reassign' ? ' closing' : ''}`} onClick={() => closeWithAnimation('reassign', () => setShowReassignModal(false))}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Edit3 size={20} /> Edit Entry</h3>
                            <button className="btn-close" onClick={() => closeWithAnimation('reassign', () => setShowReassignModal(false))}>
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleReassign}>
                            <div className="modal-body">
                                <p className="modal-info">
                                    Editing: <strong>{selectedEntry.inwardNo?.startsWith('NOINW-') ? '-' : selectedEntry.inwardNo}</strong>
                                </p>

                                <div className="form-group">
                                    <label className="form-label">Subject *</label>
                                    <input type="text" name="subject" className="form-input"
                                        value={reassignData.subject} onChange={handleReassignChange}
                                        required placeholder="Subject" />
                                </div>

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
                    {isAdmin && (
                        <button className="btn btn-primary" onClick={() => setShowNotesForm(true)}>
                            <Plus size={16} /> Add Note
                        </button>
                    )}
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
                                {isAdmin && (
                                    <button className="btn-icon" onClick={() => handleNoteDelete(n.id)} title="Delete">
                                        <X size={14} />
                                    </button>
                                )}
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

            </motion.div>)}

            {adminPage === 'auditlog' && (
                <motion.div key="auditlog" className="card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
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
                                <motion.tbody
                                    variants={{ animate: { transition: { staggerChildren: 0.04 } } }}
                                    initial="initial"
                                    animate="animate"
                                >
                                    {auditLogs.map(log => (
                                        <motion.tr
                                            key={log.id}
                                            variants={{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0, transition: { duration: 0.15 } } }}
                                        >
                                            <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                {new Date(log.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
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
                                        </motion.tr>
                                    ))}
                                </motion.tbody>
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
                </motion.div>
            )}

            {adminPage === 'inbox' && (
                <motion.div key="inbox" className="card" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
                    <div className="card-header">
                        <h3 className="card-title">
                            <Mail size={20} /> Inbox Review Queue
                            {inboxCount > 0 && <span className="entry-count">({inboxCount} pending)</span>}
                        </h3>
                        <button className="btn btn-icon-only" onClick={loadInboxItems} disabled={inboxLoading} title="Refresh">
                            <RefreshCw size={15} className={inboxLoading ? 'spin' : ''} />
                        </button>
                    </div>
                    {inboxLoading ? (
                        <div className="loading-state"><Loader2 size={40} className="spin" /><p>Loading inbox…</p></div>
                    ) : inboxItems.length === 0 ? (
                        <div className="empty-state">
                            <Mail size={48} />
                            <p>No emails pending review</p>
                            <span>New emails will appear here every 30 minutes</span>
                        </div>
                    ) : (() => {
                        const iqTotalPages = Math.ceil(inboxItems.length / INBOX_PAGE_SIZE);
                        const pagedInboxItems = inboxItems.slice(
                            (inboxQueuePage - 1) * INBOX_PAGE_SIZE,
                            inboxQueuePage * INBOX_PAGE_SIZE
                        );
                        return (
                            <>
                                <div className="inbox-queue-list">
                                    {pagedInboxItems.map((item, i) => (
                                        <motion.div
                                            key={item.id}
                                            className={`inbox-queue-item${new Date(item.created_at.replace(' ', 'T') + 'Z') > new Date(Date.now() - 30 * 60 * 1000) ? ' inbox-queue-item--latest' : ''}`}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.06, duration: 0.16 }}
                                        >
                                            <div className="iq-left">
                                                <div className="iq-from">
                                                    <span className="iq-from-name">{item.from_name || item.from_email}</span>
                                                    <span className="iq-from-email">{item.from_email}</span>
                                                </div>
                                                <div className="iq-subject">{item.subject}</div>
                                                {item.body_preview && (
                                                    <div className="iq-preview">{item.body_preview.slice(0, 180)}…</div>
                                                )}
                                                <div className="iq-meta">
                                                    <span>{new Date(item.received_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                            <div className="iq-right">
                                                <div className="iq-ai-suggestion">
                                                    <span className="iq-ai-label"><Sparkles size={11} /> AI Suggestion</span>
                                                    <div className="iq-ai-fields">
                                                        {item.ai_team && <span className="badge badge-team">{item.ai_team}</span>}
                                                        {item.ai_due_date && <span className="iq-ai-due">Due: {item.ai_due_date}</span>}
                                                        {item.ai_remarks && <span className="iq-ai-remarks">{item.ai_remarks}</span>}
                                                    </div>
                                                </div>
                                                <div className="iq-actions">
                                                    <button className="btn btn-sm iq-view-btn" onClick={() => setInboxViewItem(item)}>
                                                        <Mail size={13} /> View
                                                    </button>
                                                    <button className="btn btn-primary btn-sm" onClick={() => openInboxAccept(item)} disabled={inboxAiLoading === item.id}>
                                                        {inboxAiLoading === item.id
                                                            ? <><Loader2 size={13} className="spin" /> AI…</>
                                                            : <><Check size={13} /> Accept</>}
                                                    </button>
                                                    <button className="btn btn-ghost btn-sm iq-reject-btn" onClick={() => handleInboxReject(item.id)} disabled={inboxAiLoading === item.id}>
                                                        <X size={13} /> Reject
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                                {iqTotalPages > 1 && (
                                    <div className="table-pagination">
                                        <span className="table-note">
                                            Showing {(inboxQueuePage - 1) * INBOX_PAGE_SIZE + 1}–{Math.min(inboxQueuePage * INBOX_PAGE_SIZE, inboxItems.length)} of {inboxItems.length}
                                        </span>
                                        <div className="slider-pagination">
                                            <button className="page-arrow" disabled={inboxQueuePage === 1} onClick={() => setInboxQueuePage(p => p - 1)}>‹</button>
                                            <div className="slider-wrap">
                                                <input
                                                    type="range"
                                                    className="page-slider"
                                                    min={1} max={iqTotalPages} value={inboxQueuePage}
                                                    style={{ '--pct': `${iqTotalPages > 1 ? ((inboxQueuePage - 1) / (iqTotalPages - 1)) * 100 : 0}%` }}
                                                    onChange={e => setInboxQueuePage(Number(e.target.value))}
                                                />
                                            </div>
                                            <button className="page-arrow" disabled={inboxQueuePage === iqTotalPages} onClick={() => setInboxQueuePage(p => p + 1)}>›</button>
                                            <span className="page-badge">{inboxQueuePage} <span className="page-of">/ {iqTotalPages}</span></span>
                                        </div>
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </motion.div>
            )}
            {adminPage === 'recycle' && (
                <motion.div key="recycle" style={{ width: '100%' }} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18, ease: 'easeOut' }}>
                <div className="card">
                    <div className="card-header">
                        <h3 className="card-title">
                            <Trash2 size={20} /> Recycle Bin
                            {recycleBin.length > 0 && <span className="entry-count">({recycleBin.length} entries)</span>}
                        </h3>
                        <button className="btn btn-icon-only" onClick={loadRecycleBin} disabled={recycleBinLoading} title="Refresh">
                            <RefreshCw size={15} className={recycleBinLoading ? 'spin' : ''} />
                        </button>
                    </div>

                    {recycleBinLoading ? (
                        <div className="loading-state"><Loader2 size={40} className="spin" /><p>Loading…</p></div>
                    ) : recycleBin.length === 0 ? (
                        <div className="empty-state">
                            <Trash2 size={48} />
                            <p>Recycle bin is empty</p>
                            <span>Deleted inward entries will appear here</span>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Inward No.</th>
                                        <th>Date</th>
                                        <th>Mode</th>
                                        <th>From</th>
                                        <th>Subject</th>
                                        <th>Status</th>
                                        <th>Deleted At</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <motion.tbody
                                    variants={{ animate: { transition: { staggerChildren: 0.04 } } }}
                                    initial="initial"
                                    animate="animate"
                                >
                                    {recycleBin.map(entry => (
                                        <motion.tr
                                            key={entry.id}
                                            variants={{ initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0, transition: { duration: 0.15 } } }}
                                            style={{ opacity: 0.82 }}
                                        >
                                            <td><strong style={{ fontFamily: 'monospace', fontSize: '0.78rem' }}>{entry.inwardNo}</strong></td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{formatDate(entry.signReceiptDatetime)}</td>
                                            <td>{entry.means || '-'}</td>
                                            <td>{entry.particularsFromWhom || '-'}</td>
                                            <td className="subject-cell">
                                                <div className="subject-text"
                                                    onMouseEnter={e => setTooltip({ text: entry.subject, x: e.clientX, y: e.clientY, visible: true })}
                                                    onMouseMove={e => setTooltip(t => ({ ...t, x: e.clientX, y: e.clientY }))}
                                                    onMouseLeave={() => setTooltip(t => ({ ...t, visible: false }))}
                                                >{entry.subject}</div>
                                            </td>
                                            <td><span className="badge badge-none">{entry.assignmentStatus || '-'}</span></td>
                                            <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {entry.deletedAt ? new Date(entry.deletedAt.replace(' ', 'T') + 'Z').toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn-icon"
                                                        onClick={() => handleRestore(entry.id)}
                                                        disabled={restoreLoadingId === entry.id}
                                                        title="Restore to register"
                                                        style={{ color: '#4ade80' }}
                                                    >
                                                        {restoreLoadingId === entry.id
                                                            ? <Loader2 size={15} className="spin" />
                                                            : <RotateCcw size={15} />
                                                        }
                                                    </button>
                                                    {permDeleteConfirmId === entry.id ? (
                                                        <>
                                                            <button className="btn-icon btn-icon--danger" onClick={() => handlePermDelete(entry.id)} title="Confirm permanent delete">
                                                                <Check size={14} />
                                                            </button>
                                                            <button className="btn-icon" onClick={() => setPermDeleteConfirmId(null)} title="Cancel">
                                                                <X size={14} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button className="btn-icon btn-icon--danger-soft" onClick={() => setPermDeleteConfirmId(entry.id)} title="Permanently delete">
                                                            <Trash2 size={15} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </motion.tr>
                                    ))}
                                </motion.tbody>
                            </table>
                        </div>
                    )}
                </div>
                </motion.div>
            )}
            </AnimatePresence>

            {/* Inbox Email Viewer Modal */}
            {inboxViewItem && (
                <div className="modal-overlay" onClick={() => setInboxViewItem(null)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Mail size={18} /> Email</h3>
                            <button className="modal-close" onClick={() => setInboxViewItem(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="iq-email-view-header">
                                <div className="iq-email-view-row">
                                    <span className="iq-email-view-label">From</span>
                                    <span className="iq-email-view-value">
                                        {inboxViewItem.from_name
                                            ? <><strong>{inboxViewItem.from_name}</strong> &lt;{inboxViewItem.from_email}&gt;</>
                                            : inboxViewItem.from_email}
                                    </span>
                                </div>
                                <div className="iq-email-view-row">
                                    <span className="iq-email-view-label">Subject</span>
                                    <span className="iq-email-view-value"><strong>{inboxViewItem.subject}</strong></span>
                                </div>
                                <div className="iq-email-view-row">
                                    <span className="iq-email-view-label">Date</span>
                                    <span className="iq-email-view-value">
                                        {new Date(inboxViewItem.received_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}
                                    </span>
                                </div>
                            </div>
                            <div className="iq-email-view-body">
                                {inboxViewItem.body_preview || '(No content available)'}
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setInboxViewItem(null)}>Close</button>
                            <button className="btn btn-primary" onClick={() => { setInboxViewItem(null); openInboxAccept(inboxViewItem); }}>
                                <Check size={14} /> Accept this email
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Inbox Accept Modal */}
            {inboxAcceptItem && (
                <div className="modal-overlay" onClick={() => setInboxAcceptItem(null)}>
                    <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3><Check size={18} /> Review &amp; Accept Email</h3>
                            <button className="modal-close" onClick={() => setInboxAcceptItem(null)}><X size={18} /></button>
                        </div>
                        <div className="modal-body">
                            <div className="iq-accept-source">
                                <span className="iq-ai-label"><Mail size={11} /> From: {inboxAcceptItem.from_email}</span>
                                <span className="iq-preview">{inboxAcceptItem.subject}</span>
                            </div>
                            <div className="grid-2" style={{ marginTop: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">From (Sender) *</label>
                                    <input className="form-input" value={inboxAcceptData.particularsFromWhom || ''}
                                        onChange={e => setInboxAcceptData(p => ({ ...p, particularsFromWhom: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Mode</label>
                                    <select className="form-select" value={inboxAcceptData.means || 'Email'}
                                        onChange={e => setInboxAcceptData(p => ({ ...p, means: e.target.value }))}>
                                        <option>Email</option><option>Post</option><option>Hand Delivery</option><option>Courier</option>
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Subject *</label>
                                <input className="form-input" value={inboxAcceptData.subject || ''}
                                    onChange={e => setInboxAcceptData(p => ({ ...p, subject: e.target.value }))} />
                            </div>
                            <div className="grid-2">
                                <div className="form-group">
                                    <label className="form-label">Assign Team</label>
                                    <select className="form-select" value={inboxAcceptData.assignedTeam || ''}
                                        onChange={e => setInboxAcceptData(p => ({ ...p, assignedTeam: e.target.value, assignedToEmail: TEAM_EMAILS[e.target.value] || '' }))}>
                                        <option value="">— No Assignment —</option>
                                        <option>UG</option><option>PG/PRO</option><option>PhD</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Due Date</label>
                                    <input type="date" className="form-input" value={inboxAcceptData.dueDate || ''}
                                        onChange={e => setInboxAcceptData(p => ({ ...p, dueDate: e.target.value }))} />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Assignment Instructions</label>
                                <textarea className="form-textarea" rows={2} value={inboxAcceptData.assignmentInstructions || ''}
                                    onChange={e => setInboxAcceptData(p => ({ ...p, assignmentInstructions: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Remarks</label>
                                <textarea className="form-textarea" rows={2} value={inboxAcceptData.remarks || ''}
                                    onChange={e => setInboxAcceptData(p => ({ ...p, remarks: e.target.value }))} />
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-ghost" onClick={() => setInboxAcceptItem(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleInboxAccept} disabled={inboxAccepting || !inboxAcceptData.subject || !inboxAcceptData.particularsFromWhom}>
                                {inboxAccepting ? <><Loader2 size={15} className="spin" /> Creating…</> : <><Check size={15} /> Create Inward Entry</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ChatBot onFindEntry={handleFindEntry} storageKey="iosys_chat_admin" />

            {/* Subject Tooltip */}
            {tooltip.visible && (
                <div className="subject-tooltip" style={{ left: tooltip.x + 14, top: tooltip.y + 14 }}>
                    {tooltip.text}
                </div>
            )}
        </div>
        </motion.div>
    );
}

export default AdminPortal;
