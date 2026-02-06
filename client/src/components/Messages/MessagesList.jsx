import { Search, Filter, Mail, Inbox } from 'lucide-react';

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
    userEmail
}) {
    // Format time ago
    const timeAgo = (dateString) => {
        const date = new Date(dateString);
        const now = new Date();
        const seconds = Math.floor((now - date) / 1000);

        if (seconds < 60) return 'Just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
        if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
        return date.toLocaleDateString();
    };

    // Get sender display name
    const getSenderDisplay = (message) => {
        if (message.fromEmail === userEmail) return 'You';
        if (message.fromEmail.includes('admin')) return 'Admin';
        if (message.fromEmail.includes('sathyajain9')) return 'UG Team';
        if (message.fromEmail.includes('saisathyajain')) return 'PG/PRO Team';
        if (message.fromEmail.includes('results')) return 'PhD Team';
        return message.fromEmail.split('@')[0];
    };

    return (
        <div className="messages-list">
            {/* Search and Filters */}
            <div className="messages-filters">
                <div className="search-box">
                    <Search size={16} />
                    <input
                        type="text"
                        placeholder="Search messages..."
                        value={searchTerm}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>

                <div className="filter-row">
                    <label className="filter-checkbox">
                        <input
                            type="checkbox"
                            checked={filterUnread}
                            onChange={(e) => onFilterUnreadChange(e.target.checked)}
                        />
                        <span>Unread only</span>
                    </label>

                    {userType === 'admin' && (
                        <select
                            className="filter-select"
                            value={filterTeam}
                            onChange={(e) => onFilterTeamChange(e.target.value)}
                        >
                            <option value="">All Teams</option>
                            <option value="sathyajain9">UG Team</option>
                            <option value="saisathyajain">PG/PRO Team</option>
                            <option value="results">PhD Team</option>
                        </select>
                    )}
                </div>
            </div>

            {/* Conversations List */}
            <div className="conversations-list">
                {conversations.length === 0 ? (
                    <div className="empty-state">
                        <Inbox size={48} />
                        <p>No messages yet</p>
                        <span className="empty-hint">
                            {searchTerm || filterUnread ? 'Try adjusting your filters' : 'Start a conversation by composing a new message'}
                        </span>
                    </div>
                ) : (
                    conversations.map((conv, index) => (
                        <div
                            key={index}
                            className={`conversation-item ${conv.unreadCount > 0 ? 'unread' : ''} ${
                                selectedConversation?.subject === conv.subject ? 'selected' : ''
                            }`}
                            onClick={() => onSelectConversation(conv)}
                        >
                            <div className="conversation-header">
                                <div className="conversation-sender">
                                    {getSenderDisplay(conv.lastMessage)}
                                </div>
                                <div className="conversation-time">
                                    {timeAgo(conv.lastMessage.createdAt)}
                                </div>
                            </div>

                            <div className="conversation-subject">
                                {conv.subject}
                                {conv.unreadCount > 0 && (
                                    <span className="unread-badge">{conv.unreadCount}</span>
                                )}
                            </div>

                            <div className="conversation-preview">
                                {conv.lastMessage.body?.substring(0, 80) || 'No message body'}
                                {conv.lastMessage.body?.length > 80 && '...'}
                            </div>

                            {conv.lastMessage.relatedType && (
                                <div className="conversation-badges">
                                    <span className="badge badge-linked">
                                        Linked to {conv.lastMessage.relatedType}
                                    </span>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default MessagesList;
