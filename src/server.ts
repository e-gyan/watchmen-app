import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());

const dataDir = join(process.cwd(), '.data');
const storeFile = join(dataDir, 'watchman-cloud-store.json');

interface CloudStoreData {
  partnerships: Record<string, unknown>[];
  sessions: Record<string, Record<string, unknown>[]>;
  testimonies: Record<string, Record<string, unknown>[]>;
  requests: Record<string, Record<string, unknown>[]>;
  messages: Record<string, Record<string, unknown>[]>;
  authorities: Record<string, Record<string, unknown>[]>;
  seeds: Record<string, Record<string, unknown>[]>;
}

function loadCloudStore(): CloudStoreData {
  try {
    if (existsSync(storeFile)) {
      const raw = readFileSync(storeFile, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<CloudStoreData>;
      return {
        partnerships: parsed.partnerships || [],
        sessions: parsed.sessions || {},
        testimonies: parsed.testimonies || {},
        requests: parsed.requests || {},
        messages: parsed.messages || {},
        authorities: parsed.authorities || {},
        seeds: parsed.seeds || {},
      };
    }
  } catch {
    // ignore read error
  }
  return {
    partnerships: [],
    sessions: {},
    testimonies: {},
    requests: {},
    messages: {},
    authorities: {},
    seeds: {},
  };
}

function saveCloudStore(data: CloudStoreData): void {
  try {
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }
    writeFileSync(storeFile, JSON.stringify(data, null, 2), 'utf-8');
  } catch {
    // ignore write error on read-only fs
  }
}

const memoryStore: CloudStoreData = loadCloudStore();

/**
 * Production Security Headers: Prevent clickjacking, MIME sniffing, and referrer leaks
 * while allowing Google OAuth popup windows to communicate back via window.opener.
 */
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

/**
 * Health check endpoint for Render/Cloud health monitoring
 */
app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

/**
 * Real-Time Market FX Rates Listener to GHS (Ghanaian Cedi)
 * Continuously syncs with live market exchange rate feeds and streams updates via SSE (/api/fx-stream).
 */
const DEFAULT_TO_GHS: Record<string, number> = {
  GHS: 1,
  USD: 15.8,
  GBP: 20.1,
  EUR: 17.1,
  NGN: 0.01,
};

interface FxSnapshot {
  toGhs: Record<string, number>;
  updatedAt: string;
  source: 'live' | 'fallback';
  fetchedAtMs: number;
}

let cachedFx: FxSnapshot = {
  toGhs: { ...DEFAULT_TO_GHS },
  updatedAt: new Date().toISOString(),
  source: 'fallback',
  fetchedAtMs: 0,
};

const fxSseClients = new Set<express.Response>();
const cloudSseClients = new Set<express.Response>();

function broadcastFxUpdate(snapshot: FxSnapshot): void {
  const payload = `data: ${JSON.stringify(snapshot)}\n\n`;
  for (const client of fxSseClients) {
    try {
      client.write(payload);
    } catch {
      fxSseClients.delete(client);
    }
  }
}

function broadcastCloudUpdate(eventData: Record<string, unknown>): void {
  const payload = `data: ${JSON.stringify(eventData)}\n\n`;
  for (const client of cloudSseClients) {
    try {
      client.write(payload);
    } catch {
      cloudSseClients.delete(client);
    }
  }
}

async function fetchLatestMarketFxRates(): Promise<FxSnapshot> {
  const now = Date.now();
  const endpoints = [
    'https://open.er-api.com/v6/latest/GHS',
    'https://api.exchangerate-api.com/v4/latest/GHS',
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' },
      });
      clearTimeout(timeout);

      if (response.ok) {
        const data = (await response.json()) as {
          rates?: Record<string, number>;
          time_last_update_utc?: string;
          date?: string;
        };
        if (data.rates) {
          const toGhs: Record<string, number> = { ...DEFAULT_TO_GHS, GHS: 1 };
          for (const [code, rateFromGhs] of Object.entries(data.rates)) {
            if (typeof rateFromGhs === 'number' && rateFromGhs > 0) {
              toGhs[code] = Number((1 / rateFromGhs).toFixed(4));
            }
          }
          const nextSnapshot: FxSnapshot = {
            toGhs,
            updatedAt: new Date().toISOString(),
            source: 'live',
            fetchedAtMs: now,
          };
          const prevJson = JSON.stringify(cachedFx.toGhs);
          const nextJson = JSON.stringify(nextSnapshot.toGhs);
          const changed = prevJson !== nextJson || cachedFx.source !== 'live';
          cachedFx = nextSnapshot;
          if (changed) {
            broadcastFxUpdate(cachedFx);
          }
          return cachedFx;
        }
      }
    } catch {
      // Try next market FX provider
    }
  }

  return cachedFx;
}

