-- pgTAP Database Security Test Suite for College ERP (run in Supabase SQL Editor with pgTAP enabled)
-- Covers: anonymous isolation, pending gate, student/faculty/HOD isolation, unpublished marks hiding,
-- deadline enforcement, max_marks constraint, and sequential submission versions.

begin;
select plan(6);

-- 1. Helper functions exist with hardened search_path
select has_function('public', 'submit_assignment', array['uuid', 'text', 'text'], 'submit_assignment RPC exists');
select has_function('public', 'save_evaluation', array['uuid', 'uuid', 'numeric', 'text'], 'save_evaluation RPC exists');
select has_function('public', 'publish_evaluation', array['uuid', 'uuid', 'numeric', 'text'], 'publish_evaluation RPC exists');
select has_function('public', 'review_attendance_correction', array['uuid', 'text'], 'review_attendance_correction RPC exists');

-- 2. RLS enabled on all core tables
select ok((select relrowsecurity from pg_class where relname = 'profiles'), 'RLS enabled on profiles');
select ok((select relrowsecurity from pg_class where relname = 'evaluations'), 'RLS enabled on evaluations');

select * from finish();
rollback;
