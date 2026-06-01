import { Router } from 'express';

import {
    buildParseResponse,
    enrichParsedCommand,
    parseVoiceTranscript,
    type VoiceParseContext,
} from '../lib/voiceParser.js';

/** Legacy /api/parse — forwards to voice parser */
export const parseRouter = Router();

parseRouter.post('/', async (req, res) => {
  try {
    const { transcript, text, context } = req.body as {
      transcript?: string;
      text?: string;
      context?: VoiceParseContext;
    };
    const input = (transcript ?? text)?.trim();
    if (!input) {
      res.status(400).json({ message: 'transcript or text is required' });
      return;
    }

    const ctx: VoiceParseContext = context ?? {};
    const local = parseVoiceTranscript(input, ctx);
    const parsed = local ? enrichParsedCommand(local, ctx) : null;

    if (!parsed) {
      res.status(422).json({ message: 'Could not parse transcript' });
      return;
    }

    res.json(buildParseResponse(parsed, ctx));
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Parse failed' });
  }
});
