-- Automatically promotes the designated institutional Admin email on signup/login
-- while keeping all other new registrations in 'pending' student status.

create or replace function handle_new_auth_user()
returns trigger as $$
declare
  is_primary_admin boolean := lower(new.email) = 'phaniinapakolla227@proton.me';
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    case when is_primary_admin then 'admin'::user_role else 'student'::user_role end,
    case when is_primary_admin then 'approved'::account_status else 'pending'::account_status end
  )
  on conflict (id) do update
  set role = case when is_primary_admin then 'admin'::user_role else profiles.role end,
      status = case when is_primary_admin then 'approved'::account_status else profiles.status end;
  return new;
end;
$$ language plpgsql security definer;

-- If the Admin user already exists in auth.users, ensure their profile is approved as admin
update public.profiles
set role = 'admin', status = 'approved'
where lower(email) = 'phaniinapakolla227@proton.me';
