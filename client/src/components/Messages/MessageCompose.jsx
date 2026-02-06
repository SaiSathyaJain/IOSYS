import { useState, useEffect } from 'react';
import { X, Send, Loader2, AlertCircle } from 'lucide-react';
import { messagesAPI, inwardAPI, outwardAPI } from '../../services/api';

function MessageCompose({ userType, userEmail, initialData, onClose, onSent }) {
    const TEAM_EMAILS = {
        'UG': 'sathyajain9@gmail.com',
        'PG/PRO': 'saisathyajain@sssihl.edu.in',
        'PhD': 'results@sssihl.edu.in'
    };

    const [formData, setFormData] = useState({
        toEmail: '',
        subject: '',
        body: '',
        relatedType: null,
        relatedId: null
    });
    const [sending, setSending] = useState(false);
    const [error, setError] = useState('');
    const [entries, setEntries] = useState([]);

    // Initialize form with initial data if provided
    useEffect(() => {
        if (initialData) {
            setFormData({
                toEmail: initialData.toEmail || '',
                subject: initialData.subject || '',
                body: initialData.body || '',
                relatedType: initialData.relatedType || null,
                relatedId: initialData.relatedId || null
            });
        }
    }, [initialData]);

    // Load entries for linking
    useEffect(() => {
        const loadEntries = async () => {
            try {
                const res = await inwardAPI.getAll();
                if (res.data.success) {
                    setEntries((res.data.entries || []).slice(0, 20)); // Limit to recent 20
                }
            } catch (err) {
                console.error('Error loading entries:', err);
            }
        };
        loadEntries();
    }, []);

    // Handle form change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError('');
    };

    // Handle team selection (for admin)
    const handleTeamSelect = (e) => {
        const team = e.target.value;
        if (team && TEAM_EMAILS[team]) {
            setFormData(prev => ({ ...prev, toEmail: TEAM_EMAILS[team] }));
        }
        setError('');
    };

    // Handle entry link
    const handleEntryLink = (e) => {
        const value = e.target.value;
        if (value) {
            const [type, id] = value.split('-');
            setFormData(prev => ({
                ...prev,
                relatedType: type,
                relatedId: parseInt(id)
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                relatedType: null,
                relatedId: null
            }));
        }
    };

    // Validate form
    const validateForm = () => {
        if (!formData.toEmail) {
            setError('Please select a recipient');
            return false;
        }
        if (!formData.subject.trim()) {
            setError('Please enter a subject');
            return false;
        }
        if (!formData.body.trim()) {
            setError('Please enter a message');
            return false;
        }
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.toEmail)) {
            setError('Please enter a valid email address');
            return false;
        }
        return true;
    };

    // Handle send
    const handleSend = async (e) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) return;

        try {
            setSending(true);
            await messagesAPI.send({
                fromEmail: userEmail,
                toEmail: formData.toEmail,
                subject: formData.subject.trim(),
                body: formData.body.trim(),
                relatedType: formData.relatedType,
                relatedId: formData.relatedId
            });

            // Success
            onSent();
        } catch (err) {
            console.error('Error sending message:', err);
            setError('Failed to send message. Please try again.');
            setSending(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal compose-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Compose Message</h3>
                    <button className="btn-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <form onSubmit={handleSend}>
                    <div className="modal-body">
                        {error && (
                            <div className="error-message">
                                <AlertCircle size={16} />
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">To: *</label>
                            {userType === 'admin' ? (
                                <div className="grid-2">
                                    <select
                                        className="form-select"
                                        onChange={handleTeamSelect}
                                        defaultValue=""
                                    >
                                        <option value="">Select Team...</option>
                                        <option value="UG">UG Team</option>
                                        <option value="PG/PRO">PG/PRO Team</option>
                                        <option value="PhD">PhD Team</option>
                                    </select>
                                    <input
                                        type="email"
                                        name="toEmail"
                                        className="form-input"
                                        placeholder="or enter email directly"
                                        value={formData.toEmail}
                                        onChange={handleChange}
                                        required
                                    />
                                </div>
                            ) : (
                                <input
                                    type="email"
                                    name="toEmail"
                                    className="form-input"
                                    value={formData.toEmail}
                                    onChange={handleChange}
                                    placeholder="Admin email"
                                    required
                                    readOnly={!!initialData?.toEmail}
                                />
                            )}
                        </div>

                        <div className="form-group">
                            <label className="form-label">Subject: *</label>
                            <input
                                type="text"
                                name="subject"
                                className="form-input"
                                placeholder="Enter subject"
                                value={formData.subject}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Link to Entry (Optional):</label>
                            <select
                                className="form-select"
                                onChange={handleEntryLink}
                                value={
                                    formData.relatedType && formData.relatedId
                                        ? `${formData.relatedType}-${formData.relatedId}`
                                        : ''
                                }
                            >
                                <option value="">No linked entry</option>
                                {entries.map((entry) => (
                                    <option key={entry.id} value={`inward-${entry.id}`}>
                                        {entry.inwardNo} - {entry.subject}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Message: *</label>
                            <textarea
                                name="body"
                                className="form-textarea"
                                placeholder="Type your message here..."
                                value={formData.body}
                                onChange={handleChange}
                                rows="8"
                                required
                            />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={sending}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={sending}
                        >
                            {sending ? (
                                <>
                                    <Loader2 size={18} className="spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send size={18} />
                                    Send Message
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default MessageCompose;
