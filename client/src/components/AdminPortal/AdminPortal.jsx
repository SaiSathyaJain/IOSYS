import { useState, useEffect } from 'react';
import { inwardAPI, outwardAPI } from '../../services/api';
import { Inbox, XCircle, Plus, ClipboardList, Check, X, Edit, FileText, Download, TrendingUp, Search } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import AiChat from '../AiAssistant/AiChat';
import './AdminPortal.css';

function AdminPortal() {
    const [entries, setEntries] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [createdEntry, setCreatedEntry] = useState(null);
    const [editingEntry, setEditingEntry] = useState(null);

    // Inward Form State
    const [formData, setFormData] = useState({
        means: '',
        particularsFromWhom: '',
        subject: '',
        signReceiptDateTime: '',
        fileReference: '',
        assignedTeam: '',
        assignedToEmail: '',
        assignmentInstructions: '',
        dueDate: ''
    });

    // Report State
    const [activeTab, setActiveTab] = useState('inward');
    const [reportDateRange, setReportDateRange] = useState({ startDate: '', endDate: '' });
    const [reportData, setReportData] = useState([]);
    const [reportLoading, setReportLoading] = useState(false);
    const [totalExpenditure, setTotalExpenditure] = useState(0);

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
        setSubmitting(true);
        try {
            const response = await inwardAPI.create(formData);
            setCreatedEntry(response.data);
            setShowSuccessModal(true);
            setShowForm(false);
            setFormData({
                means: '', particularsFromWhom: '', subject: '',
                signReceiptDateTime: '', fileReference: '',
                assignedTeam: '', assignedToEmail: '',
                assignmentInstructions: '', dueDate: ''
            });
            loadEntries();
        } catch (error) {
            const errorMessage = error.response?.data?.message || error.message;
            alert('❌ Error creating entry: ' + errorMessage);
            console.error('Create entry error details:', error);
        } finally {
            setSubmitting(false);
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

    const handleEdit = (entry) => {
        // Populate form with entry data
        setFormData({
            means: entry.means || '',
            particularsFromWhom: entry.particularsFromWhom || '',
            subject: entry.subject || '',
            signReceiptDateTime: entry.signReceiptDateTime || '',
            fileReference: entry.fileReference || '',
            assignedTeam: entry.assignedTeam || '',
            assignedToEmail: entry.assignedToEmail || '',
            assignmentInstructions: entry.assignmentInstructions || '',
            dueDate: entry.dueDate || ''
        });
        setEditingEntry(entry);
        setShowForm(true);
        // Scroll to top to show form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // Report Functions
    const handleReportDateChange = (e) => {
        setReportDateRange({ ...reportDateRange, [e.target.name]: e.target.value });
    };

    const generateReport = async () => {
        setReportLoading(true);
        try {
            const res = await outwardAPI.getAll(reportDateRange);
            const data = res.data.entries;
            setReportData(data);

            // Calculate Total
            const total = data.reduce((sum, item) => sum + (Number(item.postalTariff) || 0), 0);
            setTotalExpenditure(total);
        } catch (error) {
            console.error('Error generating report:', error);
            alert('Failed to generate report');
        } finally {
            setReportLoading(false);
        }
    };

    const formatDate = (dateString, includeTime = false) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (includeTime) {
            return date.toLocaleString();
        }
        return date.toLocaleDateString();
    };

    const exportPDF = () => {
        const doc = new jsPDF();

        // Title
        doc.setFontSize(18);
        doc.text('Outward Expenditure Report', 14, 20);

        doc.setFontSize(10);
        doc.text(`Period: ${reportDateRange.startDate || 'All'} to ${reportDateRange.endDate || 'Present'}`, 14, 28);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 34);

        // Table
        const tableColumn = [
            "S.No.", "Ack Rec", "Cross No.", "Date",
            "File Ref", "Address", "Particular",
            "Due Date", "Receipt No.", "Postal Amt"
        ];

        const tableRows = reportData.map((item, index) => [
            index + 1,
            formatDate(item.signReceiptDateTime, true),
            item.inward?.inwardNo || '-',
            formatDate(item.signReceiptDateTime),
            item.fileReference || '-',
            item.toWhom || '-',
            item.subject || '-',
            formatDate(item.dueDate),
            item.outwardNo || '-',
            item.postalTariff || '0'
        ]);

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 40,
            styles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 10 }, // S.No
                9: { cellWidth: 15, halign: 'right' } // Amount
            }
        });

        // Total
        const finalY = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text(`Total Expenditure: ${totalExpenditure.toFixed(2)}`, 14, finalY);

        doc.save('outward_expenditure_report.pdf');
    };

    const exportExcel = () => {
        // Map data to requested columns
        const excelData = reportData.map((item, index) => ({
            'S.No.': index + 1,
            'Ack Rec': formatDate(item.signReceiptDateTime, true),
            'Cross No.': item.inward?.inwardNo || '-',
            'Date': formatDate(item.signReceiptDateTime),
            'File Reference': item.fileReference || '-',
            'Address': item.toWhom || '-',
            'Particular': item.subject || '-',
            'Due Date': formatDate(item.dueDate),
            'Receipt No.': item.outwardNo || '-',
            'Postal Amount': Number(item.postalTariff) || 0
        }));

        // Add Total Row
        excelData.push({
            'S.No.': '', 'Ack Rec': '', 'Cross No.': '', 'Date': '',
            'File Reference': '', 'Address': '', 'Particular': '',
            'Due Date': '', 'Receipt No.': 'TOTAL',
            'Postal Amount': totalExpenditure
        });

        const ws = XLSX.utils.json_to_sheet(excelData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Expenditure Report");
        XLSX.writeFile(wb, "outward_expenditure_report.xlsx");
    };

    return (
        <>
            <div className="admin-portal animate-fade">
                <div className="page-header">
                    <h2 className="page-title"><Inbox className="icon-svg" /> Admin Portal</h2>
                </div>

                {/* Stats Overview */}
                <div className="stats-grid animate-fade" style={{ marginBottom: '2rem' }}>
                    <div className="stat-card">
                        <div className="stat-value">{entries.length}</div>
                        <div className="stat-label">Total Inward Entries</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ backgroundImage: 'linear-gradient(135deg, #f59e0b, #fbbf24)' }}>
                            {entries.filter(e => e.assignmentStatus === 'Pending' || e.assignmentStatus === 'Unassigned').length}
                        </div>
                        <div className="stat-label">Pending / Unassigned</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value" style={{ backgroundImage: 'linear-gradient(135deg, #10b981, #34d399)' }}>
                            {entries.filter(e => e.assignmentStatus === 'Completed').length}
                        </div>
                        <div className="stat-label">Completed</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="admin-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'inward' ? 'active' : ''}`}
                        onClick={() => setActiveTab('inward')}
                    >
                        <Inbox size={18} style={{ marginRight: '8px' }} /> Inward Entries
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'reports' ? 'active' : ''}`}
                        onClick={() => setActiveTab('reports')}
                    >
                        <FileText size={18} style={{ marginRight: '8px' }} /> Outward Expenditure Report
                    </button>
                </div>

                {activeTab === 'inward' ? (
                    /* INWARD ENTRIES TAB */
                    <>
                        <div className="tab-actions" style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button className="btn btn-primary" onClick={() => {
                                setShowForm(!showForm);
                                if (showForm) {
                                    setEditingEntry(null);
                                }
                            }}>
                                {showForm ? <><X size={18} /> Cancel</> : <><Plus size={18} /> New Inward Entry</>}
                            </button>
                        </div>

                        {showForm && (
                            <div className="card form-card">
                                <h3 className="card-title">{editingEntry ? 'Edit Inward Entry' : 'Create New Inward Entry'}</h3>
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
                                            <label className="form-label">File Reference</label>
                                            <input type="text" name="fileReference" className="form-input"
                                                value={formData.fileReference} onChange={handleChange} />
                                        </div>
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

                                    <button type="submit" className="btn btn-primary btn-submit" disabled={submitting}>
                                        {submitting ? (
                                            <>
                                                <div className="btn-spinner"></div>
                                                Creating Entry...
                                            </>
                                        ) : (
                                            <>
                                                <Check size={18} /> Create Entry & Notify Team
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Success Modal Logic (Same as before) */}
                        {showSuccessModal && (
                            <div className="modal-overlay" onClick={() => setShowSuccessModal(false)}>
                                <div className="modal-content success-modal" onClick={(e) => e.stopPropagation()}>
                                    <div className="success-icon-wrapper">
                                        <div className="success-icon-circle">
                                            <Check size={48} strokeWidth={3} />
                                        </div>
                                        <div className="success-checkmark">
                                            <svg className="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                                                <circle className="checkmark-circle" cx="26" cy="26" r="25" fill="none" />
                                                <path className="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8" />
                                            </svg>
                                        </div>
                                    </div>
                                    <h2 className="modal-title">Entry Created Successfully!</h2>
                                    <p className="modal-subtitle">
                                        {createdEntry?.assignedTeam
                                            ? `Notification sent to ${createdEntry.assignedTeam} team leader`
                                            : 'Inward entry has been recorded'}
                                    </p>
                                    {/* Modal Actions */}
                                    <div className="modal-actions">
                                        <button className="btn btn-primary" onClick={() => { setShowSuccessModal(false); setShowForm(true); }}>
                                            <Plus size={18} /> Create Another Entry
                                        </button>
                                        <button className="btn btn-secondary" onClick={() => setShowSuccessModal(false)}>Close</button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Entries Table */}
                        <div className="card">
                            <div className="card-header">
                                <h3 className="card-title"><ClipboardList size={20} /> Recent Inward Entries</h3>
                                {/* Can add Refresh button here */}
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
                                                <th>Actions</th>
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
                                                    <td>
                                                        {(!entry.assignedTeam || entry.assignmentStatus === 'Unassigned') && (
                                                            <button
                                                                className="btn-icon btn-edit"
                                                                onClick={() => handleEdit(entry)}
                                                                title="Edit entry"
                                                            >
                                                                <Edit size={16} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* REPORTS TAB */
                    <div className="report-section animate-fade">
                        <div className="report-filters">
                            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                <label className="form-label">From Date</label>
                                <input
                                    type="date"
                                    name="startDate"
                                    className="form-input"
                                    value={reportDateRange.startDate}
                                    onChange={handleReportDateChange}
                                />
                            </div>
                            <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                                <label className="form-label">To Date</label>
                                <input
                                    type="date"
                                    name="endDate"
                                    className="form-input"
                                    value={reportDateRange.endDate}
                                    onChange={handleReportDateChange}
                                />
                            </div>
                            <button className="btn btn-primary" onClick={generateReport} disabled={reportLoading}>
                                {reportLoading ? <div className="btn-spinner"></div> : <><Search size={18} /> Generate Report</>}
                            </button>
                        </div>

                        {reportData.length > 0 && (
                            <>
                                <div className="total-card">
                                    <div className="total-label">Total Expenditure</div>
                                    <div className="total-amount">₹ {totalExpenditure.toFixed(2)}</div>
                                </div>

                                <div className="card">
                                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 className="card-title"><TrendingUp size={20} /> Expenditure Details</h3>
                                        <div className="report-actions">
                                            <button className="btn btn-secondary btn-sm" onClick={exportPDF}>
                                                <FileText size={16} /> PDF
                                            </button>
                                            <button className="btn btn-secondary btn-sm" onClick={exportExcel}>
                                                <Download size={16} /> Excel
                                            </button>
                                        </div>
                                    </div>
                                    <div className="table-container">
                                        <table className="table">
                                            <thead>
                                                <tr>
                                                    <th>S.No.</th>
                                                    <th>Ack Rec</th>
                                                    <th>Cross No.</th>
                                                    <th>Date</th>
                                                    <th>File Reference</th>
                                                    <th>Address</th>
                                                    <th>Particular</th>
                                                    <th>Due Date</th>
                                                    <th>Receipt No.</th>
                                                    <th style={{ textAlign: 'right' }}>Postal Amount</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {reportData.map((item, index) => (
                                                    <tr key={item.id}>
                                                        <td>{index + 1}</td>
                                                        <td>{formatDate(item.signReceiptDateTime, true)}</td>
                                                        <td>{item.inward?.inwardNo || '-'}</td>
                                                        <td>{formatDate(item.signReceiptDateTime)}</td>
                                                        <td>{item.fileReference || '-'}</td>
                                                        <td>{item.toWhom}</td>
                                                        <td>{item.subject}</td>
                                                        <td>{formatDate(item.dueDate)}</td>
                                                        <td>{item.outwardNo}</td>
                                                        <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                            {item.postalTariff || 0}
                                                        </td>
                                                    </tr>
                                                ))}
                                                <tr style={{ background: 'var(--bg-page)', fontWeight: 'bold' }}>
                                                    <td colSpan="9" style={{ textAlign: 'right' }}>Total Expenditure:</td>
                                                    <td style={{ textAlign: 'right' }}>{totalExpenditure.toFixed(2)}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </>
                        )}

                        {reportData.length === 0 && !reportLoading && (
                            <div className="empty-state" style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                                <FileText size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                                <p>Select a date range and click "Generate Report" to view expenditure details.</p>
                            </div>
                        )}
                    </div>
                )}

            </div>
            <AiChat />
        </>
    );
}

export default AdminPortal;
