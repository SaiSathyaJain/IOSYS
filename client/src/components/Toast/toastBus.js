let listeners = [];

export function showToast(message, type = 'info') {
    const toast = { id: Date.now() + Math.random(), message, type };
    listeners.forEach(fn => fn(toast));
}

export function subscribeToast(fn) {
    listeners.push(fn);
    return () => {
        listeners = listeners.filter(l => l !== fn);
    };
}
