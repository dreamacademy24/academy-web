alter table public.project_nodes add column if not exists work_order jsonb not null default '[]'::jsonb, add column if not exists work_order_revision integer not null default 0;