// Start background real-time market FX listener (syncs immediately and every 30s)
fetchLatestMarketFxRates().catch(() => undefined);
const fxInterval = setInterval(() => {
  fetchLatestMarketFxRates().catch(() => undefined);
}, 30 * 1000);
if (typeof fxInterval.unref === 'function') {
  fxInterval.unref();
}

app.get('/api/fx-rates', async (req, res) => {
  const force = req.query['force'] === '1' || req.query['force'] === 'true';
  const now = Date.now();
  if (force || cachedFx.source !== 'live' || now - cachedFx.fetchedAtMs > 15 * 1000) {
    await fetchLatestMarketFxRates();
  }
  return res.json(cachedFx);
});

/**
 * Real-Time SSE Stream for Market Currency Rates (/api/fx-stream)
 */
app.get('/api/fx-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // Send immediate snapshot on connect (0ms)
  res.write(`data: ${JSON.stringify(cachedFx)}\n\n`);
  fxSseClients.add(res);

  // Trigger a fresh market check in background
  fetchLatestMarketFxRates().catch(() => undefined);

  req.on('close', () => {
    fxSseClients.delete(res);
  });
});

/**
 * Real-Time SSE Stream for Database Cloud Sync (/api/cloud-stream)
 */
app.get('/api/cloud-stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);
  cloudSseClients.add(res);

  req.on('close', () => {
    cloudSseClients.delete(res);
  });
});

/**
 * Cloud Sync Endpoint (allows instant 0ms read/write sync across Firebase & Express persistent store)
 */
app.get('/api/cloud-sync', (req, res) => {
  const email = String(req.query['email'] || '').toLowerCase().trim();
  const partnershipId = String(req.query['partnershipId'] || '').trim();

  const userPartnerships = email
    ? memoryStore.partnerships.filter((p) => {
        const emails = Array.isArray(p['memberEmails']) ? (p['memberEmails'] as string[]) : [];
        return emails.map((e) => e.toLowerCase()).includes(email);
      })
    : memoryStore.partnerships;

  const targetPid =
    partnershipId ||
    (userPartnerships.length > 0 ? String(userPartnerships[0]['id'] || '') : '');

  if (targetPid) {
    return res.json({
      activePartnershipId: targetPid,
      partnerships: userPartnerships,
      sessions: memoryStore.sessions[targetPid] || [],
      testimonies: memoryStore.testimonies[targetPid] || [],
      requests: memoryStore.requests[targetPid] || [],
      messages: memoryStore.messages[targetPid] || [],
      authorities: memoryStore.authorities[targetPid] || [],
      seeds: memoryStore.seeds[targetPid] || [],
    });
  }

  return res.json({ partnerships: userPartnerships });
});

app.post('/api/cloud-sync', (req, res) => {
  const { type, action, partnershipId, item } = req.body || {};

  if (type === 'partnership' && item && item.id) {
    const idx = memoryStore.partnerships.findIndex((p) => p['id'] === item.id);
    if (action === 'delete') {
      if (idx >= 0) memoryStore.partnerships.splice(idx, 1);
    } else if (idx >= 0) {
      memoryStore.partnerships[idx] = { ...memoryStore.partnerships[idx], ...item };
    } else {
      memoryStore.partnerships.push(item);
    }
    saveCloudStore(memoryStore);
    broadcastCloudUpdate({ type, action, partnershipId: item.id, timestamp: Date.now() });
    return res.json({ ok: true });
  }

  const validTypes = ['sessions', 'testimonies', 'requests', 'messages', 'authorities', 'seeds'] as const;
  type SubColType = (typeof validTypes)[number];

  if (partnershipId && validTypes.includes(type as SubColType) && item && item.id) {
    const collectionMap = memoryStore[type as SubColType];
    if (!collectionMap[partnershipId]) {
      collectionMap[partnershipId] = [];
    }
    const list = collectionMap[partnershipId];
    const idx = list.findIndex((x) => x['id'] === item.id);

    if (action === 'delete') {
      if (idx >= 0) list.splice(idx, 1);
      // Cascade delete all seed amounts recorded under this authority target
      if (type === 'authorities' && memoryStore.seeds[partnershipId]) {
        memoryStore.seeds[partnershipId] = memoryStore.seeds[partnershipId].filter(
          (seed) => seed['authorityId'] !== item.id
        );
      }
    } else if (idx >= 0) {
      list[idx] = { ...list[idx], ...item };
    } else {
      list.push(item);
    }
    saveCloudStore(memoryStore);
    broadcastCloudUpdate({ type, action, partnershipId, itemId: item.id, timestamp: Date.now() });
    return res.json({ ok: true });
  }

  return res.status(400).json({ ok: false, error: 'Invalid sync payload' });
});



