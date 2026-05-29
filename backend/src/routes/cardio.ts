import { Router } from 'express';
import { notImplemented } from '../middleware/placeholder.js';

export const cardioRouter = Router();

cardioRouter.get('/', (req, res) => notImplemented(req, res, 'Cardio history'));
cardioRouter.post('/', (req, res) => notImplemented(req, res, 'Start cardio session'));
cardioRouter.patch('/:id', (req, res) => notImplemented(req, res, 'Update cardio session'));
cardioRouter.post('/heart-rate', (req, res) => notImplemented(req, res, 'Log heart rate'));
