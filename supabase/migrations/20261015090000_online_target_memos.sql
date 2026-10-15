create table if not exists public.online_target_memos (
 target_key text primary key,
 memo text not null default '' check (char_length(memo)<=1000),
 updated_by text not null,
 updated_at timestamptz not null default now()
);
alter table public.online_target_memos enable row level security;
revoke all on public.online_target_memos from anon, authenticated;
grant all on public.online_target_memos to service_role;
