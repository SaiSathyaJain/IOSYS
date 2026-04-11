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

// Parse a line like: [OTW/2026/001] 12 Apr 2026 | To: Dean | Subject: ... | Sent by: X | Team: UG
// Normalize key names so display is consistent regardless of AI casing
const KEY_ALIASES = {
    'sent by': 'Sent By', 'sentby': 'Sent By',
    'from': 'From', 'to': 'To', 'subject': 'Subject',
    'date': 'Date', 'team': 'Team', 'status': 'Status',
    'due': 'Due', 'mode': 'Mode', 'file': 'File',
    'postal': 'Amount', 'amount': 'Amount', 'postal tariff': 'Amount',
    'file reference': 'File', 'file ref': 'File',
    'remarks': 'Remarks',
};

function parseEntryLine(line) {
    const match = line.match(/^\s*\[?((?:OTW|INW)\/[^\]\s|]+)\]?\s*(.*)/);
    if (!match) return null;

    const no = match[1].trim();
    const rest = match[2].trim();
    const type = no.startsWith('OTW') ? 'outward' : 'inward';

    // Split on pipe — allow spaces around it
    const parts = rest.split(/\s*\|\s*/);
    const fields = [];
    let caseClosed = false;

    // First part may be a bare date (no colon)
    if (parts[0] && !parts[0].includes(':')) {
        fields.push({ key: 'Date', val: parts[0].trim() });
        parts.shift();
    }

    for (const part of parts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        if (/^case\s+closed$/i.test(trimmed)) { caseClosed = true; continue; }

        const colon = trimmed.indexOf(':');
        if (colon > -1) {
            const rawKey = trimmed.substring(0, colon).trim().toLowerCase();
            const val = trimmed.substring(colon + 1).trim();
            const key = KEY_ALIASES[rawKey] || (rawKey.charAt(0).toUpperCase() + rawKey.slice(1));
            if (val) fields.push({ key, val });
        }
    }

    return { no, type, fields, caseClosed };
}

// Render one assistant message — plain text OR structured entry cards
function MessageContent({ content }) {
    const lines = content.split('\n');
    const segments = [];
    let textBuffer = [];

    const flushText = () => {
        if (textBuffer.length > 0) {
            segments.push({ kind: 'text', lines: [...textBuffer] });
            textBuffer = [];
        }
    };

    for (const line of lines) {
        const entry = parseEntryLine(line);
        if (entry) {
            flushText();
            segments.push({ kind: 'entry', entry });
        } else {
            textBuffer.push(line);
        }
    }
    flushText();

    return (
        <div className="chatbot-message-content">
            {segments.map((seg, i) => {
                if (seg.kind === 'text') {
                    const text = seg.lines.join('\n').trim();
                    if (!text) return null;
                    return (
                        <p key={i} className="chatbot-text-segment">
                            {seg.lines.map((line, j) => (
                                <span key={j}>
                                    {line}
                                    {j < seg.lines.length - 1 && <br />}
                                </span>
                            ))}
                        </p>
                    );
                }
                const { no, type, fields, caseClosed } = seg.entry;
                const PRIORITY = ['Date', 'From', 'To', 'Subject', 'Sent By', 'Team', 'Status', 'Due', 'Mode', 'File', 'Amount'];
                const displayFields = [
                    ...PRIORITY.map(k => fields.find(f => f.key === k)).filter(Boolean),
                    ...fields.filter(f => !PRIORITY.includes(f.key))
                ].slice(0, 6);

                return (
                    <div key={i} className={`chatbot-entry-card chatbot-entry-card--${type}`}>
                        <div className="chatbot-entry-header">
                            <span className="chatbot-entry-no">{no}</span>
                            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                                {caseClosed && (
                                    <span className="chatbot-entry-badge chatbot-entry-badge--closed">
                                        Closed
                                    </span>
                                )}
                                <span className={`chatbot-entry-badge chatbot-entry-badge--${type}`}>
                                    {type === 'outward' ? 'Outward' : 'Inward'}
                                </span>
                            </div>
                        </div>
                        <div className="chatbot-entry-fields">
                            {displayFields.map(({ key, val }) => (
                                <div key={key} className="chatbot-entry-field">
                                    <span className="chatbot-field-key">{key}</span>
                                    <span className="chatbot-field-val" title={val}>{val}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })}
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
