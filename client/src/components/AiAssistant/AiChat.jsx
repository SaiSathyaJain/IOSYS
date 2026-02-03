import { useState, useRef, useEffect } from 'react';
import api from '../../services/api';
import { MessageSquare, Send, X, Bot, User, Minimize2, Maximize2, Sparkles } from 'lucide-react';
import './AiChat.css';

function AiChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hello! I am your IO-SYS Assistant. I can help you find letters, check status, or generate summaries. How can I help?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || loading) return;

        const userMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            // Prepare context for the AI (last 10 messages to keep context window manageable)
            const contextMessages = [...messages, userMessage].slice(-10);

            const response = await api.post('/ai/chat', { messages: contextMessages });

            if (response.data.success) {
                setMessages(prev => [...prev, { role: 'assistant', content: response.data.reply }]);
            } else {
                throw new Error(response.data.message || 'Failed to get response');
            }
        } catch (error) {
            console.error('AI Chat Error:', error);
            setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error connecting to the server. Please try again later.' }]);
        } finally {
            setLoading(false);
        }
    };

    // Auto-resize textarea
    const handleInput = (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = (e.target.scrollHeight) + 'px';
    };

    if (!isOpen) {
        return (
            <button className="ai-fab animate-bounce-in" onClick={() => setIsOpen(true)}>
                <Sparkles size={24} />
                <span className="ai-fab-text">Ask AI</span>
            </button>
        );
    }

    return (
        <div className="ai-chat-window animate-slide-up">
            <div className="ai-header">
                <div className="ai-header-title">
                    <Bot size={20} />
                    <span>smart Assistant</span>
                </div>
                <div className="ai-header-actions">
                    <button className="btn-icon-light" onClick={() => setIsOpen(false)}>
                        <X size={18} />
                    </button>
                </div>
            </div>

            <div className="ai-messages">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.role}`}>
                        <div className="message-avatar">
                            {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                        </div>
                        <div className="message-bubble">
                            {msg.content}
                        </div>
                    </div>
                ))}
                {loading && (
                    <div className="message assistant">
                        <div className="message-avatar"><Bot size={16} /></div>
                        <div className="message-bubble typing-indicator">
                            <span></span><span></span><span></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form className="ai-input-area" onSubmit={handleSubmit}>
                <textarea
                    className="ai-input"
                    placeholder="Ask about inward entries..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onInput={handleInput}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e);
                        }
                    }}
                    rows={1}
                />
                <button type="submit" className="btn-send" disabled={!input.trim() || loading}>
                    <Send size={18} />
                </button>
            </form>
        </div>
    );
}

export default AiChat;
