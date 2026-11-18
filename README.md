# Watchman Prayer & Accountability Partner App 🙏

A modern, analytical prayer tracking and spiritual accountability platform designed for prayer partners and covenant circles. Enables you and your friends to record daily prayer hours and minutes, track message listening and repeat depth, manage annual seed targets in GHS with live FX conversion, analyze period trends and growth rates, celebrate answered prayers in a Praise Altar, and configure daily notification alert checks.

---

## 🌟 Key Capabilities

- **Backend-Driven Navigation & Seamless Left/Right Sliding Bottom Menu Bar**:
  - Bottom menu bar (`GET /api/menu-config`) surfaces **Dashboard**, **Messages**, **Seeds**, **Journal**, and **Analytics** in ordered `slideOrder` (`0..4`) alongside a server-defined `slideConfig` (`enabled: true`, `swipeThresholdPx: 48`, `durationMs: 360`, `easing: 'cubic-bezier(0.22, 1, 0.36, 1)'`), omitting **Testimonies** and **Covenant** from the bottom bar while retaining them in the slide-over **Sidebar Menu Drawer**.
  - Full-width 5-column mobile grid (`grid-cols-5`) with a synchronized gliding active indicator pill (`translate3d(activeBottomIndex * 100%, 0, 0)`) and directional left/right view sliding (`view-slide-next` / `view-slide-prev`) allow users to slide smoothly left and right across bottom menu options via tap, interactive touch/swipe gestures (`touchstart` / `touchmove` / `touchend`), or keyboard `ArrowLeft` / `ArrowRight` keys while keeping `transform: none` at rest so viewport-fixed pop-ups are never clipped.
- **Smooth Viewport-Centered Pop-Up Modals & Mobile-Fit Button Positioning**:
  - Every action button across **Messages** (`Log Message`, `Edit Message`, `+ Add Time / Repeat`, `Delete Message`), **Seeds** (`Add Target`, `Edit Target`, `Log Seed`, `Delete Target`, `Delete Seed`), **Journal**, **Dashboard**, **Testimonies**, and **Covenant** opens a smooth, viewport-centered pop-up modal (`z-[80] modal-backdrop-in` + `modal-pop-in`, `max-h-[85dvh] overflow-y-auto my-auto`) with backdrop click-to-dismiss, `Escape` key dismissal, and responsive `grid-cols-2 sm:flex` mobile action buttons.
  - All header actions, card buttons, segmented selectors (**Journal** 3x2 mobile grid, **Analytics** 5-column mobile period bar), and bottom navigation items are positioned and sized to fit cleanly on mobile screens (`320px–430px`) without horizontal overflow or crowding.
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
   git commit -m "Ensure smooth pop-up modals and mobile-fit button positioning across all views"
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
- **Frontend**: Angular 21+ (Zoneless, Signals, Reactive Forms, Tailwind CSS v4) with OnPush change detection, directional left/right sliding transitions, touch/swipe gestures, smooth viewport-centered pop-up modals, and 0ms optimistic state hydration.
- **Typography Architecture**: Prose and UI text use **DM Sans** (`--font-sans`) and **Outfit** (`--font-serif`), while all numeric figures, durations, currencies, and metrics strictly preserve **JetBrains Mono** (`--font-mono` / `tabular-nums`) with comma formatting (`1,000.0`, `1,250`).
- **Progressive Web App (PWA) & Notification Alerts**: Compliant with Android Chrome and iOS Safari standalone installation via `/manifest.webmanifest` (`#fffbeb` warm splash background), `/sw.js` Service Worker, `/icon.svg`, and server-rendered Watchman flame badge PNG icons (`/pwa-192x192.png`, `/pwa-512x512.png`, `/pwa-maskable-512x512.png`, `/apple-touch-icon.png`).
- **Backend / SSR (`src/server.ts`)**: Express + `@angular/ssr` providing:
  - `GET /api/menu-config`: Backend-driven navigation schema returning ordered `bottomNavItems`, `sidebarNavItems`, and `slideConfig` (`enabled`, `swipeThresholdPx`, `durationMs`, `easing`, `loop`, `order`).
  - `GET /api/analytics`: Server-side period aggregation and trend computation across prayers, messages, seeds (in GHS), testimonies, and petitions.
  - `GET /api/fx-stream` & `GET /api/fx-rates`: Continuous real-time market currency rate polling + Server-Sent Events for live conversion to **GHS**.
  - `GET /api/cloud-stream` & `POST /api/cloud-sync`: Real-time multi-device/partner state synchronization.
