import { Search, Plus, RefreshCw, Inbox } from 'lucide-react';

function MessagesList({
    conversations,
    selectedConversation,
    onSelectConversation,
    searchTerm,
    onSearchChange,
    filterUnread,
    onFilterUnreadChange,
    filterTeam,
    onFilterTeamChange,
    userType,
    userEmail,
    onCompose,
    onRefresh,
    refreshing
}) {
    // Format time ago
    const formatTime = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
        } else if (diffDays === 1) {
            return 'Yesterday';
        } else if (diffDays < 7) {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        } else {
            return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
        }
    };

    // Get sender info
    const getSenderInfo = (message) => {
        if (message.fromEmail === userEmail) {
            return { name: 'You', type: 'me' };
        }
        if (message.fromEmail.includes('admin')) {
            return { name: 'Admin', type: 'admin', initials: 'A' };
        }
        if (message.fromEmail.includes('sathyajain9')) {
            return { name: 'UG Team', type: 'ug', initials: 'UG' };
        }
        if (message.fromEmail.includes('saisathyajain')) {
            return { name: 'PG/PRO Team', type: 'pg', initials: 'PG' };
        }
        if (message.fromEmail.includes('results')) {
            return { name: 'PhD Team', type: 'phd', initials: 'PhD' };
        }
        const name = message.fromEmail.split('@')[0];
        return { name: name, type: 'default', initials: name.charAt(0).toUpperCase() };
    };

    // Get chat display info (who the conversation is with)
    const getChatInfo = (conv) => {
        // Find the other party in the conversation
        const lastMsg = conv.lastMessage;
        if (lastMsg.fromEmail === userEmail) {
            // We sent the last message, so show who we sent to
            if (lastMsg.toEmail.includes('admin')) {
                return { name: 'Admin', type: 'admin', initials: 'A' };
            }
            if (lastMsg.toEmail.includes('sathyajain9')) {
                return { name: 'UG Team', type: 'ug', initials: 'UG' };
            }
            if (lastMsg.toEmail.includes('saisathyajain')) {
                return { name: 'PG/PRO Team', type: 'pg', initials: 'PG' };
            }
            if (lastMsg.toEmail.includes('results')) {
                return { name: 'PhD Team', type: 'phd', initials: 'PhD' };
            }
            const name = lastMsg.toEmail.split('@')[0];
            return { name: name, type: 'default', initials: name.charAt(0).toUpperCase() };
        }
        return getSenderInfo(lastMsg);
    };

    // Get preview text
    const getPreview = (conv) => {
        const lastMsg = conv.lastMessage;
        const isFromMe = lastMsg.fromEmail === userEmail;
        const prefix = isFromMe ? 'You: ' : '';
        const body = lastMsg.body || 'No message';
        return prefix + body;
    };

    return (
        <div className="messages-list">
            {/* Header */}
            <div className="list-header">
                <div className="list-header-left">
                    <span className="list-header-title">Messages</span>
                </div>
                <div className="list-header-actions">
                    <button
                        className="icon-btn"
                        onClick={onRefresh}
                        disabled={refreshing}
                        title="Refresh"
                    >
                        <RefreshCw size={20} className={refreshing ? 'spin' : ''} />
                    </button>
                    <button
                        className="icon-btn primary"
                        onClick={onCompose}
                        title="New message"
                    >
                        <Plus size={22} />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="messages-filters">
                <div className="search-box">
                    <Search size={18} />
                    <input
                        type="text"
                        placeholder="Search or start new chat"
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>

                <div className="filter-row">
                    <button
                        className={`filter-btn ${!filterUnread && !filterTeam ? 'active' : ''}`}
                        onClick={() => { onFilterUnreadChange(false); onFilterTeamChange(''); }}
                    >
                        All
                    </button>
                    <button
                        className={`filter-btn ${filterUnread ? 'active' : ''}`}
                        onClick={() => onFilterUnreadChange(!filterUnread)}
                    >
                        Unread
                    </button>
                    {userType === 'admin' && (
                        <select
                            className="filter-select"
                            value={filterTeam}
                            onChange={(e) => onFilterTeamChange(e.target.value)}
                        >
                            <option value="">All Teams</option>
                            <option value="sathyajain9">UG</option>
                            <option value="saisathyajain">PG/PRO</option>
                            <option value="results">PhD</option>
                        </select>
                    )}
                </div>
            </div>

            {/* Conversations List */}
            <div className="conversations-list">
                {conversations.length === 0 ? (
                    <div className="empty-state">
                        <Inbox size={48} />
                        <h3>No messages</h3>
                        <p>
                            {searchTerm || filterUnread
                                ? 'Try adjusting your filters'
                                : 'Start a new conversation'}
                        </p>
                    </div>
                ) : (
                    conversations.map((conv, index) => {
                        const chatInfo = getChatInfo(conv);
                        const isSelected = selectedConversation?.subject === conv.subject;
                        const hasUnread = conv.unreadCount > 0;

                        return (
                            <div
                                key={index}
                                className={`conversation-item ${hasUnread ? 'unread' : ''} ${isSelected ? 'selected' : ''}`}
                                onClick={() => onSelectConversation(conv)}
                            >
                                {/* Avatar */}
                                <div className={`chat-avatar ${chatInfo.type}`}>
                                    {chatInfo.initials}
                                    {hasUnread && <span className="unread-dot" />}
                                </div>

                                {/* Chat Info */}
                                <div className="chat-info">
                                    <div className="chat-info-header">
                                        <span className="chat-name">{conv.subject}</span>
                                        <span className="chat-time">
                                            {formatTime(conv.lastMessage.createdAt)}
                                        </span>
                                    </div>
                                    <div className="chat-preview-row">
                                        <span className="chat-preview">
                                            {getPreview(conv)}
                                        </span>
                                        {hasUnread && (
                                            <span className="unread-badge">{conv.unreadCount}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}

export default MessagesList;
