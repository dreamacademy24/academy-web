-- Additive: preserves all existing reports, issues and attachments.
alter table public.house_pending_items
 add column if not exists assignee text not null default '',
 add column if not exists next_action text not null default '',
 add column if not exists next_check date,
 add column if not exists updated_at timestamptz not null default now(),
 add column if not exists version integer not null default 1,
 add column if not exists files jsonb not null default '[]',
 add column if not exists created_by text;
create table if not exists public.house_issue_events (
 id uuid primary key default gen_random_uuid(),
 issue_id uuid not null references public.house_pending_items(id) on delete restrict,
 kind text not null check(kind in ('created','progress','comment','status')),
 content text not null default '',
 author_id text not null,
 author_name text not null,
 status text,
 files jsonb not null default '[]',
 created_at timestamptz not null default now()
);
create index if not exists house_issue_events_issue_date on public.house_issue_events(issue_id,created_at);
alter table public.house_issue_events enable row level security;
revoke all on public.house_issue_events from anon,authenticated;
grant all on public.house_issue_events to service_role;

create or replace function public.house_issue_write(p_id uuid,p_action text,p_data jsonb,p_author text,p_name text,p_version integer default null)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_id uuid; v_row house_pending_items; v_status text; v_text text; begin
 if p_author is null or length(p_author)=0 then raise exception 'author required'; end if;
 v_text:=trim(coalesce(p_data->>'content',''));
 if p_action='create' then
  if length(v_text)=0 or length(trim(coalesce(p_data->>'room_no','')))=0 then raise exception 'location and content required'; end if;
  insert into house_pending_items(room_no,content,status,assignee,next_action,next_check,files,created_by)
  values(trim(p_data->>'room_no'),v_text,'problem',coalesce(p_data->>'assignee',''),coalesce(p_data->>'next_action',''),nullif(p_data->>'next_check','')::date,coalesce(p_data->'files','[]'),p_author) returning id into v_id;
  insert into house_issue_events(issue_id,kind,content,author_id,author_name,status,files)
  values(v_id,'created',v_text,p_author,p_name,'problem',coalesce(p_data->'files','[]'));
 else
  select * into v_row from house_pending_items where id=p_id for update;
  if not found then raise exception 'issue not found'; end if;
  v_id:=v_row.id;
  if p_action not in ('comment','progress','status') then raise exception 'invalid action'; end if;
  if p_action<>'comment' and p_version is distinct from v_row.version then raise exception 'conflict: refresh and retry'; end if;
  v_status:=case when p_action='comment' then v_row.status else coalesce(p_data->>'status',v_row.status) end;
  if v_status not in ('problem','in_progress','check','done') then raise exception 'invalid status'; end if;
  if p_action='comment' and length(v_text)=0 then raise exception 'comment required'; end if;
  if p_action='progress' and length(v_text)=0 and jsonb_array_length(coalesce(p_data->'files','[]'))=0 then raise exception 'progress required'; end if;
  update house_pending_items set status=v_status,
   resolved_at=case when v_status='done' then coalesce(resolved_at,now()) else null end,
   assignee=case when p_action='comment' then assignee else coalesce(p_data->>'assignee',assignee) end,
   next_action=case when p_action='comment' then next_action else coalesce(p_data->>'next_action',next_action) end,
   next_check=case when p_action='comment' or not(p_data?'next_check') then next_check else nullif(p_data->>'next_check','')::date end,
   updated_at=now(),version=version+case when p_action='comment' then 0 else 1 end where id=v_id;
  insert into house_issue_events(issue_id,kind,content,author_id,author_name,status,files)
  values(v_id,p_action,v_text,p_author,p_name,v_status,coalesce(p_data->'files','[]'));
 end if;
 return v_id;
end $$;
revoke all on function public.house_issue_write(uuid,text,jsonb,text,text,integer) from public,anon,authenticated;
grant execute on function public.house_issue_write(uuid,text,jsonb,text,text,integer) to service_role;
create or replace view public.house_issues_summary with (security_invoker=true) as select i.*, (select e.content from public.house_issue_events e where e.issue_id=i.id and length(e.content)>0 order by e.created_at desc,e.id desc limit 1) as latest_note from public.house_pending_items i; revoke all on public.house_issues_summary from anon,authenticated; grant select on public.house_issues_summary to service_role;
