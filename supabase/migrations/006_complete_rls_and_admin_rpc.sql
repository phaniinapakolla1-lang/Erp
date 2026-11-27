-- Standard user registration trigger (no hardcoded Admin emails)
-- Promote your first Admin manually inside Supabase Dashboard -> Table Editor -> profiles.

create or replace function handle_new_auth_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, email, role, status)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email,
    'student'::user_role,
    'pending'::account_status
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;