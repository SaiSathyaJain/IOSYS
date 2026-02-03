import { Hono } from 'hono';
import { cors } from 'hono/cors';
import inwardRoutes from './routes/inward.js';
import outwardRoutes from './routes/outward.js';
import dashboardRoutes from './routes/dashboard.js';

const app = new Hono();

// CORS middleware
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}));

// Mount routes
app.route('/api/inward', inwardRoutes);
app.route('/api/outward', outwardRoutes);
app.route('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    database: 'Cloudflare D1 (SQLite)',
    timestamp: new Date().toISOString()
  });
});

// Root route
app.get('/', (c) => {
  return c.json({
    message: 'Inward/Outward API - Cloudflare Workers',
    version: '1.0.0',
    endpoints: ['/api/inward', '/api/outward', '/api/dashboard', '/api/health']
  });
});

export default app;
