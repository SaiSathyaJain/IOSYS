import { useEffect, useRef, useState } from 'react';
import './UpdateNotifier.css';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const LAST_SEEN_KEY = 'iosys_last_seen_version';

function UpdateNotifier() {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const baselineVersion = useRef(null);
    const dismissed = useRef(false);

    useEffect(() => {
        let cancelled = false;

        const checkVersion = async () => {
            if (dismissed.current || cancelled) return;
            try {
                const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
                if (!res.ok) return;
                const data = await res.json();

                if (baselineVersion.current === null) {
                    baselineVersion.current = data.version;
                    const lastSeen = localStorage.getItem(LAST_SEEN_KEY);
                    if (lastSeen && lastSeen !== data.version) {
                        // Browser last visited an older version — an update shipped since then
                        localStorage.setItem(LAST_SEEN_KEY, data.version);
                        setUpdateAvailable(true);
                    } else if (!lastSeen) {
                        localStorage.setItem(LAST_SEEN_KEY, data.version);
                    }
                    return;
                }

                if (data.version !== baselineVersion.current) {
                    localStorage.setItem(LAST_SEEN_KEY, data.version);
                    setUpdateAvailable(true);
                }
            } catch {
                // network hiccup — ignore, will retry on next interval
            }
        };

        checkVersion();
        const interval = setInterval(checkVersion, CHECK_INTERVAL_MS);

        const onVisibilityChange = () => {
            if (document.visibilityState === 'visible') checkVersion();
        };
        document.addEventListener('visibilitychange', onVisibilityChange);

        return () => {
            cancelled = true;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', onVisibilityChange);
        };
    }, []);

    if (!updateAvailable) return null;

    const handleDismiss = () => {
        dismissed.current = true;
        setUpdateAvailable(false);
    };

    return (
        <div className="update-notifier">
            <div className="update-notifier-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 12a9 9 0 1 1-3-6.7" />
                    <polyline points="21 3 21 9 15 9" />
                </svg>
            </div>
            <div className="update-notifier-text">
                <h3>Update has been made</h3>
                <p>This app has been updated to a new version. Refresh to get the latest version.</p>
            </div>
            <div className="update-notifier-actions">
                <button className="update-notifier-btn secondary" onClick={handleDismiss}>Later</button>
                <button className="update-notifier-btn primary" onClick={() => window.location.reload()}>Refresh Now</button>
            </div>
        </div>
    );
}

export default UpdateNotifier;
