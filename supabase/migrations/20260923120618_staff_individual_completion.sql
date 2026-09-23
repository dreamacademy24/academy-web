alter table public.staff_tasks add column if not exists completion_by jsonb not null default '{}'::jsonb;

create or replace function public.staff_task_people(primary_id text, others jsonb)
returns text[] language plpgsql immutable security invoker set search_path='' as $$
declare parsed jsonb:=others; result text[];
begin
  if jsonb_typeof(parsed)='string' then
    begin parsed:=(parsed#>>'{}')::jsonb; exception when others then parsed:='[]'::jsonb; end;
  end if;
  if jsonb_typeof(parsed) is distinct from 'array' then parsed:='[]'::jsonb; end if;
  select coalesce(array_agg(distinct v),array[]::text[]) into result
  from (select primary_id v union all select jsonb_array_elements_text(parsed)) ids
  where v is not null and v<>'' and v<>'all';
  return result;
end $$;

-- Preserve already-completed work. No historical task changes its completed status.
update public.staff_tasks t set completion_by=(
  select coalesce(jsonb_object_agg(person,'"legacy-completed"'::jsonb),'{}'::jsonb)
  from unnest(public.staff_task_people(t.assignee,t.assignees)) person
) where (done=true or progress=100) and cardinality(public.staff_task_people(assignee,assignees))>1;

create or replace function public.staff_task_completion_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
declare people text[]; old_people text[]; completed integer;
begin
  people:=public.staff_task_people(new.assignee,new.assignees);
  if tg_op='UPDATE' then
    old_people:=public.staff_task_people(old.assignee,old.assignees);
    if new.completion_by is distinct from old.completion_by and current_user not in ('postgres','service_role','supabase_admin') then
      raise exception 'Use the signed-in completion endpoint' using errcode='42501';
    end if;
  elsif new.completion_by<>'{}'::jsonb and current_user not in ('postgres','service_role','supabase_admin') then
    raise exception 'Use the signed-in completion endpoint' using errcode='42501';
  end if;
  if cardinality(people)>1 or coalesce(cardinality(old_people),0)>1 then
    select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into new.completion_by
      from jsonb_each(new.completion_by) where key=any(people);
    select count(*) into completed from jsonb_object_keys(new.completion_by);
    new.done:=cardinality(people)>0 and completed=cardinality(people);
    new.progress:=case when cardinality(people)>0 then (100*completed/cardinality(people)) else 0 end;
  end if;
  return new;
end $$;
create trigger staff_task_completion_guard before insert or update on public.staff_tasks
for each row execute function public.staff_task_completion_guard();

create or replace function public.staff_complete_own_task(task_id text, actor text, completed boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.staff_tasks; people text[];
begin
  select * into t from public.staff_tasks where id=task_id for update;
  if not found then raise exception 'Task not found' using errcode='P0002'; end if;
  people:=public.staff_task_people(t.assignee,t.assignees);
  if not (actor=any(people)) then raise exception 'Only an assigned employee can complete their part' using errcode='42501'; end if;
  if completed then t.completion_by:=jsonb_set(t.completion_by,array[actor],to_jsonb(clock_timestamp()::text));
  else t.completion_by:=t.completion_by-actor; end if;
  update public.staff_tasks set completion_by=t.completion_by,
    done=completed,progress=case when completed then 100 else 0 end
    where id=task_id returning * into t;
  return to_jsonb(t);
end $$;
revoke all on function public.staff_complete_own_task(text,text,boolean) from public,anon,authenticated;
grant execute on function public.staff_complete_own_task(text,text,boolean) to service_role;

