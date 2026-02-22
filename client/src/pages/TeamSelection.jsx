import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Users, Building, ArrowLeft, Sun, Moon } from 'lucide-react';
import './TeamSelection.css';

const TeamSelection = () => {
    const navigate = useNavigate();
    const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') !== 'light');

    useEffect(() => {
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
        document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    }, [isDarkMode]);

    const teams = [
        { id: 'ug', name: 'UG Team', desc: 'Handle undergraduate correspondence', icon: <Users size={32} />, color: '#2196f3' },
        { id: 'pg-pro', name: 'PG/PRO Team', desc: 'Postgraduate & Professional communications', icon: <BookOpen size={32} />, color: '#ff9800' },
        { id: 'phd', name: 'PhD Team', desc: 'Doctoral research correspondence', icon: <Building size={32} />, color: '#4caf50' },
    ];

    return (
        <div className="team-selection">

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
                    <button className="back-btn" onClick={() => setIsDarkMode(!isDarkMode)} title="Toggle theme">
                        {isDarkMode ? <Sun size={17} /> : <Moon size={17} />}
                    </button>
                </div>
            </header>

            {/* Page Title */}
            <div className="selection-title animate-stagger-1">
                <h1>Select Workspace</h1>
                <p>Choose your academic department to access tasks and files.</p>
            </div>

            {/* Grid */}
            <main className="team-grid-container animate-stagger-2">
                <div className="team-grid">
                    {teams.map((team, idx) => (
                        <div
                            key={team.id}
                            className="team-card glass-card interactive animate-stagger-3"
                            style={{ animationDelay: `${(idx * 0.1) + 0.2}s` }}
                            onClick={() => navigate(`/team/${team.id}`)}
                        >
                            <div
                                className="team-icon-container"
                                style={{ color: team.color, boxShadow: `inset 0 0 20px ${team.color}15` }}
                            >
                                {team.icon}
                            </div>
                            <h3>{team.name}</h3>
                            <p>Enter workspace →</p>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default TeamSelection;
