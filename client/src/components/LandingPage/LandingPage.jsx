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
                    <img src="/sssihl-icon.jpg" alt="SSSIHL Logo" style={{ width: '35px', height: '35px', borderRadius: '50%', objectFit: 'cover' }} />
                    <span>SSSIHL</span>
                </div>
                <div className="space-actions">
                    <button className="icon-btn" onClick={() => { document.body.classList.add('theme-transitioning'); setIsDarkMode(v => !v); setTimeout(() => document.body.classList.remove('theme-transitioning'), 350); }}>
                        {isDarkMode ? <Sun size={20} className="icon-svg" /> : <Moon size={20} className="icon-svg" />}
                    </button>
                    <div className="profile-pill">
                        <img
                            src={userPhoto || "https://ui-avatars.com/api/?name=Admin&background=475569&color=ffffff"}
                            alt="Profile"
                            className="profile-img"
                        />
                        <span>Admin</span>
                        <ChevronDown size={14} />
                    </div>
                </div>
            </div>

            <div className="space-content">
                <div className="space-header stagger-1">
                    <h1 className="landing-heading">
                        Unified <span className="gradient-text">Correspondence Intelligence</span>
                    </h1>
                    <p className="landing-sub">SSSIHL — Document Tracking &amp; Correspondence Portal</p>
                </div>

                <div className="glass-cards">
                    {/* Admin Card */}
                    <Link to="/admin" className="glass-card admin-glass stagger-2">
                        <div className="card-icon-wrapper admin-icon">
                            <Shield size={36} strokeWidth={1.5} />
                        </div>
                        <h2>Admin Portal</h2>
                        <p>Comprehensive management suite for institutional oversight, secure logging, and real-time correspondence analytics.</p>
                        <div className="card-cta">
                            <span className="cta-text admin-cta">ACCESS INFRASTRUCTURE</span>
                            <span className="circle-btn admin-circle">
                                <ArrowRight size={20} />
                            </span>
                        </div>
                    </Link>

                    {/* Team Card */}
                    <Link to="/team" className="glass-card team-glass stagger-3">
                        <div className="card-icon-wrapper team-icon">
                            <Users size={36} strokeWidth={1.5} />
                        </div>
                        <h2>Team Portal</h2>
                        <p>Collaborative workspace for academic departments to streamline document workflows and response generation.</p>
                        <div className="card-cta">
                            <span className="cta-text team-cta">OPEN WORKSPACE</span>
                            <span className="circle-btn team-circle">
                                <ArrowRight size={20} />
                            </span>
                        </div>
                    </Link>
                </div>
            </div>

            <footer className="landing-footer">
                © 2024 SSSIHL DIGITAL INFRASTRUCTURE
            </footer>
        </div>
    );
}

export default LandingPage;
