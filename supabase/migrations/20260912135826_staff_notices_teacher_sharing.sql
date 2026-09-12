-- Deploy the staff notice API and both notice clients before applying this migration.
-- Ordinary Korean notices stay private unless an administrator explicitly shares them.
alter table public.staff_notices
 add column if not exists teacher_shared boolean not null default false;

update public.staff_notices
set teacher_shared=true
where id in (
 'student-care-release-20260912',
 'student-care-auto-directory-20260912',
 'student-care-session-menu-20260912'
);

-- Current production policy "all" grants every public client every operation.
-- Custom staff cookies are verified by the server API, not a browser Supabase JWT.
alter table public.staff_notices enable row level security;
drop policy if exists "all" on public.staff_notices;
revoke all privileges on table public.staff_notices from public,anon,authenticated;
grant select,insert,update,delete on table public.staff_notices to service_role;

comment on column public.staff_notices.teacher_shared is
 'Shared with active local teachers through the signed-session staff notices API. Existing notices default to Korean staff only.';
notify pgrst,'reload schema';
