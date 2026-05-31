# Release Notes Template — LiftFlow Beta

## v[X.Y.Z] — [Build number] — [Date]

### Highlights
- One sentence value prop for this build

### New
- Feature A
- Feature B

### Improved
- Performance / UX change

### Fixed
- Bug fix (reference feedback ID if applicable)

### Known issues
- Link to [BETA_KNOWN_ISSUES.md](./BETA_KNOWN_ISSUES.md)

### Tester actions
- [ ] Update TestFlight
- [ ] Re-test [critical flow]
- [ ] Redeem new invite if required

---

**Insert into Supabase:**

```sql
insert into release_notes (version, title, body)
values ('1.0.0-beta.1', 'Beta 1 — Monetization + Transformation', '...');
```

**Changelog entries:**

```sql
insert into changelog_entries (version, category, summary)
values ('1.0.0-beta.1', 'feature', 'Transformation Engine on Progress tab');
```
