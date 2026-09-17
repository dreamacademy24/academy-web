create table public.fieldtrip_workspace (
 id text primary key, data jsonb not null, revision integer not null default 1,
 updated_by text not null, updated_at timestamptz not null default now()
);
create table public.fieldtrip_workspace_history (
 document_id text not null, revision integer not null, data jsonb not null,
 created_at timestamptz not null default now(), primary key(document_id,revision)
);
alter table public.fieldtrip_workspace enable row level security;
alter table public.fieldtrip_workspace_history enable row level security;
revoke all on public.fieldtrip_workspace,public.fieldtrip_workspace_history from public,anon,authenticated;
grant all on public.fieldtrip_workspace,public.fieldtrip_workspace_history to service_role;

create or replace function public.fieldtrip_document_save(p_id text,p_revision integer,p_data jsonb,p_actor text)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare d fieldtrip_workspace;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_id,0));
 select * into d from fieldtrip_workspace where id=p_id for update;
 if coalesce(d.revision,0)<>p_revision then raise exception 'CONFLICT document'; end if;
 if d.id is not null then insert into fieldtrip_workspace_history(document_id,revision,data) values(d.id,d.revision,d.data); end if;
 insert into fieldtrip_workspace(id,data,revision,updated_by) values(p_id,p_data,p_revision+1,p_actor)
 on conflict(id) do update set data=excluded.data,revision=excluded.revision,updated_by=excluded.updated_by,updated_at=now();
 return jsonb_build_object('revision',p_revision+1);
end $$;

create or replace function public.fieldtrip_month(p_month text,p_action text default 'load',p_revision integer default 0,p_items jsonb default '[]',p_fingerprint text default '',p_actor text default '')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare d fieldtrip_workspace; live jsonb; fingerprint text; item jsonb; result jsonb; draft jsonb;
begin
 if p_month !~ '^20[0-9]{2}-(0[1-9]|1[0-2])$' then raise exception 'Invalid month'; end if;
 perform pg_advisory_xact_lock(hashtextextended('month:'||p_month,0));
 -- Lock existing live rows against legacy concurrent editors as well.
 perform 1 from schedule_items where deploy_month=p_month and type in ('afterschool','fieldtrip') for update;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'date',date,'type',type,'title',title,'description',coalesce(description,''),'is_deployed',is_deployed) order by id),'[]') into live from schedule_items where deploy_month=p_month and type in ('afterschool','fieldtrip');
 fingerprint:=md5(live::text);
 select * into d from fieldtrip_workspace where id='month:'||p_month for update;
 if p_action='load' then return jsonb_build_object('revision',coalesce(d.revision,0),'items',coalesce(d.data->'items',live),'fingerprint',coalesce(d.data->>'fingerprint',fingerprint),'live',live,'conflict',d.id is not null and d.data->>'fingerprint'<>fingerprint); end if;
 if p_revision<>coalesce(d.revision,0) or p_fingerprint<>fingerprint then raise exception 'CONFLICT month'; end if;
 if p_action='save' then
  if jsonb_typeof(p_items)<>'array' then raise exception 'Invalid items';end if;
  if exists(select 1 from jsonb_array_elements(live) l where not exists(select 1 from jsonb_array_elements(p_items) i where i->>'id'=l->>'id')) then raise exception 'Existing schedule must be preserved';end if;
  result:=fieldtrip_document_save('month:'||p_month,p_revision,jsonb_build_object('items',p_items,'fingerprint',fingerprint),p_actor);
 elsif p_action='publish' then
  if d.id is null then raise exception 'Save first';end if;
  draft:=d.data->'items';
  for item in select value from jsonb_array_elements(draft) loop
   if item->>'type' not in ('afterschool','fieldtrip') or left(item->>'date',7)<>p_month or length(trim(item->>'title'))=0 then raise exception 'Invalid schedule';end if;
   if exists(select 1 from schedule_items where id=(item->>'id')::uuid and (deploy_month is distinct from p_month or type not in ('afterschool','fieldtrip'))) then raise exception 'CONFLICT schedule identity';end if;
   insert into schedule_items(id,type,date,title,description,is_deployed,deploy_month)
   values((item->>'id')::uuid,item->>'type',(item->>'date')::date,item->>'title',coalesce(item->>'description',''),true,p_month)
   on conflict(id) do update set type=excluded.type,date=excluded.date,title=excluded.title,description=excluded.description,is_deployed=true,updated_at=now();
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('id',id,'date',date,'type',type,'title',title,'description',coalesce(description,''),'is_deployed',is_deployed) order by id),'[]') into live from schedule_items where deploy_month=p_month and type in ('afterschool','fieldtrip');
  fingerprint:=md5(live::text);
  select coalesce(jsonb_agg(value||'{"is_deployed":true}'::jsonb),'[]') into draft from jsonb_array_elements(draft);
  result:=fieldtrip_document_save('month:'||p_month,p_revision,jsonb_build_object('items',draft,'fingerprint',fingerprint),p_actor);
 else raise exception 'Invalid action'; end if;
 return fieldtrip_month(p_month,'load');
end $$;
revoke all on function public.fieldtrip_document_save(text,integer,jsonb,text) from public,anon,authenticated;
revoke all on function public.fieldtrip_month(text,text,integer,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.fieldtrip_document_save(text,integer,jsonb,text),public.fieldtrip_month(text,text,integer,jsonb,text,text) to service_role;
