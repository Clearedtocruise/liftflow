import { Router } from 'express';

import {
    buildParseResponse,
    enrichParsedCommand,
    parseVoiceTranscript,
    readTranscript,
    sanitizeParseContext,
} from '../lib/voiceParser.js';

/** Legacy /api/parse — forwards to voice parser */
export const parseRouter = Router();

parseRouter.post('/', async (req, res) => {
  try {
    const body = req.body as { transcript?: unknown; text?: unknown; context?: unknown };
    const read = readTranscript(typeof body.transcript === 'string' ? body.transcript : body.text);
    if ('error' in read) {
      res.status(400).json({ message: read.error.replace('transcript', 'transcript or text') });
      return;
    }

    const ctx = sanitizeParseContext(body.context);
    const local = parseVoiceTranscript(read.transcript, ctx);
    const parsed = local ? enrichParsedCommand(local, ctx) : null;

    if (!parsed) {
      res.status(422).json({ message: 'Could not parse transcript' });
      return;
    }

    res.json(buildParseResponse(parsed, ctx));
  } catch (error) {
    console.error('[api/parse] failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ message: 'Parse failed' });
  }
});
