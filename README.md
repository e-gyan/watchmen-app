# Watchman Prayer & Accountability Partner App 🙏

A modern, analytical prayer tracking and spiritual accountability platform designed for prayer partners and covenant circles. Enables you and your friends to record daily prayer hours and minutes, pursue weekly and yearly prayer targets (e.g. 100 hours covenant), document topics and scriptures, celebrate answered prayers in a Praise Altar, and manage active intercession requests.

---

## 🌟 Key Capabilities

- **Daily Prayer Bundles**: Group and review prayer sessions recorded each day with cumulative hours/minutes and target achievements.
- **Accountability Targets**: Set and measure progress towards **Daily Target** (e.g. 60 min), **Weekly Target** (e.g. 7 hours), and **Period Milestone** (e.g. 100 hours by year-end).
- **Multi-Partner Agreement**: Connect 2 or more prayer partners into a shared circle using their email addresses. Filter views by specific partner or view shared progress.
- **Multi-Category Tagging**: Select multiple tags per session/testimony/request (e.g. *Thanksgiving & Praise*, *Intercession & Nations*, *Spiritual Warfare*, *Personal Revival*).
- **Praise Altar (Testimonies)**: Keep permanent records of answered prayers linked directly to prayer days and past sessions, with editable testimony burdens.
- **AI Spiritual Partner (Secure SSR)**: Contextual scripture lookup and partner encouragement generated server-side using Gemini.

---

## 🔒 Security Architecture & Secret Management

This application is built with security-first principles:

1. **Strict Client/Server Separation**:
   - Sensitive credentials (like `GEMINI_API_KEY`) **NEVER** enter client-side bundles or templates.
   - All AI interactions go through a secure server-side Express proxy route (`/api/prayer-assist`).
2. **Environment File Discipline**:
   - `.env` and `*.env` files are strictly excluded from version control in `.gitignore`.
   - Never commit API keys or private keys into Git.
   - Use `.env.example` as a template for environment configuration.
3. **HTTP Security Headers**:
   - Built-in protection against MIME-type sniffing (`X-Content-Type-Options: nosniff`).
   - Clickjacking prevention (`X-Frame-Options: SAMEORIGIN`).
   - Referrer policy enforcement (`Referrer-Policy: strict-origin-when-cross-origin`).
   - Permissions policy restricting camera, microphone, and geolocation.
4. **Firestore RBAC (Role-Based Access Control)**:
   - Enforced by `firestore.rules`.
   - Only authenticated users can access circle data.
   - Membership validation ensures only authorized partners can read or contribute to a partnership.
   - Automated sanitization (`removeUndefinedFields`) prevents malformed document injection.

---

## 🚀 Step-by-Step Deployment on Render.com

Follow this guide to deploy the full-stack Angular SSR app onto **Render**:

### Step 1: Push Code to GitHub / GitLab
1. Initialize a git repository and commit the codebase:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Watchman Prayer Partner app"
   ```
2. Create a private repository on GitHub (or GitLab) and push your code:
   ```bash
   git remote add origin https://github.com/<your-username>/watchman-prayer-partner.git
   git branch -M main
   git push -u origin main
   ```
   > ⚠️ **Security Check**: Confirm `.env` is NOT committed. Run `git status` or inspect GitHub to ensure only `.env.example` is present.

---

### Step 2: Create a Web Service on Render
1. Log in to [Render.com](https://render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub/GitLab repository.
4. Fill in the service configuration:
   - **Name**: `watchman-prayer-partner` (or your preferred name)
   - **Region**: Choose the region closest to your users (e.g., Frankfurt, Oregon, or Ohio)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**:
     ```bash
     npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```
     *(This executes `node dist/app/server/server.mjs`, serving the compiled Angular Universal SSR application).*

---

### Step 3: Configure Environment Variables in Render
In the Render Web Service setup (or under the **Environment** tab of your service), add the following environment variables:

| Key | Value | Purpose |
| :--- | :--- | :--- |
| `NODE_VERSION` | `20` | Ensures modern LTS Node.js runtime |
| `NODE_ENV` | `production` | Optimizes Express and SSR rendering |
| `PORT` | `10000` | (Render assigns this automatically, but 10000 is default) |
| `GEMINI_API_KEY` | `AIzaSy...` *(Secret)* | Your Google Gemini API Key for prayer assist |
| `APP_URL` | `https://your-service.onrender.com` | Your live Render domain URL |

> 💡 **Health Check Path**: Under **Advanced** settings on Render, set **Health Check Path** to `/api/health`. Render will verify this endpoint before switching traffic during zero-downtime deployments.

