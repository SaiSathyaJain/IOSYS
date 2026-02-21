import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Particles from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import { Shield, Users, ArrowRight, ChevronDown, Moon, Sun } from 'lucide-react';
import './LandingPage.css';

function LandingPage() {
    const [userPhoto, setUserPhoto] = useState(null);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [introPhase, setIntroPhase] = useState('visible'); // 'visible' | 'exiting' | 'done'

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
            } catch (e) { console.error(e); }
        }

        // Load Theme
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) {
            setIsDarkMode(savedTheme === 'dark');
        }

        // Intro timing: start exit after 2.4s, remove after 3s
        const exitTimer = setTimeout(() => setIntroPhase('exiting'), 2400);
        const doneTimer = setTimeout(() => setIntroPhase('done'), 3000);
        return () => { clearTimeout(exitTimer); clearTimeout(doneTimer); };
    }, []);

    useEffect(() => {
        // Sync theme across app
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    return (
        <div className={`space-container ${isDarkMode ? 'dark-mode' : 'light-mode'}`}>

            {/* ── Intro Splash ── */}
            {introPhase !== 'done' && (
                <div className={`intro-overlay ${introPhase === 'exiting' ? 'intro-exit' : ''}`}>
                    <div className="intro-bg-glow" />
                    <div className="intro-content">
                        <div className="intro-logo-wrap">
                            <div className="intro-ring intro-ring-1" />
                            <div className="intro-ring intro-ring-2" />
                            <img src="/IO_SYS_LOGO.png" alt="IO System" className="intro-logo" />
                        </div>
                        <p className="intro-tagline">Inward / Outward Management System</p>
                        <div className="intro-bar-track">
                            <div className="intro-bar-fill" />
                        </div>
                    </div>
                </div>
            )}
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
                    <img src="/sssihl-icon.jpg" alt="SSSIHL Logo" style={{ width: '35px', height: '35px', borderRadius: '8px', objectFit: 'cover' }} />
                    <span>Inward/Outward</span>
                </div>
                <div className="space-actions">
                    <button className="icon-btn" onClick={() => setIsDarkMode(!isDarkMode)}>
                        {isDarkMode ? <Sun size={20} className="icon-svg" /> : <Moon size={20} className="icon-svg" />}
                    </button>
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
