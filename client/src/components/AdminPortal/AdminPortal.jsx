import { useState, useEffect } from 'react';
import { inwardAPI } from '../../services/api';
import { Inbox, XCirlce, Plus, ClipboardList, Check, X } from 'lucide-react';
import './AdminPortal.css';

function AdminPortal() {
    const [entries, setEntries] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [formData, setFormData] = useState({
        means: '',
        particularsFromWhom: '',
        subject: '',
        takenBy: '',
        signReceiptDateTime: '',
        actionTaken: '',
        fileReference: '',
        assignedTeam: '',
        assignedToEmail: '',
        assignmentInstructions: '',
        dueDate: ''
    });

    // Team Leader Mappings
    const TEAM_EMAILS = {
        'UG': 'sathyajain9@gmail.com',
        'PG/PRO': 'saisathyajain@sssihl.edu.in',
        'PhD': 'results@sssihl.edu.in'
    };

    useEffect(() => {
        loadEntries();
    }, []);

    const loadEntries = async () => {
        try {
            const res = await inwardAPI.getAll();
            setEntries(res.data.entries);
        } catch (error) {
            console.error('Error loading entries:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await inwardAPI.create(formData);
            alert('✅ Inward entry created! Notification sent to team leader.');
            setShowForm(false);
            setFormData({
                means: '', particularsFromWhom: '', subject: '', takenBy: '',
                signReceiptDateTime: '', actionTaken: '', fileReference: '',
                assignedTeam: '', assignedToEmail: '',
                assignmentInstructions: '', dueDate: ''
            });
            loadEntries();
        } catch (error) {
            alert('Error creating entry: ' + error.message);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = { ...prev, [name]: value };

            // Auto-fill email when team changes
            if (name === 'assignedTeam' && TEAM_EMAILS[value]) {
                newData.assignedToEmail = TEAM_EMAILS[value];
            }

            return newData;
        });
    };

    return (
        <div className="admin-portal animate-fade">
            <div className="page-header">
                <h2 className="page-title"><Inbox className="icon-svg" /> Admin Portal - Inward Entries</h2>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> New Inward Entry</>}
                </button>
            </div>

            {showForm && (
                <div className="card form-card">
                    <h3 className="card-title">Create New Inward Entry</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Means *</label>
                                <select name="means" className="form-select" value={formData.means} onChange={handleChange} required>
                                    <option value="">Select...</option>
                                    <option value="Post">Post</option>
                                    <option value="Email">Email</option>
                                    <option value="Hand Delivery">Hand Delivery</option>
                                    <option value="Courier">Courier</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Date & Time *</label>
                                <input type="datetime-local" name="signReceiptDateTime" className="form-input"
                                    value={formData.signReceiptDateTime} onChange={handleChange} required />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">From Whom *</label>
                            <input type="text" name="particularsFromWhom" className="form-input"
                                value={formData.particularsFromWhom} onChange={handleChange} required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Subject *</label>
                            <input type="text" name="subject" className="form-input"
                                value={formData.subject} onChange={handleChange} required />
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Taken By *</label>
                                <input type="text" name="takenBy" className="form-input"
                                    value={formData.takenBy} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">File Reference</label>
                                <input type="text" name="fileReference" className="form-input"
                                    value={formData.fileReference} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Action Taken</label>
                            <textarea name="actionTaken" className="form-textarea"
                                value={formData.actionTaken} onChange={handleChange} />
                        </div>

                        <hr className="divider" />
                        <h4 className="section-title"><ClipboardList size={20} /> Assignment Details</h4>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Assign to Team</label>
                                <select name="assignedTeam" className="form-select" value={formData.assignedTeam} onChange={handleChange}>
                                    <option value="">Select Team...</option>
                                    <option value="UG">UG Team</option>
                                    <option value="PG/PRO">PG/PRO Team</option>
                                    <option value="PhD">PhD Team</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Team Leader Email</label>
                                <input type="email" name="assignedToEmail" className="form-input"
                                    value={formData.assignedToEmail} onChange={handleChange}
                                    placeholder="leader@example.com" />
                            </div>
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Due Date</label>
                                <input type="date" name="dueDate" className="form-input"
                                    value={formData.dueDate} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Assignment Instructions</label>
                            <textarea name="assignmentInstructions" className="form-textarea"
                                value={formData.assignmentInstructions} onChange={handleChange}
                                placeholder="Instructions for the team leader..." />
                        </div>

                        <button type="submit" className="btn btn-primary">
                            <Check size={18} /> Create Entry & Notify Team
                        </button>
                    </form>
                </div>
            )}

            {/* Entries Table */}
            <div className="card">
                <div className="card-header">
                    <h3 className="card-title"><ClipboardList size={20} /> Recent Inward Entries</h3>
                </div>
                {loading ? (
                    <p>Loading...</p>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Inward No</th>
                                    <th>Subject</th>
                                    <th>From</th>
                                    <th>Assigned Team</th>
                                    <th>Status</th>
                                    <th>Due Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(entry => (
                                    <tr key={entry.id}>
                                        <td><strong>{entry.inwardNo}</strong></td>
                                        <td>{entry.subject}</td>
                                        <td>{entry.particularsFromWhom}</td>
                                        <td>
                                            {entry.assignedTeam && (
                                                <span className="badge badge-team">{entry.assignedTeam}</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className={`badge badge-${entry.assignmentStatus?.toLowerCase() || 'pending'}`}>
                                                {entry.assignmentStatus || 'Unassigned'}
                                            </span>
                                        </td>
                                        <td>{entry.dueDate ? new Date(entry.dueDate._seconds * 1000).toLocaleDateString() : '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminPortal;
