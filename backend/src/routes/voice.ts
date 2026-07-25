import { Router } from 'express';

import {
    buildParseResponse,
    enrichParsedCommand,
    parseVoiceTranscript,
    parseWithOpenAI,
    readTranscript,
    sanitizeParseContext,
} from '../lib/voiceParser.js';
import { FAST_PATH_CONFIDENCE } from '../lib/voicePlausibility.js';

export const voiceRouter = Router();

voiceRouter.post('/parse', async (req, res) => {
  try {
    const body = req.body as { transcript?: unknown; context?: unknown };
    const read = readTranscript(body.transcript);
    if ('error' in read) {
      res.status(400).json({ message: read.error });
      return;
    }

    const ctx = sanitizeParseContext(body.context);
    const local = parseVoiceTranscript(read.transcript, ctx);
    const enrichedLocal = local ? enrichParsedCommand(local, ctx) : null;

    // Only spend an LLM call when the local parse is genuinely unsure.
    if (enrichedLocal && (enrichedLocal.confidence ?? 0) >= FAST_PATH_CONFIDENCE) {
      res.json(buildParseResponse(enrichedLocal, ctx));
      return;
    }

    const remote = await parseWithOpenAI(read.transcript, ctx);
    const parsed = remote ?? enrichedLocal;
    if (!parsed) {
      res.status(422).json({ message: 'Could not parse transcript' });
      return;
    }

    res.json(buildParseResponse(enrichParsedCommand(parsed, ctx), ctx));
  } catch (error) {
    // Provider and internal detail stays server-side; the caller gets a generic failure.
    console.error('[voice/parse] failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ message: 'Parse failed' });
  }
});
