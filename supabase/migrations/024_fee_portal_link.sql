-- Migration 024: Admin-Configured External Fee Portal Link
-- Safe to re-run.

alter table public.erp_settings
  add column if not exists fee_portal_url text;

create or replace function public.admin_set_fee_portal_url(p_url text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.user_role;
  v_clean text := nullif(btrim(coalesce(p_url, '')), '');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_role is distinct from 'admin'::public.user_role then
    raise exception 'Only Admin can configure the Fee Portal link';
  end if;

  if v_clean is not null and v_clean !~ '^https?://' then
    raise exception 'Fee Portal URL must start with http:// or https://';
  end if;

  update public.erp_settings
  set fee_portal_url = v_clean,
      updated_at = now()
  where id = 1;
end;
$$;

revoke all on function public.admin_set_fee_portal_url(text) from public;
grant execute on function public.admin_set_fee_portal_url(text) to authenticated;
