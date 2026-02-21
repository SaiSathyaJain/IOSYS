import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, BookOpen, Users, Folder, Building, ArrowLeft } from 'lucide-react';
import './TeamSelection.css';

const TeamSelection = () => {
    const navigate = useNavigate();

    const teams = [
        { id: 'ug', name: 'UG Team', desc: 'Handle undergraduate correspondence', icon: <Users size={32} />, color: '#2196f3' },
        { id: 'pg-pro', name: 'PG/PRO Team', desc: 'Postgraduate & Professional communications', icon: <BookOpen size={32} />, color: '#ff9800' },
        { id: 'phd', name: 'PhD Team', desc: 'Doctoral research correspondence', icon: <Building size={32} />, color: '#4caf50' },
    ];

    return (
        <div className="team-selection">

            {/* Header */}
            <header className="selection-header animate-stagger-1">
                <button className="back-btn" onClick={() => navigate('/')}>
                    <ArrowLeft size={20} />
                </button>
                <div className="selection-title">
                    <h1>Select Workspace</h1>
                    <p>Choose your academic department to access tasks and files.</p>
                </div>
            </header>

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
