#!/usr/bin/env node
/**
 * Verify LiftFlow backend AI endpoints.
 * Usage: node scripts/verify-ai-endpoints.mjs [userId]
 */

const API = process.env.EXPO_PUBLIC_API_URL ?? 'https://liftflow-api.onrender.com';
const userId = process.argv[2] ?? '82afd1a2-207f-486f-bd42-24846ea63586';

async function check(name, url, init) {
  const res = await fetch(`${API}${url}`, init);
  const body = await res.text();
  let preview = body.slice(0, 120);
  try {
    preview = JSON.stringify(JSON.parse(body)).slice(0, 120);
  } catch {
    /* html error page */
  }
  const ok = res.ok;
  console.log(`${ok ? '✓' : '✗'} ${name}: HTTP ${res.status} ${preview}`);
  return ok;
}

async function main() {
  console.log(`API: ${API}\n`);
  const health = await fetch(`${API}/health`).then((r) => r.json());
  console.log('Health:', JSON.stringify(health));

  await check('AI workout', '/api/ai/workout/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  await check('AI meal plan', '/api/nutrition/meal-plan/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  await check('Voice coach', '/api/ai/coach', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, message: 'How is my recovery?', context: 'general' }),
  });
  await check('TTS', '/api/ai/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: 'Ready to train' }),
  });
}

main();
