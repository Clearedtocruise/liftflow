import { Router } from 'express';
import { notImplemented } from '../middleware/placeholder.js';

export const subscriptionsRouter = Router();

subscriptionsRouter.get('/', (req, res) => notImplemented(req, res, 'Get subscription'));
subscriptionsRouter.post('/upgrade', (req, res) => notImplemented(req, res, 'Upgrade subscription'));
subscriptionsRouter.post('/cancel', (req, res) => notImplemented(req, res, 'Cancel subscription'));
subscriptionsRouter.post('/restore', (req, res) => notImplemented(req, res, 'Restore purchases'));

export const adsRouter = Router();
adsRouter.post('/impression', (req, res) => notImplemented(req, res, 'Record ad impression'));
adsRouter.post('/click', (req, res) => notImplemented(req, res, 'Record ad click'));

export const notificationsRouter = Router();
notificationsRouter.get('/', (req, res) => notImplemented(req, res, 'List notifications'));
notificationsRouter.patch('/:id/read', (req, res) => notImplemented(req, res, 'Mark notification read'));
notificationsRouter.post('/devices', (req, res) => notImplemented(req, res, 'Register device'));
notificationsRouter.post('/schedule', (req, res) => notImplemented(req, res, 'Schedule notification'));
