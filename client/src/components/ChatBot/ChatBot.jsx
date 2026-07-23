import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles, RotateCcw, ChevronDown, Database, Search, Cpu, Bell, ExternalLink, CheckCircle2, Users, Lock, CornerUpLeft, AlertTriangle, ClipboardList, BarChart3, Inbox, Upload, Hourglass, TrendingUp, User, Filter, Timer, FolderTree, FileText, Scale, Check, ImagePlus, Trash2 } from 'lucide-react';
import { showToast } from '../Toast/toastBus';

const SEARCH_STEPS = [
    { icon: Database, label: 'Fetching live data…'      },
    { icon: Search,   label: 'Searching entries…'       },
    { icon: Cpu,      label: 'Generating response…'     },
];

function SearchingIndicator() {
    const [step, setStep] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setStep(s => (s + 1) % SEARCH_STEPS.length), 1200);
        return () => clearInterval(id);
    }, []);

    const { icon: Icon, label } = SEARCH_STEPS[step];

    return (
        <div className="chatbot-searching">
            <div className="chatbot-searching-icon">
                <Icon size={13} />
            </div>
            <span className="chatbot-searching-label">{label}</span>
            <span className="chatbot-searching-dots"><span /><span /><span /></span>
        </div>
    );
}
import './ChatBot.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const MODELS = [
    { id: 'nvidia/nemotron-3-nano-30b-a3b:free',    label: 'Nemotron Nano 30B', badge: 'Fast'     },
    { id: 'openai/gpt-oss-20b:free',                label: 'GPT OSS 20B',       badge: 'Fast'     },
    { id: 'openai/gpt-oss-120b:free',               label: 'GPT OSS 120B',      badge: 'Powerful' },
    { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron Super',    badge: 'Powerful' },
    { id: 'qwen/qwen2.5-vl-32b-instruct:free',      label: 'Qwen VL 32B',       badge: 'Vision'   },
];
const DEFAULT_MODEL = MODELS[0].id;
const VISION_MODEL = 'qwen/qwen2.5-vl-32b-instruct:free';
const MAX_IMAGE_DIM = 1024;

