-- Migration 025: Roll-No Login Resolver, Internal-Only College Mail, & Admin-Configurable Hourly Email Limit (Default 150/h)
-- Safe to re-run.

-- 1. Admin-configurable hourly email limit on erp_settings (default 150/hour)
alter table public.erp_settings
  add column if not exists mail_hourly_limit int not null default 150
  check (mail_hourly_limit >= 1 and mail_hourly_limit <= 10000);

-- Track SMTP auth email sends (signup / password_reset) for rolling 1-hour limit
create table if not exists public.smtp_mail_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('signup', 'password_reset')),
  email text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_smtp_mail_events_created_at on public.smtp_mail_events(created_at desc);

alter table public.smtp_mail_events enable row level security;

drop policy if exists "smtp_events_admin_select" on public.smtp_mail_events;
create policy "smtp_events_admin_select" on public.smtp_mail_events
for select to authenticated using (public.current_user_role() = 'admin');

-- Check rolling 1-hour SMTP limit and record send if allowed; returns exact seconds remaining if limit hit
create or replace function public.check_and_log_smtp_limit(
  p_event_type text,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limit int;
  v_used int;
  v_oldest timestamptz;
  v_retry_secs int := 0;
begin
  if p_event_type not in ('signup', 'password_reset') then
    raise exception 'Invalid mail event type';
  end if;

  select coalesce(mail_hourly_limit, 150) into v_limit from public.erp_settings where id = 1;
  if v_limit is null then v_limit := 150; end if;

  select count(*), min(created_at)
  into v_used, v_oldest
  from public.smtp_mail_events
  where created_at > now() - interval '1 hour';

  if v_used >= v_limit then
    v_retry_secs := greatest(1, ceil(extract(epoch from ((v_oldest + interval '1 hour') - now())))::int);
    return jsonb_build_object(
      'allowed', false,
      'limit', v_limit,
      'used', v_used,
      'retry_after_seconds', v_retry_secs
    );
  end if;

  insert into public.smtp_mail_events (event_type, email)
  values (p_event_type, lower(btrim(coalesce(p_email, ''))));

  return jsonb_build_object(
    'allowed', true,
    'limit', v_limit,
    'used', v_used + 1,
    'retry_after_seconds', 0
  );
end;
$$;

-- Admin-only RPC to update the hourly email limit
create or replace function public.admin_set_mail_hourly_limit(p_limit int)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_role is distinct from 'admin'::public.user_role then
    raise exception 'Only Admin can change the hourly email limit';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 10000 then
    raise exception 'Hourly mail limit must be between 1 and 10,000';
  end if;

  update public.erp_settings
  set mail_hourly_limit = p_limit,
      updated_at = now()
  where id = 1;
end;
$$;

-- 2. Resolve Login Email from Email OR Student Roll Number (for LoginPage)
create or replace function public.resolve_login_email(p_identifier text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text := btrim(coalesce(p_identifier, ''));
  v_email text;
begin
  if v_clean = '' then return null; end if;
  if position('@' in v_clean) > 0 then
    return lower(v_clean);
  end if;

  select p.email into v_email
  from public.student_profiles sp
  join public.profiles p on p.id = sp.user_id
  where lower(sp.roll_no) = lower(v_clean)
     or lower(sp.student_code) = lower(v_clean)
  limit 1;

  return lower(v_email);
end;
$$;

-- 3. Restrict College Mail System to INTERNAL college users only (with safety logs)
create or replace function public.send_college_mail(
  p_recipient_email text,
  p_subject text,
  p_body text
)
returns public.college_mails
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sender_email text;
  v_sender_name text;
  v_rec_id uuid;
  v_rec_email text := lower(btrim(coalesce(p_recipient_email, '')));
  v_mail public.college_mails;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not public.is_approved_user() then raise exception 'Approved account required'; end if;
  if v_rec_email = '' or position('@' in v_rec_email) = 0 then raise exception 'Valid college mail ID is required'; end if;
  if btrim(coalesce(p_subject, '')) = '' then raise exception 'Subject is required'; end if;
  if btrim(coalesce(p_body, '')) = '' then raise exception 'Message body is required'; end if;

  select email, full_name into v_sender_email, v_sender_name from public.profiles where id = v_uid;
  select id into v_rec_id from public.profiles where lower(email) = v_rec_email and status = 'approved' limit 1;

  if v_rec_id is null then
    raise exception 'College Mail is for internal college users only. Recipient "%" was not found among approved college accounts.', v_rec_email;
  end if;

  insert into public.college_mails (
    sender_id, sender_email, recipient_email, recipient_id, mail_scope, subject, body, delivery_status
  ) values (
    v_uid, v_sender_email, v_rec_email, v_rec_id, 'internal', btrim(p_subject), btrim(p_body), 'delivered'
  )
  returning * into v_mail;

  insert into public.college_mail_logs (
    mail_id, sender_id, sender_email, recipient_email, mail_scope, subject, action
  ) values (
    v_mail.id, v_uid, v_sender_email, v_rec_email, 'internal', btrim(p_subject), 'sent_internal'
  );

  if v_rec_id <> v_uid then
    insert into public.notifications (user_id, title, body, is_read)
    values (v_rec_id, 'New College Mail from ' || coalesce(v_sender_name, v_sender_email), btrim(p_subject), false);
  end if;

  return v_mail;
end;
$$;

revoke all on function public.check_and_log_smtp_limit(text, text) from public;
revoke all on function public.admin_set_mail_hourly_limit(int) from public;
revoke all on function public.resolve_login_email(text) from public;
revoke all on function public.send_college_mail(text, text, text) from public;

grant execute on function public.check_and_log_smtp_limit(text, text) to anon, authenticated;
grant execute on function public.resolve_login_email(text) to anon, authenticated;
grant execute on function public.admin_set_mail_hourly_limit(int) to authenticated;
grant execute on function public.send_college_mail(text, text, text) to authenticated;
