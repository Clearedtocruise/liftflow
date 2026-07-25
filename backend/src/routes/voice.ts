import express, { Router, type NextFunction, type Request, type Response } from 'express';

import {
    buildParseResponse,
    enrichParsedCommand,
    parseVoiceTranscript,
    parseWithOpenAI,
    readTranscript,
    sanitizeParseContext,
} from '../lib/voiceParser.js';
import { FAST_PATH_CONFIDENCE } from '../lib/voicePlausibility.js';
import { MAX_AUDIO_BYTES, transcribeAudio } from '../lib/voiceTranscription.js';

export const voiceRouter = Router();

/**
 * Audio arrives as a raw body rather than multipart: the app already has the bytes in memory
 * after reading the recording, and this avoids both a multipart dependency and the 33% inflation
 * of base64. The global express.json only claims application/json, so it passes this through.
 */
const rawAudioBody = express.raw({ type: () => true, limit: MAX_AUDIO_BYTES });

/** body-parser rejects an oversized body by throwing, which would surface as an opaque 500. */
function readAudioBody(req: Request, res: Response, next: NextFunction) {
  rawAudioBody(req, res, (error?: unknown) => {
    if (error) {
      res.status(413).json({ message: 'That recording is too long. Try a shorter phrase.' });
      return;
    }
    next();
  });
}

voiceRouter.post('/transcribe', readAudioBody, async (req, res) => {
  try {
    const body = req.body;
    const audio = Buffer.isBuffer(body) ? body : undefined;
    const result = await transcribeAudio(audio, req.headers['content-type']);

    if (!result.ok) {
      res.status(result.status).json({ message: result.message });
      return;
    }

    res.json({ transcript: result.transcript });
  } catch (error) {
    console.error('[voice/transcribe] failed:', error instanceof Error ? error.message : error);
    res.status(500).json({ message: 'Transcription failed' });
  }
});

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
