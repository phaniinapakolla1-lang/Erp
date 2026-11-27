-- Migration 016: Learning Resources, Announcements, Assignment Instructions/Reference Links, & Faculty Profile RPC
-- Safe to re-run.

-- 1. Assignment instructions & reference Drive link
alter table public.assignments
  add column if not exists description text,
  add column if not exists reference_url text;

-- 2. Learning Resources table (Sec 4.11)
create table if not exists public.learning_resources (
  id uuid primary key default gen_random_uuid(),
  teaching_assignment_id uuid references public.teaching_assignments(id) on delete cascade,
  title text not null,
  description text,
  resource_url text not null,
  resource_type text not null default 'notes' check (resource_type in ('notes', 'pdf', 'slides', 'video', 'link')),
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.learning_resources enable row level security;

drop policy if exists "lr_select" on public.learning_resources;
create policy "lr_select" on public.learning_resources
for select to authenticated using (
  public.is_approved_user()
  and (
    public.current_user_role() = 'admin'
    or created_by = auth.uid()
    or exists (
      select 1 from public.teaching_assignments ta
      where ta.id = learning_resources.teaching_assignment_id
        and (
          ta.faculty_id = auth.uid()
          or exists (select 1 from public.enrollments e where e.student_id = auth.uid() and e.class_section_id = ta.class_section_id and e.is_active = true)
          or (public.current_user_role() = 'hod' and exists (
            select 1 from public.class_sections cs join public.programs p on p.id = cs.program_id
            where cs.id = ta.class_section_id and p.department_id = public.current_user_dept()
          ))
        )
    )
    or teaching_assignment_id is null
  )
);

drop policy if exists "lr_insert" on public.learning_resources;
create policy "lr_insert" on public.learning_resources
for insert to authenticated with check (
  public.is_approved_user()
  and created_by = auth.uid()
  and public.current_user_role() in ('admin', 'hod', 'faculty')
);

drop policy if exists "lr_delete" on public.learning_resources;
create policy "lr_delete" on public.learning_resources
for delete to authenticated using (
  public.current_user_role() = 'admin' or created_by = auth.uid()
);

-- 3. Announcements table (Sec 5.3, 6.1)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  target_role text not null default 'all' check (target_role in ('all', 'student', 'faculty', 'hod')),
  department_id uuid references public.departments(id) on delete set null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.announcements enable row level security;

drop policy if exists "ann_select" on public.announcements;
create policy "ann_select" on public.announcements
for select to authenticated using (
  public.is_approved_user()
  and (
    public.current_user_role() = 'admin'
    or created_by = auth.uid()
    or (
      (target_role = 'all' or target_role = public.current_user_role()::text)
      and (department_id is null or department_id = public.current_user_dept())
    )
  )
);

drop policy if exists "ann_insert" on public.announcements;
create policy "ann_insert" on public.announcements
for insert to authenticated with check (
  public.is_approved_user()
  and created_by = auth.uid()
  and public.current_user_role() in ('admin', 'hod', 'faculty')
);

drop policy if exists "ann_delete" on public.announcements;
create policy "ann_delete" on public.announcements
for delete to authenticated using (
  public.current_user_role() = 'admin' or created_by = auth.uid()
);

-- 4. Admin RPC for Faculty Employee ID & Designation (Sec 4.3)
create or replace function public.admin_upsert_faculty_profile(
  p_user_id uuid,
  p_employee_id text,
  p_designation text default 'Assistant Professor'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_caller_role public.user_role;
  v_emp text := nullif(btrim(coalesce(p_employee_id, '')), '');
  v_desig text := coalesce(nullif(btrim(coalesce(p_designation, '')), ''), 'Assistant Professor');
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into v_caller_role from public.profiles where id = auth.uid() and status = 'approved';
  if v_caller_role is distinct from 'admin'::public.user_role then
    raise exception 'Only Admin can update faculty profile metadata';
  end if;

  if v_emp is null then
    return;
  end if;

  insert into public.faculty_profiles (user_id, employee_id, designation)
  values (p_user_id, v_emp, v_desig)
  on conflict (user_id) do update
  set employee_id = excluded.employee_id,
      designation = excluded.designation;
end;
$$;

revoke all on function public.admin_upsert_faculty_profile(uuid, text, text) from public;
grant execute on function public.admin_upsert_faculty_profile(uuid, text, text) to authenticated;
