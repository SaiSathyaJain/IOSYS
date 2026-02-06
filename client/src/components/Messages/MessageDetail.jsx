import { useState, useEffect, useRef } from 'react';
import { Send, MessageSquare, Search, MoreVertical, Check, CheckCheck, Loader2 } from 'lucide-react';
import { messagesAPI } from '../../services/api';

function MessageDetail({ conversation, userEmail, onReply, onMessagesUpdate }) {
    const [replyText, setReplyText] = useState('');
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const textareaRef = useRef(null);

    // Scroll to bottom when conversation changes or new message
    useEffect(() => {
        scrollToBottom();
    }, [conversation?.messages?.length]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 100) + 'px';
        }
    }, [replyText]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // Format timestamp for messages
    const formatMessageTime = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    // Format date for separators
    const formatDateSeparator = (dateString) => {
        const date = new Date(dateString);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) {
            return 'Today';
        } else if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        } else {
            return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        }
    };

    // Check if we need a date separator
    const needsDateSeparator = (currentMsg, prevMsg) => {
        if (!prevMsg) return true;
        const currDate = new Date(currentMsg.createdAt).toDateString();
        const prevDate = new Date(prevMsg.createdAt).toDateString();
        return currDate !== prevDate;
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

    // Get chat partner info for header
    const getChatPartnerInfo = () => {
        if (!conversation) return { name: '', type: 'default', initials: '' };

        const lastMsg = conversation.lastMessage;
        const otherEmail = lastMsg.fromEmail === userEmail ? lastMsg.toEmail : lastMsg.fromEmail;

        if (otherEmail.includes('admin')) {
            return { name: 'Admin', type: 'admin', initials: 'A' };
        }
        if (otherEmail.includes('sathyajain9')) {
            return { name: 'UG Team', type: 'ug', initials: 'UG' };
        }
        if (otherEmail.includes('saisathyajain')) {
            return { name: 'PG/PRO Team', type: 'pg', initials: 'PG' };
        }
        if (otherEmail.includes('results')) {
            return { name: 'PhD Team', type: 'phd', initials: 'PhD' };
        }
        const name = otherEmail.split('@')[0];
        return { name: name, type: 'default', initials: name.charAt(0).toUpperCase() };
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
                onMessagesUpdate(true);
            }
        };

        markAsRead();
    }, [conversation?.subject]);

    // Handle send reply
    const handleSendReply = async () => {
        if (!replyText.trim() || !conversation) return;

        try {
            setSending(true);
            const lastMessage = conversation.lastMessage;
            const toEmail = lastMessage.fromEmail === userEmail ? lastMessage.toEmail : lastMessage.fromEmail;

            await messagesAPI.send({
                fromEmail: userEmail,
                toEmail: toEmail,
                subject: lastMessage.subject.startsWith('Re:')
                    ? lastMessage.subject
                    : `Re: ${lastMessage.subject}`,
                body: replyText.trim(),
                relatedType: lastMessage.relatedType,
                relatedId: lastMessage.relatedId
            });

            setReplyText('');
            onMessagesUpdate(true);
        } catch (error) {
            console.error('Error sending reply:', error);
            alert('Failed to send message. Please try again.');
        } finally {
            setSending(false);
        }
    };

    // Handle key press
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendReply();
        }
    };

    if (!conversation) {
        return (
            <div className="message-detail empty">
                <div className="empty-state">
                    <MessageSquare size={80} />
                    <h3>IO-SYS Messages</h3>
                    <p>Send and receive messages without keeping your phone online.</p>
                </div>
            </div>
        );
    }

    const partnerInfo = getChatPartnerInfo();
    const sortedMessages = [...conversation.messages].sort((a, b) =>
        new Date(a.createdAt) - new Date(b.createdAt)
    );

    return (
        <div className="message-detail">
            {/* Chat Header */}
            <div className="chat-header">
                <div className={`chat-header-avatar chat-avatar ${partnerInfo.type}`}>
                    {partnerInfo.initials}
                </div>
                <div className="chat-header-info">
                    <div className="chat-header-name">{conversation.subject}</div>
                    <div className="chat-header-status">
                        with {partnerInfo.name}
                    </div>
                </div>
                <div className="chat-header-actions">
                    <button className="icon-btn" title="Search">
                        <Search size={20} />
                    </button>
                    <button className="icon-btn" title="More options">
                        <MoreVertical size={20} />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="thread-messages">
                {sortedMessages.map((message, index) => {
                    const prevMessage = index > 0 ? sortedMessages[index - 1] : null;
                    const showDateSeparator = needsDateSeparator(message, prevMessage);
                    const senderType = getSenderType(message);
                    const isFromMe = senderType === 'from-me';
                    const isRead = message.isRead === 1 || message.toEmail !== userEmail;

                    return (
                        <div key={message.id}>
                            {/* Date Separator */}
                            {showDateSeparator && (
                                <div className="date-separator">
                                    <span>{formatDateSeparator(message.createdAt)}</span>
                                </div>
                            )}

                            {/* Message Bubble */}
                            <div className={`message-bubble ${senderType}`}>
                                {/* Sender name for received messages */}
                                {!isFromMe && (
                                    <div className="message-header">
                                        <span className="message-sender">{getSenderName(message)}</span>
                                    </div>
                                )}

                                {/* Message content with inline footer */}
                                <div className="message-body">
                                    {message.body || 'No message content'}
                                    <span className="message-footer">
                                        <span className="message-timestamp">
                                            {formatMessageTime(message.createdAt)}
                                        </span>
                                        {isFromMe && (
                                            <span className={`read-receipt ${isRead ? 'read' : ''}`}>
                                                {isRead ? <CheckCheck size={16} /> : <Check size={16} />}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            <div className="message-input-area">
                <div className="message-input-wrapper">
                    <textarea
                        ref={textareaRef}
                        className="message-input"
                        placeholder="Type a message"
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        onKeyPress={handleKeyPress}
                        rows="1"
                        disabled={sending}
                    />
                </div>
                <button
                    className="send-btn"
                    onClick={handleSendReply}
                    disabled={!replyText.trim() || sending}
                    title="Send message"
                >
                    {sending ? <Loader2 size={24} className="spin" /> : <Send size={24} />}
                </button>
            </div>
        </div>
    );
}

export default MessageDetail;
