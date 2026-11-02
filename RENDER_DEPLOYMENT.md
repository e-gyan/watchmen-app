# Deploying Watchman to Render.com

This guide provides step-by-step instructions to bundle and deploy the **Watchman: Prayer & Testimony Altar** application to **Render.com** as a high-performance Web Service.

---

## 1. Architecture Overview

Watchman is built with **Angular 21 + Express (SSR Hybrid)**:
* **Client**: Bundled with Vite/esbuild into `dist/app/browser/`.
* **Server**: Express SSR server bundled into `dist/app/server/server.mjs`.
* **Database & Auth**: Google Cloud Firestore & Firebase Auth (Google Sign-In).
* **AI Assist**: Gemini API via `/api/prayer-assist` Express endpoint.

When Render runs `node dist/app/server/server.mjs`, the Express server automatically:
1. Listens on `process.env.PORT` provided by Render.
2. Serves client static assets with high-performance caching.
3. Renders the Angular application.
4. Handles the `/api/prayer-assist` endpoints.

---

## 2. Step-by-Step Render Deployment

### Step 1: Push Repository to GitHub or GitLab
Ensure your project is committed and pushed to a repository on GitHub or GitLab:
```bash
git add .
git commit -m "feat: prayer bundles, multi-category selection and render config"
git push origin main
```

### Step 2: Create a Web Service on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com/).
2. Click **New +** and select **Web Service**.
3. Connect your repository containing Watchman.
4. Configure the service settings:

| Setting | Value |
| :--- | :--- |
| **Name** | `watchman-prayer-altar` (or your preferred name) |
| **Region** | Choose closest to your users (e.g. Frankfurt, Oregon, Ohio) |
| **Branch** | `main` |
| **Root Directory** | *(Leave blank or `.`)* |
| **Runtime** | **Node** |
| **Build Command** | `npm install && npm run build` |
| **Start Command** | `node dist/app/server/server.mjs` |
| **Instance Type** | **Free** (or Starter for persistent zero-sleep uptime) |

### Step 3: Configure Environment Variables on Render
In the **Environment Variables** section of your Render Web Service, add:

1. `NODE_VERSION`: `20.18.0` (or `22.x`)
2. `NODE_ENV`: `production`
3. `GEMINI_API_KEY`: *(Optional)* Your Gemini API key for biblical scripture suggestions and encouragement messages.
4. `APP_URL`: Your Render service URL (e.g. `https://watchman-prayer-altar.onrender.com`).

*(Note: The Firebase client configuration is automatically read from `firebase-applet-config.json` bundled in the app).*

### Step 4: Add Render Domain to Firebase Authorized Domains
To ensure Google Sign-In works in production on your Render URL:
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project (`ai-studio-watchmanpartnerp-b1d9f6b3-b013-4cf4-8aa4-3a46c4babb4a` / `gen-lang-client-0412977179`).
3. Navigate to **Authentication** > **Settings** tab.
4. Under **Authorized domains**, click **Add domain**.
5. Enter your Render domain: e.g. `watchman-prayer-altar.onrender.com` (and your custom domain if you attach one).

---

## 3. Alternative: Infrastructure as Code (`render.yaml`)

You can also deploy with Render Blueprint using this `render.yaml` specification in the repository root:

```yaml
services:
  - type: web
    name: watchman-prayer-altar
    env: node
    plan: free
    buildCommand: npm install && npm run build
    startCommand: node dist/app/server/server.mjs
    envVars:
      - key: NODE_VERSION
        value: 20.18.0
      - key: NODE_ENV
        value: production
      - key: GEMINI_API_KEY
        sync: false
```

---

## 4. Local Production Verification

To test the exact production bundle locally before pushing:

```bash
# 1. Build the production client & server bundles
npm run build

# 2. Run the production Node Express server
node dist/app/server/server.mjs
```
The server will boot on `http://localhost:4000` (or `PORT`), providing identical behavior to Render.
