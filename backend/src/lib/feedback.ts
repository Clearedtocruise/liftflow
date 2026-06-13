import { requireAdmin } from './supabase.js';

export type FeedbackInput = {
  userId?: string;
  feedbackType: 'bug' | 'feature' | 'support' | 'confusion';
  subject: string;
  body: string;
  screenshotUrl?: string;
  deviceMetadata?: Record<string, unknown>;
  appVersion?: string;
  appEnvironment?: string;
  area?: string;
  issueCategory?: 'crash' | 'confusion' | 'missing_feature' | 'feature_request' | 'support' | 'other';
};

export type FeedbackIssueCategory =
  | 'crash'
  | 'confusion'
  | 'missing_feature'
  | 'feature_request'
  | 'support'
  | 'other';

export function inferIssueCategory(
  feedbackType: FeedbackInput['feedbackType'],
  explicit?: FeedbackIssueCategory,
): FeedbackIssueCategory {
  if (explicit) return explicit;
  switch (feedbackType) {
    case 'bug':
      return 'crash';
    case 'confusion':
      return 'confusion';
    case 'feature':
      return 'feature_request';
    case 'support':
    default:
      return 'support';
  }
}

export async function submitFeedback(input: FeedbackInput) {
  const db = requireAdmin();
  const issueCategory = inferIssueCategory(input.feedbackType, input.issueCategory);
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
      area: input.area ?? null,
      issue_category: issueCategory,
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
    .select(
      'id, user_id, feedback_type, subject, body, status, area, issue_category, app_version, created_at, updated_at',
    )
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function updateFeedbackStatus(
  id: string,
  status: 'open' | 'triaged' | 'resolved' | 'closed',
) {
  const db = requireAdmin();
  const { data, error } = await db
    .from('beta_feedback')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, status, updated_at')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getFeedbackSummary() {
  const db = requireAdmin();
  const since7 = new Date();
  since7.setDate(since7.getDate() - 7);

  const { data, error } = await db
    .from('beta_feedback')
    .select('feedback_type, issue_category, status, created_at')
    .gte('created_at', since7.toISOString());

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  const open = rows.filter((r) => r.status === 'open').length;
  const byType: Record<string, number> = { bug: 0, feature: 0, support: 0, confusion: 0 };
  const byCategory: Record<string, number> = {
    crash: 0,
    confusion: 0,
    missing_feature: 0,
    feature_request: 0,
    support: 0,
    other: 0,
  };
  for (const r of rows) {
    byType[r.feedback_type] = (byType[r.feedback_type] ?? 0) + 1;
    if (r.issue_category) {
      byCategory[r.issue_category] = (byCategory[r.issue_category] ?? 0) + 1;
    }
  }

  return { last7Days: rows.length, open, byType, byCategory };
}
