import { useState, useEffect } from 'react';
import { Loader2, User } from 'lucide-react';
import { messagesAPI } from '../../services/api';
import MessagesList from './MessagesList';
import MessageDetail from './MessageDetail';
import MessageCompose from './MessageCompose';
import './Messages.css';

function Messages({ userType }) {
    const [messages, setMessages] = useState([]);
    const [conversations, setConversations] = useState([]);
    const [selectedConversation, setSelectedConversation] = useState(null);
    const [showCompose, setShowCompose] = useState(false);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterUnread, setFilterUnread] = useState(false);
    const [filterTeam, setFilterTeam] = useState('');
    const [userEmail, setUserEmail] = useState('');
    const [composeData, setComposeData] = useState(null);

    // Identity state for team users
    const [showIdentityModal, setShowIdentityModal] = useState(false);
    const [identityEmail, setIdentityEmail] = useState('');

    // Get user email from localStorage
    useEffect(() => {
        const checkAuth = () => {
            // Check for admin user
            const adminUser = localStorage.getItem('adminUser');
            if (adminUser) {
                try {
                    const user = JSON.parse(adminUser);
                    setUserEmail(user.email);
                    return;
                } catch (e) {
                    console.error('Error parsing admin user:', e);
                }
            }

            // Check for team user
            const teamUser = localStorage.getItem('teamUser');
            if (teamUser) {
                try {
                    const user = JSON.parse(teamUser);
                    setUserEmail(user.email.trim());
                    return;
                } catch (e) {
                    console.error('Error parsing team user:', e);
                }
            }

            // If no user found and not admin portal, show identity modal
            if (userType === 'team') {
                setShowIdentityModal(true);
                setLoading(false);
            } else {
                setLoading(false); // Stop loading if admin but not logged in (should be handled by layout/router)
            }
        };

        checkAuth();
    }, [userType]);

    // Group messages by subject (conversation threading)
    const groupMessagesBySubject = (msgs) => {
        if (!Array.isArray(msgs)) return [];
        const threads = {};
        msgs.forEach(msg => {
            // Normalize subject (remove "Re: " prefix)
            const baseSubject = msg.subject.replace(/^Re:\s*/i, '');
            if (!threads[baseSubject]) {
                threads[baseSubject] = {
                    subject: baseSubject,
                    messages: [],
                    lastMessage: null,
                    unreadCount: 0
                };
            }
            threads[baseSubject].messages.push(msg);
            if (msg.isRead === 0) threads[baseSubject].unreadCount++;
            // Track latest message for preview
            if (!threads[baseSubject].lastMessage ||
                new Date(msg.createdAt) > new Date(threads[baseSubject].lastMessage.createdAt)) {
                threads[baseSubject].lastMessage = msg;
            }
        });

        // Sort threads by latest message
        return Object.values(threads).sort((a, b) =>
            new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt)
        );
    };

    // Load messages
    const loadMessages = async (showRefreshIndicator = false) => {
        if (!userEmail) {
            if (!showIdentityModal) setLoading(false);
            return;
        }

        try {
            if (showRefreshIndicator) setRefreshing(true);
            else setLoading(true);

            const res = await messagesAPI.getAll(userEmail);
            if (res.data.success) {
                setMessages(res.data.messages || []);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Auto-refresh every 5 seconds (faster for testing)
    useEffect(() => {
        if (userEmail) {
            loadMessages();
            const interval = setInterval(() => loadMessages(true), 5000);
            return () => clearInterval(interval);
        }
    }, [userEmail]);

    // Group into conversations when messages update
    useEffect(() => {
        const grouped = groupMessagesBySubject(messages);
        setConversations(grouped);

        // Update selected conversation if it exists
        if (selectedConversation) {
            const updated = grouped.find(c => c.subject === selectedConversation.subject);
            if (updated) {
                setSelectedConversation(updated);
            }
        }
    }, [messages]);

    // Handle identity submit
    const handleIdentitySubmit = (e) => {
        e.preventDefault();
        const email = identityEmail.trim();
        if (email && email.includes('@')) {
            const user = { email: email, type: 'team' };
            localStorage.setItem('teamUser', JSON.stringify(user));
            setUserEmail(email);
            setShowIdentityModal(false);
        }
    };

    // Handle compose with optional pre-filled data
    const handleCompose = (data = null) => {
        setComposeData(data);
        setShowCompose(true);
    };

    // Handle message sent
    const handleMessageSent = () => {
        setShowCompose(false);
        setComposeData(null);
        loadMessages(true);
    };

    // Handle refresh
    const handleRefresh = () => {
        loadMessages(true);
    };

    // Filter conversations based on search and filters
    const filteredConversations = conversations.filter(conv => {
        // Search filter
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            const subjectMatch = conv.subject.toLowerCase().includes(search);
            const senderMatch = conv.lastMessage.fromEmail.toLowerCase().includes(search);
            const bodyMatch = conv.lastMessage.body?.toLowerCase().includes(search);
            if (!subjectMatch && !senderMatch && !bodyMatch) return false;
        }

        // Unread filter
        if (filterUnread && conv.unreadCount === 0) return false;

        // Team filter (for admin view)
        if (filterTeam) {
            const hasTeamMessage = conv.messages.some(
                msg => msg.fromEmail.includes(filterTeam) || msg.toEmail.includes(filterTeam)
            );
            if (!hasTeamMessage) return false;
        }

        return true;
    });

    if (loading) {
        return (
            <div className="messages-page">
                <div className="loading-state">
                    <Loader2 size={48} className="spin" />
                    <p>Loading messages...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="messages-page">
            {/* Main Content - Two Panel Layout */}
            <div className="messages-container">
                {/* Left Panel - Conversations List */}
                <MessagesList
                    conversations={filteredConversations}
                    selectedConversation={selectedConversation}
                    onSelectConversation={setSelectedConversation}
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    filterUnread={filterUnread}
                    onFilterUnreadChange={setFilterUnread}
                    filterTeam={filterTeam}
                    onFilterTeamChange={setFilterTeam}
                    userType={userType}
                    userEmail={userEmail}
                    onCompose={() => handleCompose()}
                    onRefresh={handleRefresh}
                    refreshing={refreshing}
                />

                {/* Right Panel - Message Detail */}
                <MessageDetail
                    conversation={selectedConversation}
                    userEmail={userEmail}
                    onReply={handleCompose}
                    onMessagesUpdate={loadMessages}
                />
            </div>

            {/* Compose Modal - For new conversations only */}
            {showCompose && (
                <MessageCompose
                    userType={userType}
                    userEmail={userEmail}
                    initialData={composeData}
                    onClose={() => {
                        setShowCompose(false);
                        setComposeData(null);
                    }}
                    onSent={handleMessageSent}
                />
            )}

            {/* Identity Modal for Team Users */}
            {showIdentityModal && (
                <div className="modal-overlay">
                    <div className="modal" style={{ maxWidth: '400px' }}>
                        <div className="modal-header">
                            <h3><User size={20} style={{ marginRight: '8px' }} /> Identify Yourself</h3>
                        </div>
                        <form onSubmit={handleIdentitySubmit}>
                            <div className="modal-body">
                                <p style={{ marginBottom: '16px', color: 'var(--wa-text-secondary)' }}>
                                    Please enter your email address to view your team's messages.
                                </p>
                                <div className="form-group">
                                    <label className="form-label">Email Address</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        value={identityEmail}
                                        onChange={(e) => setIdentityEmail(e.target.value)}
                                        placeholder="your.email@example.com"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="submit" className="btn btn-primary">
                                    Continue to Messages
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default Messages;
