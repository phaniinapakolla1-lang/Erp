-- Migration 017: P0 Security & Governance — Department-scoped HOD audit_logs RLS
-- Safe to re-run.

drop policy if exists "audit_read" on public.audit_logs;
create policy "audit_read" on public.audit_logs
for select to authenticated using (
  public.is_approved_user()
  and (
    public.current_user_role() = 'admin'
    or (
      public.current_user_role() = 'hod'
      and exists (
        select 1 from public.profiles p
        where p.id = audit_logs.changed_by
          and p.department_id = public.current_user_dept()
      )
    )
  )
);
