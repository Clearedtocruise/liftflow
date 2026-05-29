import { Router } from 'express';
import { notImplemented } from '../middleware/placeholder.js';

export const workoutsRouter = Router();

workoutsRouter.get('/', (req, res) => notImplemented(req, res, 'List workouts'));
workoutsRouter.post('/', (req, res) => notImplemented(req, res, 'Start workout'));
workoutsRouter.get('/:id', (req, res) => notImplemented(req, res, 'Get workout'));
workoutsRouter.patch('/:id', (req, res) => notImplemented(req, res, 'Update workout'));
workoutsRouter.post('/:id/end', (req, res) => notImplemented(req, res, 'End workout'));
workoutsRouter.post('/:id/sets', (req, res) => notImplemented(req, res, 'Log set'));
workoutsRouter.delete('/sets/:setId', (req, res) => notImplemented(req, res, 'Delete set'));
workoutsRouter.post('/:id/rest', (req, res) => notImplemented(req, res, 'Start rest timer'));
workoutsRouter.post('/:id/density', (req, res) => notImplemented(req, res, 'Calculate density'));
