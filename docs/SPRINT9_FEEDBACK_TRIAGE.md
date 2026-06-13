# Sprint 9 — Feedback Triage Board

Living document. Sync with `GET /api/feedback/list` daily during beta.

**Categories:** `crash` · `confusion` · `missing_feature` · `feature_request` · `support`  
**Severity:** P0 ship blocker · P1 fix before Wave 1 · P2 workaround OK · P3 nice-to-have  
**Status:** open → triaged → resolved → closed

---

## Summary (update weekly)

| Category | Open | Triaged | Resolved | This week new |
|----------|------|---------|----------|---------------|
| crash | 0 | 0 | 0 | 0 |
| confusion | 0 | 0 | 0 | 0 |
| missing_feature | 0 | 0 | 0 | 0 |
| feature_request | 0 | 0 | 0 | 0 |
| support | 0 | 0 | 0 | 0 |

**Last synced:** _YYYY-MM-DD_

---

## Open issues

| ID | Date | Persona | Category | Area | Severity | Subject | Status | Owner | Target build |
|----|------|---------|----------|------|----------|---------|--------|-------|--------------|
| | | | | | | | open | | |

---

## Triaged (in progress)

| ID | Category | Severity | Fix approach | PR / commit | ETA |
|----|----------|----------|--------------|-------------|-----|
| | | | | | |

---

## Resolved (this sprint)

| ID | Category | Resolution | Build | Verified by |
|----|----------|------------|-------|-------------|
| | | | | |

---

## Triage workflow

1. **Ingest** — `npm run beta:daily-report` pulls `/api/feedback/summary` `byCategory`
2. **List** — `GET /api/feedback/list` (founder key) for full rows
3. **Classify** — confirm `issue_category` + assign severity
4. **Route** — P0 → hotfix branch · P1 → next RC · P2 → backlog · P3 → roadmap
5. **Update status** — `PATCH /api/feedback/{id}/status` → `triaged` / `resolved`
6. **Sync roadmap** — copy P0/P1 to [SPRINT9_FIX_ROADMAP.md](./SPRINT9_FIX_ROADMAP.md)

---

## Category guide

| Category | When to use | Example |
|----------|-------------|---------|
| **crash** | App force-quit, freeze, data loss | “App crashed after logging set” |
| **confusion** | UX unclear, wrong mental model | “Didn’t know how to start workout” |
| **missing_feature** | Expected capability absent | “Can’t edit rest timer mid-session” |
| **feature_request** | New idea, enhancement | “Add RPE logging” |
| **support** | Account, billing, access | “Invite code didn’t work” |

---

## SLA (from [BETA_SUPPORT_PLAYBOOK.md](./BETA_SUPPORT_PLAYBOOK.md))

| Severity | First response | Resolution target |
|----------|----------------|-------------------|
| P0 | 2 hours | Same day hotfix |
| P1 | 24 hours | Before next TestFlight |
| P2 | 48 hours | Next sprint |
| P3 | Weekly batch | Backlog |
