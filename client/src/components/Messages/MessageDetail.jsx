import { useEffect } from 'react';
import { Reply, Mail, ExternalLink, MessageSquare } from 'lucide-react';
import { messagesAPI } from '../../services/api';

function MessageDetail({ conversation, userEmail, onReply, onMessagesUpdate }) {
    // Format time ago
    const timeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
        return date.toLocaleDateString() + ' at ' + date.toLocaleTimeString();
    };

    // Get sender type for styling
    const getSenderType = (message) => {
        if (message.fromEmail === userEmail) return 'from-me';
        if (message.fromEmail.includes('admin')) return 'from-admin';
        return 'from-team';
    };

    // Get sender display name
    const getSenderName = (message) => {
        if (message.fromEmail === userEmail) return 'You';
        if (message.fromEmail.includes('admin')) return 'Admin';
        if (message.fromEmail.includes('sathyajain9')) return 'UG Team';
        if (message.fromEmail.includes('saisathyajain')) return 'PG/PRO Team';
        if (message.fromEmail.includes('results')) return 'PhD Team';
        return message.fromEmail.split('@')[0];
    };

    // Mark messages as read when viewing
    useEffect(() => {
        if (!conversation) return;

        const markAsRead = async () => {
            const unreadMessages = conversation.messages.filter(msg =>
                msg.isRead === 0 && msg.toEmail === userEmail
            );

            for (const msg of unreadMessages) {
                try {
                    await messagesAPI.markAsRead(msg.id);
                } catch (error) {
                    console.error('Error marking message as read:', error);
                }
            }

            if (unreadMessages.length > 0) {
                // Refresh messages to update unread counts
                onMessagesUpdate(true);
            }
        };

        markAsRead();
    }, [conversation?.subject]); // Only run when conversation changes

    // Handle reply
    const handleReply = () => {
        if (!conversation) return;

        const lastMessage = conversation.lastMessage;
        onReply({
            toEmail: lastMessage.fromEmail === userEmail ? lastMessage.toEmail : lastMessage.fromEmail,
            subject: lastMessage.subject.startsWith('Re:')
                ? lastMessage.subject
                : `Re: ${lastMessage.subject}`,
            relatedType: lastMessage.relatedType,
            relatedId: lastMessage.relatedId
        });
    };

    if (!conversation) {
        return (
            <div className="message-detail empty">
                <div className="empty-state">
                    <MessageSquare size={64} />
                    <h3>No conversation selected</h3>
                    <p>Select a conversation from the list to view messages</p>
                </div>
            </div>
        );
    }

    return (
        <div className="message-detail">
            {/* Thread Header */}
            <div className="thread-header">
                <div className="thread-subject">
                    <Mail size={20} />
                    <h3>{conversation.subject}</h3>
                </div>
                {conversation.lastMessage.relatedType && (
                    <span className="badge badge-linked">
                        <ExternalLink size={12} />
                        Linked to {conversation.lastMessage.relatedType}
                    </span>
                )}
            </div>

            {/* Messages Thread */}
            <div className="thread-messages">
                {conversation.messages
                    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
                    .map((message) => (
                        <div
                            key={message.id}
                            className={`message-bubble ${getSenderType(message)}`}
                        >
                            <div className="message-header">
                                <span className="message-sender">
                                    {getSenderName(message)}
                                </span>
                                <span className="message-time">
                                    {timeAgo(message.createdAt)}
                                </span>
                            </div>
                            <div className="message-body">
                                {message.body || 'No message content'}
                            </div>
                            {message.isRead === 0 && message.toEmail === userEmail && (
                                <div className="message-unread-indicator">
                                    <span className="badge badge-unread">New</span>
                                </div>
                            )}
                        </div>
                    ))}
            </div>

            {/* Reply Button */}
            <div className="thread-actions">
                <button className="btn btn-primary" onClick={handleReply}>
                    <Reply size={18} />
                    Reply
                </button>
            </div>
        </div>
    );
}

export default MessageDetail;
