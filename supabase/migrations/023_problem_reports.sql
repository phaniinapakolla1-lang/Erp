-- Migration 023: Problem Reports (User -> Admin) with Notifications
-- Safe to re-run.

create table if not exists public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reporter_email text not null,
  reporter_role public.user_role not null,
  category text not null default 'bug' check (category in ('bug', 'ui', 'access', 'academic', 'other')),
  page_path text,
  subject text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  admin_response text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.problem_reports enable row level security;

drop policy if exists "pr_select" on public.problem_reports;
create policy "pr_select" on public.problem_reports
for select to authenticated using (
  public.is_approved_user()
  and (
    reporter_id = auth.uid()
    or public.current_user_role() = 'admin'
  )
);

drop policy if exists "pr_update_admin" on public.problem_reports;
create policy "pr_update_admin" on public.problem_reports
for update to authenticated using (
  public.current_user_role() = 'admin'
) with check (
  public.current_user_role() = 'admin'
);

create or replace function public.submit_problem_report(
  p_category text,
  p_page_path text,
  p_subject text,
  p_description text
)
returns public.problem_reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_prof record;
  v_row public.problem_reports;
  v_adm record;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select id, email, role, full_name, status into v_prof from public.profiles where id = v_uid;
  if not found or v_prof.status <> 'approved' then raise exception 'Approved account required'; end if;
  if btrim(coalesce(p_subject, '')) = '' or btrim(coalesce(p_description, '')) = '' then
    raise exception 'Subject and description are required';
  end if;

  insert into public.problem_reports (
    reporter_id, reporter_email, reporter_role, category, page_path, subject, description
  ) values (
    v_uid,
    v_prof.email,
    v_prof.role,
    case when p_category in ('bug', 'ui', 'access', 'academic', 'other') then p_category else 'other' end,
    nullif(btrim(coalesce(p_page_path, '')), ''),
    btrim(p_subject),
    btrim(p_description)
  )
  returning * into v_row;

  -- Notify all approved admins
  for v_adm in select id from public.profiles where role = 'admin' and status = 'approved' loop
    insert into public.notifications (user_id, title, body, is_read)
    values (
      v_adm.id,
      'Problem Report from ' || coalesce(v_prof.full_name, v_prof.email),
      '[' || upper(v_row.category) || '] ' || v_row.subject,
      false
    );
  end loop;

  return v_row;
end;
$$;

revoke all on function public.submit_problem_report(text, text, text, text) from public;
grant execute on function public.submit_problem_report(text, text, text, text) to authenticated;
