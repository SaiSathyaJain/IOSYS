import { useState, useEffect } from 'react';
import { ExternalLink, FileText, Calendar, Clock, Loader2 } from 'lucide-react';
import { inwardAPI, outwardAPI } from '../../services/api';
import { Link } from 'react-router-dom';

function ContextPanel({ relatedType, relatedId }) {
    const [entry, setEntry] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!relatedType || !relatedId) {
            setEntry(null);
            return;
        }

        const loadEntry = async () => {
            try {
                setLoading(true);
                let res;
                if (relatedType === 'inward') {
                    // Get single inward entry
                    res = await inwardAPI.getAll();
                    if (res.data.success) {
                        const found = res.data.entries.find(e => e.id === relatedId);
                        setEntry(found || null);
                    }
                } else if (relatedType === 'outward') {
                    // Get single outward entry
                    res = await outwardAPI.getAll();
                    if (res.data.success) {
                        const found = res.data.entries.find(e => e.id === relatedId);
                        setEntry(found || null);
                    }
                }
            } catch (error) {
                console.error('Error loading entry:', error);
                setEntry(null);
            } finally {
                setLoading(false);
            }
        };

        loadEntry();
    }, [relatedType, relatedId]);

    if (!relatedType || !relatedId) {
        return (
            <div className="context-panel empty">
                <div className="context-empty">
                    <FileText size={40} style={{ opacity: 0.3 }} />
                    <p>No linked entry</p>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="context-panel">
                <div className="context-loading">
                    <Loader2 size={32} className="spin" />
                    <p>Loading entry...</p>
                </div>
            </div>
        );
    }

    if (!entry) {
        return (
            <div className="context-panel">
                <div className="context-empty">
                    <FileText size={40} style={{ opacity: 0.3 }} />
                    <p>Entry not found</p>
                </div>
            </div>
        );
    }

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'Not set';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    return (
        <div className="context-panel">
            <div className="context-header">
                <h4>Linked Entry</h4>
                <span className="badge badge-linked">
                    <ExternalLink size={12} />
                    {relatedType}
                </span>
            </div>

            <div className="context-body">
                {relatedType === 'inward' ? (
                    <>
                        <div className="context-field">
                            <label>Entry Number</label>
                            <span className="context-value">{entry.inwardNo}</span>
                        </div>

                        <div className="context-field">
                            <label>Subject</label>
                            <span className="context-value">{entry.subject}</span>
                        </div>

                        <div className="context-field">
                            <label>From</label>
                            <span className="context-value">{entry.particularsFromWhom}</span>
                        </div>

                        {entry.assignedTeam && (
                            <div className="context-field">
                                <label>Assigned To</label>
                                <span className="badge badge-team">{entry.assignedTeam}</span>
                            </div>
                        )}

                        {entry.assignmentStatus && (
                            <div className="context-field">
                                <label>Status</label>
                                <span className={`badge badge-${entry.assignmentStatus.toLowerCase()}`}>
                                    {entry.assignmentStatus}
                                </span>
                            </div>
                        )}

                        {entry.dueDate && (
                            <div className="context-field">
                                <label><Calendar size={14} /> Due Date</label>
                                <span className="context-value">{formatDate(entry.dueDate)}</span>
                            </div>
                        )}
                    </>
                ) : (
                    <>
                        <div className="context-field">
                            <label>Entry Number</label>
                            <span className="context-value">{entry.outwardNo}</span>
                        </div>

                        <div className="context-field">
                            <label>Subject</label>
                            <span className="context-value">{entry.subject}</span>
                        </div>

                        <div className="context-field">
                            <label>To</label>
                            <span className="context-value">{entry.toWhom}</span>
                        </div>

                        {entry.createdByTeam && (
                            <div className="context-field">
                                <label>Created By</label>
                                <span className="badge badge-team">{entry.createdByTeam}</span>
                            </div>
                        )}

                        {entry.caseClosed !== undefined && (
                            <div className="context-field">
                                <label>Status</label>
                                <span className={`badge ${entry.caseClosed ? 'badge-success' : 'badge-pending'}`}>
                                    {entry.caseClosed ? 'Closed' : 'Open'}
                                </span>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="context-footer">
                <Link
                    to={relatedType === 'inward' ? '/admin/entries' : '/team'}
                    className="btn btn-secondary btn-sm"
                >
                    <ExternalLink size={14} />
                    View Full Entry
                </Link>
            </div>
        </div>
    );
}

export default ContextPanel;
