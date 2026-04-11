import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles, RotateCcw, ArrowUpRight } from 'lucide-react';
import './ChatBot.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const QUICK_ACTIONS = [
    { label: 'Outward entries', query: 'List all outward entries' },
    { label: 'Team workload', query: 'Show team workload breakdown' },
    { label: 'Pending entries', query: 'How many pending inward entries are there?' },
    { label: 'Recent activity', query: 'Summarize recent activity' },
    { label: 'Overdue', query: 'Are there any overdue entries?' },
];

const INITIAL_MESSAGE = {
    role: 'assistant',
    content: "Sai Ram! I'm your IOSYS Assistant. I have live access to your entries, team workloads, and activity. What would you like to know?",
};

// Extract ENTRIES_JSON block from AI reply
// Returns { text: string, entries: array }
function parseAIReply(content) {
    const match = content.match(/ENTRIES_JSON\s*([\s\S]*?)\s*END_ENTRIES_JSON/);
    if (!match) return { text: content, entries: [] };

    const text = content
        .replace(/ENTRIES_JSON[\s\S]*?END_ENTRIES_JSON/, '')
        .trim();

    try {
        const entries = JSON.parse(match[1].trim());
        return { text, entries: Array.isArray(entries) ? entries : [] };
    } catch {
        return { text: content, entries: [] };
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

// Render assistant message: plain text + optional entry cards
function MessageContent({ content }) {
    const { text, entries } = parseAIReply(content);

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
                                    <MessageContent content={msg.content} />
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
                <div className="chatbot-quick-actions">
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
