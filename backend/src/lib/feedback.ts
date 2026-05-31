import { requireAdmin } from './supabase.js';

export type FeedbackInput = {
  userId?: string;
  feedbackType: 'bug' | 'feature' | 'support';
  subject: string;
  body: string;
  screenshotUrl?: string;
  deviceMetadata?: Record<string, unknown>;
  appVersion?: string;
  appEnvironment?: string;
};

export async function submitFeedback(input: FeedbackInput) {
  const db = requireAdmin();
  const { data, error } = await db
    .from('beta_feedback')
    .insert({
      user_id: input.userId ?? null,
      feedback_type: input.feedbackType,
      subject: input.subject,
      body: input.body,
      screenshot_url: input.screenshotUrl,
      device_metadata: input.deviceMetadata ?? {},
      app_version: input.appVersion,
      app_environment: input.appEnvironment,
      status: 'open',
    })
    .select('id, created_at')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function listFeedback(limit = 50) {
  const db = requireAdmin();
  const { data, error } = await db
    .from('beta_feedback')
    .select('id, user_id, feedback_type, subject, status, app_version, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getFeedbackSummary() {
  const db = requireAdmin();
  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);

  const { data, error } = await db
    .from('beta_feedback')
    .select('feedback_type, status, created_at')
    .gte('created_at', since7.toISOString());

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const open = rows.filter((r) => r.status === 'open').length;
  const byType: Record<string, number> = { bug: 0, feature: 0, support: 0 };
  for (const r of rows) {
    byType[r.feedback_type] = (byType[r.feedback_type] ?? 0) + 1;
  }

  return { last7Days: rows.length, open, byType };
}