- **Database & Auth**: Dual-persistence architecture combining 0ms synchronous local cache (`localStorage`), real-time Express cloud sync (`/api/cloud-sync`), and Firebase Authentication + Cloud Firestore protected by a daily write-quota circuit breaker, profile write deduplication, and pending-write snapshot merge protection.

### Core Components & Services
- `src/app/app.ts` & `src/app/app.html`: Application shell with slide-over Sidebar Menu Drawer (`sidebarNavItems`, Display Mode controls, and compact App Color Palette), backend-driven 5-column Bottom Menu Bar (`bottomNavItems`) with a smoothly gliding active indicator pill, interactive touch/swipe left-and-right handlers (`onTouchStart`, `onTouchMove`, `onTouchEnd`), keyboard arrow and `Escape` key navigation, transform-clean resting view containers, and mobile zero-overlap responsive layout across Dashboard, Journal, Testimonies, and Covenant views.
- `src/app/services/theme.service.ts`: Manages the 4-mode Display Mode engine (`auto` syncing live with OS `prefers-color-scheme`, `schedule` switching automatically to Light at **6:45 AM** and Dark at **6:45 PM**, plus manual `light` and `dark`) alongside the 9-color App Color Palette (`emerald`, `teal`, `indigo`, `amber`, `rose`, `fuchsia`, `slate`, `cyan`, `sky`), persisting preferences in `localStorage` and updating `data-palette` and `<meta name="theme-color">`.
- `src/app/components/theme-toggle.ts`: Compact 4-column Sidebar Display Mode selector (`Auto`, `6:45`, `Light`, `Dark`) with live active status summary.
- `src/app/components/color-palette-picker.ts`: Standalone 9-color App Color Palette picker (`compact` 3x3 grid in Sidebar, `expanded` grid in Covenant) with accessible contrast states.
- `src/app/components/analytics-tracker.ts`: Dedicated Analytics & Insights view (`<app-analytics-tracker>`) with a 5-column mobile-fit period selector (`7 Days`, `30 Days`, `90 Days`, `1 Year`, `All Time`), mobile-safe KPI cards, scrollable multi-series trend bars, prayer consistency & mode split, message retention & top speakers, and seed target fulfillment in **GHS**.
- `src/app/components/messages-tracker.ts`: Word intake tracker with smooth viewport-fixed pop-up modals for `Log/Edit Message`, `+ Add Time / Repeat`, and `Delete Message Confirmation`, plus non-overlapping mobile card action buttons (`Repeat`, `+ Add Time`, `Edit`, `Delete`).
- `src/app/components/seed-tracker.ts`: Annual Seed Altar tracker in **GHS** with always-accessible `Add Target` and `Log Seed` buttons (`grid-cols-2 sm:flex`), smooth pop-up modals for `New/Edit Seed Target`, `Log Seed Given`, `Delete Seed Target Confirmation`, and `Delete Seed Record Confirmation`, and live FX conversion.
- `src/app/components/log-session-modal.ts`, `src/app/components/testimony-modal.ts`, `src/app/components/target-modal.ts`, `src/app/components/request-modal.ts`, `src/app/components/create-circle-modal.ts`, `src/app/components/add-partner-modal.ts`, & `src/app/components/auth-modal.ts`: Viewport-centered pop-up modals (`z-[80] modal-backdrop-in` + `modal-pop-in`, `max-h-[85dvh] overflow-y-auto my-auto`) with backdrop click-to-close, `Escape` key support, and `grid-cols-2 sm:flex` mobile footer buttons.
- `src/app/components/streak.ts`: Dashboard Streak component displaying the current week's Mon–Sat praying days (`Week: X/6`, resetting cleanly each new Monday), active Mon–Sat consecutive streak accounting across Sunday rest days, longest Mon–Sat streak, and tap-to-log day badges.
- `src/app/services/firebase.service.ts`: Manages backend menu & slide configuration (`bottomNavItems`, `sidebarNavItems`, `slideConfig`), custom user categories (`userCategories`, `addCustomCategory`, `removeCustomCategory`), daily alert settings (`alertSettings`, `updateAlertSettings`, `todayMessageMinutes`), 0ms optimistic CRUD with Firestore daily quota circuit breaker & pending-write merge protection, and live FX conversion.
- `src/app/services/pwa.service.ts`: Manages Service Worker registration, install prompt capture, and browser/PWA notification dispatch.

