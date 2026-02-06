import { useState, useEffect } from 'react';
import { RefreshCw, Plus, Loader2 } from 'lucide-react';
import { messagesAPI } from '../../services/api';
import MessagesList from './MessagesList';
import MessageDetail from './MessageDetail';
import MessageCompose from './MessageCompose';
import ContextPanel from './ContextPanel';
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

    // Get user email from localStorage
    useEffect(() => {
        const adminUser = localStorage.getItem('adminUser');
        if (adminUser) {
            try {
                const user = JSON.parse(adminUser);
                setUserEmail(user.email);
            } catch (e) {
                console.error('Error parsing admin user:', e);
            }
        }
    }, []);

    // Group messages by subject (conversation threading)
    const groupMessagesBySubject = (msgs) => {
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
        if (!userEmail) return;

        try {
            if (showRefreshIndicator) setRefreshing(true);
            else setLoading(true);

            const res = await messagesAPI.getAll(userEmail);
            if (res.data.success) {
                setMessages(res.data.messages);
            }
        } catch (error) {
            console.error('Error loading messages:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Auto-refresh every 30 seconds
    useEffect(() => {
        loadMessages();
        const interval = setInterval(() => loadMessages(true), 30000);
        return () => clearInterval(interval);
    }, [userEmail]);

    // Group into conversations when messages update
    useEffect(() => {
        const grouped = groupMessagesBySubject(messages);
        setConversations(grouped);
    }, [messages]);

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
            if (!subjectMatch && !senderMatch) return false;
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

    return (
        <div className="messages-page animate-fade">
            {/* Header */}
            <div className="messages-header">
                <h2 className="page-title">Messages</h2>
                <div className="messages-actions">
                    <button
                        className="btn btn-icon-only"
                        onClick={handleRefresh}
                        disabled={refreshing}
                        title="Refresh messages"
                    >
                        <RefreshCw size={18} className={refreshing ? 'spin' : ''} />
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => handleCompose()}
                    >
                        <Plus size={18} /> Compose
                    </button>
                </div>
            </div>

            {/* Main Content */}
            {loading ? (
                <div className="loading-state">
                    <Loader2 size={40} className="spin" />
                    <p>Loading messages...</p>
                </div>
            ) : (
                <div className="messages-container">
                    {/* Conversations List */}
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
                    />

                    {/* Message Detail */}
                    <MessageDetail
                        conversation={selectedConversation}
                        userEmail={userEmail}
                        onReply={handleCompose}
                        onMessagesUpdate={loadMessages}
                    />

                    {/* Context Panel */}
                    <ContextPanel
                        relatedType={selectedConversation?.lastMessage?.relatedType}
                        relatedId={selectedConversation?.lastMessage?.relatedId}
                    />
                </div>
            )}

            {/* Compose Modal */}
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
        </div>
    );
}

export default Messages;
