-- Automated pgTAP RLS verification for College ERP
-- Run via: supabase test db

begin;
select plan(6);

-- 1. Verify RLS is enabled on sensitive tables
select ok(
  (select relrowsecurity from pg_class where relname = 'submissions'),
  'RLS must be enabled on submissions'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'evaluations'),
  'RLS must be enabled on evaluations'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'calendar_events'),
  'RLS must be enabled on calendar_events'
);

-- 2. Verify anon role has no table access
set local role anon;
select throws_ok(
  'select * from public.profiles',
  '42501',
  null,
  'anon role cannot read profiles'
);

-- 3. Verify non-admin cannot insert into calendar_events
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', true);
select throws_ok(
  $$insert into public.calendar_events (title, event_type, start_at, end_at, created_by)
    values ('Unauthorized Event', 'holiday', now(), now(), '00000000-0000-0000-0000-000000000099')$$,
  '42501',
  null,
  'non-admin cannot insert calendar_events'
);

-- 4. Verify unpublished evaluations are hidden from students
select is(
  (select count(*)::int from public.evaluations where published_at is null),
  0,
  'students cannot read unpublished evaluations'
);

select * from finish();
rollback;
