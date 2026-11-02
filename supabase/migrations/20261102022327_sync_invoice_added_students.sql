-- Add new invoice students to both operational rosters in the same transaction.
-- Existing names, schedules, attendance and financial history are not overwritten.
create or replace function public.sync_invoice_added_students()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp as $$
declare
  b public.bookings;
  items jsonb;
  previous jsonb := '[]'::jsonb;
  candidate jsonb;
  source_student jsonb;
  existing_json jsonb;
  added public.students;
  named text;
  named_key text;
  bid uuid;
  changed boolean := false;
begin
  if jsonb_typeof(new.saved_data->'students') is distinct from 'array' then return new; end if;
  if tg_op='UPDATE' then
    if old.saved_data->'students' is not distinct from new.saved_data->'students' then return new; end if;
    if jsonb_typeof(old.saved_data->'students')='array' then previous:=old.saved_data->'students'; end if;
  end if;
  begin bid:=new.booking_id::uuid; exception when invalid_text_representation then return new; end;
  select * into b from public.bookings where id=bid for update;
  if not found or coalesce(b.status,'') ~* '취소|cancel' then return new; end if;
  items:=case when jsonb_typeof(b.students)='array' then b.students
    when jsonb_typeof(b.students)='string' then (b.students#>>'{}')::jsonb else '[]'::jsonb end;
  if jsonb_typeof(items) is distinct from 'array' then raise exception '예약 학생 명단을 먼저 확인해주세요.'; end if;
  for candidate in select value from jsonb_array_elements(new.saved_data->'students') loop
    named:=trim(coalesce(nullif(candidate->>'korName',''),candidate->>'name_kr',''));
    named_key:=regexp_replace(lower(named),'\s','','g');
    if named_key='' then continue; end if;
    -- A rename of a stable invoice row is not a new person. Do not recreate removed legacy names.
    if exists(select 1 from jsonb_array_elements(previous) old_s
      where regexp_replace(lower(coalesce(nullif(old_s->>'korName',''),old_s->>'name_kr','')),'\s','','g')=named_key
      or (nullif(candidate->>'id','') is not null and old_s->>'id'=candidate->>'id'
        and trim(coalesce(nullif(old_s->>'korName',''),old_s->>'name_kr',''))<>'')) then continue; end if;
    select value into existing_json from jsonb_array_elements(items)
      where regexp_replace(lower(coalesce(nullif(value->>'korName',''),value->>'name_kr','')),'\s','','g')=named_key limit 1;
    source_student:=coalesce(existing_json,candidate);
    select * into added from public.students where booking_id=bid
      and regexp_replace(lower(name_kr),'\s','','g')=named_key limit 1;
    if not found then
      insert into public.students(booking_id,name_kr,name_en,age,level,academy_start,academy_end,photo_allowed)
      values(bid,named,coalesce(source_student->>'engName',source_student->>'name_en'),source_student->>'age',
        case when coalesce(source_student->>'level',source_student->>'grade') in ('kinder','킨더') then 'kinder' else 'junior' end,
        nullif(coalesce(source_student->>'academyStart',source_student->>'academy_start'),'')::date,
        nullif(coalesce(source_student->>'academyEnd',source_student->>'academy_end'),'')::date,
        case when source_student ? 'photo_allowed' then (source_student->>'photo_allowed')::boolean else coalesce(source_student->>'photo','O')='O' end)
      returning * into added;
    end if;
    if existing_json is null then
      items:=items||jsonb_build_array(candidate||to_jsonb(added)||jsonb_build_object(
        'korName',added.name_kr,'engName',added.name_en,'academyStart',added.academy_start,'academyEnd',added.academy_end));
      changed:=true;
    end if;
  end loop;
  if changed then update public.bookings set students=items,children=greatest(coalesce(children,0),jsonb_array_length(items)) where id=bid; end if;
  return new;
end;
$$;
revoke all on function public.sync_invoice_added_students() from public, anon, authenticated;
grant execute on function public.sync_invoice_added_students() to service_role;
create trigger invoice_added_students_sync
after insert or update of saved_data on public.invoice_snapshots
for each row execute function public.sync_invoice_added_students();
