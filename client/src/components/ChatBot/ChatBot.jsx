import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles, RotateCcw, ArrowUpRight } from 'lucide-react';
import './ChatBot.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const QUICK_ACTIONS = [
    // Overview
    { label: '📋 Daily briefing',        query: 'Give me today\'s briefing — new entries today, overdue items, and team with most load' },
    { label: '📊 Team workload',          query: 'Show team workload breakdown and compare UG, PG/PRO and PhD performance' },
    { label: '⚠️ Overdue entries',        query: 'Show all overdue entries sorted by how long they have been pending' },
    { label: '📥 Unassigned entries',     query: 'List all inward entries that have not been assigned to any team yet' },
    // Entry lists
    { label: '📤 Outward entries',        query: 'List all outward entries' },
    { label: '⏳ Pending entries',        query: 'List all pending inward entries' },
    // Analysis
    { label: '📈 Inward trend',           query: 'Is our inward volume increasing or decreasing? Which period had the most entries?' },
    { label: '👤 Top senders',            query: 'Who sends us the most correspondence? Group entries by sender and show counts' },
    { label: '🏎️ Bottlenecks',            query: 'Which entries have been pending the longest? Show the top 10 oldest unresolved entries' },
    { label: '⏱️ SLA analysis',           query: 'How long does each team typically take to complete entries? Calculate average turnaround time' },
    { label: '🗂️ Entry categories',       query: 'Classify inward entries by subject category (exam, certificate, attendance, etc.) and show counts' },
    // Productivity
    { label: '📝 Status report',          query: 'Generate a formal status report I can share with the COE — total entries, team breakdown, overdue count' },
    { label: '🔍 Recent activity',        query: 'Summarize the last 15 actions from the audit log' },
    { label: '⚖️ Compare teams',          query: 'Compare UG vs PG/PRO vs PhD — which team has the best completion rate and least overdue?' },
];

const INITIAL_MESSAGE = {
    role: 'assistant',
    content: "Sai Ram! I'm your IOSYS Assistant. I have live access to your entries, team workloads, and activity. What would you like to know?",
};

// Extract ENTRIES_JSON block from AI reply
// Returns { text, entries, showing, total }
function parseAIReply(content) {
    const match = content.match(/ENTRIES_JSON\s*([\s\S]*?)\s*END_ENTRIES_JSON/);

    // Strip any ENTRIES_JSON markers from displayed text
    const cleanText = content
        .replace(/ENTRIES_JSON[\s\S]*?END_ENTRIES_JSON/g, '')
        .replace(/ENTRIES_JSON[\s\S]*/g, '')
        .trim();

    // Detect "Showing X of Y" in the text to know if more exist
    const pageMatch = cleanText.match(/showing\s+(\d+)\s+of\s+(\d+)/i);
    const showing = pageMatch ? parseInt(pageMatch[1]) : null;
    const total   = pageMatch ? parseInt(pageMatch[2]) : null;

    if (!match) return { text: cleanText, entries: [], showing, total };

    try {
        const entries = JSON.parse(match[1].trim());
        return { text: cleanText, entries: Array.isArray(entries) ? entries : [], showing, total };
    } catch {
        return { text: cleanText, entries: [], showing, total };
    }
}

// Fields to show per entry type, in display order
const INWARD_FIELDS  = [
    { key: 'date',    label: 'Date'    },
    { key: 'from',    label: 'From'    },
    { key: 'subject', label: 'Subject' },
    { key: 'team',    label: 'Team'    },
    { key: 'status',  label: 'Status'  },
    { key: 'due',     label: 'Due'     },
];
const OUTWARD_FIELDS = [
    { key: 'date',    label: 'Date'    },
    { key: 'to',      label: 'To'      },
    { key: 'subject', label: 'Subject' },
    { key: 'sentBy',  label: 'Sent By' },
    { key: 'team',    label: 'Team'    },
    { key: 'mode',    label: 'Mode'    },
    { key: 'file',    label: 'File'    },
];

