import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Calendar, Check } from 'lucide-react';
import { inwardAPI } from '../services/api';
import './AdminEntry.css';

const TEAM_EMAILS = {
    'UG': 'sathyajain9@gmail.com',
    'PG/PRO': 'saisathyajain@sssihl.edu.in',
    'PhD': 'results@sssihl.edu.in'
};

const AdminEntry = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        means: '',
        particularsFromWhom: '',
        subject: '',
        signReceiptDateTime: '',
        assignedTeam: '',
        assignedToEmail: '',
        assignmentInstructions: '',
        dueDate: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = { ...prev, [name]: value };
            if (name === 'assignedTeam' && TEAM_EMAILS[value]) {
                newData.assignedToEmail = TEAM_EMAILS[value];
            } else if (name === 'assignedTeam' && !value) {
                newData.assignedToEmail = '';
            }
            return newData;
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const response = await inwardAPI.create(formData);
            let message = 'Inward entry created successfully!';
            if (response.data?.notification?.success) {
                message += ` Email sent to ${formData.assignedToEmail}`;
            } else if (response.data?.notification?.skipped) {
                message += ` (Email skipped: ${response.data.notification.reason})`;
            }
            alert(message);
            navigate('/admin');
        } catch (error) {
            console.error('Error creating entry:', error);
            alert('Error creating entry: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="admin-entry-page">
            {/* Background Overlay Simulation */}
            <div className="dashboard-background-mock" onClick={() => navigate('/admin')}>
            </div>

            {/* Modal Container */}
            <div className="modal-overlay animate-stagger-1">
                <div className="entry-modal glass-card" style={{ maxWidth: '800px' }}>

                    {/* Modal Header */}
                    <div className="modal-header">
                        <div>
                            <h2>Log New Inward</h2>
                            <p>Record incoming correspondence details below.</p>
                        </div>
                        <button className="close-btn" type="button" onClick={() => navigate('/admin')}>
                            <X size={20} />
                        </button>
                    </div>

                    {/* Form */}
                    <form className="entry-form animate-stagger-2" onSubmit={handleSubmit}>
                        <div className="form-row">
                            <div className="form-group">
                                <label>FROM WHOM *</label>
                                <input type="text" name="particularsFromWhom" value={formData.particularsFromWhom} onChange={handleChange} required placeholder="Name or organization" />
                            </div>
                            <div className="form-group">
                                <label>SUBJECT LINE *</label>
                                <input type="text" name="subject" value={formData.subject} onChange={handleChange} required placeholder="Brief description of contents" />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>DATE & TIME RECEIVED *</label>
                                <div className="input-with-icon">
                                    <input type="datetime-local" name="signReceiptDateTime" value={formData.signReceiptDateTime} onChange={handleChange} required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label>MEANS *</label>
                                <select className="team-select" name="means" value={formData.means} onChange={handleChange} required>
                                    <option value="">Select...</option>
                                    <option value="Post">Post</option>
                                    <option value="Email">Email</option>
                                    <option value="Hand Delivery">Hand Delivery</option>
                                    <option value="Courier">Courier</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>ASSIGN TEAM *</label>
                                <select className="team-select" name="assignedTeam" value={formData.assignedTeam} onChange={handleChange} required>
                                    <option value="">Select a team...</option>
                                    <option value="UG">UG Team</option>
                                    <option value="PG/PRO">PG/PRO Team</option>
                                    <option value="PhD">PhD Team</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>TEAM LEADER EMAIL *</label>
                                <input type="email" name="assignedToEmail" value={formData.assignedToEmail} onChange={handleChange} required placeholder="Auto-filled based on team" />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>DUE DATE</label>
                                <input type="date" name="dueDate" value={formData.dueDate} onChange={handleChange} />
                            </div>
                            <div className="form-group">
                                <label>ASSIGNMENT INSTRUCTIONS</label>
                                <input type="text" name="assignmentInstructions" value={formData.assignmentInstructions} onChange={handleChange} placeholder="Special instructions for the team..." />
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="modal-actions" style={{ marginTop: '2rem' }}>
                            <button
                                type="button"
                                className="btn-link"
                                onClick={() => navigate('/admin')}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button type="submit" className="btn-primary action-btn" disabled={isSubmitting}>
                                {isSubmitting ? 'LOGGING...' : 'LOG & ASSIGN'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default AdminEntry;
