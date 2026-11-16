# Watchman Prayer & Accountability Partner App 🙏

A modern, analytical prayer tracking and spiritual accountability platform designed for prayer partners and covenant circles. Enables you and your friends to record daily prayer hours and minutes, track message listening and repeat depth, manage annual seed targets in GHS with live FX conversion, analyze period trends and growth rates, celebrate answered prayers in a Praise Altar, and configure daily notification alert checks.

---

## 🌟 Key Capabilities

- **Backend-Driven Navigation & Seamless Left/Right Sliding Bottom Menu Bar**:
  - Bottom menu bar (`GET /api/menu-config`) surfaces **Dashboard**, **Messages**, **Seeds**, **Journal**, and **Analytics** in ordered `slideOrder` (`0..4`) alongside a server-defined `slideConfig` (`enabled: true`, `swipeThresholdPx: 48`, `durationMs: 360`, `easing: 'cubic-bezier(0.22, 1, 0.36, 1)'`), omitting **Testimonies** and **Covenant** from the bottom bar while retaining them in the slide-over **Sidebar Menu Drawer**.
  - Hardware-accelerated horizontal sliding carousel track (`translate3d(calc(-activeBottomIndex * 100% + swipeOffsetPx), 0, 0)`) and a synchronized gliding active indicator pill (`translate3d(activeBottomIndex * 100%, 0, 0)`) allow users to slide smoothly left and right across bottom menu options via tap, left/right chevron controls, interactive touch/swipe gestures (`touchstart` / `touchmove` / `touchend`), or keyboard `ArrowLeft` / `ArrowRight` keys.
- **Pop-Up Modals in Messages & Seeds**:
  - All action buttons in **Messages** (`Log Message`, `Edit Message`, `+ Add Time / Repeat`) and **Seeds** (`Add Target`, `Edit Target`, `Log Seed`) open responsive pop-up modals (`modal-pop-in`).
- **Custom User-Defined Categories**:
  - Removed hardcoded default categories (`PRAYER_CATEGORIES = []`). Users create, color-tag, select, and delete their own custom categories directly when logging prayers, testimonies, and petitions.
- **Analytics & Insights (`<app-analytics-tracker>`)**:
  - Period selector (**7 Days**, **30 Days**, **90 Days**, **1 Year**, **All Time**) with period-over-period growth deltas (`+%`), multi-series timeline progression bars (**Prayer Hours**, **Message Hours**, **Seeds in GHS**), partner vs. individual split, custom category distribution, top message speakers/repeat multipliers, and seed target fulfillment in **GHS**.
- **Daily Prayer & Message Notification Alert Parameters (in Covenant)**:
  - Configure daily check times and custom reminder prompts inside the **Covenant** menu option to trigger browser/PWA notification alerts whenever 0 minutes of prayer or message listening have been recorded for the day, plus an on-demand **Check Now** button.
- **Unified Header & PWA Brand Logo + Warm Launch Theme**:
  - Matches the header's rounded amber flame badge (`local_fire_department` beside `WATCHMAN`) across `/icon.svg`, `/pwa-192x192.png`, `/pwa-512x512.png`, `/pwa-maskable-512x512.png`, and `/apple-touch-icon.png`, with a warm amber-cream splash screen (`#fffbeb`) and warm espresso-slate dark palette (`#171412`) to eliminate harsh black screens when opening the app.

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
   git commit -m "Enable backend-driven smooth left/right sliding bottom menu bar and view track"
   ```
2. Create a private repository on GitHub (or GitLab) and push your code:
   ```bash
   git remote add origin https://github.com/<your-username>/watchman-prayer-partner.git
   git branch -M main
   git push -u origin main
   ```

---

### Step 2: Create a Web Service on Render
1. Log in to [Render.com](https://render.com).
2. Click **New +** and select **Web Service**.
3. Connect your GitHub/GitLab repository.
4. Fill in the service configuration:
   - **Name**: `watchman-prayer-partner`
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

---

### Step 3: Configure Environment Variables in Render

| Key | Value | Purpose |
| :--- | :--- | :--- |
| `NODE_VERSION` | `20` | Ensures modern LTS Node.js runtime |
| `NODE_ENV` | `production` | Optimizes Express and SSR rendering |
| `PORT` | `10000` | Default Render port |
| `GEMINI_API_KEY` | `AIzaSy...` *(Secret)* | Your Google Gemini API Key for prayer assist |
| `APP_URL` | `https://your-service.onrender.com` | Your live Render domain URL |

---

## 🏗️ System Architecture & Components

