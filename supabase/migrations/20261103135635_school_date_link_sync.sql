-- One atomic date fan-out, without changing pricing, attendance or completed tasks.
create or replace function public.school_student_array(raw jsonb) returns jsonb
language plpgsql immutable security invoker set search_path=public,pg_temp as $$
begin
 if jsonb_typeof(raw)='string' then raw:=(raw#>>'{}')::jsonb; end if;
 return case when jsonb_typeof(raw)='array' then raw else '[]'::jsonb end;
end $$;
create or replace function public.school_name(raw jsonb) returns text
language sql immutable security invoker set search_path=public,pg_temp as $$
 select regexp_replace(lower(trim(coalesce(nullif(raw->>'korName',''),raw->>'name_kr',''))),'\s','','g')
$$;
create or replace function public.school_patch_dates(raw jsonb,student_name text,patch jsonb) returns jsonb
language sql immutable security invoker set search_path=public,pg_temp as $$
 select coalesce(jsonb_agg(case when public.school_name(v)=regexp_replace(lower(trim(student_name)),'\s','','g') then v||patch else v end order by ord),'[]'::jsonb)
 from jsonb_array_elements(public.school_student_array(raw)) with ordinality a(v,ord)
$$;

create or replace function public.sync_student_school_dates() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare patch jsonb:='{}'; old_guard text:=current_setting('app.school_date_sync',true); lo date; hi date;
begin
 if old_guard='on' then return new; end if;
 if new.academy_start is distinct from old.academy_start then patch:=patch||jsonb_build_object('academyStart',new.academy_start,'academy_start',new.academy_start); end if;
 if new.academy_end is distinct from old.academy_end then patch:=patch||jsonb_build_object('academyEnd',new.academy_end,'academy_end',new.academy_end); end if;
 if patch='{}'::jsonb then return new; end if;
 if new.academy_end<new.academy_start then raise exception '수업 종료일이 시작일보다 빠릅니다.'; end if;
 perform set_config('app.school_date_sync','on',true);
 update public.bookings set students=public.school_patch_dates(students,new.name_kr,patch) where id=new.booking_id;
 update public.invoice_snapshots set saved_data=jsonb_set(saved_data,'{students}',public.school_patch_dates(saved_data->'students',new.name_kr,patch))
 where booking_id=new.booking_id and jsonb_typeof(saved_data->'students')='array';
 select min(academy_start),max(academy_end) into lo,hi from public.students where booking_id=new.booking_id;
 -- Aggregate only the dimension explicitly changed; do not silently repair other disagreements.
 update public.bookings set academy_start=case when patch?'academyStart' then lo else academy_start end,
 academy_end=case when patch?'academyEnd' then hi else academy_end end where id=new.booking_id;
 if patch?'academyStart' and new.academy_start is not null then
  update public.checkin_preparation_receipts set followup_due=new.academy_start,revision=revision+1,updated_at=now()
  where booking_id=new.booking_id and regexp_replace(lower(trim(student_name)),'\s','','g')=regexp_replace(lower(trim(new.name_kr)),'\s','','g')
   and medicine_at is null and (followup_due<new.academy_start or followup_due=old.academy_start);
 end if;
 perform set_config('app.school_date_sync',coalesce(old_guard,''),true);
 return new;
end $$;

create or replace function public.ingest_school_date_changes() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare before_items jsonb; after_items jsonb; item jsonb; prev jsonb; bid uuid; start_changed boolean; end_changed boolean; sd date; ed date; cnt integer;
begin
 if current_setting('app.school_date_sync',true)='on' then return new; end if;
 if tg_table_name='bookings' then bid:=new.id; before_items:=public.school_student_array(old.students);after_items:=public.school_student_array(new.students);
 else bid:=new.booking_id;before_items:=public.school_student_array(old.saved_data->'students');after_items:=public.school_student_array(new.saved_data->'students');end if;
 for item in select value from jsonb_array_elements(after_items) loop
  if public.school_name(item)='' then continue;end if;
  select value into prev from jsonb_array_elements(before_items) where public.school_name(value)=public.school_name(item) limit 1;
  if prev is null then continue;end if; -- New students are handled by the existing enrollment flow.
  start_changed:=(item->>'academyStart') is distinct from (prev->>'academyStart') or (item->>'academy_start') is distinct from (prev->>'academy_start');
  end_changed:=(item->>'academyEnd') is distinct from (prev->>'academyEnd') or (item->>'academy_end') is distinct from (prev->>'academy_end');
  if not start_changed and not end_changed then continue;end if;
  sd:=nullif(case when (item->>'academyStart') is distinct from (prev->>'academyStart') then item->>'academyStart' else item->>'academy_start' end,'')::date;
  ed:=nullif(case when (item->>'academyEnd') is distinct from (prev->>'academyEnd') then item->>'academyEnd' else item->>'academy_end' end,'')::date;
  select count(*) into cnt from public.students where booking_id=bid and regexp_replace(lower(trim(name_kr)),'\s','','g')=public.school_name(item);
  if cnt<>1 then raise exception '학생 일정 연결을 확인해주세요: % (일치 %건)',public.school_name(item),cnt;end if;
  update public.students set academy_start=case when start_changed then sd else academy_start end,academy_end=case when end_changed then ed else academy_end end
  where booking_id=bid and regexp_replace(lower(trim(name_kr)),'\s','','g')=public.school_name(item);
 end loop;
 return new;
end $$;
create trigger school_dates_from_students after update of academy_start,academy_end on public.students for each row execute function public.sync_student_school_dates();
create trigger school_dates_from_booking after update of students on public.bookings for each row execute function public.ingest_school_date_changes();
create trigger school_dates_from_invoice after update of saved_data on public.invoice_snapshots for each row execute function public.ingest_school_date_changes();

create or replace function public.sync_booking_school_dates() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if current_setting('app.school_date_sync',true)='on' then return new;end if;
 if new.academy_start is not distinct from old.academy_start and new.academy_end is not distinct from old.academy_end then return new;end if;
 update public.students set
 academy_start=case when new.academy_start is distinct from old.academy_start then new.academy_start else academy_start end,
 academy_end=case when new.academy_end is distinct from old.academy_end then new.academy_end else academy_end end where booking_id=new.id;
 return new;
end $$;
create trigger school_dates_from_booking_period after update of academy_start,academy_end on public.bookings for each row execute function public.sync_booking_school_dates();

-- Moving a reminder is not completion. Preserve task IDs, comments and progress.
create or replace function public.checkin_receipt_changed() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.medicine_at is not null then
  update public.staff_tasks set done=true,progress=100 where id like 'medication-followup:'||new.booking_id||':'||md5(new.student_name)||':%' and not done;
 elsif new.followup_due is distinct from old.followup_due then
  update public.staff_tasks set due=new.followup_due::text where id like 'medication-followup:'||new.booking_id||':'||md5(new.student_name)||':%' and not done;
 end if;
 return new;
end $$;

create or replace function public.sync_medication_followups() returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare r record;people text[];tid text;safe_name text;today date:=(now() at time zone 'Asia/Manila')::date; school_start date;school_end date;
begin
 insert into public.checkin_preparation_receipts(booking_id,student_name,followup_due)
 select b.id,trim(coalesce(nullif(j->>'korName',''),j->>'name_kr')),coalesce(s.academy_start,nullif(coalesce(j->>'academyStart',j->>'academy_start'),'')::date,b.academy_start)
 from public.bookings b cross join lateral jsonb_array_elements(public.school_student_array(b.students)) j
 left join public.students s on s.booking_id=b.id and regexp_replace(lower(trim(s.name_kr)),'\s','','g')=public.school_name(j)
 where coalesce(s.academy_start,nullif(coalesce(j->>'academyStart',j->>'academy_start'),'')::date,b.academy_start) is not null
 and coalesce(s.academy_end,b.academy_end,b.checkout_date)>=today and coalesce(b.status,'')!~*'취소|cancel'
 and public.school_name(j)<>'' on conflict do nothing;
 for r in select p.*,b.assignee,b.care_assignee,b.status,b.academy_start booking_start,b.academy_end booking_end,b.checkout_date
 from public.checkin_preparation_receipts p join public.bookings b on b.id=p.booking_id loop
  select s.academy_start,s.academy_end into school_start,school_end from public.students s where s.booking_id=r.booking_id
   and regexp_replace(lower(trim(s.name_kr)),'\s','','g')=regexp_replace(lower(trim(r.student_name)),'\s','','g') limit 1;
  school_start:=coalesce(school_start,r.booking_start);school_end:=coalesce(school_end,r.booking_end,r.checkout_date);
  if r.medicine_at is not null or school_end<today or coalesce(r.status,'')~*'취소|cancel' then continue;end if;
  if school_start is null then continue;end if;
  if r.followup_due<school_start then
   update public.checkin_preparation_receipts set followup_due=school_start,revision=revision+1,updated_at=now() where booking_id=r.booking_id and student_name=r.student_name;
   r.followup_due:=school_start;
  end if;
  if school_start>today or r.followup_due>today or r.followup_due<=date '2026-09-18' then continue;end if;
  if exists(select 1 from public.staff_tasks where id like 'medication-followup:'||r.booking_id||':'||md5(r.student_name)||':%' and not done) then continue;end if;
  tid:='medication-followup:'||r.booking_id||':'||md5(r.student_name)||':'||r.followup_due;
  select coalesce(array_agg(distinct regexp_replace(a.username,'^admin-','')),'{}') into people from public.staff_accounts a where a.is_active and a.role='korean_admin'
  and exists(select 1 from unnest(array[r.assignee,r.care_assignee]) n where lower(trim(n)) in (lower(a.name),lower(a.username),lower(regexp_replace(a.username,'^admin-',''))));
  safe_name:=replace(replace(replace(r.student_name,'&','&amp;'),'<','&lt;'),'>','&gt;');
  insert into public.staff_tasks(id,title,assignee,assignees,due,created_at,note,done,shared,created_by)
  values(tid,'[상비약 수령 확인·재안내] '||r.student_name,coalesce(people[1],''),to_jsonb(people),r.followup_due::text,now()::text,
   '<p>'||safe_name||' 학생 수업 시작일: '||school_start||'. 실제 약 수령 여부를 확인하고 미수령이면 보호자에게 안내해주세요.</p><p><a href="/admin/med-forms?bookingId='||r.booking_id||'">전달·수령 확인하기</a></p><p>앱 제출과 실제 약 수령은 별도입니다. 재안내 후 다음 확인일을 지정해주세요.</p>',false,true,'system') on conflict(id) do nothing;
 end loop;
end $$;
revoke all on function public.sync_student_school_dates(),public.ingest_school_date_changes(),public.sync_booking_school_dates() from public,anon;
revoke all on function public.sync_medication_followups(),public.checkin_receipt_changed() from public,anon,authenticated;
grant execute on function public.sync_medication_followups() to service_role;
