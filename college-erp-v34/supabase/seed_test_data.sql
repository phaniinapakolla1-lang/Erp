-- Optional Test Data Seed Script (For Testing / Staging Only — Do NOT run in production with real student data)
-- Run in Supabase Dashboard -> SQL Editor AFTER migrations 001 through 018.
-- Safe & idempotent: uses existing approved users in public.profiles and ON CONFLICT DO NOTHING.

do $$
declare
  v_dept_cs uuid;
  v_dept_it uuid;
  v_ay_id uuid;
  v_sem_id uuid;
  v_prog_cs uuid;
  v_sec_a uuid;
  v_sec_b uuid;
  v_sub_dbms uuid;
  v_sub_os uuid;
  v_sub_lab uuid;
  v_faculty_id uuid;
  v_admin_id uuid;
  v_ta_dbms uuid;
  v_ta_os uuid;
  v_ta_lab uuid;
  v_sess1 uuid;
  v_sess2 uuid;
  v_sess3 uuid;
  v_stu record;
  v_roll_counter int := 101;
begin
  -- Pick an approved admin and faculty (fallback to admin if no faculty exists yet)
  select id into v_admin_id from public.profiles where role = 'admin' and status = 'approved' order by created_at limit 1;
  select id into v_faculty_id from public.profiles where role in ('faculty', 'hod') and status = 'approved' order by created_at limit 1;
  if v_faculty_id is null then v_faculty_id := v_admin_id; end if;

  if v_admin_id is null then
    raise notice 'No approved admin profile found. Approve at least one admin in public.profiles first, then re-run seed_test_data.sql.';
    return;
  end if;

  -- 1. Departments
  insert into public.departments (code, name) values ('CS', 'Computer Science & Applications') on conflict (code) do nothing;
  insert into public.departments (code, name) values ('IT', 'Information Technology') on conflict (code) do nothing;
  select id into v_dept_cs from public.departments where code = 'CS' limit 1;
  select id into v_dept_it from public.departments where code = 'IT' limit 1;

  -- 2. Academic Year & Active Semester
  select id into v_ay_id from public.academic_years where is_current = true limit 1;
  if v_ay_id is null then
    insert into public.academic_years (label, start_date, end_date, is_current)
    values ('2026-27', '2026-07-01', '2027-06-30', true)
    returning id into v_ay_id;
  end if;

  select id into v_sem_id from public.semesters where is_active = true limit 1;
  if v_sem_id is null then
    insert into public.semesters (academic_year_id, number, label, is_active)
    values (v_ay_id, 1, 'Semester 1', true)
    returning id into v_sem_id;
  end if;

  -- 3. Program & Class Sections
  insert into public.programs (department_id, code, name, duration_years)
  values (v_dept_cs, 'CS-PROG', 'MCA Computer Applications', 2)
  on conflict (code) do nothing;
  select id into v_prog_cs from public.programs where code = 'CS-PROG' limit 1;

  select id into v_sec_a from public.class_sections where program_id = v_prog_cs and semester_id = v_sem_id and name = 'MCA Year 1' and section_code = 'A' limit 1;
  if v_sec_a is null then
    insert into public.class_sections (program_id, semester_id, name, section_code)
    values (v_prog_cs, v_sem_id, 'MCA Year 1', 'A')
    returning id into v_sec_a;
  end if;

  select id into v_sec_b from public.class_sections where program_id = v_prog_cs and semester_id = v_sem_id and name = 'MCA Year 1' and section_code = 'B' limit 1;
  if v_sec_b is null then
    insert into public.class_sections (program_id, semester_id, name, section_code)
    values (v_prog_cs, v_sem_id, 'MCA Year 1', 'B')
    returning id into v_sec_b;
  end if;

  -- 4. Subjects (Theory & Practical)
  insert into public.subjects (department_id, code, name, credits, subject_type)
  values (v_dept_cs, 'CS501', 'Database Management Systems', 4, 'theory')
  on conflict (code) do nothing;
  insert into public.subjects (department_id, code, name, credits, subject_type)
  values (v_dept_cs, 'CS502', 'Operating Systems', 4, 'theory')
  on conflict (code) do nothing;
  insert into public.subjects (department_id, code, name, credits, subject_type)
  values (v_dept_cs, 'CS503L', 'DBMS & SQL Lab', 2, 'practical')
  on conflict (code) do nothing;

  select id into v_sub_dbms from public.subjects where code = 'CS501' limit 1;
  select id into v_sub_os from public.subjects where code = 'CS502' limit 1;
  select id into v_sub_lab from public.subjects where code = 'CS503L' limit 1;

  -- 5. Teaching Assignments
  insert into public.teaching_assignments (faculty_id, subject_id, class_section_id, semester_id)
  values (v_faculty_id, v_sub_dbms, v_sec_a, v_sem_id)
  on conflict do nothing;
  insert into public.teaching_assignments (faculty_id, subject_id, class_section_id, semester_id)
  values (v_faculty_id, v_sub_os, v_sec_a, v_sem_id)
  on conflict do nothing;
  insert into public.teaching_assignments (faculty_id, subject_id, class_section_id, semester_id)
  values (v_faculty_id, v_sub_lab, v_sec_a, v_sem_id)
  on conflict do nothing;

  select id into v_ta_dbms from public.teaching_assignments where subject_id = v_sub_dbms and class_section_id = v_sec_a limit 1;
  select id into v_ta_os from public.teaching_assignments where subject_id = v_sub_os and class_section_id = v_sec_a limit 1;
  select id into v_ta_lab from public.teaching_assignments where subject_id = v_sub_lab and class_section_id = v_sec_a limit 1;

  -- 6. Timetable Slots (skip safely if slot already exists or clashes with existing data)
  begin
    if v_ta_dbms is not null and not exists (select 1 from public.weekly_schedule_slots where teaching_assignment_id = v_ta_dbms and day_of_week = 1) then
      insert into public.weekly_schedule_slots (teaching_assignment_id, day_of_week, start_time, end_time, room)
      values (v_ta_dbms, 1, '09:30', '10:30', 'LH 101');
    end if;
  exception when raise_exception then null;
  end;
  begin
    if v_ta_os is not null and not exists (select 1 from public.weekly_schedule_slots where teaching_assignment_id = v_ta_os and day_of_week = 2) then
      insert into public.weekly_schedule_slots (teaching_assignment_id, day_of_week, start_time, end_time, room)
      values (v_ta_os, 2, '10:30', '11:30', 'LH 102');
    end if;
  exception when raise_exception then null;
  end;
  begin
    if v_ta_lab is not null and not exists (select 1 from public.weekly_schedule_slots where teaching_assignment_id = v_ta_lab and day_of_week = 3) then
      insert into public.weekly_schedule_slots (teaching_assignment_id, day_of_week, start_time, end_time, room)
      values (v_ta_lab, 3, '14:00', '16:00', 'Lab 302');
    end if;
  exception when raise_exception then null;
  end;

  -- 7. Enroll existing approved students into MCA Year 1 · Sec A & assign Roll Numbers if missing
  for v_stu in select id from public.profiles where role = 'student' and status = 'approved' order by created_at loop
    update public.profiles set department_id = coalesce(department_id, v_dept_cs) where id = v_stu.id;
    insert into public.student_profiles (user_id, roll_no, student_code, admission_year)
    values (v_stu.id, '24MCA' || v_roll_counter, '24MCA' || v_roll_counter, 2026)
    on conflict (user_id) do nothing;
    insert into public.enrollments (student_id, class_section_id, is_active)
    values (v_stu.id, v_sec_a, true)
    on conflict (student_id, class_section_id) do nothing;
    v_roll_counter := v_roll_counter + 1;
  end loop;

  -- 8. Sample Attendance Sessions & Records (last 3 days)
  if v_ta_dbms is not null then
    insert into public.attendance_sessions (teaching_assignment_id, session_date, slot_number, status, recorded_by)
    values (v_ta_dbms, current_date - 2, 1, 'conducted', v_faculty_id)
    on conflict (teaching_assignment_id, session_date, slot_number) do nothing;
    select id into v_sess1 from public.attendance_sessions where teaching_assignment_id = v_ta_dbms and session_date = current_date - 2 and slot_number = 1 limit 1;

    insert into public.attendance_sessions (teaching_assignment_id, session_date, slot_number, status, recorded_by)
    values (v_ta_dbms, current_date - 1, 1, 'conducted', v_faculty_id)
    on conflict (teaching_assignment_id, session_date, slot_number) do nothing;
    select id into v_sess2 from public.attendance_sessions where teaching_assignment_id = v_ta_dbms and session_date = current_date - 1 and slot_number = 1 limit 1;
  end if;

  if v_ta_lab is not null then
    insert into public.attendance_sessions (teaching_assignment_id, session_date, slot_number, status, recorded_by)
    values (v_ta_lab, current_date - 1, 5, 'conducted', v_faculty_id)
    on conflict (teaching_assignment_id, session_date, slot_number) do nothing;
    select id into v_sess3 from public.attendance_sessions where teaching_assignment_id = v_ta_lab and session_date = current_date - 1 and slot_number = 5 limit 1;
  end if;

  for v_stu in select student_id from public.enrollments where class_section_id = v_sec_a and is_active = true loop
    if v_sess1 is not null then
      insert into public.attendance_records (session_id, student_id, status) values (v_sess1, v_stu.student_id, 'present') on conflict do nothing;
    end if;
    if v_sess2 is not null then
      insert into public.attendance_records (session_id, student_id, status) values (v_sess2, v_stu.student_id, 'absent') on conflict do nothing;
    end if;
    if v_sess3 is not null then
      insert into public.attendance_records (session_id, student_id, status) values (v_sess3, v_stu.student_id, 'present') on conflict do nothing;
    end if;
  end loop;

  -- 9. Sample Assignment
  if v_ta_dbms is not null and not exists (select 1 from public.assignments where title = 'DBMS Unit 1 — ER Modeling & 3NF') then
    insert into public.assignments (teaching_assignment_id, title, description, due_at, max_marks, allow_late_submission, state, created_by)
    values (
      v_ta_dbms,
      'DBMS Unit 1 — ER Modeling & 3NF',
      'Draw a complete ER diagram for a College Library and normalize tables up to 3NF. Upload PDF to Google Drive (Anyone with link – Viewer) and paste link.',
      now() + interval '7 days',
      20,
      true,
      'published',
      v_faculty_id
    );
  end if;

  -- 10. Sample Learning Resource, Syllabus Topics, Announcement & Calendar Event
  if v_ta_dbms is not null and not exists (select 1 from public.learning_resources where title = 'DBMS Unit 1 Lecture Slides') then
    insert into public.learning_resources (teaching_assignment_id, title, description, resource_url, resource_type, created_by)
    values (v_ta_dbms, 'DBMS Unit 1 Lecture Slides', 'Introduction to ER Models, Keys, and Relational Algebra.', 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view', 'slides', v_faculty_id);
  end if;

  if v_ta_dbms is not null and not exists (select 1 from public.syllabus_topics where teaching_assignment_id = v_ta_dbms) then
    insert into public.syllabus_topics (teaching_assignment_id, unit_title, topic_title, planned_periods, status, completed_date, updated_by)
    values
      (v_ta_dbms, 'Unit 1', 'Database Architecture & ER Modeling', 4, 'completed', current_date - 2, v_faculty_id),
      (v_ta_dbms, 'Unit 2', 'Relational Algebra & SQL Joins', 5, 'in_progress', null, v_faculty_id),
      (v_ta_dbms, 'Unit 3', 'Normalization (1NF, 2NF, 3NF, BCNF)', 4, 'not_started', null, v_faculty_id);
  end if;

  if not exists (select 1 from public.announcements where title = 'Welcome to Semester 1 Academic Portal') then
    insert into public.announcements (title, body, target_role, created_by)
    values ('Welcome to Semester 1 Academic Portal', 'Timetables, attendance tracking, learning resources, and Drive assignment submissions are now live for Semester 1.', 'all', v_admin_id);
  end if;

  if not exists (select 1 from public.calendar_events where title = 'Mid-Semester Internal Assessment Week') then
    insert into public.calendar_events (title, description, event_type, start_at, end_at, created_by)
    values ('Mid-Semester Internal Assessment Week', 'Internal exams for Semester 1 subjects.', 'college_event', now() + interval '14 days', now() + interval '18 days', v_admin_id);
  end if;

  raise notice 'Test data seeded successfully!';
end $$;
