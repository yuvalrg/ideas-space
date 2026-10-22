-- Extensions and enum types (spec sections 3 and 7).
-- Enum values are English; the Hebrew labels live in src/lib/i18n/he.json.
-- Changing an enum is a migration, not data.

create extension if not exists pg_trgm with schema extensions;

create type public.idea_status as enum ('new', 'discussion', 'review', 'approved', 'paused', 'dropped');

create type public.item_type as enum ('thought', 'question', 'info');

create type public.question_status as enum ('open', 'in_review', 'answered');

-- The 10 fixed development sections (spec decision 3).
create type public.section_key as enum (
  'audience',
  'problem',
  'value',
  'how_it_works',
  'existing_solutions',
  'opportunity',
  'revenue_model',
  'partners_suppliers',
  'costs_resources',
  'risks'
);

create type public.version_change_type as enum ('create', 'edit', 'restore');

create type public.allowed_email_status as enum ('invited', 'joined', 'removed');

create type public.resource_kind as enum ('link', 'file');
