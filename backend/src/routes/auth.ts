import { Router } from 'express';

import { emailConfirmHtml, passwordResetHtml } from '../lib/authPages.js';

export const authRouter = Router();

authRouter.get('/confirm', (_req, res) => {
  res.type('html').send(emailConfirmHtml());
});

authRouter.get('/reset-password', (_req, res) => {
  res.type('html').send(passwordResetHtml());
});
