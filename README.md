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

### Step 4: Authorize Render Domain in Firebase Authentication
To allow users to sign in with Google from your live Render app:
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: `gen-lang-client-0412977179` (or custom project).
3. Navigate to **Authentication** > **Settings** > **Authorized domains**.
4. Click **Add domain**.
5. Paste your Render service URL (e.g., `watchman-prayer-partner.onrender.com` — without `https://`).
6. Click **Save**.

---

### Step 5: Deploy & Verify
1. Click **Create Web Service** on Render.
2. Render will run:
   - `npm install`
   - `npm run build`
   - `npm start`
3. Once the build finishes and the health check responds with `200 OK`, click on your live Render URL.
4. Test:
   - Google Sign-in.
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

## 📜 NPM Scripts Reference

- `npm run dev`: Runs the Angular development server on port 3000.
- `npm run build`: Compiles both client browser bundle and server SSR bundle into `dist/app`.
- `npm start`: Starts the production Node.js SSR server (`node dist/app/server/server.mjs`).
- `npm run lint`: Runs ESLint type and syntax checks.
- `npm test`: Runs Vitest test suite.

---

## 📄 License
MIT License. Created for prayer circles and intercessory teams.
