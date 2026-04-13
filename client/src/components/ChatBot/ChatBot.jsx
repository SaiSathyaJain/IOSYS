import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles, RotateCcw, ArrowUpRight, ChevronDown, Database, Search, Cpu } from 'lucide-react';

const SEARCH_STEPS = [
    { icon: Database, label: 'Fetching live data…'      },
    { icon: Search,   label: 'Searching entries…'       },
    { icon: Cpu,      label: 'Generating response…'     },
];

function SearchingIndicator() {
    const [step, setStep] = useState(0);

    useEffect(() => {
        const id = setInterval(() => setStep(s => (s + 1) % SEARCH_STEPS.length), 1200);
        return () => clearInterval(id);
    }, []);

    const { icon: Icon, label } = SEARCH_STEPS[step];

    return (
        <div className="chatbot-searching">
            <div className="chatbot-searching-icon">
                <Icon size={13} />
            </div>
            <span className="chatbot-searching-label">{label}</span>
            <span className="chatbot-searching-dots"><span /><span /><span /></span>
        </div>
    );
}
import './ChatBot.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const MODELS = [
    { id: 'nvidia/nemotron-3-nano-30b-a3b:free',    label: 'Nemotron Nano 30B', badge: 'Fast'     },
    { id: 'openai/gpt-oss-20b:free',                label: 'GPT OSS 20B',       badge: 'Fast'     },
    { id: 'openai/gpt-oss-120b:free',               label: 'GPT OSS 120B',      badge: 'Powerful' },
    { id: 'nvidia/nemotron-3-super-120b-a12b:free', label: 'Nemotron Super',    badge: 'Powerful' },
];
const DEFAULT_MODEL = MODELS[0].id;

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

// Inline markdown: **bold**, *italic*, `code`
function renderInline(text) {
    const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('*')  && part.endsWith('*'))  return <em key={i}>{part.slice(1, -1)}</em>;
        if (part.startsWith('`')  && part.endsWith('`'))  return <code key={i} className="md-code">{part.slice(1, -1)}</code>;
        return part;
    });
}

