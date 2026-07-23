import { useEffect, useState, useRef } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { subscribeToast } from './toastBus';
import './Toast.css';

const ICONS = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
};

const DURATION = 5000;

function ToastContainer() {
    const [toasts, setToasts] = useState([]);
    const timers = useRef(new Map());

    const dismiss = (id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
        const timer = timers.current.get(id);
        if (timer) {
            clearTimeout(timer);
            timers.current.delete(id);
        }
    };

    useEffect(() => {
        const unsubscribe = subscribeToast((toast) => {
            setToasts(prev => [...prev, toast]);
            const timer = setTimeout(() => dismiss(toast.id), DURATION);
            timers.current.set(toast.id, timer);
        });
        return () => {
            unsubscribe();
            timers.current.forEach(clearTimeout);
        };
    }, []);

    if (toasts.length === 0) return null;

    return (
        <div className="toast-stack">
            {toasts.map(({ id, message, type }) => {
                const Icon = ICONS[type] || ICONS.info;
                return (
                    <div key={id} className={`toast toast--${type}`} role="alert">
                        <div className="toast-icon"><Icon size={18} /></div>
                        <div className="toast-message">{message}</div>
                        <button className="toast-close" onClick={() => dismiss(id)} title="Dismiss">
                            <X size={14} />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

export default ToastContainer;
