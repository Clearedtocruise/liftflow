import { Router } from 'express';

import {
    buildParseResponse,
    enrichParsedCommand,
    parseVoiceTranscript,
    parseWithOpenAI,
    type VoiceParseContext,
} from '../lib/voiceParser.js';

export const voiceRouter = Router();

voiceRouter.post('/parse', async (req, res) => {
  try {
    const { transcript, context } = req.body as {
      transcript?: string;
      context?: VoiceParseContext;
    };
    if (!transcript?.trim()) {
      res.status(400).json({ message: 'transcript is required' });
      return;
    }

    const ctx: VoiceParseContext = context ?? {};
    const local = parseVoiceTranscript(transcript, ctx);
    const enrichedLocal = local ? enrichParsedCommand(local, ctx) : null;

    if (enrichedLocal && (enrichedLocal.confidence ?? 0) >= 0.88) {
      res.json(buildParseResponse(enrichedLocal, ctx));
      return;
    }

    let parsed = enrichedLocal;
    if (!parsed || (parsed.confidence ?? 0) < 0.88) {
      const remote = await parseWithOpenAI(transcript, ctx);
      const fallback = remote ?? parsed ?? parseVoiceTranscript(transcript, ctx);
      if (!fallback) {
        res.status(422).json({ message: 'Could not parse transcript' });
        return;
      }
      parsed = enrichParsedCommand(fallback, ctx);
    }

    if (!parsed) {
      res.status(422).json({ message: 'Could not parse transcript' });
      return;
    }

    res.json(buildParseResponse(parsed, ctx));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Parse failed' });
  }
});
