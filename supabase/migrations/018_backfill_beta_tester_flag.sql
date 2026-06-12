-- Backfill is_beta_tester for users who already redeemed invites or were flagged internal

update public.profiles
set is_beta_tester = true
where is_beta_tester = false
  and (is_internal_tester = true or beta_tester_tag is not null);
