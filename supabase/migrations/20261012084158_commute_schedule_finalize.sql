alter table public.pickup_schedules
 add column if not exists finalized_at timestamptz,
 add column if not exists finalized_by text,
 add column if not exists finalized_data jsonb;
