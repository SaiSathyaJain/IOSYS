import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Inward API
export const inwardAPI = {
    getAll: () => api.get('/inward'),
    create: (data) => api.post('/inward', data),
    assign: (id, data) => api.put(`/inward/${id}/assign`, data),
    updateStatus: (id, status) => api.put(`/inward/${id}/status`, { assignmentStatus: status })
};

// Outward API
export const outwardAPI = {
    getAll: (team = '') => api.get(`/outward${team ? `?team=${team}` : ''}`),
    create: (data) => api.post('/outward', data),
    update: (id, data) => api.put(`/outward/${id}`, data),
    closeCase: (id) => api.put(`/outward/${id}/close`)
};

// Dashboard API
export const dashboardAPI = {
    getStats: () => api.get('/dashboard/stats'),
    getTeamStats: (team) => api.get(`/dashboard/team/${encodeURIComponent(team)}`),
    getAllTeams: () => api.get('/dashboard/teams')
};

// Notifications API
export const notificationsAPI = {
    getAll: (email) => api.get(`/notifications?email=${encodeURIComponent(email)}`),
    getUnreadCount: (email) => api.get(`/notifications/unread/count?email=${encodeURIComponent(email)}`),
    markAsRead: (id) => api.put(`/notifications/${id}/read`),
    markAllAsRead: (email) => api.put('/notifications/read-all', { userEmail: email }),
    create: (data) => api.post('/notifications', data)
};

// Messages API
export const messagesAPI = {
    getAll: (email) => api.get(`/messages?email=${encodeURIComponent(email)}`),
    getUnreadCount: (email) => api.get(`/messages/unread/count?email=${encodeURIComponent(email)}`),
    markAsRead: (id) => api.put(`/messages/${id}/read`),
    markAllAsRead: (email) => api.put('/messages/read-all', { userEmail: email }),
    send: (data) => api.post('/messages', data)
};

export default api;
