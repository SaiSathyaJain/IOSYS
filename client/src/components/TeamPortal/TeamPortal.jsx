import { useState, useEffect } from 'react';
import { outwardAPI, inwardAPI } from '../../services/api';
import { Clock, CheckCircle, ArrowRight, AlertCircle, Calendar, Plus, X, ClipboardList, Check, FileText } from 'lucide-react';
import './TeamPortal.css';

function TeamPortal() {
    const [entries, setEntries] = useState([]);
    const [pendingInward, setPendingInward] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [selectedTeam, setSelectedTeam] = useState('');
    const [formData, setFormData] = useState({
        means: '',
        toWhom: '',
        subject: '',
        sentBy: '',
        signReceiptDateTime: '',
        caseClosed: false,
        fileReference: '',
        postalTariff: '',
        dueDate: '',
        linkedInwardId: '',
        createdByTeam: '',
        teamMemberEmail: ''
    });

    useEffect(() => {
        loadData();
    }, [selectedTeam]);

    const loadData = async () => {
        try {
            const [outwardRes, inwardRes] = await Promise.all([
                outwardAPI.getAll(selectedTeam),
                inwardAPI.getAll()
            ]);
            setEntries(outwardRes.data.entries);

            // Filter pending inward entries for linking
            // Logic: Show all assignments if "All Teams" selected, else filter by team
            const pending = inwardRes.data.entries.filter(e => {
                const matchesTeam = !selectedTeam || e.assignedTeam === selectedTeam;
                const matchesStatus = e.assignmentStatus === 'Pending' || e.assignmentStatus === 'In Progress';
                // Only show entries that have an assigned team
                return e.assignedTeam && matchesTeam && matchesStatus;
            });

            setPendingInward(pending);
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleProcess = (inwardEntry) => {
        setFormData({
            ...formData,
            subject: `Re: ${inwardEntry.subject}`,
            toWhom: inwardEntry.particularsFromWhom,
            linkedInwardId: inwardEntry.id,
            createdByTeam: selectedTeam || inwardEntry.assignedTeam || '',
            fileReference: inwardEntry.fileReference || ''
        });
        setShowForm(true);
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await inwardAPI.updateStatus(id, status);
            loadData(); // Refresh data
        } catch (error) {
            alert('Error updating status: ' + error.message);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await outwardAPI.create(formData);
            alert('✅ Outward entry created successfully!');
            setShowForm(false);
            setFormData({
                means: '', toWhom: '', subject: '', sentBy: '',
                signReceiptDateTime: '', caseClosed: false, fileReference: '',
                postalTariff: '', dueDate: '', linkedInwardId: '',
                createdByTeam: '', teamMemberEmail: ''
            });
            loadData();
        } catch (error) {
            alert('Error creating entry: ' + error.message);
        }
    };

    const handleChange = (e) => {
        const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    return (
        <div className="team-portal animate-fade">
            <div className="page-header">
                <h2 className="page-title">📤 Team Portal</h2>
                <div className="header-actions">
                    <select className="form-select team-filter" value={selectedTeam}
                        onChange={(e) => setSelectedTeam(e.target.value)}>
                        <option value="">All Teams (Overview)</option>
                        <option value="UG">UG Team</option>
                        <option value="PG/PRO">PG/PRO Team</option>
                        <option value="PhD">PhD Team</option>
                    </select>
                    <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                        {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> New Outward Entry</>}
                    </button>
                </div>
            </div>

            {/* Pending Assignments Section */}
            <div className="card glass-card team-glass">
                <div className="glow-effect"></div>
                <div className="card-header">
                    <h3 className="card-title">
                        <Clock size={20} className="text-warning" style={{ color: 'var(--warning)' }} />
                        Pending Assignments {selectedTeam ? `for ${selectedTeam}` : ''}
                    </h3>
                </div>
                {pendingInward.length === 0 ? (
                    <div className="empty-state">
                        <CheckCircle size={48} style={{ color: 'var(--success)', marginBottom: '1rem' }} />
                        <p>No pending assignments found. Good job!</p>
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Inward No</th>
                                    <th>Subject</th>
                                    <th>Assigned To</th>
                                    <th>Due Date</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pendingInward.map(entry => (
                                    <tr key={entry.id}>
                                        <td><strong>{entry.inwardNo}</strong></td>
                                        <td>
                                            <div>{entry.subject}</div>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                From: {entry.particularsFromWhom}
                                            </div>
                                            {entry.assignmentInstructions && (
                                                <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <FileText size={12} /> {entry.assignmentInstructions}
                                                </div>
                                            )}
                                        </td>
                                        <td><span className="badge badge-team">{entry.assignedTeam}</span></td>
                                        <td>
                                            {entry.dueDate ? (
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <Calendar size={14} />
                                                    {new Date(entry.dueDate._seconds ? entry.dueDate._seconds * 1000 : entry.dueDate).toLocaleDateString()}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td>
                                            <select
                                                className="form-select status-select"
                                                value={entry.assignmentStatus}
                                                onChange={(e) => handleStatusUpdate(entry.id, e.target.value)}
                                            >
                                                <option value="Pending">Pending</option>
                                                <option value="In Progress">In Progress</option>
                                            </select>
                                        </td>
                                        <td>
                                            <button className="btn btn-sm btn-primary" onClick={() => handleProcess(entry)}>
                                                Process <ArrowRight size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {showForm && (
                <div className="card form-card animate-fade glass-card team-glass">
                    <div className="glow-effect"></div>
                    <h3 className="card-title">Create New Outward Entry</h3>
                    <form onSubmit={handleSubmit}>
                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Your Team *</label>
                                <select name="createdByTeam" className="form-select" value={formData.createdByTeam} onChange={handleChange} required>
                                    <option value="">Select Team...</option>
                                    <option value="UG">UG Team</option>
                                    <option value="PG/PRO">PG/PRO Team</option>
                                    <option value="PhD">PhD Team</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Your Email *</label>
                                <input type="email" name="teamMemberEmail" className="form-input"
                                    value={formData.teamMemberEmail} onChange={handleChange} required />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Link to Inward Entry (Optional)</label>
                            <select name="linkedInwardId" className="form-select" value={formData.linkedInwardId} onChange={handleChange}>
                                <option value="">No link - Independent outward</option>
                                {pendingInward.map(entry => (
                                    <option key={entry.id} value={entry.id}>
                                        {entry.inwardNo} - {entry.subject}
                                    </option>
                                ))}
                            </select>
                        </div>

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
                            <label className="form-label">To Whom *</label>
                            <input type="text" name="toWhom" className="form-input"
                                value={formData.toWhom} onChange={handleChange} required />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Subject *</label>
                            <input type="text" name="subject" className="form-input"
                                value={formData.subject} onChange={handleChange} required />
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Sent By *</label>
                                <input type="text" name="sentBy" className="form-input"
                                    value={formData.sentBy} onChange={handleChange} required />
                            </div>
                            <div className="form-group">
                                <label className="form-label">File Reference</label>
                                <input type="text" name="fileReference" className="form-input"
                                    value={formData.fileReference} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="grid-2">
                            <div className="form-group">
                                <label className="form-label">Due Date</label>
                                <input type="date" name="dueDate" className="form-input"
                                    value={formData.dueDate} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Postal Tariff</label>
                                <input type="number" name="postalTariff" className="form-input"
                                    value={formData.postalTariff} onChange={handleChange} />
                            </div>
                        </div>

                        <div className="form-group checkbox-group">
                            <input type="checkbox" name="caseClosed" id="caseClosed"
                                checked={formData.caseClosed} onChange={handleChange} />
                            <label htmlFor="caseClosed">Case Closed</label>
                        </div>

                        <button type="submit" className="btn btn-primary">
                            <Check size={18} /> Create Outward Entry
                        </button>
                    </form>
                </div>
            )}

            {/* Outward History Table */}
            <div className="card glass-card team-glass">
                <div className="glow-effect"></div>
                <div className="card-header">
                    <h3 className="card-title"><ClipboardList size={20} /> Outward History</h3>
                </div>
                {loading ? (
                    <div className="loading">Loading...</div>
                ) : (
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Outward No</th>
                                    <th>Subject</th>
                                    <th>To</th>
                                    <th>Team</th>
                                    <th>Linked Inward</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map(entry => (
                                    <tr key={entry.id}>
                                        <td><strong>{entry.outwardNo}</strong></td>
                                        <td>{entry.subject}</td>
                                        <td>{entry.toWhom}</td>
                                        <td><span className="badge badge-team">{entry.createdByTeam}</span></td>
                                        <td>{entry.linkedInwardId || '-'}</td>
                                        <td>{entry.createdAt ? new Date(entry.createdAt._seconds ? entry.createdAt._seconds * 1000 : entry.createdAt).toLocaleDateString() : '-'}</td>
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

export default TeamPortal;
