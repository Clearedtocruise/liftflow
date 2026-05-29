import { Router, type Request, type Response } from 'express';

/** Standard 501 placeholder for scaffolded API routes */
export function notImplemented(_req: Request, res: Response, feature: string) {
  res.status(501).json({
    error: 'NOT_IMPLEMENTED',
    message: `${feature} API is scaffolded but not yet implemented.`,
    documentation: 'See docs/ARCHITECTURE.md for planned endpoints.',
  });
}

export function createPlaceholderRouter(feature: string): Router {
  const router = Router();
  router.all('*', (req, res) => notImplemented(req, res, feature));
  return router;
}
