import { Router } from 'express';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadLegalHtml(name: string): string {
  try {
    return readFileSync(join(__dirname, '../../public/legal', `${name}.html`), 'utf8');
  } catch {
    return `<html><body><h1>ONE MORE ${name}</h1><p>See in-app Settings → Legal.</p><p>support@liftflow.app</p></body></html>`;
  }
}

export const legalRouter = Router();

legalRouter.get('/privacy', (_req, res) => {
  res.type('html').send(loadLegalHtml('privacy'));
});

legalRouter.get('/terms', (_req, res) => {
  res.type('html').send(loadLegalHtml('terms'));
});

legalRouter.get('/subscription-terms', (_req, res) => {
  res.type('html').send(loadLegalHtml('subscription-terms'));
});

legalRouter.get('/support', (_req, res) => {
  res.type('html').send(loadLegalHtml('support'));
});