function EntryCard({ entry }) {
    const type   = entry.type === 'outward' ? 'outward' : 'inward';
    const schema = type === 'outward' ? OUTWARD_FIELDS : INWARD_FIELDS;
    const fields = schema.filter(f => entry[f.key] && entry[f.key] !== '');

    return (
        <div className={`chatbot-entry-card chatbot-entry-card--${type}`}>
            <div className="chatbot-entry-header">
                <span className="chatbot-entry-no">{entry.no}</span>
                <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
                    {entry.closed && (
                        <span className="chatbot-entry-badge chatbot-entry-badge--closed">Closed</span>
                    )}
                    <span className={`chatbot-entry-badge chatbot-entry-badge--${type}`}>
                        {type === 'outward' ? 'Outward' : 'Inward'}
                    </span>
                </div>
            </div>
            <div className="chatbot-entry-fields">
                {fields.map(({ key, label }) => (
                    <div key={key} className={`chatbot-entry-field${key === 'subject' ? ' chatbot-entry-field--full' : ''}`}>
                        <span className="chatbot-field-key">{label}</span>
                        <span
                            className="chatbot-field-val"
                            title={entry[key]}
                            style={key === 'subject' ? { whiteSpace: 'normal', wordBreak: 'break-word' } : {}}
                        >
                            {entry[key]}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// Render assistant message: plain text + optional entry cards + load more button
function MessageContent({ content, onSend }) {
    const { text, entries, showing, total } = parseAIReply(content);
    const hasMore = showing !== null && total !== null && showing < total;
    const nextStart = showing + 1;
    const nextEnd   = Math.min(showing + 10, total);

    // Build the "show more" query by extracting context from existing text
    const handleShowMore = () => {
        onSend(`Show entries ${nextStart} to ${nextEnd} (continue from where you left off)`);
    };

    return (
        <div className="chatbot-message-content">
            {text && (
                <p className="chatbot-text-segment">
                    {text.split('\n').map((line, i, arr) => (
                        <span key={i}>
                            {line}
                            {i < arr.length - 1 && <br />}
                        </span>
                    ))}
                </p>
            )}
            {entries.map((entry, i) => (
                <EntryCard key={i} entry={entry} />
            ))}
            {hasMore && (
                <button className="chatbot-load-more" onClick={handleShowMore}>
                    Show next 10 ({nextStart}–{nextEnd} of {total}) →
                </button>
            )}
        </div>
    );
}

function ChatBot() {
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([INITIAL_MESSAGE]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const chipsRef = useRef(null);

    const scrollChips = (dir) => {
        if (chipsRef.current) {
            chipsRef.current.scrollBy({ left: dir * 160, behavior: 'smooth' });
        }
    };

    useEffect(() => {
        if (open) setTimeout(() => inputRef.current?.focus(), 300);
    }, [open]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const sendMessage = async (text) => {
        const content = (text || input).trim();
        if (!content || loading) return;
        setInput('');

        const userMsg = { role: 'user', content };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setLoading(true);

        try {
            const apiMessages = updatedMessages
                .filter((_, i) => i > 0)
                .map(({ role, content }) => ({ role, content }));

            const res = await fetch(`${API_URL}/ai/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: apiMessages }),
            });

            const data = await res.json();
            const reply = data.success
                ? data.reply
                : 'Sorry, something went wrong. Please try again.';

            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
        } catch {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Connection error. Make sure the server is running.',
            }]);
        } finally {
            setLoading(false);
        }
    };

    const resetChat = () => {
        setMessages([INITIAL_MESSAGE]);
        setInput('');
    };

    return (
        <>
            {/* Floating Action Button */}
            <button
                className={`chatbot-fab${open ? ' chatbot-fab--hidden' : ''}`}
                onClick={() => setOpen(true)}
                title="Ask AI Assistant"
            >
                <Sparkles size={16} />
                <span>Ask AI</span>
                <span className="chatbot-fab-dot" />
            </button>

            {/* Chat Panel */}
            <div className={`chatbot-panel${open ? ' chatbot-panel--open' : ''}`}>

                {/* Header */}
                <div className="chatbot-header">
                    <div className="chatbot-header-left">
                        <div className="chatbot-avatar">
                            <Sparkles size={13} />
                        </div>
                        <div>
                            <div className="chatbot-title">IOSYS Assistant</div>
                            <div className="chatbot-subtitle">
                                <span className="chatbot-live-dot" />
                                Llama 3.3 · Live data
                            </div>
                        </div>
                    </div>
                    <div className="chatbot-header-actions">
                        <button className="chatbot-icon-btn" onClick={resetChat} title="Clear chat">
                            <RotateCcw size={13} />
                        </button>
                        <button className="chatbot-icon-btn" onClick={() => setOpen(false)} title="Close">
                            <X size={15} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="chatbot-messages">
                    {messages.map((msg, i) => (
                        <div key={i} className={`chatbot-msg chatbot-msg--${msg.role}`}>
                            {msg.role === 'assistant' && (
                                <div className="chatbot-msg-avatar">
                                    <Sparkles size={10} />
                                </div>
                            )}
                            {msg.role === 'assistant' ? (
                                <div className="chatbot-bubble chatbot-bubble--assistant">
                                    <MessageContent content={msg.content} onSend={sendMessage} />
                                </div>
                            ) : (
                                <div className="chatbot-bubble chatbot-bubble--user">
                                    {msg.content}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Typing indicator */}
                    {loading && (
                        <div className="chatbot-msg chatbot-msg--assistant">
                            <div className="chatbot-msg-avatar">
                                <Sparkles size={10} />
                            </div>
                            <div className="chatbot-bubble chatbot-bubble--assistant chatbot-bubble--typing">
                                <span /><span /><span />
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Quick-action chips — always visible */}
                <div className="chatbot-quick-actions-wrap">
                    <button className="chatbot-chips-arrow" onClick={() => scrollChips(-1)} title="Scroll left">‹</button>
                    <div className="chatbot-quick-actions" ref={chipsRef}>
                        {QUICK_ACTIONS.map(({ label, query }) => (
                            <button
                                key={label}
                                className="chatbot-qa-chip"
                                onClick={() => sendMessage(query)}
                                disabled={loading}
                            >
                                {label}
                                <ArrowUpRight size={11} />
                            </button>
                        ))}
                    </div>
                    <button className="chatbot-chips-arrow" onClick={() => scrollChips(1)} title="Scroll right">›</button>
                </div>

                {/* Input row */}
                <div className="chatbot-input-row">
                    <input
                        ref={inputRef}
                        className="chatbot-input"
                        placeholder="Ask anything about your data..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        }}
                        disabled={loading}
                    />
                    <button
                        className="chatbot-send"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || loading}
                    >
                        {loading
                            ? <Loader2 size={15} className="chatbot-spin" />
                            : <Send size={15} />
                        }
                    </button>
                </div>
            </div>
        </>
    );
}

export default ChatBot;
