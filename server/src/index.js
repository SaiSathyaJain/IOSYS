import 'dotenv/config'; // Load env vars before other imports
// Forced restart for env update
import express from 'express';
import cors from 'cors';

// Import database
import supabase from './database/db.js';

// Routes
import inwardRoutes from './routes/inward.js';
import outwardRoutes from './routes/outward.js';
import dashboardRoutes from './routes/dashboard.js';
import aiRoutes from './routes/ai.js';

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

// Root welcome page
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Inward/Outward API Server</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .container {
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 800px;
                    width: 100%;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                }
                h1 {
                    color: #667eea;
                    margin-bottom: 10px;
                    font-size: 2.5em;
                }
                .subtitle {
                    color: #666;
                    margin-bottom: 30px;
                    font-size: 1.1em;
                }
                .status {
                    background: #10b981;
                    color: white;
                    padding: 10px 20px;
                    border-radius: 50px;
                    display: inline-block;
                    margin-bottom: 30px;
                    font-weight: 600;
                }
                .section {
                    margin-bottom: 30px;
                }
                h2 {
                    color: #333;
                    margin-bottom: 15px;
                    font-size: 1.5em;
                }
                .endpoint {
                    background: #f8fafc;
                    border-left: 4px solid #667eea;
                    padding: 15px;
                    margin-bottom: 10px;
                    border-radius: 5px;
                }
                .method {
                    display: inline-block;
                    padding: 4px 12px;
                    border-radius: 4px;
                    font-weight: 600;
                    font-size: 0.85em;
                    margin-right: 10px;
                }
                .get { background: #10b981; color: white; }
                .post { background: #3b82f6; color: white; }
                .put { background: #f59e0b; color: white; }
                .delete { background: #ef4444; color: white; }
                .path {
                    font-family: 'Courier New', monospace;
                    color: #333;
                    font-weight: 500;
                }
                .description {
                    color: #666;
                    margin-top: 5px;
                    font-size: 0.9em;
                }
                .footer {
                    text-align: center;
                    color: #999;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #e5e7eb;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 Inward/Outward API</h1>
                <p class="subtitle">Document Management System Backend</p>
                <div class="status">✅ Server Running</div>

                <div class="section">
                    <h2>📋 Available Endpoints</h2>
                    
                    <div class="endpoint">
                        <span class="method get">GET</span>
                        <span class="path">/api/health</span>
                        <div class="description">Check server health and database status</div>
                    </div>

                    <div class="endpoint">
                        <span class="method get">GET</span>
                        <span class="path">/api/inward</span>
                        <div class="description">Get all inward documents</div>
                    </div>

                    <div class="endpoint">
                        <span class="method post">POST</span>
                        <span class="path">/api/inward</span>
                        <div class="description">Create a new inward document</div>
                    </div>

                    <div class="endpoint">
                        <span class="method get">GET</span>
                        <span class="path">/api/outward</span>
                        <div class="description">Get all outward documents</div>
                    </div>

                    <div class="endpoint">
                        <span class="method post">POST</span>
                        <span class="path">/api/outward</span>
                        <div class="description">Create a new outward document</div>
                    </div>
                    
                    <div class="endpoint">
                        <span class="method post">POST</span>
                        <span class="path">/api/ai/chat</span>
                        <div class="description">Chat with AI Assistant</div>
                    </div>

                    <div class="endpoint">
                        <span class="method get">GET</span>
                        <span class="path">/api/dashboard/stats</span>
                        <div class="description">Get dashboard statistics</div>
                    </div>
                </div>

                <div class="section">
                    <h2>🔧 Server Info</h2>
                    <p><strong>Port:</strong> ${PORT}</p>
                    <p><strong>Database:</strong> Supabase (Postgres)</p>
                    <p><strong>Environment:</strong> Development</p>
                </div>

                <div class="footer">
                    <p>Inward/Outward Document Management System v1.0.0</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Routes
app.use('/api/inward', inwardRoutes);
app.use('/api/outward', outwardRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);

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
