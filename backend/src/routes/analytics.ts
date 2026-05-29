import { Router } from 'express';
import { notImplemented } from '../middleware/placeholder.js';

export const analyticsRouter = Router();

analyticsRouter.get('/dashboard', (req, res) => notImplemented(req, res, 'Analytics dashboard'));
analyticsRouter.get('/snapshots', (req, res) => notImplemented(req, res, 'Analytics snapshots'));
analyticsRouter.post('/snapshots', (req, res) => notImplemented(req, res, 'Generate snapshot'));
analyticsRouter.get('/trends', (req, res) => notImplemented(req, res, 'Performance trends'));
analyticsRouter.get('/trends/:exerciseId', (req, res) => notImplemented(req, res, 'Exercise trend'));
