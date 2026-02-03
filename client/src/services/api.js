import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
    getAll: (params = '') => {
        let config = {};
        if (typeof params === 'string') {
            if (params) config.params = { team: params };
        } else {
            config.params = params;
        }
        return api.get('/outward', config);
    },
    create: (data) => api.post('/outward', data),
    update: (id, data) => api.put(`/outward/${id}`, data)
};

// Dashboard API
export const dashboardAPI = {
    getStats: () => api.get('/dashboard/stats'),
    getTeamStats: (team) => api.get(`/dashboard/team/${team}`),
    getAllTeams: () => api.get('/dashboard/teams')
};

export default api;