### High-Level Architecture
- **Frontend**: Angular 21+ (Zoneless, Signals, Reactive Forms, Tailwind CSS v4) with OnPush change detection, hardware-accelerated horizontal sliding carousel track (`translate3d`), touch/swipe gestures, and 0ms optimistic state hydration.
- **Typography Architecture**: Prose and UI text use **DM Sans** (`--font-sans`) and **Outfit** (`--font-serif`), while all numeric figures, durations, currencies, and metrics strictly preserve **JetBrains Mono** (`--font-mono` / `tabular-nums`) with comma formatting (`1,000.0`, `1,250`).
- **Progressive Web App (PWA) & Notification Alerts**: Compliant with Android Chrome and iOS Safari standalone installation via `/manifest.webmanifest` (`#fffbeb` warm splash background), `/sw.js` Service Worker, `/icon.svg`, and server-rendered Watchman flame badge PNG icons (`/pwa-192x192.png`, `/pwa-512x512.png`, `/pwa-maskable-512x512.png`, `/apple-touch-icon.png`).
- **Backend / SSR (`src/server.ts`)**: Express + `@angular/ssr` providing:
  - `GET /api/menu-config`: Backend-driven navigation schema returning ordered `bottomNavItems`, `sidebarNavItems`, and `slideConfig` (`enabled`, `swipeThresholdPx`, `durationMs`, `easing`, `loop`, `order`).
  - `GET /api/analytics`: Server-side period aggregation and trend computation across prayers, messages, seeds (in GHS), testimonies, and petitions.
  - `GET /api/fx-stream` & `GET /api/fx-rates`: Continuous real-time market currency rate polling + Server-Sent Events for live conversion to **GHS**.
  - `GET /api/cloud-stream` & `POST /api/cloud-sync`: Real-time multi-device/partner state synchronization.
- **Database & Auth**: Dual-persistence architecture combining 0ms synchronous local cache (`localStorage`), real-time Express cloud sync (`/api/cloud-sync`), and Firebase Authentication + Cloud Firestore.

### Core Components & Services
- `src/app/app.ts` & `src/app/app.html`: Application shell with slide-over Sidebar Menu Drawer (`sidebarNavItems`), backend-driven Bottom Menu Bar (`bottomNavItems`) with a smoothly gliding active indicator pill, left/right slide buttons (`slidePrevTab`, `slideNextTab`), interactive touch/swipe left-and-right handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd`), keyboard arrow navigation, and a horizontal `flex` sliding track for **Dashboard**, **Messages**, **Seeds**, **Journal**, and **Analytics**.
- `src/app/components/analytics-tracker.ts`: Dedicated Analytics & Insights view (`<app-analytics-tracker>`) with period comparisons (`7 Days`, `30 Days`, `90 Days`, `1 Year`, `All Time`), growth rate deltas, multi-series progression bars, prayer consistency & mode split, message retention & top speakers, and seed target fulfillment in **GHS**.
- `src/app/components/messages-tracker.ts`: Word intake tracker with responsive pop-up modals for `Log/Edit Message` and `+ Add Time / Repeat`, plus search, filter, and sort controls.
- `src/app/components/seed-tracker.ts`: Annual Seed Altar tracker in **GHS** with responsive pop-up modals for `Add/Edit Seed Target` and `Log Seed Given`, live FX conversion, and cascading seed deletion.
- `src/app/components/log-session-modal.ts`, `src/app/components/testimony-modal.ts`, & `src/app/components/request-modal.ts`: Pop-up modals with user-defined custom category creation, color selection, and deletion.
- `src/app/components/streak.ts`: Dashboard Streak component visualizing consecutive prayer days via a 7-day strip of circular day badges.
- `src/app/services/firebase.service.ts`: Manages backend menu & slide configuration (`bottomNavItems`, `sidebarNavItems`, `slideConfig`), custom user categories (`userCategories`, `addCustomCategory`, `removeCustomCategory`), daily alert settings (`alertSettings`, `updateAlertSettings`, `todayMessageMinutes`), 0ms optimistic CRUD, and live FX conversion.
- `src/app/services/pwa.service.ts`: Manages Service Worker registration, install prompt capture, and browser/PWA notification dispatch.

---

## 📦 GitHub File Change Summary (Commit Briefs)

- **`src/app/models/prayer.model.ts`**: Added `slideOrder?: number` to `NavigationMenuItem` and introduced the `BottomBarSlideConfig` interface (`enabled`, `swipeThresholdPx`, `durationMs`, `easing`, `loop`, `order`) for backend-driven left/right sliding bottom menu bar navigation.
- **`src/server.ts`**: Updated `BACKEND_MENU_ITEMS` with ordered `slideOrder` indices, added `BACKEND_SLIDE_CONFIG`, and enhanced `GET /api/menu-config` to return sorted `bottomNavItems`, `sidebarNavItems`, and `slideConfig`.
- **`src/app/services/firebase.service.ts`**: Added `DEFAULT_SLIDE_CONFIG` and reactive `slideConfig` signal hydrated from `GET /api/menu-config`, sorting `bottomNavItems` and `sidebarNavItems` by backend `slideOrder`.
- **`src/app/app.ts`**: Added `activeBottomIndex`, `isBottomBarTab`, `canSlidePrev`, `canSlideNext`, `carouselTrackTransform`, `carouselTrackTransition`, `bottomPillTransform`, `bottomPillTransition`, `slidePrevTab()`, `slideNextTab()`, touch/swipe gesture handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd`), and keyboard Left/Right arrow navigation.
- **`src/app/app.html`**: Upgraded the bottom navigation bar with a smoothly gliding active pill indicator and left/right slide buttons, and wrapped the 5 bottom-bar views (`dashboard`, `messages`, `seeds`, `journal`, `analytics`) inside a hardware-accelerated horizontal left/right sliding track (`translate3d`).
- **`README.md`**: Documented the backend-driven bottom menu bar left/right sliding architecture and added GitHub commit briefs for each modified file.
