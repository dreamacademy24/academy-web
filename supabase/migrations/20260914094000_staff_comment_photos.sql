alter table public.staff_task_comments add column files jsonb not null default '[]'::jsonb check(jsonb_typeof(files)='array' and jsonb_array_length(files)<=10);
