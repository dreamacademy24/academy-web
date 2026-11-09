update public.staff_checklist_items set assignee=concat_ws(',',nullif(assignee,''),'system')
where id in ('adccf321-2c63-439e-b17b-967d383c5af2','145cabe6-c825-4e04-bbde-a7e78445adb8') and not ('system'=any(string_to_array(assignee,',')));

create or replace function public.sync_dreamy_checkin_flights() returns jsonb language plpgsql set search_path=public,pg_temp as $$
declare today date:=(now() at time zone 'Asia/Manila')::date; occ date; r record; it record; issues text:=''; reason text; actor text; recipients text[]:=array[]::text[]; ticket text; new_id text; added int:=0; flagged int:=0;
begin
perform pg_advisory_xact_lock(hashtext('sync_dreamy_checkin_flights'));
occ:=date_trunc('week',today::timestamp)::date+1;
create temporary table flight_review_rows on commit drop as
select b.id,b.booker_name,b.checkin_date,least(b.checkin_date,b.extra_stay_checkin) arrival_checkin,b.assignee,
to_char(b.checkin_date,'MM/DD')||' '||coalesce(nullif(trim(b.booker_name),''),b.reservation_no,'고객') label,
(c.submitted_at is not null or c.admin_saved_at is not null) submitted,
exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(b.flight_images)='array' then b.flight_images else '[]'::jsonb end) img where img ~ '^https?://') has_ticket,
c.flight_in_date detail_date, bd.arrival_date booking_date,c.flight_in_time detail_time,b.flight_in_time booking_time,
coalesce(c.flight_in_date,bd.arrival_date) arrival, coalesce(nullif(trim(c.flight_in_time),''),nullif(trim(b.flight_in_time),'')) tm,
coalesce(c.flight_in_undecided,b.flight_in_undecided,false) undecided
from bookings b cross join lateral (select case when b.flight_in_date ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and pg_input_is_valid(b.flight_in_date,'date') then b.flight_in_date::date end as arrival_date) bd left join lateral (select * from checkin_details d where d.booking_id=b.id order by greatest(d.submitted_at,d.admin_saved_at,d.updated_at) desc nulls last limit 1)c on true
where b.checkin_date between least(occ,today) and greatest(occ,today)+62 and coalesce(b.status,'') !~* '취소|cancel'
and not ((coalesce(b.booking_type,'') like '%commute%' or coalesce(b.accom_type,'') like '%통학%') and trim(coalesce(nullif(b.house_no,''),b.accom_room,''))='');
create temporary table verified_flight_keys(item_key text primary key) on commit drop;
for it in select id,smart_key from staff_checklist_items where active and 'system'=any(string_to_array(assignee,',')) and id in ('adccf321-2c63-439e-b17b-967d383c5af2','145cabe6-c825-4e04-bbde-a7e78445adb8') loop
 insert into verified_flight_keys select it.id::text||'#'||label from flight_review_rows where checkin_date between occ+(case it.smart_key when 'checkin_8w' then 56 else 21 end) and occ+(case it.smart_key when 'checkin_8w' then 62 else 27 end)
 group by label having count(*)=1 and bool_and(submitted and has_ticket);
end loop;
delete from staff_daily_check d where d.checked_by='system' and d.check_date=occ and strpos(d.item_key,'#')>0 and split_part(d.item_key,'#',1) in ('adccf321-2c63-439e-b17b-967d383c5af2','145cabe6-c825-4e04-bbde-a7e78445adb8') and not exists(select 1 from verified_flight_keys k where k.item_key=d.item_key);
insert into staff_daily_check(check_date,item_key,checked,checked_by) select occ,item_key,true,'system' from verified_flight_keys on conflict(check_date,item_key) do nothing;
get diagnostics added=row_count;
for it in select id,smart_key from staff_checklist_items where active and 'system'=any(string_to_array(assignee,',')) and id in ('adccf321-2c63-439e-b17b-967d383c5af2','145cabe6-c825-4e04-bbde-a7e78445adb8') loop
 if exists(select 1 from flight_review_rows where checkin_date between occ+(case it.smart_key when 'checkin_8w' then 56 else 21 end) and occ+(case it.smart_key when 'checkin_8w' then 62 else 27 end))
 and not exists(select 1 from flight_review_rows b where b.checkin_date between occ+(case it.smart_key when 'checkin_8w' then 56 else 21 end) and occ+(case it.smart_key when 'checkin_8w' then 62 else 27 end) and not exists(select 1 from staff_daily_check d where d.check_date=occ and d.item_key=it.id::text||'#'||b.label and d.checked)) then
 insert into staff_daily_check(check_date,item_key,checked,checked_by) values(occ,it.id::text,true,'system') on conflict(check_date,item_key) do nothing;
 else delete from staff_daily_check where item_key=it.id::text and check_date=occ and checked_by='system';end if;
end loop;
for r in select * from flight_review_rows where checkin_date>=today order by checkin_date,booker_name loop
 reason:=null;
 if r.detail_date is not null and r.booking_date is not null and r.detail_date<>r.booking_date then reason:=format('입국 날짜가 서로 달라요. 체크인 정보 %s / 예약 원본 %s',r.detail_date,r.booking_date);
 elsif not r.undecided and r.arrival is not null and r.tm ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$' then
 if r.arrival<r.arrival_checkin or (r.arrival=r.arrival_checkin and r.tm::time<'15:00') or r.arrival>r.arrival_checkin+1 or (r.arrival=r.arrival_checkin+1 and r.tm::time>='12:00') then reason:='입실 전 도착 또는 늦은 도착으로 첫 숙박일 확인이 필요해요.';end if;
 end if;
 if reason is null then continue;end if;
 ticket:='dreamy-flight-review:'||r.id||':'||md5(concat_ws('|',r.arrival_checkin,r.detail_date,r.booking_date,r.tm,reason));
 actor:=case lower(coalesce(r.assignee,'')) when 'may' then 'ceo' else 'candice' end;
 insert into staff_tasks(id,title,created_by,assignee,assignees,note,created_at,done,progress,shared,secret,priority,files,checklist)
 values(ticket,'[입실·항공 확인] '||r.booker_name||' · '||to_char(r.checkin_date,'MM/DD'),'system',actor,jsonb_build_array(actor),format('%s님, %s님 예약의 첫 숙박일과 세부 도착 일정을 확인해 주세요. 입실 기준은 %s 15:00, 기록된 도착은 %s %s입니다. %s 항공권과 사전 숙박·조기 입실 약정을 확인한 뒤 실제 이용 일정을 이 글 댓글에 남겨 주세요.',case actor when 'ceo' then 'May' else '캔디스' end,r.booker_name,r.arrival_checkin,r.arrival,coalesce(r.tm,'시간 미정'),reason),now(),false,0,false,true,'normal','[]','[]') on conflict(id) do nothing returning id into new_id;
 if new_id is not null then flagged:=flagged+1;insert into staff_notifications(id,to_id,type,ref_id,message,is_read,created_at) values(ticket||':notify',actor,'task',ticket,'드림이가 입실일과 항공 일정 확인을 요청했어요.',false,now()) on conflict(id) do nothing;end if;
end loop;
return jsonb_build_object('week',occ,'new_checks',added,'new_reviews',flagged);
end $$;
revoke all on function public.sync_dreamy_checkin_flights() from public,anon,authenticated;
grant execute on function public.sync_dreamy_checkin_flights() to service_role;
