# Inward/Outward System - Setup Guide

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **"Create a project"**
3. Name it: `inward-outward-system`
4. Enable Google Analytics (optional)
5. Wait for project creation

## Step 2: Enable Firestore Database

1. In Firebase Console → **Build → Firestore Database**
2. Click **"Create database"**
3. Select **"Start in test mode"** (for development)
4. Choose location: **asia-south1 (Mumbai)**

## Step 3: Get Service Account Key

1. Go to **Project Settings → Service Accounts**
2. Click **"Generate new private key"**
3. Save the JSON file
4. Copy values to `server/.env`:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_CLIENT_EMAIL`

## Step 4: Configure Email (Gmail App Password)

1. Go to [Google Account Security](https://myaccount.google.com/security)
2. Enable **2-Step Verification**
3. Go to **App Passwords**
4. Create new app password for "Mail"
5. Add to `server/.env`:
   - `EMAIL_USER=your-email@gmail.com`
   - `EMAIL_PASS=your-app-password`

## Step 5: Run the Application

```bash
# Install server dependencies
cd server
npm install

# Create .env file (copy from .env.example)
copy .env.example .env
# Edit .env with your Firebase credentials

# Start server
npm run dev

# In new terminal - Start React app
cd client
npm run dev
```

## Step 6: Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```
