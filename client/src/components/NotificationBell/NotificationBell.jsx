import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Inbox, ClipboardList, MessageSquare, CheckCircle2 } from 'lucide-react';
import { notificationsAPI } from '../../services/api';
import './NotificationBell.css';

const POLL_INTERVAL_MS = 60 * 1000;

const TYPE_ICON = {
    ASSIGNMENT: <ClipboardList size={15} />,
    STATUS: <CheckCircle2 size={15} />,
    REMARKS: <MessageSquare size={15} />,
    INBOX: <Inbox size={15} />,
};

function relativeTime(value) {
    if (!value) return '';
    // D1 stores CURRENT_TIMESTAMP as "YYYY-MM-DD HH:MM:SS" in UTC without a zone marker
    const iso = /^\d{4}-\d{2}-\d{2} /.test(value) ? value.replace(' ', 'T') + 'Z' : value;
    const then = new Date(iso);
    if (isNaN(then)) return '';

    const seconds = Math.floor((Date.now() - then.getTime()) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return then.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/**
 * Notification bell + dropdown panel.
 * Identify the viewer with `email` (admin) and/or `team` (team portal).
 */
function NotificationBell({ email, team }) {
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const [items, setItems] = useState([]);
    const [unread, setUnread] = useState(0);
    const [loading, setLoading] = useState(false);
    const wrapRef = useRef(null);

    const canQuery = Boolean(email || team);

    const load = useCallback(async () => {
        if (!canQuery) return;
        try {
            const res = await notificationsAPI.getAll({ email, team, limit: 30 });
            if (res.data.success) {
                setItems(res.data.notifications || []);
                setUnread(res.data.unreadCount || 0);
            }
        } catch {
            // offline or server hiccup — keep whatever we have, retry next poll
        }
    }, [email, team, canQuery]);

    const loadCount = useCallback(async () => {
        if (!canQuery) return;
        try {
            const res = await notificationsAPI.getUnreadCount({ email, team });
            if (res.data.success) setUnread(res.data.count || 0);
        } catch {
            // ignore
        }
    }, [email, team, canQuery]);

    // Poll the cheap count endpoint; fetch the full list only when open
    useEffect(() => {
        if (!canQuery) return;
        loadCount();
        const id = setInterval(() => {
            if (document.visibilityState === 'visible') loadCount();
        }, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [loadCount, canQuery]);

    // Close on outside click / Escape
    useEffect(() => {
        if (!open) return;
        const onClick = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    const togglePanel = async () => {
        const next = !open;
        setOpen(next);
        if (next) {
            setLoading(true);
            await load();
            setLoading(false);
        }
    };

    const handleMarkAll = async () => {
        if (unread === 0) return;
        const previous = items;
        setItems(items.map(n => ({ ...n, isRead: 1 })));
        setUnread(0);
        try {
            await notificationsAPI.markAllAsRead({ email, team });
        } catch {
            setItems(previous);
            loadCount();
        }
    };

    const handleOpenItem = async (item) => {
        if (!item.isRead) {
            setItems(items.map(n => (n.id === item.id ? { ...n, isRead: 1 } : n)));
            setUnread(u => Math.max(0, u - 1));
            notificationsAPI.markAsRead(item.id).catch(() => loadCount());
        }
        setOpen(false);
        if (item.link) navigate(item.link);
    };

    if (!canQuery) return null;

    return (
        <div className="nb-wrap" ref={wrapRef}>
            <button
                className={`nb-trigger${open ? ' active' : ''}`}
                onClick={togglePanel}
                title="Notifications"
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                aria-expanded={open}
            >
                <Bell size={16} />
                {unread > 0 && <span className="nb-badge">{unread > 99 ? '99+' : unread}</span>}
            </button>

            {open && (
                <div className="nb-panel" role="dialog" aria-label="Notifications">
                    <div className="nb-panel-header">
                        <span className="nb-panel-title">
                            Notifications
                            {unread > 0 && <span className="nb-panel-count">{unread} new</span>}
                        </span>
                        <button
                            className="nb-mark-all"
                            onClick={handleMarkAll}
                            disabled={unread === 0}
                            title="Mark all as read"
                        >
                            <CheckCheck size={13} /> Mark all read
                        </button>
                    </div>

                    <div className="nb-list">
                        {loading && items.length === 0 && (
                            <div className="nb-empty">Loading…</div>
                        )}
                        {!loading && items.length === 0 && (
                            <div className="nb-empty">
                                <Bell size={22} />
                                <span>You're all caught up</span>
                            </div>
                        )}
                        {items.map(item => (
                            <button
                                key={item.id}
                                className={`nb-item${item.isRead ? '' : ' unread'}`}
                                onClick={() => handleOpenItem(item)}
                            >
                                <span className={`nb-item-icon nb-type-${(item.type || 'SYSTEM').toLowerCase()}`}>
                                    {TYPE_ICON[item.type] || <Bell size={15} />}
                                </span>
                                <span className="nb-item-body">
                                    <span className="nb-item-title">{item.title}</span>
                                    {item.body && <span className="nb-item-text">{item.body}</span>}
                                    <span className="nb-item-meta">
                                        {item.inwardNo && <span className="nb-item-ref">{item.inwardNo}</span>}
                                        <span>{relativeTime(item.createdAt)}</span>
                                    </span>
                                </span>
                                {!item.isRead && <span className="nb-item-dot" />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default NotificationBell;
