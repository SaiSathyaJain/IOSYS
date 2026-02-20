# Inward/Outward API - Cloudflare Workers

Backend API running on Cloudflare Workers with D1 database.

## Prerequisites

- Node.js 18+
- Cloudflare account
- Wrangler CLI: `npm install -g wrangler`

## Setup

### 1. Login to Cloudflare

```bash
wrangler login
```

### 2. Create D1 Database

```bash
wrangler d1 create inward-outward-db
```

Copy the `database_id` from the output and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "inward-outward-db"
database_id = "YOUR_DATABASE_ID_HERE"  # <-- Replace this
```

### 3. Install Dependencies

```bash
cd worker
npm install
```

### 4. Run Database Migration

```bash
# For local development
npm run db:migrate:local

# For production
npm run db:migrate
```

### 5. Set Email Secret (Optional)

For email notifications, sign up at [Resend](https://resend.com) and set your API key:

```bash
wrangler secret put EMAIL_API_KEY
# Enter your Resend API key when prompted
```

## Development

```bash
npm run dev
```

This starts a local development server at `http://localhost:8787`

## Deployment

```bash
npm run deploy
```

Your API will be available at: `https://inward-outward-api.YOUR_SUBDOMAIN.workers.dev`

## Data Migration from Supabase

If you have existing data in Supabase:

1. Ensure `server/.env` has your Supabase credentials
2. Run the migration script:

```bash
# Install supabase client first
npm install @supabase/supabase-js dotenv

# Run migration
node scripts/migrate-from-supabase.js

# Apply to D1
wrangler d1 execute inward-outward-db --file=./migrations/0002_data.sql
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/inward` | List all inward entries |
| GET | `/api/inward/:id` | Get single entry |
| POST | `/api/inward` | Create inward entry |
| PUT | `/api/inward/:id/assign` | Assign to team |
| PUT | `/api/inward/:id/status` | Update status |
| GET | `/api/outward` | List outward entries |
| POST | `/api/outward` | Create outward entry |
| GET | `/api/dashboard/stats` | Overall statistics |
| GET | `/api/dashboard/team/:team` | Team statistics |
| GET | `/api/dashboard/teams` | All teams summary |

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `EMAIL_API_KEY` | Resend API key for notifications | No |
| `EMAIL_FROM` | From address for emails | No |
