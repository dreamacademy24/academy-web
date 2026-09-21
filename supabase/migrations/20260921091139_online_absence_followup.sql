-- Prospective only; existing attendance and tasks are not changed.
create or replace function public.create_online_absence_followup() returns trigger
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
 e public.online_enrollments%rowtype;
 s record; streak_ids uuid[] := '{}'; dates text[] := '{}';
 people text[]; safe_name text; task_id text;
begin
 if new.status is distinct from 'no_show' then return new; end if;
 if tg_op = 'UPDATE' and old.status is not distinct from new.status then return new; end if;
 -- Serialize attendance changes for this enrollment.
 select * into e from public.online_enrollments where id=new.enrollment_id for update;
 if not found then return new; end if;
 -- Unrecorded lessons break a streak. Cancellation/makeup placeholders do not count.
 for s in select id,status,scheduled_date from public.online_sessions
   where enrollment_id=e.id and status is distinct from 'cancelled' and status is distinct from 'makeup'
   order by scheduled_date,coalesce(scheduled_time_kr,''),session_number,id
 loop
   if s.status='no_show' then
     streak_ids:=array_append(streak_ids,s.id);
     dates:=array_append(dates,s.scheduled_date::text);
   else
     if new.id=any(streak_ids) then exit; end if;
     streak_ids:='{}'; dates:='{}';
   end if;
 end loop;
 if cardinality(streak_ids)<2 or not(new.id=any(streak_ids)) then return new; end if;
 task_id:='online-absence:'||e.id||':'||streak_ids[1];
 select coalesce(array_agg(distinct regexp_replace(a.username,'^admin-','')),'{}') into people
 from public.staff_accounts a join public.bookings b on b.id=e.package_booking_id
 where a.is_active and a.role='korean_admin'
 and exists(select 1 from unnest(array[b.assignee,b.care_assignee]) n
   where lower(trim(n)) in(lower(a.name),lower(a.username),lower(regexp_replace(a.username,'^admin-',''))));
 safe_name:=replace(replace(replace(e.student_name,'&','&amp;'),'<','&lt;'),'>','&gt;');
 insert into public.staff_tasks(id,title,assignee,assignees,due,created_at,note,done,shared,created_by,application_source)
 values(task_id,'[화상영어 연속 결석 확인] '||e.student_name,coalesce(people[1],''),to_jsonb(people),
   (now() at time zone 'Asia/Seoul')::date::text,now()::text,
   '<p>'||safe_name||' 학생이 연속 2회 이상 결석했습니다. 결석 사유와 다음 수업 참여 여부를 확인해주세요.</p>'||
   '<p>등록 당시 결석 날짜: '||array_to_string(dates,', ')||'</p>'||
   '<p><a href="/admin/online-class/'||e.id||'" target="_blank" rel="noopener noreferrer">수강 정보·출석부 확인하기</a></p>'||
   '<p>최신 출석부를 먼저 확인하고 보호자 안내 및 확인 결과를 이 업무의 댓글·보고에 남긴 뒤 완료해주세요. 출석 기록이 정정된 경우에도 확인 결과를 남겨주세요.</p>'||
   case when cardinality(people)=0 then '<p>담당 미배정: 확인 담당 직원을 지정해주세요.</p>' else '' end,
   false,true,'system',jsonb_build_object('type','online_absence_followup','enrollment_id',e.id,'session_ids',to_jsonb(streak_ids)))
 on conflict(id) do nothing;
 return new;
end; $$;
revoke all on function public.create_online_absence_followup() from public,anon,authenticated;
grant execute on function public.create_online_absence_followup() to service_role;
create trigger online_absence_followup
after insert or update of status on public.online_sessions
for each row execute function public.create_online_absence_followup();

