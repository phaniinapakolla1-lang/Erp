-- Migration 022: Bugfixes — Remove ambiguous 7-param update_own_profile overload & ensure clean grants
-- Safe to re-run.

-- Drop legacy 7-parameter overload from migration 014 so PostgREST resolves the 10-parameter version cleanly
drop function if exists public.update_own_profile(text, text, text, date, text, text, text);
