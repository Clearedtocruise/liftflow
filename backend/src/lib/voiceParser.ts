export type ParsedCommand = {
  exercise?: string;
  weight?: number;
  reps?: number;
  set?: number;
  type?: string;
  confidence?: number;
  rawText: string;
  intent?: 'log_set' | 'completed_set' | 'adjust_weight' | 'feedback';
  feedback?: 'easy' | 'hard' | 'failed';
  weightAdjustment?: 'increase' | 'decrease';
};

const COACHING_PATTERNS: Array<{ pattern: RegExp; build: (match: RegExpMatchArray, text: string) => ParsedCommand }> = [
  {
    pattern: /^(?:completed|finished)\s+(?:the\s+)?set\.?$/i,
    build: (_, text) => ({ intent: 'completed_set', rawText: text, confidence: 0.92 }),
  },
  {
    pattern: /^(?:got|did|hit)\s+(?<reps>\d+)\s*reps?\.?$/i,
    build: (m, text) => ({
      intent: 'log_set',
      reps: parseInt(m.groups!.reps!, 10),
      rawText: text,
      confidence: 0.88,
    }),
  },
  {
    pattern: /^(?<exercise>.+?)\s+(?:felt|feels?)\s+easy\.?$/i,
    build: (m, text) => ({
      intent: 'feedback',
      exercise: m.groups!.exercise!.trim(),
      feedback: 'easy',
      rawText: text,
      confidence: 0.9,
    }),
  },
  {
    pattern: /^(?<exercise>.+?)\s+(?:felt|feels?)\s+(?:hard|heavy)\.?$/i,
    build: (m, text) => ({
      intent: 'feedback',
      exercise: m.groups!.exercise!.trim(),
      feedback: 'hard',
      rawText: text,
      confidence: 0.9,
    }),
  },
  {
    pattern: /^(?:failed|missed)\s+(?:at\s+)?(?<reps>\d+)\s*reps?\.?$/i,
    build: (m, text) => ({
      intent: 'feedback',
      feedback: 'failed',
      reps: parseInt(m.groups!.reps!, 10),
      rawText: text,
      confidence: 0.9,
    }),
  },
  {
    pattern: /^(?<exercise>.+?)\s+(?:failed|missed)\s+(?:at\s+)?(?<reps>\d+)\s*reps?\.?$/i,
    build: (m, text) => ({
      intent: 'feedback',
      exercise: m.groups!.exercise!.trim(),
      feedback: 'failed',
      reps: parseInt(m.groups!.reps!, 10),
      rawText: text,
      confidence: 0.92,
    }),
  },
  {
    pattern: /^(?:increase|add|go up)\s+(?:the\s+)?weight\.?$/i,
    build: (_, text) => ({
      intent: 'adjust_weight',
      weightAdjustment: 'increase',
      rawText: text,
      confidence: 0.92,
    }),
  },
  {
    pattern: /^(?:reduce|decrease|lower|drop)\s+(?:the\s+)?weight\.?$/i,
    build: (_, text) => ({
      intent: 'adjust_weight',
      weightAdjustment: 'decrease',
      rawText: text,
      confidence: 0.92,
    }),
  },
];

export function parseVoiceTranscript(transcript: string): ParsedCommand | null {
  const text = transcript.trim();

  for (const { pattern, build } of COACHING_PATTERNS) {
    const match = text.match(pattern);
    if (match) return build(match, transcript);
  }

  const patterns = [
    /^(?<exercise>.+?)\s+(?<weight>\d+(?:\.\d+)?)\s*(?:lbs?|pounds?|kg|kilos?)?\s*(?:for|x|\*|×)\s*(?<reps>\d+)/i,
    /^(?<exercise>.+?)\s+(?<reps>\d+)\s*(?:reps?|rep)\s*(?:at|@)\s*(?<weight>\d+(?:\.\d+)?)/i,
    /^(?<exercise>.+?)\s+(?<weight>\d+(?:\.\d+)?)\s+(?<reps>\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.groups) {
      return {
        intent: 'log_set',
        exercise: match.groups.exercise.trim(),
        weight: parseFloat(match.groups.weight),
        reps: parseInt(match.groups.reps, 10),
        rawText: transcript,
        confidence: 0.9,
      };
    }
  }

  const repsOnly = text.match(/^(?<exercise>.+?)\s+(?<reps>\d+)\s*reps?$/i);
  if (repsOnly?.groups) {
    return {
      intent: 'log_set',
      exercise: repsOnly.groups.exercise.trim(),
      reps: parseInt(repsOnly.groups.reps, 10),
      rawText: transcript,
      confidence: 0.75,
    };
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
          'Parse gym voice logs into JSON: { "exercise": string|null, "weight": number|null, "reps": number|null, "confidence": number 0-1, "intent": "log_set"|"completed_set"|"adjust_weight"|"feedback"|null, "feedback": "easy"|"hard"|"failed"|null, "weightAdjustment": "increase"|"decrease"|null }. Weight in lbs unless kg specified.',
      },
      { role: 'user', content: transcript },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) return parseVoiceTranscript(transcript);

  try {
    const parsed = JSON.parse(content);
    return {
      exercise: parsed.exercise ?? undefined,
      weight: parsed.weight ?? undefined,
      reps: parsed.reps ?? undefined,
      confidence: parsed.confidence ?? 0.85,
      intent: parsed.intent ?? 'log_set',
      feedback: parsed.feedback ?? undefined,
      weightAdjustment: parsed.weightAdjustment ?? undefined,
      rawText: transcript,
    };
  } catch {
    return parseVoiceTranscript(transcript);
  }
}