---

### Step 4: Signing In on Render (Two Built-In Options)

When you first deploy to Render (`https://your-app.onrender.com`), Firebase's Google OAuth Popup restricts sign-in to pre-authorized domains (`auth/unauthorized-domain`). We have provided **two ways** to sign in on Render:

#### Option A: Instant Direct Partner Sign-In (Works Immediately on Render)
1. Click **Sign In** (or **Sign In with Email**) on your live Render app.
2. Enter your **Google / Partner Email** (e.g., `you@gmail.com`) and **Your Name**.
3. Click **Sign In with Email**.
4. Your prayer circles, sessions, testimonies, and prayer requests automatically sync across partners on your Render server (`/api/cloud-sync`) and local backup without needing any console changes.

#### Option B: Authorize Your Render Domain for Google OAuth Popup
To enable 1-click Google Popup/Redirect login on Render:
1. Open the [Firebase Console Authentication Settings](https://console.firebase.google.com/project/gen-lang-client-0412977179/authentication/settings).
2. Select project: `gen-lang-client-0412977179` (or your custom Firebase project).
3. Go to **Authentication** &rarr; **Settings** &rarr; **Authorized domains**.
4. Click **Add domain** and paste your Render hostname (e.g., `watchman-prayer-partner.onrender.com` — without `https://`).
5. Click **Add**. Google Popup and Redirect sign-in will now work immediately on Render.

---

### Step 5: Deploy & Verify
1. Click **Create Web Service** (or **Manual Deploy** &rarr; **Deploy latest commit**) on Render.
2. Render will run:
   - `npm install`
   - `npm run build`
   - `npm start`
3. Once the build finishes and `/api/health` responds with `200 OK`, open your live Render URL.
4. Test:
   - Signing in via **Sign In with Email** or **Sign In with Google**.
   - Creating a partnership or adding prayer partner emails.
   - Logging a prayer session with hours, minutes, and topics.
   - Generating scripture recommendations via the AI prayer assist button.

---

## 🛠️ Local Development

### Prerequisites
- Node.js `v20+` or `v22+`
- npm `v10+`

### Setup
1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd watchman-prayer-partner
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy environment variables:
   ```bash
   cp .env.example .env
   ```
4. Start development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🏗️ System Architecture & Components

### High-Level Architecture
- **Frontend**: Angular 21+ (Zoneless, Signals, Reactive Forms, Tailwind CSS v4) with OnPush change detection and 0ms optimistic state hydration.
- **Typography Architecture**: Prose and UI text use **DM Sans** (`--font-sans`) and **Outfit** (`--font-serif`), while all numeric figures, durations, currencies, and metrics strictly preserve **JetBrains Mono** (`--font-mono` / `tabular-nums`) with comma formatting (`1,000.0`, `1,250`).
- **Progressive Web App (PWA) & Notification Alerts**: Compliant with Android Chrome and iOS Safari standalone installation via `/manifest.webmanifest`, `/sw.js` Service Worker (app-shell offline cache + push/local notification alerts), `/icon.svg`, and server-rendered PNG icons (`/pwa-192x192.png`, `/pwa-512x512.png`, `/pwa-maskable-512x512.png`, `/apple-touch-icon.png`).
- **Backend / SSR**: Express + `@angular/ssr` (`src/server.ts`) providing server-side rendering, continuous real-time market currency rate polling + Server-Sent Events (`GET /api/fx-stream` and `GET /api/fx-rates`) for live conversion to **GHS**, real-time database broadcast (`GET /api/cloud-stream` and `POST /api/cloud-sync`), dynamic PNG icon generation, and `/api/prayer-assist` Gemini integration.
- **Database & Auth**: Dual-persistence architecture combining 0ms synchronous local cache (`localStorage`), real-time Express cloud sync (`/api/cloud-sync`), and Firebase Authentication + Cloud Firestore (`partnerships`, `sessions`, `messages`, `authorities`, `seeds`, `testimonies`, `requests`).

### Core Components & Services
- `src/app/app.ts` & `src/app/app.html`: Shell, collapsible header menu with PWA **Install App** and **Notification Alerts** controls, Dashboard overview (Menu Totals in GHS, Streak component, 5-day & 2-week charts, Recent Records feed with search/filter/sort), simplified Journal with grouping by **Day**, **Week**, **Month**, **Year**, **Custom** date range, and **All**, Testimonies, and Covenant Petitions.
- `src/app/components/streak.ts`: Dedicated Dashboard Streak component visualizing consecutive prayer days via a 7-day strip of circular day badges — highlighting active streak days in vibrant amber, prior logged days in warm amber outline, and past missed days in muted stone, with 1-tap date selection to log prayer.
- `src/app/services/pwa.service.ts`: Manages Service Worker registration (`/sw.js`), Android/Desktop `beforeinstallprompt` capture, iOS/Android standalone installation guide, online/offline state tracking, and Web Notification Alerts (`enableNotifications`, `sendAlert`).
- `src/app/components/messages-tracker.ts`: Word intake tracker with initial duration, 1-click repeat (`+initial time`), custom `+ Add Time`, and filter/sort controls.
- `src/app/components/seed-tracker.ts`: Annual Seed Altar tracker with live FX conversion to **GHS**, cascading deletion of saved seeds when a seed target is removed, and filter/sort controls.
- `src/app/services/firebase.service.ts`: 0ms synchronous auth/read hydration, 0ms optimistic CRUD mutations with non-blocking background persistence to `/api/cloud-sync` and Firestore, real-time `EventSource('/api/fx-stream')` market rate listener, real-time `EventSource('/api/cloud-stream')` database listener, cascading seed deletion, newest-first record ordering, and comma-formatted number utilities (`1,000.0`, `1,250`).
- `src/app/services/theme.service.ts`: Automatic theme scheduler (Light mode `6:45 AM – 6:45 PM`, Dark mode `6:45 PM – 6:45 AM`) with manual override.

---

## 📦 GitHub File Change Summary (Commit Briefs)

- **`src/app/components/streak.ts`**: Created standalone `Streak` component (`<app-streak>`) for the Dashboard with a 7-day circular badge timeline highlighting active streak days in amber and past missed days in muted stone, plus longest streak calculation and 1-tap date logging.
- **`src/app/app.ts` & `src/app/app.html`**: Imported and mounted `<app-streak>` in the Dashboard KPI row wired to `openNewSessionModal` on badge selection; simplified Journal record cards and added grouping by Day, Week, Month, Year, Custom, and All; integrated PWA install and notification controls.
- **`public/manifest.webmanifest`**: Added PWA Web App Manifest (`standalone` display, `id: "/"`, `start_url: "/"`, `scope: "/"`, `#0c0a09` background, `#f59e0b` theme color, and `192x192`, `512x512`, `maskable`, and SVG icons) for Android home-screen installation.
- **`public/sw.js`**: Added production Service Worker with app-shell offline caching, network-first navigation/API fallback, and `push`, `message` (`SHOW_NOTIFICATION`), and `notificationclick` event handlers for Notification Alerts.
- **`public/icon.svg`**: Created scalable Watchman brand vector icon (`512x512` viewBox) for browser favicon and PWA manifest.
- **`src/server.ts`**: Added zero-dependency binary PNG generator endpoints (`/pwa-192x192.png`, `/pwa-512x512.png`, `/pwa-maskable-512x512.png`, `/apple-touch-icon.png`) alongside real-time market FX SSE (`GET /api/fx-stream`), real-time cloud DB SSE (`GET /api/cloud-stream`), and cascading seed deletion.
- **`src/app/services/pwa.service.ts`**: Created Angular PWA & Notification Alerts service handling `/sw.js` registration, `beforeinstallprompt` install trigger, standalone detection, offline indicator state, and browser/service-worker notification alerts.
- **`src/index.html` & `src/styles.css`**: Linked `/manifest.webmanifest`, Apple touch icon, and mobile web app meta tags; updated prose/heading fonts to **DM Sans** and **Outfit** while strictly preserving **JetBrains Mono** (`--font-mono` / `tabular-nums`) for all numeric figures.
- **`src/app/services/firebase.service.ts`**: Implemented 0ms synchronous startup/login hydration, 0ms optimistic CRUD mutations, real-time FX and cloud SSE listeners, cascading seed deletion, newest-on-top ordering, and comma-formatted figures.
- **`src/app/components/seed-tracker.ts` & `src/app/components/messages-tracker.ts`**: Added search, filter, and sort controls with newest-on-top ordering and comma-formatted figures.

---

## 📜 NPM Scripts Reference

- `npm run dev`: Runs the Angular development server on port 3000.
- `npm run build`: Compiles both client browser bundle and server SSR bundle into `dist/app`.
- `npm start`: Starts the production Node.js SSR server (`node dist/app/server/server.mjs`).
- `npm run lint`: Runs ESLint type and syntax checks.
- `npm test`: Runs Vitest test suite.

---

## 📄 License
MIT License. Created for prayer circles and intercessory teams.
