import { useNavigate } from 'react-router-dom';
import { ArrowRight, GraduationCap, BookOpen, FlaskConical } from 'lucide-react';
import './TeamSelector.css';

const TEAMS = [
    {
        slug: 'ug',
        name: 'UG Team',
        label: 'Undergraduate',
        description: 'Handle undergraduate student correspondence, assignments and outward entries.',
        icon: GraduationCap,
        accent: 'blue',
    },
    {
        slug: 'pg-pro',
        name: 'PG/PRO Team',
        label: 'Postgraduate & Professional',
        description: 'Manage postgraduate and professional programme-related communications.',
        icon: BookOpen,
        accent: 'amber',
    },
    {
        slug: 'phd',
        name: 'PhD Team',
        label: 'Doctorate',
        description: 'Process doctoral research correspondence and track outward entries.',
        icon: FlaskConical,
        accent: 'green',
    },
];

function TeamSelector() {
    const navigate = useNavigate();

    return (
        <div className="ts-page">
            <div className="ts-header">
                <div className="ts-badge">Internal Workflow</div>
                <h1 className="ts-title">Select Workspace</h1>
                <p className="ts-subtitle">Choose your team to access your dedicated correspondence portal</p>
            </div>

            <div className="ts-grid">
                {TEAMS.map(team => {
                    const Icon = team.icon;
                    return (
                        <button
                            key={team.slug}
                            className={`ts-card ts-card-${team.accent}`}
                            onClick={() => navigate(`/team/${team.slug}`)}
                        >
                            <div className="ts-card-icon">
                                <Icon size={32} strokeWidth={1.5} />
                            </div>
                            <div className="ts-card-body">
                                <div className="ts-card-label">{team.label}</div>
                                <h2 className="ts-card-name">{team.name}</h2>
                                <p className="ts-card-desc">{team.description}</p>
                            </div>
                            <div className="ts-card-enter">
                                Enter <ArrowRight size={16} />
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export default TeamSelector;
