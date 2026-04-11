// IOSYS Service Worker — handles push notifications

self.addEventListener('push', event => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'IOSYS', body: event.data?.text() || '' }; }

    event.waitUntil(
        self.registration.showNotification(data.title || 'IOSYS — New Assignment', {
            body: data.body || 'A new entry has been assigned to your team.',
            icon: '/sssihl-icon.jpg',
            badge: '/sssihl-icon.jpg',
            tag: 'iosys-assignment',
            renotify: true,
            data: { url: data.url || '/' }
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
            for (const client of clientList) {
                if (client.url.includes(url) && 'focus' in client) return client.focus();
            }
            return clients.openWindow(url);
        })
    );
});
