import { Router } from 'express';

import { parseVoiceTranscript, parseWithOpenAI } from '../lib/voiceParser.js';

export const voiceRouter = Router();

voiceRouter.post('/parse', async (req, res) => {
  try {
    const { transcript } = req.body as { transcript?: string };
    if (!transcript?.trim()) {
      res.status(400).json({ message: 'transcript is required' });
      return;
    }

    const parsed = (await parseWithOpenAI(transcript)) ?? parseVoiceTranscript(transcript);
    if (!parsed) {
      res.status(422).json({ message: 'Could not parse transcript' });
      return;
    }

    res.json({
      parsed,
      confidence: parsed.confidence ?? 0.85,
      requiresConfirmation: (parsed.confidence ?? 0) < 0.75,
      confirmationReason: (parsed.confidence ?? 0) < 0.75 ? 'Please confirm parsed values' : undefined,
    });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Parse failed' });
  }
});
