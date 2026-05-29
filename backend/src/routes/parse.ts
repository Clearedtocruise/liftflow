import { Router } from 'express';

export const parseRouter = Router();

/** Scaffold route for OpenAI voice/text parsing — implement in Phase 1 */
parseRouter.post('/', (_req, res) => {
  res.status(501).json({
    message: 'Voice parsing not yet implemented',
    example: {
      exercise: 'Bench Press',
      weight: 225,
      reps: 5,
      set: 1,
      type: 'normal',
    },
  });
});