/**
 * Express Rest API endpoints
 */
app.post('/api/prayer-assist', async (req, res) => {
  try {
    const { action, topic, partner1Name, partner2Name, weeklyHours, yearlyProgress, targetHours, answeredCount } = req.body || {};
    const apiKey = process.env['GEMINI_API_KEY'];

    if (!apiKey) {
      // High-quality contextual fallback
      if (action === 'scriptures') {
        const fallbacks: Record<string, { scripture: string; text: string; prayerPoint: string }[]> = {
          default: [
            {
              scripture: 'Philippians 4:6-7',
              text: 'Do not be anxious about anything, but in every situation, by prayer and petition, with thanksgiving, present your requests to God.',
              prayerPoint: 'Anchor your heart in thanksgiving before lifting burdens, resting in transcendent peace.'
            },
            {
              scripture: '1 Thessalonians 5:16-18',
              text: 'Rejoice always, pray continually, give thanks in all circumstances; for this is God’s will for you in Christ Jesus.',
              prayerPoint: 'Cultivate constant communion throughout the daily watches with your partner.'
            },
            {
              scripture: 'James 5:16',
              text: 'The prayer of a righteous person is powerful and effective.',
              prayerPoint: 'Stand in agreement with your prayer partner, believing for tangible breakthroughs.'
            }
          ]
        };
        return res.json({
          success: true,
          data: {
            title: topic ? `Scripture & Prayer Points for "${topic}"` : 'Anchoring Scriptures for Prayer',
            recommendations: fallbacks['default']
          }
        });
      }

      // Default encouragement message
      return res.json({
        success: true,
        data: {
          message: `Grace and peace, ${partner1Name || 'Partner'} & ${partner2Name || 'Friend'}! You logged ${weeklyHours || 'strong'} hours of prayer this week and reached ${yearlyProgress || 'great progress'} towards your ${targetHours || '100'}-hour yearly covenant. With ${answeredCount || 0} testimonies recorded, remember: 'Where two or three gather in my name, there am I with them.' Keep pressing in!`
        }
      });
    }

    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });

    if (action === 'scriptures') {
      const prompt = `You are a wise and uplifting Christian prayer counselor.
The user is entering a prayer session focused on: "${topic || 'General Intercession and Thanksgiving'}".
Provide 3 relevant biblical scripture passages (Book Chapter:Verse, exact quote, and a 1-sentence specific prayer focus).
Respond in valid JSON format:
{
  "title": "Scriptures for ${topic || 'Prayer'}",
  "recommendations": [
    {
      "scripture": "Book Chapter:Verse",
      "text": "Scripture verse text",
      "prayerPoint": "1-sentence focused prayer directive"
    }
  ]
}`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      const parsed = JSON.parse(response.text || '{}');
      return res.json({ success: true, data: parsed });
    } else {
      const prompt = `Write a short, heart-stirring 3-4 sentence accountability encouragement message from one prayer partner to another.
Partners: ${partner1Name || 'Emmanuel'} and ${partner2Name || 'David'}.
Weekly hours logged together: ${weeklyHours || '5.5 hours'}.
Yearly milestone goal: ${targetHours || '100'} hours (current progress: ${yearlyProgress || '42%'}).
Answered prayers/testimonies celebrated so far: ${answeredCount || 2}.
Keep it spiritually uplifting, referencing perseverance and the power of partner agreement.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      return res.json({
        success: true,
        data: { message: response.text?.trim() }
      });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    return res.json({
      success: true,
      data: {
        message: 'Stand firm and pray without ceasing. Your shared commitment in prayer builds an eternal foundation.'
      },
      warning: errorMsg
    });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, (error) => {
    if (error) {
      throw error;
    }

    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
