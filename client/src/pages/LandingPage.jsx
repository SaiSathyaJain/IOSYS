import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Users, Moon, Sun } from 'lucide-react';
import './LandingPage.css';

const LandingPage = () => {
    const navigate = useNavigate();
    const [userPhoto, setUserPhoto] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(true);

    useEffect(() => {
        // Load User
        const adminUser = localStorage.getItem('adminUser');
        if (adminUser) {
            try {
                const user = JSON.parse(adminUser);
                setUserPhoto(user.picture);
            } catch (e) { console.error(e); }
        }

        // Load Theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            setIsDarkMode(savedTheme === 'dark');
        }
    }, []);

    useEffect(() => {
        // Sync theme across app
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    return (
        <motion.div
            className={`landing-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
        >
            {/* Top Navigation Bar */}
            <nav className="top-nav">
                <div className="logo-section">
                    <img src="/sssihl-icon.jpg" alt="SSSIHL Logo" style={{ width: '35px', height: '35px', borderRadius: '8px', objectFit: 'cover' }} />
                    <span className="logo-text">SSSIHL</span>
                </div>

                <div className="user-section">
                    <div className="theme-toggle" onClick={() => { document.body.classList.add('theme-transitioning'); setIsDarkMode(v => !v); setTimeout(() => document.body.classList.remove('theme-transitioning'), 350); }}>
                        {isDarkMode ? <Sun size={18} className="theme-icon active" /> : <Moon size={18} className="theme-icon active" />}
                    </div>
                    <div className="user-profile">
                        <div className="user-info">
                            <span className="role">Admin</span>
                            <span className="status">
                                <span className="online-dot" />
                                Online
                            </span>
                        </div>
                        <div className="avatar-wrap">
                            <img src={userPhoto || "https://ui-avatars.com/api/?name=Admin&background=475569&color=ffffff"} alt="Profile" />
                            <span className="avatar-status-dot" />
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="main-content">
                <div className="header-group">
                    <h1 className="main-title animate-stagger-1">
                        Inward / Outward Management <span className="highlight">System</span>
                    </h1>
                    <p className="subtitle animate-stagger-2">
                        SSSIHL — Document Tracking & Correspondence Portal
                    </p>
                </div>

                <div className="card-grid">
                    {/* Admin Portal Card */}
                    <div
                        className="portal-card glass-card animate-stagger-3 interactive"
                        onClick={() => navigate('/admin')}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="icon-wrapper admin-icon">
                            <Shield size={48} />
                        </div>
                        <h2>Admin Portal</h2>
                        <p>Centralized control for entry management, logging, and institutional analytics.</p>
                    </div>

                    {/* Team Portal Card */}
                    <div
                        className="portal-card glass-card animate-stagger-3 interactive"
                        style={{ animationDelay: '0.4s' }}
                        onClick={() => navigate('/team')}
                        role="button"
                        tabIndex={0}
                    >
                        <div className="icon-wrapper team-icon">
                            <Users size={48} />
                        </div>
                        <h2>Team Portal</h2>
                        <p>Workspace for academic departments to process tasks and generate responses.</p>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="landing-footer">
                © 2026 SSSIHL DIGITAL INFRASTRUCTURE
            </footer>
        </motion.div>
    );
};

export default LandingPage;
