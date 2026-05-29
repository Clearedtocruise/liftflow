export type ParsedCommand = {
  exercise?: string;
  weight?: number;
  reps?: number;
  set?: number;
  type?: string;
  confidence?: number;
  rawText: string;
};

export function parseVoiceTranscript(transcript: string): ParsedCommand | null {
  const text = transcript.trim();
  const patterns = [
    /^(?<exercise>.+?)\s+(?<weight>\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilos?)?\s*(?:for|x|\*|×)\s*(?<reps>\d+)/i,
    /^(?<exercise>.+?)\s+(?<reps>\d+)\s*(?:reps?|rep)\s*(?:at|@)\s*(?<weight>\d+(?:\.\d+)?)/i,
    /^(?<exercise>.+?)\s+(?<weight>\d+(?:\.\d+)?)\s+(?<reps>\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.groups) {
      return {
        exercise: match.groups.exercise.trim(),
        weight: parseFloat(match.groups.weight),
        reps: parseInt(match.groups.reps, 10),
        rawText: transcript,
        confidence: 0.9,
      };
    }
  }

  return null;
}

export async function parseWithOpenAI(transcript: string): Promise<ParsedCommand | null> {
  const { getOpenAI } = await import('./openai.js');
  const openai = getOpenAI();
  if (!openai) return parseVoiceTranscript(transcript);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content:
          'Parse gym voice logs into JSON: { "exercise": string, "weight": number|null, "reps": number|null, "confidence": number 0-1 }. Weight in lbs unless kg specified.',
      },
      { role: 'user', content: transcript },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return parseVoiceTranscript(transcript);

  try {
    const parsed = JSON.parse(content);
    return {
      exercise: parsed.exercise,
      weight: parsed.weight ?? undefined,
      reps: parsed.reps ?? undefined,
      confidence: parsed.confidence ?? 0.85,
      rawText: transcript,
    };
  } catch {
    return parseVoiceTranscript(transcript);
  }
}
