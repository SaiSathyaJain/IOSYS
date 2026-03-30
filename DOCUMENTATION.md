# Inward/Outward Management System
## Software Documentation

**Version:** 1.2.0
**Organization:** Sri Sathya Sai Institute of Higher Learning (SSSIHL)
**Last Updated:** March 30, 2026

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Installation Guide](#installation-guide)
5. [User Guide](#user-guide)
6. [API Documentation](#api-documentation)
7. [Database Schema](#database-schema)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)
10. [Future Enhancements](#future-enhancements)

---

## System Overview

### Purpose
The Inward/Outward Management System (IOSYS) is a web-based application designed to streamline the management of inward and outward correspondence within SSSIHL. It provides a centralized platform for tracking, assigning, and processing institutional communications across three academic teams.

### Key Objectives
- Digitize and track all inward correspondence with auto-generated reference numbers
- Enable efficient task assignment to UG, PG/PRO, and PhD teams
- Facilitate outward communication management per team
- Provide real-time dashboard analytics
- Send automated email notifications on task assignment
- Deliver weekly summary reports to administrators via scheduled emails

### Target Users
- **Administrators**: Manage inward entries, assign tasks, view comprehensive statistics, export reports
- **Team Members (UG / PG/PRO / PhD)**: Process assigned tasks, create outward entries, track work progress

---

## Architecture

### Technology Stack

#### Frontend
- **Framework**: React 19.2.0
- **Build Tool**: Vite 7.2.4 (requires `vite.config.js` with `@vitejs/plugin-react`)
- **Routing**: React Router DOM 7.13.0
- **Styling**: Custom CSS with Dark/Light theme support
- **UI Components**: Lucide React icons
- **HTTP Client**: Axios 1.13.2
- **Date Picker**: react-datepicker

#### Backend
- **Runtime**: Cloudflare Workers
- **Framework**: Hono 4.4.0
- **Database**: Cloudflare D1 (SQLite)
- **Email Service**: Gmail REST API via OAuth2 (fetch-based — no SMTP/TCP)
- **AI Features**: OpenRouter API (via `routers/ai.js`)
- **Scheduled Jobs**: Cloudflare Workers Cron Triggers

#### Deployment
- **Frontend Hosting**: Cloudflare Pages (`iosys.pages.dev`)
- **Backend API**: Cloudflare Workers (`iosys.saisathyajain.workers.dev`)
- **Database**: Cloudflare D1 (`inward-outward-db`)
- **Version Control**: Git/GitHub
- **CI/CD**: Cloudflare Pages auto-deploy on push to `main`

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Layer                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Landing  │  │  Admin   │  │  Team    │  │  Team    │   │
│  │  Page    │  │  Portal  │  │Selection │  │  Portal  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│         React SPA (Cloudflare Pages — iosys.pages.dev)      │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   API Layer (Hono)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Inward  │  │ Outward  │  │Dashboard │  │   AI     │   │
│  │  Router  │  │  Router  │  │  Router  │  │  Router  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│    Cloudflare Workers (iosys.saisathyajain.workers.dev)     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Data Layer (D1/SQLite)                     │
│         ┌───────────────────┐  ┌───────────────────┐       │
│         │      inward       │  │      outward      │       │
│         │  (58+ entries)    │  │   (entries)       │       │
│         └───────────────────┘  └───────────────────┘       │
│              Cloudflare D1 — inward-outward-db              │
└─────────────────────────────────────────────────────────────┘
```

### Routing

| Path | Component | Description |
|------|-----------|-------------|
| `/` | `pages/LandingPage` | Entry point with portal links |
| `/admin` | `components/AdminPortal/AdminPortal` | Admin entry management |
| `/admin/dashboard` | `components/Dashboard/Dashboard` | Analytics dashboard |
| `/team` | `pages/TeamSelection` | Team workspace picker |
| `/team/:teamSlug` | `components/TeamPortal/TeamPortal` | Team-specific portal |

Team slugs: `ug`, `pg-pro`, `phd`

### Project Structure

```
Inward_outward System/
├── client/                      # Frontend React application
│   ├── src/
│   │   ├── components/
│   │   │   ├── AdminPortal/     # Admin entry management + navbar
│   │   │   ├── TeamPortal/      # Team-specific work portal
│   │   │   └── Dashboard/       # Analytics dashboard
│   │   ├── pages/
│   │   │   ├── LandingPage.jsx  # Home page with portal cards
│   │   │   └── TeamSelection.jsx# Team workspace selector
│   │   ├── services/
│   │   │   └── api.js           # Axios API service layer
│   │   ├── App.jsx              # Router + route definitions
│   │   ├── index.css            # Global CSS variables + themes
│   │   └── main.jsx             # React entry point
│   ├── public/
│   │   ├── sssihl-icon.jpg      # SSSIHL logo (used in navbars)
│   │   └── IO_SYS_LOGO.png      # Email header logo
│   ├── vite.config.js           # Vite config with React plugin
│   ├── .env                     # Dev: VITE_API_URL=http://localhost:8787/api
│   └── package.json
│
├── server/                      # Cloudflare Worker backend
│   ├── src/
│   │   ├── worker.js            # Hono app entry point + cron handler
│   │   ├── routers/
│   │   │   ├── inward.js        # Inward CRUD + email trigger
│   │   │   ├── outward.js       # Outward CRUD
│   │   │   ├── dashboard.js     # Stats aggregation
│   │   │   └── ai.js            # AI features (OpenRouter)
│   │   ├── services/
│   │   │   └── notification.js  # Gmail REST API email sender
│   │   └── scripts/
│   │       └── get-gmail-token.js # One-time OAuth token setup
│   ├── schema.sql               # D1 table definitions
│   ├── wrangler.toml            # Worker config + cron schedule
│   ├── .dev.vars                # Local secrets (Gmail OAuth, OpenRouter)
│   └── package.json
│
└── DOCUMENTATION.md
```

---

## Features

### Admin Portal

#### Navbar
- SSSIHL logo + brand name
- Back button (returns to landing page)
- **Export Report** button — downloads outward expenditure report
- **Refresh** button — reloads entry data
- **New Entry** button — opens create entry form
- Theme toggle (dark/light)
- Admin user pill (role + avatar)

#### Entry Management
- **Create Inward Entry**
  - Means of receipt, sender (particulars from whom), subject
  - Sign/receipt date & time, file reference
  - Assign team (UG / PG/PRO / PhD), assignee email, instructions, due date
  - Auto-generates `INW/YYYY/NNN` reference numbers
  - Triggers email notification to assignee on creation
- **Reassign Entry**
  - Change team, email, instructions, due date on existing entries
  - Sends new assignment email notification
- **Search & Filter**
  - Search by inward number, subject, or sender
  - Filter by status (All / Pending / Completed / Unassigned)
  - Filter by team (All / UG / PG/PRO / PhD)
- **View Entry Detail** — modal with all fields
- **Stats Cards** — Total Inward, Pending, Completed, Unassigned

#### Export Report
- Downloads outward expenditure data as a report
- Accessible via navbar Export Report button

### Team Portal

#### Workspace Selection
- Landing at `/team` shows three team cards: UG, PG/PRO, PhD
- Each card navigates to `/team/:teamSlug`

#### Team-Specific View (`/team/:teamSlug`)
- Lists inward entries assigned to that team
- Filter by status
- Update assignment status (Pending → Completed)
- Create outward entries linked to inward entries
- View team statistics

### Email Notifications

#### Assignment Notification
Triggered automatically when an inward entry is created or reassigned with both `assignedTeam` and `assignedToEmail` set.

Email includes:
- Inward reference number, subject, sender
- Team name + portal link
- Assignment instructions and due date
- SSSIHL logo header

#### Weekly Summary Report (Scheduled)
- **Schedule**: Every Saturday at 11:00 AM IST (05:30 UTC)
- Configured in `wrangler.toml` as a cron trigger: `30 5 * * 6`
- Report sent to the admin/boss email
- Includes total inward, pending, completed, unassigned counts
- Per-team breakdown table

### Common Features

#### Theme Support
- Dark mode (default) and light mode
- User preference saved in `localStorage`
- Applied via `data-theme` attribute on `<body>`
- All pages sync theme state on load

#### Responsive Design
- Mobile-friendly layouts
- Tablet and desktop optimized
- Sticky navbars on all pages

---

## Installation Guide

### Prerequisites

```bash
Node.js >= 18.x
npm >= 10.x
Git
Cloudflare account (for deployment)
```

### Local Development Setup

#### 1. Clone Repository

```bash
git clone https://github.com/SaiSathyaJain/IOSYS.git
cd "Inward_outward System"
```

#### 2. Install Dependencies

```bash
cd client && npm install
cd ../server && npm install
```

#### 3. Environment Configuration

**`client/.env`**
```env
VITE_API_URL=http://localhost:8787/api
```

**`server/.dev.vars`** (create this file — never commit)
```env
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REFRESH_TOKEN=your_refresh_token
GMAIL_FROM=your_gmail@gmail.com
OPENROUTER_API_KEY=your_openrouter_key
```

#### 4. Database Setup

```bash
cd server
# Create local D1 tables
npx wrangler d1 execute inward-outward-db --local --file=schema.sql
```

#### 5. Gmail OAuth Setup (one-time)

```bash
cd server
node src/scripts/get-gmail-token.js
# Follow prompts, copy refresh token into .dev.vars
```

> OAuth credential type must be **Web application** with redirect URI `http://localhost:3456`

#### 6. Run Development Servers

**Terminal 1 — Frontend**
```bash
cd client
npm run dev
# http://localhost:5173
```

**Terminal 2 — Backend**
```bash
cd server
npx wrangler dev
# http://localhost:8787
```

#### 7. Test Scheduled Email (local)

```bash
# In a separate terminal while wrangler dev is running:
curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
```

---

## API Documentation

### Base URL
- **Production**: `https://iosys.saisathyajain.workers.dev/api`
- **Local**: `http://localhost:8787/api`

### Inward Endpoints

**GET /api/inward**
- Returns all inward entries
- Response: `{ success: true, data: { entries: [...] } }`

**POST /api/inward**
- Creates a new inward entry, triggers assignment email if team + email set
- Body:
```json
{
  "means": "string",
  "particularsFromWhom": "string",
  "subject": "string",
  "signReceiptDateTime": "string",
  "fileReference": "string",
  "assignedTeam": "UG | PG/PRO | PhD",
  "assignedToEmail": "string",
  "assignmentInstructions": "string",
  "dueDate": "YYYY-MM-DD"
}
```

**PUT /api/inward/:id**
- Updates/reassigns an entry
- Same body shape as POST

**PUT /api/inward/:id/status**
- Updates assignment status only
- Body: `{ "assignmentStatus": "Pending | Completed | Unassigned" }`

**DELETE /api/inward/:id**
- Deletes an inward entry

### Outward Endpoints

**GET /api/outward**
- Returns all outward entries (optionally `?team=UG`)

**POST /api/outward**
- Creates an outward entry
```json
{
  "means": "string",
  "toWhom": "string",
  "subject": "string",
  "sentBy": "string",
  "signReceiptDateTime": "string",
  "postalTariff": 0.0,
  "dueDate": "YYYY-MM-DD",
  "linkedInwardId": null,
  "createdByTeam": "UG | PG/PRO | PhD",
  "teamMemberEmail": "string"
}
```

**PUT /api/outward/:id/close**
- Marks outward entry as case closed

### Dashboard Endpoints

**GET /api/dashboard/stats**
```json
{
  "success": true,
  "data": {
    "stats": {
      "totalInward": 58,
      "pending": 55,
      "completed": 1,
      "unassigned": 2,
      "totalOutward": 0
    }
  }
}
```

**GET /api/dashboard/team-stats**
- Per-team breakdown of assigned, pending, completed counts

---

## Database Schema

### `inward` table

```sql
CREATE TABLE IF NOT EXISTS inward (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    inward_no               TEXT UNIQUE NOT NULL,       -- e.g. INW/2026/058
    means                   TEXT,                       -- e.g. Email, Post
    particulars_from_whom   TEXT,                       -- Sender name/org
    subject                 TEXT,
    sign_receipt_datetime   TEXT,
    file_reference          TEXT,
    assigned_team           TEXT,                       -- UG | PG/PRO | PhD
    assigned_to_email       TEXT,
    assignment_instructions TEXT,
    assignment_date         TEXT,
    assignment_status       TEXT DEFAULT 'Unassigned',  -- Unassigned | Pending | Completed
    due_date                TEXT,
    completion_date         TEXT,
    created_at              TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at              TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### `outward` table

```sql
CREATE TABLE IF NOT EXISTS outward (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    outward_no          TEXT UNIQUE NOT NULL,
    means               TEXT,
    to_whom             TEXT,
    subject             TEXT,
    sent_by             TEXT,
    sign_receipt_datetime TEXT,
    case_closed         INTEGER DEFAULT 0,
    file_reference      TEXT,
    postal_tariff       REAL,
    due_date            TEXT,
    linked_inward_id    INTEGER,
    created_by_team     TEXT,
    team_member_email   TEXT,
    created_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at          TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (linked_inward_id) REFERENCES inward(id)
);
```

### Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_inward_status       ON inward(assignment_status);
CREATE INDEX IF NOT EXISTS idx_inward_assigned_team ON inward(assigned_team);
CREATE INDEX IF NOT EXISTS idx_outward_created_by_team ON outward(created_by_team);
```

---

## Deployment

### Cloudflare Pages (Frontend)

#### Build Settings
| Setting | Value |
|---------|-------|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | `client` |

#### Required Environment Variable (CF Pages Dashboard)
```
VITE_API_URL = https://iosys.saisathyajain.workers.dev/api
```

> This cannot be committed (`.env.production` is gitignored). It **must** be set in the Cloudflare Pages dashboard under Settings → Environment Variables.

#### Deployment
Push to `main` — Cloudflare Pages auto-builds and deploys.

Live URL: `https://iosys.pages.dev`

### Cloudflare Workers (Backend)

#### wrangler.toml
```toml
name = "iosys"
main = "src/worker.js"
compatibility_date = "2024-02-03"
account_id = "1966c03f4aadbbe46523c450e7c71c51"

[[d1_databases]]
binding = "DB"
database_name = "inward-outward-db"
database_id = "65cdca58-f391-42fd-b314-2bdf52aa6a19"

[triggers]
crons = ["30 5 * * 6"]   # Every Saturday 11:00 AM IST
```

#### Deploy Worker
```bash
cd server
npx wrangler deploy
```

Live URL: `https://iosys.saisathyajain.workers.dev`

#### Production Database Migration
```bash
cd server
npx wrangler d1 execute inward-outward-db --remote --file=schema.sql
```

---

## Troubleshooting

### 1. Blank Page on iosys.pages.dev
**Cause**: `main.jsx` or `App.jsx` missing, or `vite.config.js` missing.

**Fix**:
- Ensure `client/src/main.jsx` and `client/src/App.jsx` exist
- Ensure `client/vite.config.js` exists with `@vitejs/plugin-react` plugin
- Check CF Pages build logs for errors

### 2. Entries Not Showing in Production
**Cause**: `VITE_API_URL` not set — API calls go to `/api` (Pages) instead of the Worker.

**Fix**: Add `VITE_API_URL = https://iosys.saisathyajain.workers.dev/api` in CF Pages dashboard → Environment Variables → Production. Redeploy.

### 3. D1 Table Missing Locally
**Symptom**: `D1_ERROR: no such table: inward`

**Fix**:
```bash
cd server
npx wrangler d1 execute inward-outward-db --local --file=schema.sql
```

### 4. Email Not Sending
**Symptom**: `emailStatus: failed` in API response

**Fix**:
- Verify `GMAIL_REFRESH_TOKEN` in `.dev.vars` (local) or Worker secrets (production)
- Re-run `node src/scripts/get-gmail-token.js` to get a fresh token
- Ensure OAuth credential type is **Web application** with redirect URI `http://localhost:3456`

### 5. Weekly Report Shows All Zeros
**Cause**: Worker is querying local DB instead of remote, or scheduled event fired before data exists.

**Fix**:
```bash
# Test against remote DB
curl "https://iosys.saisathyajain.workers.dev/__scheduled?cron=*+*+*+*+*"
```

### 6. API Connection Failed
**Solutions**:
- Check `VITE_API_URL` in `.env` (local) or CF Pages env vars (production)
- Verify Worker is deployed: `npx wrangler deploy` from `server/`
- Check CORS settings in `server/src/worker.js`

### 7. Build Fails on CF Pages
**Solutions**:
- Ensure `client/vite.config.js` exists
- Ensure `client/src/main.jsx` and `client/src/App.jsx` exist
- Clear build cache in CF Pages dashboard and retry

---

## Future Enhancements

### Planned Features

#### Phase 1
- **Priority Levels**: Urgent/High/Medium/Low tags on entries
- **Due Date Alerts**: Overdue highlight and reminders
- **Audit Log**: Track who created/reassigned each entry

#### Phase 2
- **File Attachments**: Upload scanned letters/documents
- **Advanced Search**: Full-text search across all fields
- **Bulk Actions**: Update status of multiple entries at once
- **PDF Export**: Formatted report with date range selection

#### Phase 3
- **Auto-Assignment Rules**: Route entries by keyword/sender
- **SLA Tracking**: Monitor response time against targets
- **Mobile App**: Native iOS/Android application

---

## Support & Contact

**Technical Support**
- GitHub: https://github.com/SaiSathyaJain/IOSYS/issues
- Email: sathyajain9@gmail.com

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | February 2026 | Initial release — Admin Portal, Team Portal, Inward/Outward management, Google OAuth |
| v1.1.0 | March 2026 | Email notifications (Gmail OAuth2), weekly report cron, SSSIHL logo in emails, team portal links in emails |
| v1.2.0 | March 30, 2026 | Fixed blank page (restored `main.jsx`, `App.jsx`, `vite.config.js`), fixed production API URL env var, full navbar on all pages (Admin Portal, Team Selection), removed bell button, moved action buttons into Admin Portal navbar |

---

*This documentation is maintained by the SSSIHL Development Team and is subject to updates as the system evolves.*
