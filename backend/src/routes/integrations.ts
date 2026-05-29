import { Router } from 'express';
import { notImplemented } from '../middleware/placeholder.js';

export const integrationsRouter = Router();

integrationsRouter.get('/', (req, res) => notImplemented(req, res, 'List integrations'));
integrationsRouter.post('/:provider/connect', (req, res) => notImplemented(req, res, 'Connect integration'));
integrationsRouter.post('/:provider/disconnect', (req, res) => notImplemented(req, res, 'Disconnect integration'));
integrationsRouter.post('/healthkit/sync', (req, res) => notImplemented(req, res, 'HealthKit sync'));
integrationsRouter.post('/watch/sync', (req, res) => notImplemented(req, res, 'Watch sync'));
integrationsRouter.post('/motion/analyze', (req, res) => notImplemented(req, res, 'Motion analysis'));
integrationsRouter.post('/reps/detect', (req, res) => notImplemented(req, res, 'Rep detection'));
integrationsRouter.post('/exercise/recognize', (req, res) => notImplemented(req, res, 'Exercise recognition'));
