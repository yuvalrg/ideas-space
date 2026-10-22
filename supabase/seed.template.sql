-- seed.template.sql
-- Copy to supabase/seed.sql, fill the INSERT placeholders, then run `supabase db reset` (dev) or apply once (prod).
-- Code and column names are English; only the values shown to users are Hebrew.

-- 1. Workspace name (one row). INSERT: replace the placeholder.
insert into app_settings (key, value) values
  ('workspace_name', 'INSERT: שם המרחב כאן');   -- e.g. 'מרחב הרעיונות שלנו'

-- 2. The 7 starter categories (decided 21.10.2026). Colors are suggestions; adjust freely.
insert into categories (name, color, sort_order, is_active) values
  ('טיול או מסלול',        '#2563eb', 1, true),
  ('חוויה',                '#7c3aed', 2, true),
  ('שירות',                '#0891b2', 3, true),
  ('מוצר או אפליקציה',     '#059669', 4, true),
  ('שיתוף פעולה',          '#d97706', 5, true),
  ('קהילה',                '#db2777', 6, true),
  ('אחר',                  '#6b7280', 7, true);

-- 3. Allowed partner emails (2-4 rows). INSERT: one row per partner, lowercase emails.
-- The first person to sign in becomes 'joined' automatically via the auth trigger.
insert into allowed_emails (email, status) values
  ('INSERT: partner1@example.com', 'invited'),
  ('INSERT: partner2@example.com', 'invited');
  -- add partner3 / partner4 rows if needed