// Downscale + JPEG-encode an image file client-side so base64 payloads stay small
function fileToImageDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Could not read the file'));
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = () => reject(new Error('Could not decode the image'));
            img.onload = () => {
                let { width, height } = img;
                if (width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM) {
                    const scale = MAX_IMAGE_DIM / Math.max(width, height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.78));
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

// Strip image parts from older messages before resending — keeps only the newest
// image in the request so we don't re-upload base64 data on every turn
function stripImageContent(content) {
    if (!Array.isArray(content)) return content;
    const text = content.find(p => p.type === 'text')?.text || '';
    return text || '[Image attached]';
}

const QUICK_ACTIONS = [
    // Overview
    { icon: ClipboardList, label: 'Daily briefing',    query: 'Give me today\'s briefing — new entries today, overdue items, and team with most load' },
    { icon: BarChart3,     label: 'Team workload',      query: 'Show team workload breakdown and compare UPAS, PPAS, UPAS/PPAS and DPAS performance' },
    { icon: AlertTriangle, label: 'Overdue entries',    query: 'Show all overdue entries sorted by how long they have been pending' },
    { icon: Inbox,         label: 'Unassigned entries', query: 'List all inward entries that have not been assigned to any team yet' },
    // Entry lists
    { icon: Upload,        label: 'Outward entries',    query: 'List all outward entries' },
    { icon: Hourglass,     label: 'Pending entries',    query: 'List all pending inward entries' },
    // Analysis
    { icon: TrendingUp,    label: 'Inward trend',       query: 'Is our inward volume increasing or decreasing? Which period had the most entries?' },
    { icon: User,          label: 'Top senders',        query: 'Who sends us the most correspondence? Group entries by sender and show counts' },
    { icon: Filter,        label: 'Bottlenecks',        query: 'Which entries have been pending the longest? Show the top 10 oldest unresolved entries' },
    { icon: Timer,         label: 'SLA analysis',       query: 'How long does each team typically take to complete entries? Calculate average turnaround time' },
    { icon: FolderTree,    label: 'Entry categories',   query: 'Classify inward entries by subject category (exam, certificate, attendance, etc.) and show counts' },
    // Productivity
    { icon: FileText,      label: 'Status report',      query: 'Generate a formal status report I can share with the COE — total entries, team breakdown, overdue count' },
    { icon: Search,        label: 'Recent activity',    query: 'Summarize the last 15 actions from the audit log' },
    { icon: Scale,         label: 'Compare teams',      query: 'Compare UPAS vs PPAS vs UPAS/PPAS vs DPAS — which team has the best completion rate and least overdue?' },
];

const INITIAL_MESSAGE = {
    role: 'assistant',
    content: "Sai Ram! I'm your IOSYS Assistant. I have live access to your entries, team workloads, and activity. What would you like to know?",
};

// Extract ENTRIES_JSON block from AI reply
// Returns { text, entries, showing, total }
function parseAIReply(content) {
    const match = content.match(/ENTRIES_JSON\s*([\s\S]*?)\s*END_ENTRIES_JSON/);

    // Strip any ENTRIES_JSON markers from displayed text
    const cleanText = content
        .replace(/ENTRIES_JSON[\s\S]*?END_ENTRIES_JSON/g, '')
        .replace(/ENTRIES_JSON[\s\S]*/g, '')
        .trim();

    // Detect "Showing X of Y" in the text to know if more exist
    const pageMatch = cleanText.match(/showing\s+(\d+)\s+of\s+(\d+)/i);
    const showing = pageMatch ? parseInt(pageMatch[1]) : null;
    const total   = pageMatch ? parseInt(pageMatch[2]) : null;

    if (!match) return { text: cleanText, entries: [], showing, total };

    try {
        const entries = JSON.parse(match[1].trim());
        return { text: cleanText, entries: Array.isArray(entries) ? entries : [], showing, total };
    } catch {
        return { text: cleanText, entries: [], showing, total };
    }
}

// Fields to show per entry type, in display order
const INWARD_FIELDS  = [
    { key: 'date',    label: 'Date'    },
    { key: 'from',    label: 'From'    },
    { key: 'subject', label: 'Subject' },
    { key: 'team',    label: 'Team'    },
    { key: 'status',  label: 'Status'  },
    { key: 'due',     label: 'Due'     },
];
const OUTWARD_FIELDS = [
    { key: 'date',    label: 'Date'    },
    { key: 'to',      label: 'To'      },
    { key: 'subject', label: 'Subject' },
    { key: 'sentBy',  label: 'Sent By' },
    { key: 'team',    label: 'Team'    },
    { key: 'mode',    label: 'Mode'    },
    { key: 'file',    label: 'File'    },
];

// Reminders are stored in localStorage by ReminderForm; read them back here
const REMINDERS_KEY = 'iosys_reminders';
const REMINDERS_EVENT = 'iosys-reminders-updated';

function loadReminders() {
    try {
        return JSON.parse(localStorage.getItem(REMINDERS_KEY) || '[]');
    } catch {
        return [];
    }
}

function saveReminders(reminders) {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
    window.dispatchEvent(new Event(REMINDERS_EVENT));
}

function formatMsgTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function todayStr() {
    return new Date().toISOString().split('T')[0];
}

function RemindersDrawer({ reminders, onDismiss, onClose, onFindEntry }) {
    const today = todayStr();
    const sorted = [...reminders].sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    return (
        <div className="chatbot-reminders-drawer">
            <div className="chatbot-reminders-header">
                <span><Bell size={13} /> Reminders</span>
                <button className="chatbot-icon-btn" onClick={onClose} title="Close"><X size={14} /></button>
            </div>
            <div className="chatbot-reminders-list">
                {sorted.length === 0 && (
                    <div className="chatbot-reminders-empty">No reminders yet. Set one from an entry card.</div>
                )}
                {sorted.map(r => {
                    const overdue = r.dueDate < today;
                    const dueToday = r.dueDate === today;
                    return (
                        <div key={r.id} className={`chatbot-reminder-item${overdue ? ' chatbot-reminder-item--overdue' : ''}`}>
                            <div className="chatbot-reminder-item-main" onClick={() => onFindEntry?.(r.entryNo)}>
                                <div className="chatbot-reminder-item-top">
                                    <span className="chatbot-reminder-item-no">{r.entryNo}</span>
                                    {(overdue || dueToday) && (
                                        <span className="chatbot-reminder-item-tag">
                                            {overdue ? 'Overdue' : 'Due today'}
                                        </span>
                                    )}
                                </div>
                                <div className="chatbot-reminder-item-note">{r.note}</div>
                                <div className="chatbot-reminder-item-date">{r.dueDate}</div>
                            </div>
                            <button className="chatbot-reminder-item-dismiss" onClick={() => onDismiss(r.id)} title="Dismiss">
                                <X size={12} />
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function ReminderForm({ entry, onSave, onCancel }) {
    const [date, setDate] = useState('');
    const [note, setNote] = useState('');
    const minDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const handleSave = () => {
        if (!date) return;
        const reminder = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            entryNo: entry.no,
            entrySubject: entry.subject || '',
            note: note.trim() || `Follow up on ${entry.no}`,
            dueDate: date,
            createdAt: new Date().toISOString(),
            dismissed: false,
        };
        saveReminders([...loadReminders(), reminder]);
        onSave();
    };

    return (
        <div className="chatbot-reminder-form">
            <div className="chatbot-reminder-form-title"><Bell size={12} /> Set reminder for {entry.no}</div>
            <input type="date" className="chatbot-reminder-date" min={minDate} value={date} onChange={e => setDate(e.target.value)} />
            <input type="text" className="chatbot-reminder-note" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} maxLength={120} />
            <div className="chatbot-reminder-actions">
                <button className="chatbot-reminder-cancel" onClick={onCancel}>Cancel</button>
                <button className="chatbot-reminder-save" onClick={handleSave} disabled={!date}><Bell size={11} /> Save</button>
            </div>
        </div>
    );
}

const STATUS_DOT_COLOR = {
    'Completed':   '#22c55e',
    'In Progress': '#3b82f6',
    'Pending':     '#f59e0b',
};

function EntryCard({ entry, onFindEntry, onAssignTeam, onMarkComplete, onReply, onCloseCase, onDeleteEntry }) {
    const [showReminderForm, setShowReminderForm] = useState(false);
    const [reminderSaved, setReminderSaved] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleted, setDeleted] = useState(false);
    const type   = entry.type === 'outward' ? 'outward' : 'inward';
    const schema = type === 'outward' ? OUTWARD_FIELDS : INWARD_FIELDS;
    const allFields = schema.filter(f => entry[f.key] && entry[f.key] !== '');
    const dueField  = allFields.find(f => f.key === 'due');
    const fields    = allFields.filter(f => f.key !== 'due');
    const isInward = type === 'inward' && entry.no?.startsWith('INW/');
    const isOpenInward = isInward && !entry.closed && entry.status !== 'Completed';
    const isOpenOutward = type === 'outward' && !entry.closed;
    const isActive = !entry.closed && entry.status !== 'Completed';

    const handleReminderSaved = () => {
        setShowReminderForm(false);
        setReminderSaved(true);
        setTimeout(() => setReminderSaved(false), 3000);
    };

    return (
        <div className={`chatbot-entry-card chatbot-entry-card--${type}`}>
            <div className="chatbot-entry-header">
                <span className="chatbot-entry-no">{entry.no}</span>
                <div className="chatbot-entry-badges">
                    <span className={`chatbot-entry-status-pill${isActive ? ' chatbot-entry-status-pill--active' : ''}`}>
                        {isActive ? 'Active' : 'Closed'}
                    </span>
                    <span className={`chatbot-entry-badge chatbot-entry-badge--${type}`}>
                        {type === 'outward' ? 'Outward' : 'Inward'}
                    </span>
                </div>
            </div>
            <div className="chatbot-entry-fields">
                {fields.map(({ key, label }) => (
                    <div key={key} className={`chatbot-entry-field${key === 'subject' ? ' chatbot-entry-field--full' : ''}`}>
                        <span className="chatbot-field-key">{label}</span>
                        <span
                            className="chatbot-field-val"
                            title={entry[key]}
                            style={key === 'subject' ? { whiteSpace: 'normal', wordBreak: 'break-word' } : {}}
                        >
                            {key === 'status' && STATUS_DOT_COLOR[entry[key]] && (
                                <span className="chatbot-status-dot" style={{ background: STATUS_DOT_COLOR[entry[key]] }} />
                            )}
                            {entry[key]}
                        </span>
                    </div>
                ))}
            </div>
            {dueField && (
                <div className="chatbot-entry-due-box">
                    <span className="chatbot-field-key">{dueField.label}</span>
                    <span className="chatbot-field-val">{entry[dueField.key]}</span>
                </div>
            )}
            <div className="chatbot-entry-actions">
                {isInward && onFindEntry && (
                    <button className="chatbot-entry-action-btn" onClick={() => onFindEntry(entry.no)} title="Jump to this entry in the table">
                        <ExternalLink size={11} /> View in table
                    </button>
                )}
                {isInward && !reminderSaved && (
                    <button className="chatbot-entry-action-btn chatbot-entry-action-btn--reminder" onClick={() => setShowReminderForm(v => !v)} title="Set a follow-up reminder">
                        <Bell size={11} /> Remind me
                    </button>
                )}
                {isOpenInward && onReply && (
                    <button className="chatbot-entry-action-btn" onClick={() => onReply(entry.no)} title="Create an outward reply linked to this entry">
                        <CornerUpLeft size={11} /> Reply
                    </button>
                )}
                {isOpenInward && onAssignTeam && (
                    <button className="chatbot-entry-action-btn" onClick={() => onAssignTeam(entry.no)} title="Assign or reassign this entry to a team">
                        <Users size={11} /> Assign team
                    </button>
                )}
                {isOpenInward && onMarkComplete && (
                    <button className="chatbot-entry-action-btn" onClick={() => onMarkComplete(entry.no)} title="Mark this entry as completed">
                        <CheckCircle2 size={11} /> Mark complete
                    </button>
                )}
                {isOpenOutward && onCloseCase && (
                    <button className="chatbot-entry-action-btn" onClick={() => onCloseCase(entry.no)} title="Close this case">
                        <Lock size={11} /> Close case
                    </button>
                )}
                {isInward && onDeleteEntry && !deleted && !showDeleteConfirm && (
                    <button className="chatbot-entry-action-btn chatbot-entry-action-btn--danger" onClick={() => setShowDeleteConfirm(true)} title="Delete this entry">
                        <Trash2 size={11} /> Delete entry
                    </button>
                )}
                {reminderSaved && <span className="chatbot-reminder-saved"><Check size={11} /> Reminder set</span>}
                {deleted && <span className="chatbot-reminder-saved chatbot-reminder-saved--danger"><Check size={11} /> Entry deleted</span>}
            </div>
            {showReminderForm && (
                <ReminderForm entry={entry} onSave={handleReminderSaved} onCancel={() => setShowReminderForm(false)} />
            )}
            {showDeleteConfirm && (
                <div className="chatbot-delete-confirm">
                    <div className="chatbot-delete-confirm-text">
                        <AlertTriangle size={12} /> Delete {entry.no}? It moves to the Recycle Bin and can be restored later.
                    </div>
                    <div className="chatbot-delete-confirm-actions">
                        <button className="chatbot-reminder-cancel" onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
                        <button
                            className="chatbot-delete-confirm-btn"
                            onClick={() => {
                                const ok = onDeleteEntry(entry.no);
                                setShowDeleteConfirm(false);
                                if (ok !== false) setDeleted(true);
                            }}
                        >
                            <Trash2 size={11} /> Confirm delete
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Inline markdown: **bold**, *italic*, `code`
function renderInline(text) {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*')  && part.endsWith('*'))  return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith('`')  && part.endsWith('`'))  return <code key={i} className="md-code">{part.slice(1, -1)}</code>;
        return part;
    });
}

// Block markdown renderer: headings, bullets, numbered lists, tables, paragraphs
function MarkdownBlock({ text }) {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) { i++; continue; }

        // Headings
        if (trimmed.startsWith('### ')) {
            elements.push(<p key={i} className="md-h3">{renderInline(trimmed.slice(4))}</p>);
            i++; continue;
        }
        if (trimmed.startsWith('## ')) {
            elements.push(<p key={i} className="md-h2">{renderInline(trimmed.slice(3))}</p>);
            i++; continue;
        }
        if (trimmed.startsWith('# ')) {
            elements.push(<p key={i} className="md-h1">{renderInline(trimmed.slice(2))}</p>);
            i++; continue;
        }

        // Table — detect by pipe characters
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }
            // Parse header, separator, rows
            const parseRow = (row) =>
                row.slice(1, -1).split('|').map(cell => cell.trim());
            const isSeparator = (row) => /^[\s|:-]+$/.test(row);

            const header = parseRow(tableLines[0]);
            const dataRows = tableLines
                .slice(1)
                .filter(r => !isSeparator(r))
                .map(parseRow);

            elements.push(
                <div key={`tbl-${i}`} className="md-table-wrap">
                    <table className="md-table">
                        <thead>
                            <tr>{header.map((h, ci) => <th key={ci}>{renderInline(h)}</th>)}</tr>
                        </thead>
                        <tbody>
                            {dataRows.map((row, ri) => (
                                <tr key={ri}>
                                    {row.map((cell, ci) => <td key={ci}>{renderInline(cell)}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            continue;
        }

        // Bullet list — collect consecutive bullets
        if (/^(\s*[-*]|\s*\d+\.) /.test(line)) {
            const items = [];
            while (i < lines.length && /^(\s*[-*]|\s*\d+\.) /.test(lines[i])) {
                const l = lines[i];
                const nested = /^\s{2,}/.test(l);
                const content = l.replace(/^\s*[-*\d.]+\s/, '');
                items.push(
                    <li key={i} className={nested ? 'md-li md-li--nested' : 'md-li'}>
                        {renderInline(content)}
                    </li>
                );
                i++;
            }
            elements.push(<ul key={`ul-${i}`} className="md-ul">{items}</ul>);
            continue;
        }

        // Horizontal rule
        if (/^[-*_]{3,}$/.test(trimmed)) {
            elements.push(<hr key={i} className="md-hr" />);
            i++; continue;
        }

        // Plain paragraph
        elements.push(<p key={i} className="md-p">{renderInline(trimmed)}</p>);
        i++;
    }

    return <div className="md-body">{elements}</div>;
}

// Render assistant message: markdown text + optional entry cards + load more button
function MessageContent({ content, onSend, onFindEntry, onAssignTeam, onMarkComplete, onReply, onCloseCase, onDeleteEntry }) {
    const { text, entries, showing, total } = parseAIReply(content);
    const hasMore = showing !== null && total !== null && showing < total;
    const nextStart = showing + 1;
    const nextEnd   = Math.min(showing + 10, total);

    const handleShowMore = () => {
        onSend(`Show entries ${nextStart} to ${nextEnd} (continue from where you left off)`);
    };

    return (
        <div className="chatbot-message-content">
            {text && <MarkdownBlock text={text} />}
            {entries.filter(e => e.no || e.subject || e.from || e.to).map((entry, i) => (
                <EntryCard
                    key={i}
                    entry={entry}
                    onFindEntry={onFindEntry}
                    onAssignTeam={onAssignTeam}
                    onMarkComplete={onMarkComplete}
                    onReply={onReply}
                    onCloseCase={onCloseCase}
                    onDeleteEntry={onDeleteEntry}
                />
            ))}
            {hasMore && (
                <button className="chatbot-load-more" onClick={handleShowMore}>
                    Show next 10 ({nextStart}–{nextEnd} of {total}) →
                </button>
            )}
        </div>
    );
}

function ChatBot({ onFindEntry, onAssignTeam, onMarkComplete, onReply, onCloseCase, onDeleteEntry, storageKey = 'iosys_chat_messages', hidden = false }) {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState(() => {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved);
        } catch { /* ignore */ }
        return [INITIAL_MESSAGE];
    });
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [streaming, setStreaming] = useState(false);
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const [showReminders, setShowReminders] = useState(false);
    const [reminders, setReminders] = useState(() => loadReminders());
    const [attachedImage, setAttachedImage] = useState(null);
    const [imageProcessing, setImageProcessing] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const chipsRef = useRef(null);
    const modelPickerRef = useRef(null);
    const notifiedRef = useRef(new Set());
    const fileInputRef = useRef(null);

    const activeReminders = reminders.filter(r => !r.dismissed);
    const dueCount = activeReminders.filter(r => r.dueDate <= todayStr()).length;

    const dismissReminder = (id) => {
        const next = reminders.map(r => r.id === id ? { ...r, dismissed: true } : r);
        saveReminders(next);
        setReminders(next);
    };

    // Refresh reminders when one is saved (this tab) or changed (another tab)
    useEffect(() => {
        const refresh = () => setReminders(loadReminders());
        window.addEventListener(REMINDERS_EVENT, refresh);
        window.addEventListener('storage', refresh);
        return () => {
            window.removeEventListener(REMINDERS_EVENT, refresh);
            window.removeEventListener('storage', refresh);
        };
    }, []);

    // Periodically check for newly-due reminders and fire a browser notification once each
    useEffect(() => {
        const checkDue = () => {
            const due = loadReminders().filter(r => !r.dismissed && r.dueDate <= todayStr());
            due.forEach(r => {
                if (notifiedRef.current.has(r.id)) return;
                notifiedRef.current.add(r.id);
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Reminder due', { body: `${r.entryNo}: ${r.note}` });
                }
            });
        };
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        checkDue();
        const id = setInterval(checkDue, 5 * 60 * 1000);
        return () => clearInterval(id);
    }, []);

    // Persist chat history to localStorage
    useEffect(() => {
        localStorage.setItem(storageKey, JSON.stringify(messages));
    }, [messages, storageKey]);

    // Close model picker when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (modelPickerRef.current && !modelPickerRef.current.contains(e.target)) {
                setShowModelPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Close chatbot / model picker on Escape
    useEffect(() => {
        const onEsc = (e) => {
            if (e.key !== 'Escape') return;
            if (showModelPicker) { setShowModelPicker(false); return; }
            if (open)            { setOpen(false); }
        };
        document.addEventListener('keydown', onEsc);
        return () => document.removeEventListener('keydown', onEsc);
    }, [open, showModelPicker]);

    const scrollChips = (dir) => {
        if (chipsRef.current) {
            chipsRef.current.scrollBy({ left: dir * 160, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 300);
    }, [open]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    // Auto-grow the input textarea as the user types multi-line prompts
    useEffect(() => {
        const ta = inputRef.current;
        if (!ta) return;
        ta.style.height = 'auto';
        ta.style.height = `${Math.min(ta.scrollHeight, 110)}px`;
    }, [input]);

    const sendMessage = async (text) => {
        const content = (text || input).trim();
        const image = attachedImage;
        if ((!content && !image) || loading || streaming) return;
        setInput('');
        setAttachedImage(null);

        const userMsg = {
            role: 'user',
            content: image
                ? [{ type: 'text', text: content || 'What is in this image?' }, { type: 'image_url', image_url: { url: image } }]
                : content,
            timestamp: Date.now(),
        };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setLoading(true);

        try {
            // Only the newest message keeps its image — older ones are stripped to text
            // so we don't re-upload base64 image data on every follow-up turn
            const apiMessages = updatedMessages
                .filter((_, i) => i > 0)
                .map(({ role, content }, i, arr) => ({
                    role,
                    content: i === arr.length - 1 ? content : stripImageContent(content),
                }));

            const res = await fetch(`${API_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: apiMessages, model: image ? VISION_MODEL : selectedModel }),
            });

            // Non-streaming error response
            if (!res.headers.get('content-type')?.includes('text/event-stream')) {
                const data = await res.json();
                const msg = data.message || 'Please try again.';
                const isRateLimit = msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('per-day') || msg.toLowerCase().includes('daily free');
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: isRateLimit
                        ? `**Daily AI limit reached.**\n\nThe free model quota on OpenRouter has been used up for today.\n\n- The assistant will be available again **tomorrow** automatically.\n- Or add credits at **openrouter.ai** to restore access now.\n\nYou can still use all other features of IOSYS normally.`
                        : `Sorry, something went wrong: ${msg}`,
                    timestamp: Date.now(),
                }]);
                return;
            }

            // Streaming — hide typing indicator, start filling message
            setLoading(false);
            setStreaming(true);
            setMessages(prev => [...prev, { role: 'assistant', content: '', timestamp: Date.now() }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            let truncated = false;
            let doneSignal = false;

            const processLine = (line) => {
                if (!line.startsWith('data: ')) return;
                const data = line.slice(6).trim();
                if (data === '[DONE]') { doneSignal = true; return; }
                try {
                    const json = JSON.parse(data);
                    const delta = json.choices?.[0]?.delta?.content || '';
                    const finishReason = json.choices?.[0]?.finish_reason;
                    if (finishReason === 'length') truncated = true;
                    if (delta) {
                        setMessages(prev => {
                            const last = prev[prev.length - 1];
                            return [...prev.slice(0, -1), { ...last, content: last.content + delta }];
                        });
                    }
                } catch { /* skip malformed chunk */ }
            };

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete line

                for (const line of lines) {
                    processLine(line);
                    if (doneSignal) break;
                }
                if (doneSignal) break;
            }

            // Flush whatever's left in the buffer — the final frame may arrive without a trailing newline
            if (!doneSignal && buffer) {
                processLine(buffer);
            }

            if (truncated) {
                setMessages(prev => {
                    const last = prev[prev.length - 1];
                    return [...prev.slice(0, -1), {
                        ...last,
                        content: last.content + '\n\n_...response was cut short. Try asking for fewer entries at a time._',
                    }];
                });
            }
        } catch {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Connection error. Make sure the server is running.',
                timestamp: Date.now(),
            }]);
        } finally {
            setLoading(false);
            setStreaming(false);
        }
    };

    const handleImageSelect = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('Please select an image file.', 'warning');
            return;
        }
        setImageProcessing(true);
        try {
            const dataUrl = await fileToImageDataUrl(file);
            setAttachedImage(dataUrl);
        } catch (err) {
            showToast(err.message || 'Could not process the image.', 'error');
        } finally {
            setImageProcessing(false);
        }
    };

    const resetChat = () => {
        setMessages([INITIAL_MESSAGE]);
        setInput('');
        setAttachedImage(null);
        localStorage.removeItem(storageKey);
    };

    return (
        <>
            {/* Floating Action Button */}
            <button
                className={`chatbot-fab${(open || hidden) ? ' chatbot-fab--hidden' : ''}`}
                onClick={() => setOpen(true)}
                title="Ask AI Assistant"
            >
                <Sparkles size={16} />
                <span>Ask AI</span>
                <span className="chatbot-fab-dot" />
            </button>

            {/* Chat Panel */}
            <div className={`chatbot-panel${open ? ' chatbot-panel--open' : ''}`}>

                {/* Header */}
                <div className="chatbot-header">
                    <div className="chatbot-header-left">
                        <div className="chatbot-avatar">
                            <Sparkles size={13} />
                        </div>
                        <div>
                            <div className="chatbot-title">IOSYS Assistant</div>
                            <div className="chatbot-subtitle" ref={modelPickerRef} style={{ position: 'relative' }}>
                                <span className="chatbot-live-dot" />
                                <button
                                    className="chatbot-model-btn"
                                    onClick={() => setShowModelPicker(p => !p)}
                                    title="Switch model"
                                >
                                    {MODELS.find(m => m.id === selectedModel)?.label ?? 'Model'}
                                    <ChevronDown size={10} />
                                </button>
                                · Live data
                                {showModelPicker && (
                                    <div className="chatbot-model-picker">
                                        {MODELS.map(m => (
                                            <button
                                                key={m.id}
                                                className={`chatbot-model-option${selectedModel === m.id ? ' active' : ''}`}
                                                onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                                            >
                                                <span className="model-option-label">{m.label}</span>
                                                <span className={`model-option-badge badge-${m.badge.toLowerCase()}`}>{m.badge}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="chatbot-header-actions">
                        <button className="chatbot-icon-btn chatbot-icon-btn--bell" onClick={() => setShowReminders(v => !v)} title="Reminders">
                            <Bell size={13} />
                            {dueCount > 0 && <span className="chatbot-bell-badge">{dueCount > 9 ? '9+' : dueCount}</span>}
                        </button>
                        <button className="chatbot-icon-btn" onClick={resetChat} title="Clear chat">
                            <RotateCcw size={13} />
                        </button>
                        <button className="chatbot-icon-btn" onClick={() => setOpen(false)} title="Close">
                            <X size={15} />
                        </button>
                    </div>
                </div>

                {showReminders && (
                    <RemindersDrawer
                        reminders={activeReminders}
                        onDismiss={dismissReminder}
                        onClose={() => setShowReminders(false)}
                        onFindEntry={onFindEntry}
                    />
                )}

                {/* Messages */}
                <div className="chatbot-messages">
                    {messages.map((msg, i) => {
                        // Skip the empty streaming placeholder — SearchingIndicator covers it
                        const isEmptyStreamPlaceholder =
                            streaming && i === messages.length - 1 &&
                            msg.role === 'assistant' && msg.content === '';
                        if (isEmptyStreamPlaceholder) return null;

                        return (
                            <div key={i} className={`chatbot-msg chatbot-msg--${msg.role}`}>
                                {msg.role === 'assistant' && (
                                    <div className="chatbot-msg-avatar">
                                        <Sparkles size={10} />
                                    </div>
                                )}
                                <div className="chatbot-msg-col">
                                    {msg.role === 'assistant' ? (
                                        <div className="chatbot-bubble chatbot-bubble--assistant">
                                            <MessageContent
                                                content={msg.content}
                                                onSend={sendMessage}
                                                onFindEntry={onFindEntry}
                                                onAssignTeam={onAssignTeam}
                                                onMarkComplete={onMarkComplete}
                                                onReply={onReply}
                                                onCloseCase={onCloseCase}
                                                onDeleteEntry={onDeleteEntry}
                                            />
                                        </div>
                                    ) : (
                                        <div className="chatbot-bubble chatbot-bubble--user">
                                            {Array.isArray(msg.content) ? (
                                                <>
                                                    {msg.content.filter(p => p.type === 'image_url').map((p, i) => (
                                                        <img key={i} src={p.image_url.url} alt="Attached" className="chatbot-msg-image" />
                                                    ))}
                                                    {msg.content.find(p => p.type === 'text')?.text}
                                                </>
                                            ) : msg.content}
                                        </div>
                                    )}
                                    {msg.timestamp && (
                                        <span className="chatbot-msg-time">{formatMsgTime(msg.timestamp)}</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {/* Searching indicator — show while loading OR while streaming but no content yet */}
                    {(loading || (streaming && messages[messages.length - 1]?.content === '')) && (
                        <div className="chatbot-msg chatbot-msg--assistant">
                            <div className="chatbot-msg-avatar">
                                <Sparkles size={10} />
                            </div>
                            <div className="chatbot-bubble chatbot-bubble--assistant">
                                <SearchingIndicator />
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Quick-action chips — always visible */}
                <div className="chatbot-quick-actions-wrap">
                    <button className="chatbot-chips-arrow" onClick={() => scrollChips(-1)} title="Scroll left">‹</button>
                    <div className="chatbot-quick-actions" ref={chipsRef}>
                        {QUICK_ACTIONS.map(({ icon: Icon, label, query }) => (
                            <button
                                key={label}
                                className="chatbot-qa-chip"
                                onClick={() => sendMessage(query)}
                                disabled={loading || streaming}
                            >
                                <Icon size={12} />
                                {label}
                            </button>
                        ))}
                    </div>
                    <button className="chatbot-chips-arrow" onClick={() => scrollChips(1)} title="Scroll right">›</button>
                </div>

                {/* Attached image preview */}
                {attachedImage && (
                    <div className="chatbot-image-preview-row">
                        <div className="chatbot-image-preview">
                            <img src={attachedImage} alt="Attached" />
                            <button
                                className="chatbot-image-preview-remove"
                                onClick={() => setAttachedImage(null)}
                                title="Remove image"
                            >
                                <X size={11} />
                            </button>
                        </div>
                        <span className="chatbot-image-preview-hint">Image attached — will use vision model</span>
                    </div>
                )}

                {/* Input row */}
                <div className="chatbot-input-row">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleImageSelect}
                    />
                    <button
                        className="chatbot-attach-btn"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={loading || streaming || imageProcessing}
                        title="Attach an image"
                    >
                        {imageProcessing
                            ? <Loader2 size={15} className="chatbot-spin" />
                            : <ImagePlus size={15} />
                        }
                    </button>
                    <textarea
                        ref={inputRef}
                        className="chatbot-input"
                        rows={1}
                        placeholder="Ask anything about your data..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                        disabled={loading || streaming}
                    />
                    <button
                        className="chatbot-send"
                        onClick={() => sendMessage()}
                        disabled={(!input.trim() && !attachedImage) || loading || streaming}
                    >
                        {loading
                            ? <Loader2 size={15} className="chatbot-spin" />
                            : <Send size={15} />
                        }
                    </button>
                </div>
            </div>
        </>
    );
}

export default ChatBot;