// Block markdown renderer: headings, bullets, numbered lists, tables, paragraphs
function MarkdownBlock({ text }) {
    if (!text) return null;
    const lines = text.split('\n');
    const elements = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) { i++; continue; }

        // Headings
        if (trimmed.startsWith('### ')) {
            elements.push(<p key={i} className="md-h3">{renderInline(trimmed.slice(4))}</p>);
            i++; continue;
        }
        if (trimmed.startsWith('## ')) {
            elements.push(<p key={i} className="md-h2">{renderInline(trimmed.slice(3))}</p>);
            i++; continue;
        }
        if (trimmed.startsWith('# ')) {
            elements.push(<p key={i} className="md-h1">{renderInline(trimmed.slice(2))}</p>);
            i++; continue;
        }

        // Table — detect by pipe characters
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            const tableLines = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }
            // Parse header, separator, rows
            const parseRow = (row) =>
                row.slice(1, -1).split('|').map(cell => cell.trim());
            const isSeparator = (row) => /^[\s|:-]+$/.test(row);

            const header = parseRow(tableLines[0]);
            const dataRows = tableLines
                .slice(1)
                .filter(r => !isSeparator(r))
                .map(parseRow);

            elements.push(
                <div key={`tbl-${i}`} className="md-table-wrap">
                    <table className="md-table">
                        <thead>
                            <tr>{header.map((h, ci) => <th key={ci}>{renderInline(h)}</th>)}</tr>
                        </thead>
                        <tbody>
                            {dataRows.map((row, ri) => (
                                <tr key={ri}>
                                    {row.map((cell, ci) => <td key={ci}>{renderInline(cell)}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            );
            continue;
        }

        // Bullet list — collect consecutive bullets
        if (/^(\s*[-*]|\s*\d+\.) /.test(line)) {
            const items = [];
            while (i < lines.length && /^(\s*[-*]|\s*\d+\.) /.test(lines[i])) {
                const l = lines[i];
                const nested = /^\s{2,}/.test(l);
                const content = l.replace(/^\s*[-*\d.]+\s/, '');
                items.push(
                    <li key={i} className={nested ? 'md-li md-li--nested' : 'md-li'}>
                        {renderInline(content)}
                    </li>
                );
                i++;
            }
            elements.push(<ul key={`ul-${i}`} className="md-ul">{items}</ul>);
            continue;
        }

        // Horizontal rule
        if (/^[-*_]{3,}$/.test(trimmed)) {
            elements.push(<hr key={i} className="md-hr" />);
            i++; continue;
        }

        // Plain paragraph
        elements.push(<p key={i} className="md-p">{renderInline(trimmed)}</p>);
        i++;
    }

    return <div className="md-body">{elements}</div>;
}

// Render assistant message: markdown text + optional entry cards + load more button
function MessageContent({ content, onSend }) {
    const { text, entries, showing, total } = parseAIReply(content);
    const hasMore = showing !== null && total !== null && showing < total;
    const nextStart = showing + 1;
    const nextEnd   = Math.min(showing + 10, total);

    const handleShowMore = () => {
        onSend(`Show entries ${nextStart} to ${nextEnd} (continue from where you left off)`);
    };

    return (
        <div className="chatbot-message-content">
            {text && <MarkdownBlock text={text} />}
            {entries.filter(e => e.no || e.subject || e.from || e.to).map((entry, i) => (
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
    const [streaming, setStreaming] = useState(false);
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);
    const [showModelPicker, setShowModelPicker] = useState(false);
    const bottomRef = useRef(null);
    const inputRef = useRef(null);
    const chipsRef = useRef(null);
    const modelPickerRef = useRef(null);

    // Close model picker when clicking outside
    useEffect(() => {
        const handler = (e) => {
            if (modelPickerRef.current && !modelPickerRef.current.contains(e.target)) {
                setShowModelPicker(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

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
        if (!content || loading || streaming) return;
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
                body: JSON.stringify({ messages: apiMessages, model: selectedModel }),
            });

            // Non-streaming error response
            if (!res.headers.get('content-type')?.includes('text/event-stream')) {
                const data = await res.json();
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: `Sorry, something went wrong: ${data.message || 'Please try again.'}`,
                }]);
                return;
            }

            // Streaming — hide typing indicator, start filling message
            setLoading(false);
            setStreaming(true);
            setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // keep incomplete line

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') break;
                    try {
                        const json = JSON.parse(data);
                        const delta = json.choices?.[0]?.delta?.content || '';
                        if (delta) {
                            setMessages(prev => {
                                const last = prev[prev.length - 1];
                                return [...prev.slice(0, -1), { ...last, content: last.content + delta }];
                            });
                        }
                    } catch { /* skip malformed chunk */ }
                }
            }
        } catch {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Connection error. Make sure the server is running.',
            }]);
        } finally {
            setLoading(false);
            setStreaming(false);
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
                            <div className="chatbot-subtitle" ref={modelPickerRef} style={{ position: 'relative' }}>
                                <span className="chatbot-live-dot" />
                                <button
                                    className="chatbot-model-btn"
                                    onClick={() => setShowModelPicker(p => !p)}
                                    title="Switch model"
                                >
                                    {MODELS.find(m => m.id === selectedModel)?.label ?? 'Model'}
                                    <ChevronDown size={10} />
                                </button>
                                · Live data
                                {showModelPicker && (
                                    <div className="chatbot-model-picker">
                                        {MODELS.map(m => (
                                            <button
                                                key={m.id}
                                                className={`chatbot-model-option${selectedModel === m.id ? ' active' : ''}`}
                                                onClick={() => { setSelectedModel(m.id); setShowModelPicker(false); }}
                                            >
                                                <span className="model-option-label">{m.label}</span>
                                                <span className={`model-option-badge badge-${m.badge.toLowerCase()}`}>{m.badge}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
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
                    {messages.map((msg, i) => {
                        // Skip the empty streaming placeholder — SearchingIndicator covers it
                        const isEmptyStreamPlaceholder =
                            streaming && i === messages.length - 1 &&
                            msg.role === 'assistant' && msg.content === '';
                        if (isEmptyStreamPlaceholder) return null;

                        return (
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
                        );
                    })}

                    {/* Searching indicator — show while loading OR while streaming but no content yet */}
                    {(loading || (streaming && messages[messages.length - 1]?.content === '')) && (
                        <div className="chatbot-msg chatbot-msg--assistant">
                            <div className="chatbot-msg-avatar">
                                <Sparkles size={10} />
                            </div>
                            <div className="chatbot-bubble chatbot-bubble--assistant">
                                <SearchingIndicator />
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
                                disabled={loading || streaming}
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
                        disabled={loading || streaming}
                    />
                    <button
                        className="chatbot-send"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || loading || streaming}
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
