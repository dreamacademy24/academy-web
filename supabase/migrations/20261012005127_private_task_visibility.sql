-- Private tasks use the authenticated staff endpoint; direct browser queries
-- cannot read or change private tasks or their comments.
alter table public.staff_tasks enable row level security;
alter table public.staff_task_comments enable row level security;
create policy private_task_guard on public.staff_tasks as restrictive
for all to anon, authenticated
using (secret is not true) with check (secret is not true);
create policy private_task_comment_guard on public.staff_task_comments as restrictive
for all to anon, authenticated
using (exists (select 1 from public.staff_tasks t where t.id=task_id and t.secret is not true))
with check (exists (select 1 from public.staff_tasks t where t.id=task_id and t.secret is not true));
