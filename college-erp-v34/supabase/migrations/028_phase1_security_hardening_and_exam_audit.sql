-- Migration 028: Phase 1 — Security Hardening (NULL-Role Guards, Self-Role-Escalation Block, Double-Publish Protection & Exam Audit Logs)
-- Run in Supabase Dashboard -> SQL Editor. Safe to re-run.

-- 1. Hardened admin_save_college_branding: explicit NULL-role check + immutable audit log
create or replace function public.admin_save_college_branding(
  p_college_name text,
  p_college_subtitle text default null,
  p_college_address text default null,
  p_college_logo_data text default null,
  p_principal_sign_data text default null,
  p_college_stamp_data text default null,
  p_default_exam_instructions text default null,
  p_hall_ticket_template jsonb default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role::text into v_role from public.profiles where id = v_uid and status = 'approved';
  if v_role is null or v_role not in ('admin', 'exam_controller') then
    raise exception 'Only approved Admin or Exam Controller can update branding and hall ticket settings';
  end if;

  insert into public.erp_settings (id, college_name)
  values (1, coalesce(nullif(btrim(p_college_name), ''), 'College ERP'))
  on conflict (id) do update
  set college_name = coalesce(nullif(btrim(p_college_name), ''), erp_settings.college_name),
      college_subtitle = coalesce(p_college_subtitle, erp_settings.college_subtitle),
      college_address = coalesce(p_college_address, erp_settings.college_address),
      college_logo_data = case when p_college_logo_data is not null then nullif(p_college_logo_data, '') else erp_settings.college_logo_data end,
      principal_sign_data = case when p_principal_sign_data is not null then nullif(p_principal_sign_data, '') else erp_settings.principal_sign_data end,
      college_stamp_data = case when p_college_stamp_data is not null then nullif(p_college_stamp_data, '') else erp_settings.college_stamp_data end,
      default_exam_instructions = coalesce(p_default_exam_instructions, erp_settings.default_exam_instructions),
      hall_ticket_template = coalesce(p_hall_ticket_template, erp_settings.hall_ticket_template),
      updated_at = now();

  insert into public.audit_logs (table_name, record_id, action, new_data, changed_by, reason)
  values (
    'erp_settings',
    '00000000-0000-0000-0000-000000000001'::uuid,
    'update_college_branding',
    jsonb_build_object(
      'college_name', coalesce(nullif(btrim(p_college_name), ''), 'College ERP'),
      'template_updated', p_hall_ticket_template is not null,
      'logo_updated', p_college_logo_data is not null
    ),
    v_uid,
    'College branding or Hall Ticket template updated'
  );
end;
$$;

-- 2. Hardened publish_exam_results_and_auto_supp:
--    - Explicit NULL-role guard
--    - Double-publish protection (no duplicate announcements or duplicate notifications on re-sync)
--    - Immutable audit log entry
create or replace function public.publish_exam_results_and_auto_supp(
  p_exam_cycle_id uuid,
  p_external_url text default null,
  p_auto_generate_supp boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_cycle record;
  v_was_published boolean := false;
  v_supp_cycle_id uuid;
  v_stu record;
  v_supp_list jsonb;
  v_generated_count int := 0;
  v_roll text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select role::text into v_role from public.profiles where id = v_uid and status = 'approved';
  if v_role is null or v_role not in ('admin', 'exam_controller') then
    raise exception 'Only approved Admin or Exam Controller can publish exam results';
  end if;

  select * into v_cycle from public.exam_cycles where id = p_exam_cycle_id for update;
  if not found then raise exception 'Exam cycle not found'; end if;

  v_was_published := coalesce(v_cycle.results_published, false);

  update public.exam_results
  set is_published = true, updated_at = now()
  where exam_cycle_id = p_exam_cycle_id;

  update public.exam_cycles
  set results_published = true,
      results_external_url = coalesce(nullif(btrim(coalesce(p_external_url, '')), ''), results_external_url),
      published_at = coalesce(published_at, now())
  where id = p_exam_cycle_id;

  -- Post official Announcement and broadcast notifications ONLY on first publish (prevents duplicates)
  if not v_was_published then
    insert into public.announcements (title, body, target_role, created_by)
    values (
      'Results Published: ' || v_cycle.title,
      'Examination results for ' || v_cycle.title || ' (' || v_cycle.semester_label || ') have been published. View your marks under Hall Tickets & Results' ||
        case when nullif(btrim(coalesce(p_external_url, '')), '') is not null then ' or open the official link: ' || btrim(p_external_url) else '.' end,
      'student',
      v_uid
    );

    insert into public.notifications (user_id, title, body, link_url, is_read)
    select distinct
      er.student_id,
      'Exam Results Published: ' || v_cycle.title,
      'Your results for ' || v_cycle.title || ' (' || v_cycle.semester_label || ') are now live. Open Hall Tickets & Results to view.',
      '/student/exams',
      false
    from public.exam_results er
    where er.exam_cycle_id = p_exam_cycle_id;
  end if;

  -- Auto-generate or refresh Supplementary Hall Tickets for students who Failed or were Absent
  if p_auto_generate_supp then
    select id into v_supp_cycle_id
    from public.exam_cycles
    where title = v_cycle.title || ' — Supplementary' and exam_type = 'supplementary'
    limit 1;

    if v_supp_cycle_id is null then
      insert into public.exam_cycles (title, semester_label, exam_type, max_marks, min_pass_marks, instructions, created_by)
      values (
        v_cycle.title || ' — Supplementary',
        v_cycle.semester_label,
        'supplementary',
        v_cycle.max_marks,
        v_cycle.min_pass_marks,
        v_cycle.instructions,
        v_uid
      )
      returning id into v_supp_cycle_id;
    end if;

    for v_stu in
      select distinct student_id
      from public.exam_results
      where exam_cycle_id = p_exam_cycle_id and status in ('fail', 'absent')
    loop
      select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name, 'type', coalesce(s.subject_type, 'theory'), 'exam_date', 'TBA'))
      into v_supp_list
      from public.exam_results er
      join public.subjects s on s.id = er.subject_id
      where er.exam_cycle_id = p_exam_cycle_id
        and er.student_id = v_stu.student_id
        and er.status in ('fail', 'absent');

      select coalesce(roll_no, left(v_stu.student_id::text, 8)) into v_roll
      from public.student_profiles where user_id = v_stu.student_id;

      insert into public.exam_hall_tickets (
        exam_cycle_id, student_id, hall_ticket_no,
        chk_subjects, is_approved, approved_by, approved_at,
        regular_subjects, supplementary_subjects
      ) values (
        v_supp_cycle_id,
        v_stu.student_id,
        'SUPP-' || upper(coalesce(v_roll, left(v_stu.student_id::text, 6))),
        true, true, v_uid, now(),
        '[]'::jsonb,
        coalesce(v_supp_list, '[]'::jsonb)
      )
      on conflict (exam_cycle_id, student_id) do update
      set supplementary_subjects = excluded.supplementary_subjects,
          is_approved = true,
          approved_by = v_uid,
          approved_at = now(),
          updated_at = now();

      v_generated_count := v_generated_count + 1;

      if not v_was_published then
        insert into public.notifications (user_id, title, body, link_url, is_read)
        values (
          v_stu.student_id,
          'Supplementary Hall Ticket Generated',
          'A Supplementary Hall Ticket has been auto-generated for ' || v_cycle.title || '. Open Hall Tickets & Results to view and print.',
          '/student/exams',
          false
        );
      end if;
    end loop;
  end if;

  insert into public.audit_logs (table_name, record_id, action, new_data, changed_by, reason)
  values (
    'exam_cycles',
    p_exam_cycle_id,
    case when v_was_published then 'resync_published_results' else 'publish_results' end,
    jsonb_build_object(
      'title', v_cycle.title,
      'external_url', nullif(btrim(coalesce(p_external_url, '')), ''),
      'supplementary_hall_tickets_generated', v_generated_count,
      'already_published', v_was_published
    ),
    v_uid,
    case when v_was_published then 'Re-synced newly entered marks without duplicate announcements' else 'Published official exam results' end
  );

  return jsonb_build_object(
    'published', true,
    'already_published', v_was_published,
    'supplementary_hall_tickets_generated', v_generated_count,
    'supp_cycle_id', v_supp_cycle_id
  );
