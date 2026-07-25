import { Router } from 'express';

import {
  getLatestTransformationProjection,
  listTransformationProjections,
  runTransformationProjection,
} from '../lib/transformationEngine.js';
import { getOpenAI, hasOpenAI } from '../lib/openai.js';
import { requireAdmin } from '../lib/supabase.js';
import { authedUserId } from '../middleware/authUser.js';
import { requireProSubscription } from '../middleware/requireProSubscription.js';

export const bodyRouter = Router();

bodyRouter.post('/estimate-body-fat', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { photoUrl, photoId } = req.body as {
      photoUrl?: string;
      photoId?: string;
    };

    if (!photoUrl) {
      res.status(400).json({ message: 'photoUrl is required' });
      return;
    }

    if (hasOpenAI()) {
      const openai = getOpenAI()!;
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'Estimate body fat percentage from a physique photo. Respond JSON only: { "bodyFatPct": number, "analysis": string }. This is a rough visual estimate, not medical advice.',
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Estimate body fat percentage.' },
              { type: 'image_url', image_url: { url: photoUrl } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      });

      const result = JSON.parse(completion.choices[0]?.message?.content ?? '{}');

      if (result.bodyFatPct) {
        const db = requireAdmin();
        await db.from('profiles').update({ body_fat_pct: result.bodyFatPct }).eq('id', userId);
        if (photoId) {
          await db
            .from('progress_photos')
            .update({ metadata: { bodyFatEstimate: result.bodyFatPct } })
            .eq('id', photoId)
            .eq('user_id', userId);
        }
      }

      res.json(result);
      return;
    }

    res.json({
      bodyFatPct: 18,
      analysis: 'Visual estimation requires OPENAI_API_KEY. Using baseline estimate for demo.',
    });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Estimation failed' });
  }
});

bodyRouter.post('/projection', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { photoId, targetBodyFatPct } = req.body as {
      photoId?: string;
      targetBodyFatPct?: number;
    };

    if (!photoId || targetBodyFatPct === undefined) {
      res.status(400).json({ message: 'photoId and targetBodyFatPct are required' });
      return;
    }

    const db = requireAdmin();
    const { data: photo } = await db
      .from('progress_photos')
      .select('photo_url')
      .eq('id', photoId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!photo) {
      res.status(404).json({ message: 'Photo not found' });
      return;
    }

    let projectedImageUrl: string | undefined;
    let modelVersion = 'heuristic-v1';

    if (hasOpenAI()) {
      const openai = getOpenAI()!;

      const analysis = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Analyze physique and describe visual changes at ${targetBodyFatPct}% body fat. JSON: { "description": string, "currentEstimate": number }`,
          },
          {
            role: 'user',
            content: [
              { type: 'text', text: `Project to ${targetBodyFatPct}% body fat.` },
              { type: 'image_url', image_url: { url: photo.photo_url } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(analysis.choices[0]?.message?.content ?? '{}');
      modelVersion = 'gpt-4o-mini-vision';

      try {
        const image = await openai.images.generate({
          model: 'dall-e-3',
          prompt: `Fitness physique reference: athletic build at ${targetBodyFatPct}% body fat, front view, gym lighting, realistic. ${parsed.description ?? ''}`,
          size: '1024x1024',
          n: 1,
        });
        projectedImageUrl = image.data?.[0]?.url;
        modelVersion = 'dall-e-3';
      } catch {
        projectedImageUrl = photo.photo_url;
      }

      res.json({
        projectedImageUrl,
        targetBodyFatPct,
        analysis: parsed.description,
        currentEstimate: parsed.currentEstimate,
        modelVersion,
      });
      return;
    }

    res.json({
      projectedImageUrl: photo.photo_url,
      targetBodyFatPct,
      analysis: `Projected appearance at ${targetBodyFatPct}% body fat. Enable OPENAI_API_KEY for AI-generated projections.`,
      modelVersion,
    });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Projection failed' });
  }
});

bodyRouter.post('/transformation/run', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    const { targetBodyFatPct, beforePhotoId, currentPhotoId } = req.body as {
      targetBodyFatPct?: number;
      beforePhotoId?: string;
      currentPhotoId?: string;
    };

    if (targetBodyFatPct === undefined) {
      res.status(400).json({ message: 'targetBodyFatPct is required' });
      return;
    }

    const result = await runTransformationProjection(userId, targetBodyFatPct, {
      beforePhotoId,
      currentPhotoId,
    });
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Transformation failed' });
  }
});

bodyRouter.get('/transformation/latest', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    const latest = await getLatestTransformationProjection(userId);
    res.json(latest);
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Fetch failed' });
  }
});

bodyRouter.get('/transformation/history', requireProSubscription, async (req, res) => {
  try {
    const userId = authedUserId(req);
    const limit = Number(req.query.limit ?? 10);
    const history = await listTransformationProjections(userId, limit);
    res.json({ projections: history });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'History failed' });
  }
});
