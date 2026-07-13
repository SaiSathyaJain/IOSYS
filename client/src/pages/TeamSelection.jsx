import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { BookOpen, Users, Building, ArrowLeft, Sun, Moon } from 'lucide-react';
import './TeamSelection.css';

const TiltCard = ({ team, idx, onClick }) => {
    const ref = useRef(null);
    const x = useMotionValue(0);
    const y = useMotionValue(0);
    const springConfig = { stiffness: 200, damping: 20, mass: 0.5 };
    const rotateX = useSpring(useTransform(y, [-0.5, 0.5], [10, -10]), springConfig);
    const rotateY = useSpring(useTransform(x, [-0.5, 0.5], [-10, 10]), springConfig);

    const handleMouseMove = (e) => {
        const rect = ref.current.getBoundingClientRect();
        x.set((e.clientX - rect.left) / rect.width - 0.5);
        y.set((e.clientY - rect.top) / rect.height - 0.5);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            ref={ref}
            className="team-card glass-card interactive animate-stagger-3"
            style={{
                animationDelay: `${(idx * 0.1) + 0.2}s`,
                '--team-color': team.color,
                rotateX,
                rotateY,
                transformPerspective: 900,
            }}
            whileHover={{ scale: 1.03, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onClick={onClick}
        >
            <div
                className="team-icon-container"
                style={{ color: team.color, boxShadow: `inset 0 0 20px ${team.color}15` }}
            >
                {team.icon}
            </div>
            <h3>{team.name}</h3>
            <p>Enter workspace →</p>
        </motion.div>
    );
};

const TeamSelection = () => {
    const navigate = useNavigate();
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');

    useEffect(() => {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    const teams = [
        { id: 'upas', name: 'UPAS Team', desc: 'Handle undergraduate correspondence', icon: <Users size={32} />, color: '#2196f3' },
        { id: 'ppas', name: 'PPAS Team', desc: 'Postgraduate & Professional communications', icon: <BookOpen size={32} />, color: '#ff9800' },
        { id: 'upas-ppas', name: 'UPAS/PPAS Team', desc: 'Combined undergraduate & postgraduate correspondence', icon: <Users size={32} />, color: '#e91e63' },
        { id: 'dpas', name: 'DPAS Team', desc: 'Doctoral research correspondence', icon: <Building size={32} />, color: '#4caf50' },
    ];

    return (
        <motion.div
            className="team-selection"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
        >

            {/* Navbar */}
            <header className="selection-header">
                <div className="sel-nav-left">
                    <button className="back-btn" onClick={() => navigate('/')}>
                        <ArrowLeft size={20} />
                    </button>
                    <img src="/sssihl-icon.jpg" alt="SSSIHL" style={{ width: '32px', height: '32px', borderRadius: '7px', objectFit: 'cover' }} />
                    <div className="sel-brand">
                        <span className="sel-brand-name">SSSIHL</span>
                        <span className="sel-brand-sub">Team Portal</span>
                    </div>
                </div>
                <div className="sel-nav-right">
                    <button className="theme-toggle-btn" onClick={() => { document.body.classList.add('theme-transitioning'); setIsDarkMode(v => !v); setTimeout(() => document.body.classList.remove('theme-transitioning'), 350); }} title="Toggle theme">
                        {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
                    </button>
                </div>
            </header>

            {/* Page Title */}
            <div className="selection-title animate-stagger-1">
                <h1>Select Workspace</h1>
            </div>

            {/* Grid */}
            <main className="team-grid-container animate-stagger-2">
                <div className="team-grid">
                    {teams.map((team, idx) => (
                        <TiltCard key={team.id} team={team} idx={idx} onClick={() => navigate(`/team/${team.id}`)} />
                    ))}
                </div>
            </main>
        </motion.div>
    );
};

export default TeamSelection;
