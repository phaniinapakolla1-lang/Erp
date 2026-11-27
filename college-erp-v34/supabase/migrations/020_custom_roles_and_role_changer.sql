-- Migration 020: Custom Roles & Admin Inline Role Changer RPC
-- Safe to re-run.

create table if not exists public.custom_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  base_portal public.user_role not null default 'faculty',
  description text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.custom_roles enable row level security;

drop policy if exists "custom_roles_read" on public.custom_roles;
create policy "custom_roles_read" on public.custom_roles
for select to authenticated using (public.is_approved_user());

drop policy if exists "custom_roles_admin" on public.custom_roles;
create policy "custom_roles_admin" on public.custom_roles
for all to authenticated using (public.current_user_role() = 'admin')
with check (public.current_user_role() = 'admin');

alter table public.profiles
  add column if not exists custom_role_id uuid references public.custom_roles(id) on delete set null;

create or replace function public.admin_change_user_role(
  p_user_id uuid,
  p_role public.user_role,
  p_custom_role_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
  v_old_role public.user_role;
  v_base public.user_role;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_caller_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_caller_role is distinct from 'admin'::public.user_role then
    raise exception 'Only Admin can change user roles';
  end if;

  if p_user_id = auth.uid() and p_role <> 'admin'::public.user_role then
    raise exception 'You cannot change your own Admin role';
  end if;

  select role into v_old_role from public.profiles where id = p_user_id;
  if not found then raise exception 'User profile not found'; end if;

  -- If a custom role is selected, keep its base_portal in sync with profiles.role
  if p_custom_role_id is not null then
    select base_portal into v_base from public.custom_roles where id = p_custom_role_id;
    if found then
      p_role := v_base;
    end if;
  end if;

  update public.profiles
  set role = p_role,
      custom_role_id = p_custom_role_id,
      updated_at = now()
  where id = p_user_id;

  insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, reason)
  values (
    'profiles',
    p_user_id,
    'role_change',
    jsonb_build_object('role', v_old_role),
    jsonb_build_object('role', p_role, 'custom_role_id', p_custom_role_id),
    auth.uid(),
    'Admin role update'
  );
end;
$$;

revoke all on function public.admin_change_user_role(uuid, public.user_role, uuid) from public;
grant execute on function public.admin_change_user_role(uuid, public.user_role, uuid) to authenticated;
