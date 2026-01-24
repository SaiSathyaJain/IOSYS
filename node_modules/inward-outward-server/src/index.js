import 'dotenv/config'; // Load env vars before other imports
import express from 'express';
import cors from 'cors';

// Import database
import supabase from './database/db.js';

// Routes
import inwardRoutes from './routes/inward.js';
import outwardRoutes from './routes/outward.js';
import dashboardRoutes from './routes/dashboard.js';

// Initialize Express
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Make supabase available to routes
app.use((req, res, next) => {
    req.supabase = supabase;
    next();
});

// Routes
app.use('/api/inward', inwardRoutes);
app.use('/api/outward', outwardRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        database: 'Supabase (Postgres)',
        timestamp: new Date().toISOString()
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📦 Database: Supabase (Postgres)`);
});
