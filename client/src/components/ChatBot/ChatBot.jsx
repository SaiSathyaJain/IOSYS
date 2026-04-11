import { useState, useRef, useEffect } from 'react';
import { X, Send, Loader2, Sparkles, RotateCcw } from 'lucide-react';
import './ChatBot.css';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const SUGGESTIONS = [
    'How many pending entries are there?',
    'Which team has the most workload?',
    'Are there any overdue entries?',
    'Summarize recent activity',
];

const INITIAL_MESSAGE = {
    role: 'assistant',
    content: "Hi! I'm your IOSYS Assistant powered by Llama 3.3. I have live access to your entries, team workloads, and activity. What would you like to know?",
};

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
            // Send only role/content pairs (exclude initial greeting from history sent to API)
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

    const showSuggestions = messages.length === 1 && !loading;

    return (
        <>
            {/* Floating Action Button */}
            <button
                className={`chatbot-fab${open ? ' chatbot-fab--hidden' : ''}`}
                onClick={() => setOpen(true)}
                title="Ask AI Assistant"
            >
                <Sparkles size={18} />
                <span>Ask AI</span>
            </button>

            {/* Chat Panel */}
            <div className={`chatbot-panel${open ? ' chatbot-panel--open' : ''}`}>
                {/* Header */}
                <div className="chatbot-header">
                    <div className="chatbot-header-left">
                        <div className="chatbot-avatar">
                            <Sparkles size={14} />
                        </div>
                        <div>
                            <div className="chatbot-title">IOSYS Assistant</div>
                            <div className="chatbot-subtitle">Llama 3.3 · Live data</div>
                        </div>
                    </div>
                    <div className="chatbot-header-actions">
                        <button className="chatbot-icon-btn" onClick={resetChat} title="Clear chat">
                            <RotateCcw size={15} />
                        </button>
                        <button className="chatbot-icon-btn" onClick={() => setOpen(false)} title="Close">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* Messages */}
                <div className="chatbot-messages">
                    {messages.map((msg, i) => (
                        <div key={i} className={`chatbot-msg chatbot-msg--${msg.role}`}>
                            {msg.role === 'assistant' && (
                                <div className="chatbot-msg-avatar">
                                    <Sparkles size={11} />
                                </div>
                            )}
                            <div className="chatbot-bubble">
                                {msg.content.split('\n').map((line, j) => (
                                    <span key={j}>
                                        {line}
                                        {j < msg.content.split('\n').length - 1 && <br />}
                                    </span>
                                ))}
                            </div>
                        </div>
                    ))}

                    {/* Typing indicator */}
                    {loading && (
                        <div className="chatbot-msg chatbot-msg--assistant">
                            <div className="chatbot-msg-avatar">
                                <Sparkles size={11} />
                            </div>
                            <div className="chatbot-bubble chatbot-bubble--typing">
                                <span /><span /><span />
                            </div>
                        </div>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Suggestion chips */}
                {showSuggestions && (
                    <div className="chatbot-suggestions">
                        {SUGGESTIONS.map(s => (
                            <button
                                key={s}
                                className="chatbot-chip"
                                onClick={() => sendMessage(s)}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input row */}
                <div className="chatbot-input-row">
                    <input
                        ref={inputRef}
                        className="chatbot-input"
                        placeholder="Ask about entries, teams, activity..."
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                        disabled={loading}
                    />
                    <button
                        className="chatbot-send"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || loading}
                    >
                        {loading ? <Loader2 size={16} className="chatbot-spin" /> : <Send size={16} />}
                    </button>
                </div>
            </div>
        </>
    );
}

export default ChatBot;
