import { Router } from 'express';
import { notImplemented } from '../middleware/placeholder.js';

export const goalsRouter = Router();

goalsRouter.get('/', (req, res) => notImplemented(req, res, 'List goals'));
goalsRouter.post('/', (req, res) => notImplemented(req, res, 'Create goal'));
goalsRouter.patch('/:id', (req, res) => notImplemented(req, res, 'Update goal'));
goalsRouter.post('/:id/complete', (req, res) => notImplemented(req, res, 'Complete goal'));
