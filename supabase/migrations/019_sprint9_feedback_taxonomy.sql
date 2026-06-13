-- Sprint 9 — Private beta feedback taxonomy

alter type public.feedback_type add value if not exists 'confusion';

alter table public.beta_feedback
  add column if not exists area text,
  add column if not exists issue_category text
    check (issue_category is null or issue_category in (
      'crash', 'confusion', 'missing_feature', 'feature_request', 'support', 'other'
    ));

create index if not exists idx_beta_feedback_category on public.beta_feedback(issue_category, status, created_at desc);
