import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Particles from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { Shield, Users, ArrowRight, Bell, Mail, ChevronDown, Moon, Sun } from 'lucide-react';
import { notificationsAPI, messagesAPI } from '../../services/api';
import './LandingPage.css';

function LandingPage() {
    const navigate = useNavigate();
    const [userPhoto, setUserPhoto] = useState(null);
    const [userEmail, setUserEmail] = useState('');
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showMessages, setShowMessages] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [messages, setMessages] = useState([]);
    const [notificationCount, setNotificationCount] = useState(0);
    const [messageCount, setMessageCount] = useState(0);

    const particlesInit = useCallback(async engine => {
        await loadSlim(engine);
    }, []);

    useEffect(() => {
        // Load User
        const adminUser = localStorage.getItem('adminUser');
        if (adminUser) {
            try {
                const user = JSON.parse(adminUser);
                setUserPhoto(user.picture);
                setUserEmail(user.email);
            } catch (e) { console.error(e); }
        }

        // Load Theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            setIsDarkMode(savedTheme === 'dark');
        }
    }, []);

    // Fetch notifications and messages
    useEffect(() => {
        if (!userEmail) return;

        const fetchData = async () => {
            try {
                // Fetch notifications
                const [notifRes, notifCountRes, msgRes, msgCountRes] = await Promise.all([
                    notificationsAPI.getAll(userEmail),
                    notificationsAPI.getUnreadCount(userEmail),
                    messagesAPI.getAll(userEmail),
                    messagesAPI.getUnreadCount(userEmail)
                ]);

                if (notifRes.data.success) {
                    setNotifications(notifRes.data.notifications);
                }
                if (notifCountRes.data.success) {
                    setNotificationCount(notifCountRes.data.count);
                }
                if (msgRes.data.success) {
                    setMessages(msgRes.data.messages);
                }
                if (msgCountRes.data.success) {
                    setMessageCount(msgCountRes.data.count);
                }
            } catch (error) {
                console.error('Error fetching notifications/messages:', error);
            }
        };

        fetchData();
        // Refresh every 30 seconds
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, [userEmail]);

    useEffect(() => {
        // Sync theme across app
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    // Helper function to format time ago
    const timeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    };

    // Mark notification as read and navigate to portal
    const handleNotificationClick = async (id) => {
        try {
            await notificationsAPI.markAsRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? {...n, isRead: 1} : n));
            setNotificationCount(prev => Math.max(0, prev - 1));

            // Navigate based on user type
            const isAdmin = localStorage.getItem('adminAuth') === 'true';
            navigate(isAdmin ? '/admin' : '/team');

            // Close the dropdown
            setShowNotifications(false);
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Mark message as read and navigate to messages page
    const handleMessageClick = async (id) => {
        try {
            await messagesAPI.markAsRead(id);
            setMessages(prev => prev.map(m => m.id === id ? {...m, isRead: 1} : m));
            setMessageCount(prev => Math.max(0, prev - 1));

            // Navigate to messages page based on user type
            const isAdmin = localStorage.getItem('adminAuth') === 'true';
            navigate(isAdmin ? '/admin/messages' : '/team/messages');

            // Close the dropdown
            setShowMessages(false);
        } catch (error) {
            console.error('Error marking message as read:', error);
        }
    };

    return (
        <div className={`space-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>
            {/* Particles Background */}
            <Particles
                id="tsparticles"
                init={particlesInit}
                options={{
                    background: {
                        color: { value: isDarkMode ? "#0b0f19" : "#f0f2f5" },
                    },
                    fpsLimit: 120,
                    particles: {
                        color: { value: isDarkMode ? "#ffffff" : "#334155" },
                        links: {
                            color: isDarkMode ? "#ffffff" : "#334155",
                            distance: 150,
                            enable: true,
                            opacity: isDarkMode ? 0.1 : 0.05,
                            width: 1,
                        },
                        move: {
                            enable: true,
                            speed: 0.8,
                            direction: "none",
                            random: false,
                            straight: false,
                            outModes: { default: "bounce" },
                        },
                        number: {
                            density: { enable: true, area: 800 },
                            value: 80,
                        },
                        opacity: { value: isDarkMode ? 0.3 : 0.5 },
                        shape: { type: "circle" },
                        size: { value: { min: 1, max: 3 } },
                    },
                    detectRetina: true,
                }}
                className="particles-bg"
            />

            {/* Top Navbar overlay */}
            <div className="space-navbar">
                <div className="space-brand">
                    <div className="brand-icon">IO</div>
                    <span>Inward/Outward</span>
                </div>
                <div className="space-actions">
                    <button className="icon-btn" onClick={() => setIsDarkMode(!isDarkMode)}>
                        {isDarkMode ? <Sun size={20} className="icon-svg" /> : <Moon size={20} className="icon-svg" />}
                    </button>

                    <div style={{position: 'relative'}}>
                        <button className="icon-btn" onClick={() => {setShowMessages(!showMessages); setShowNotifications(false);}}>
                            <Mail size={20} className="icon-svg" />
                            {messageCount > 0 && <span className="badge-dot">{messageCount}</span>}
                        </button>
                        {showMessages && (
                            <div className="notification-dropdown">
                                <div className="dropdown-header">
                                    <h4>Messages</h4>
                                    {messageCount > 0 && <span className="badge-count">{messageCount}</span>}
                                </div>
                                <div className="dropdown-content">
                                    {messages.length === 0 ? (
                                        <div className="notification-item">
                                            <div style={{width: '100%', textAlign: 'center', opacity: 0.5}}>
                                                <p className="notification-title">No messages</p>
                                            </div>
                                        </div>
                                    ) : (
                                        messages.slice(0, 5).map((msg) => (
                                            <div
                                                key={msg.id}
                                                className={`notification-item ${msg.isRead ? 'read' : 'unread'}`}
                                                onClick={() => handleMessageClick(msg.id)}
                                            >
                                                <Mail size={16} />
                                                <div>
                                                    <p className="notification-title">{msg.subject}</p>
                                                    <p className="notification-time">{timeAgo(msg.createdAt)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="dropdown-footer">
                                    <Link
                                        to={localStorage.getItem('adminAuth') === 'true' ? '/admin/messages' : '/team/messages'}
                                        className="btn-link"
                                    >
                                        View all messages
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                    <div style={{position: 'relative'}}>
                        <button className="icon-btn" onClick={() => {setShowNotifications(!showNotifications); setShowMessages(false);}}>
                            <Bell size={20} className="icon-svg" />
                            {notificationCount > 0 && <span className="badge-dot orange">{notificationCount}</span>}
                        </button>
                        {showNotifications && (
                            <div className="notification-dropdown">
                                <div className="dropdown-header">
                                    <h4>Notifications</h4>
                                    {notificationCount > 0 && <span className="badge-count orange">{notificationCount}</span>}
                                </div>
                                <div className="dropdown-content">
                                    {notifications.length === 0 ? (
                                        <div className="notification-item">
                                            <div style={{width: '100%', textAlign: 'center', opacity: 0.5}}>
                                                <p className="notification-title">No notifications</p>
                                            </div>
                                        </div>
                                    ) : (
                                        notifications.slice(0, 5).map((notif) => (
                                            <div
                                                key={notif.id}
                                                className={`notification-item ${notif.isRead ? 'read' : 'unread'}`}
                                                onClick={() => handleNotificationClick(notif.id)}
                                            >
                                                <Bell size={16} />
                                                <div>
                                                    <p className="notification-title">{notif.title}</p>
                                                    <p className="notification-time">{timeAgo(notif.createdAt)}</p>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                                <div className="dropdown-footer">
                                    <Link
                                        to={localStorage.getItem('adminAuth') === 'true' ? '/admin' : '/team'}
                                        className="btn-link"
                                    >
                                        View all notifications
                                    </Link>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="profile-pill">
                        <img
                            src={userPhoto || "https://ui-avatars.com/api/?name=Admin&background=random"}
                            alt="Profile"
                            className="profile-img"
                        />
                        <span>Admin</span>
                        <ChevronDown size={14} />
                    </div>
                </div>
            </div>

            <div className="space-content animate-fade">
                <div className="space-header">
                    <img src="/IO_SYS_LOGO.png" alt="Inward/Outward System" className="landing-logo" />
                    <p>Please select your portal to continue.</p>
                </div>

                <div className="glass-cards">
                    {/* Admin Card */}
                    <Link to="/admin" className="glass-card admin-glass">
                        <div className="glow-effect"></div>
                        <div className="card-icon-wrapper">
                            <Shield size={48} strokeWidth={1.5} />
                        </div>
                        <h2>Admin Portal</h2>
                        <p>Manage inward entries, assign tasks, and view dashboard statistics.</p>
                        <span className="glass-link">
                            Enter Admin Portal <ArrowRight size={16} />
                        </span>
                    </Link>

                    {/* Team Card */}
                    <Link to="/team" className="glass-card team-glass">
                        <div className="glow-effect"></div>
                        <div className="card-icon-wrapper">
                            <Users size={48} strokeWidth={1.5} />
                        </div>
                        <h2>Team Portal</h2>
                        <p>View assignments, process tasks, and create outward entries.</p>
                        <span className="glass-link">
                            Enter Team Portal <ArrowRight size={16} />
                        </span>
                    </Link>
                </div>
            </div>
        </div>
    );
}

export default LandingPage;