end;
$$;

-- 3. Automatic Audit Log trigger for Hall Ticket Approvals / Holds
create or replace function public.trg_fn_audit_hall_ticket_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := coalesce(auth.uid(), new.approved_by, new.student_id);
begin
  if (tg_op = 'INSERT' and new.is_approved = true)
     or (tg_op = 'UPDATE' and old.is_approved is distinct from new.is_approved) then
    insert into public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by, reason)
    values (
      'exam_hall_tickets',
      new.id,
      case when new.is_approved then 'approve_hall_ticket' else 'hold_hall_ticket' end,
      case when tg_op = 'UPDATE' then jsonb_build_object('is_approved', old.is_approved, 'hall_ticket_no', old.hall_ticket_no) else null end,
      jsonb_build_object('is_approved', new.is_approved, 'hall_ticket_no', new.hall_ticket_no, 'student_id', new.student_id),
      v_actor,
      case when new.is_approved then 'Hall Ticket approved for printing' else 'Hall Ticket placed on hold' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_audit_hall_ticket_approval on public.exam_hall_tickets;
create trigger trg_audit_hall_ticket_approval
after insert or update on public.exam_hall_tickets
for each row execute function public.trg_fn_audit_hall_ticket_approval();

-- 4. Defense-in-depth: Prevent any non-admin from changing their own role or account status directly
create or replace function public.trg_fn_prevent_self_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_caller_role text;
begin
  -- Allow service-role / SQL editor operations where auth.uid() is null
  if v_uid is null then
    return new;
  end if;

  if new.role is distinct from old.role or new.status is distinct from old.status then
    select role::text into v_caller_role from public.profiles where id = v_uid and status = 'approved';
    if v_caller_role is null or v_caller_role <> 'admin' then
      raise exception 'Only an approved Admin can change a user role or account status';
    end if;
    if v_uid = new.id and new.role is distinct from old.role then
      raise exception 'Users cannot change their own role';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_prevent_self_role_escalation on public.profiles;
create trigger trg_prevent_self_role_escalation
before update on public.profiles
for each row execute function public.trg_fn_prevent_self_role_escalation();

revoke all on function public.admin_save_college_branding(text, text, text, text, text, text, text, jsonb) from public;
revoke all on function public.publish_exam_results_and_auto_supp(uuid, text, boolean) from public;
grant execute on function public.admin_save_college_branding(text, text, text, text, text, text, text, jsonb) to authenticated;
grant execute on function public.publish_exam_results_and_auto_supp(uuid, text, boolean) to authenticated;