---

## 📦 GitHub File Change Summary (Commit Briefs)

- **`src/app/services/theme.service.ts`**: Implemented 9-color `AppColorPalette` state (`emerald`, `teal`, `indigo`, `amber`, `rose`, `fuchsia`, `slate`, `cyan`, `sky`), automated **6:45 AM Light / 6:45 PM Dark** (`schedule`) timer + focus sync, OS `prefers-color-scheme` live listener (`auto`), `localStorage` persistence, `data-palette` root attribute binding, and dynamic `<meta name="theme-color">` updates.
- **`src/app/components/color-palette-picker.ts`**: Created reusable standalone `<app-color-palette-picker>` component supporting `compact` (Sidebar) and `expanded` (Covenant) grid layouts with all 9 color swatches and `aria-pressed` states.
- **`src/app/components/theme-toggle.ts`**: Updated Sidebar Display Mode control to a non-overlapping 4-column segmented selector (`Auto`, `6:45`, `Light`, `Dark`) with live status label.
- **`src/styles.css`**: Added `html[data-palette="..."]` CSS custom properties (`--palette-200` to `--palette-800`, `--palette-on-solid`), remapped Tailwind v4 theme accent tokens so all accent surfaces, charts, borders, and active controls follow the chosen palette, blended Light and Dark mode canvas surfaces with the selected palette via `color-mix`, and guaranteed legible contrast on solid CTA buttons.
- **`src/index.html`**: Updated pre-hydration script to apply persisted `watchman_color_palette` (`data-palette`) and `watchman_theme_pref` (`auto` OS preference, `schedule` 6:45 AM/PM, `light`, `dark`) before first paint.
- **`src/app/app.ts`**: Imported and registered `ColorPalettePicker` in the root `App` component.
- **`src/app/app.html`**: Added Sidebar Display Mode & compact App Color Palette sections, added the expanded App Color Palette card to the Covenant tab, and eliminated mobile element/text overlaps across Sidebar controls, Dashboard analytical pacing & chart strips, Journal entry action rows, Covenant partner emails, Petitions headers, and floating toast/offline banners.
- **`src/app/components/analytics-tracker.ts`**: Prevented mobile KPI text wrapping collisions and made the 12-point Trend Chart horizontally scrollable (`overflow-x-auto`) on narrow screens so multi-row bars never collide vertically.
- **`src/app/components/messages-tracker.ts`**: Added `min-w-0` truncation and `shrink-0` icons to `Repeat` and `+ Add Time` card buttons to prevent mobile label clipping/overlap.
- **`angular.json`**: Disabled development source map generation (`sourceMap: false` under `configurations.development`) to reduce dev server memory footprint and accelerate `ng serve` startup on port `3000`.
- **`src/app/components/streak.ts`**: Switched the circular streak strip to show only the current week's praying days (**Mon–Sat**), automatically resetting to the new week every Monday, distinguishing past `Missed` days from `Next` upcoming days, displaying `Week: X/6`, and calculating `longestStreak` and `activeStreakDates` across Sunday rest days.
- **`src/app/services/firebase.service.ts`**: Updated `streakDays` calculation to account exclusively for Mon–Sat scheduled prayer days (skipping Sunday rest days seamlessly without breaking streaks), added `isPrayerWeekDay`, `isPrayerWeekDayStr`, `stepBackPrayerDay`, and `getCurrentPrayerWeekDates` helpers, alongside the existing Firestore daily write-quota circuit breaker and sync protection.
- **`README.md`**: Updated Streak component architecture and GitHub commit briefs covering the Mon–Sat weekly streak schedule and new-week accounting.

