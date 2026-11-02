import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();

app.use(express.json());

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
