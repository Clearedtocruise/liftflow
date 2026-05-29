import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

/** Load root .env for local dev; Render injects env vars directly in production. */
function loadEnv(): void {
  if (process.env.NODE_ENV === 'production') return;

  const candidates = [resolve(process.cwd(), '../.env'), resolve(process.cwd(), '.env')];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
    return;
  }
}

loadEnv();

export { loadEnv };
