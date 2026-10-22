-- seed.sql (from seed.template.sql)
-- Run by `supabase db reset` (local) or `supabase db push --include-seed` (dev). Safe to re-run.
-- Code and column names are English; only the values shown to users are Hebrew.

-- 1. Workspace name (one row). Editable later in the settings screen.
insert into app_settings (key, value) values
  ('workspace_name', 'מרחב רעיונות משותף')
on conflict (key) do nothing;

-- 2. The 7 starter categories (decided 21.10.2026). Colors are suggestions; adjust freely.
insert into categories (name, color, sort_order, is_active) values
  ('טיול או מסלול',        '#2563eb', 1, true),
  ('חוויה',                '#7c3aed', 2, true),
  ('שירות',                '#0891b2', 3, true),
  ('מוצר או אפליקציה',     '#059669', 4, true),
  ('שיתוף פעולה',          '#d97706', 5, true),
  ('קהילה',                '#db2777', 6, true),
  ('אחר',                  '#6b7280', 7, true)
on conflict (name) do nothing;

-- 3. Allowed partner emails (2-4 rows), lowercase.
-- Each becomes 'joined' automatically via the auth trigger on first sign-in.
insert into allowed_emails (email, status) values
  ('yuvalr2d2@gmail.com', 'invited'),
  ('ragoler@hotmail.com', 'invited')
on conflict (email) do nothing;
