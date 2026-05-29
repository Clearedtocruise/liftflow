import OpenAI from 'openai';

let client: OpenAI | null = null;

export function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  if (!client) client = new OpenAI({ apiKey: key });
  return client;
}

export function hasOpenAI(): boolean {
  const key = process.env.OPENAI_API_KEY;
  return Boolean(key && !key.includes('your-openai-api-key'));
}
