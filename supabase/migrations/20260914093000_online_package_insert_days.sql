create or replace function public.save_online_package_plan(p_id uuid,p_existing boolean,p_snapshot text,p_student_key text,p_enrollment jsonb,p_plan jsonb,p_rows jsonb,p_today date)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_total integer:=(p_plan->>'total')::integer; v_pre integer:=(p_plan->'pre'->>'count')::integer; v_post integer:=(p_plan->'post'->>'count')::integer; v_part jsonb; v_item jsonb; v_booking uuid; v_tutor uuid:=nullif(p_enrollment->>'tutor_id','')::uuid; v_days text[]; v_time text; v_from date;
begin
 perform pg_advisory_xact_lock(hashtext('online-package:'||(p_enrollment->>'customer_user_id')||':'||p_student_key));
 if p_existing then
   perform 1 from public.online_enrollments where id=p_id for update;
   if not found then raise exception 'STALE'; end if;
   perform 1 from public.online_sessions where enrollment_id=p_id for update;
   if public.online_package_snapshot(p_id)<>p_snapshot then raise exception 'STALE'; end if;
 else
   if exists(select 1 from public.online_enrollments where id=p_id) then raise exception 'SOURCE_USED'; end if;
 end if;
 if v_total<1 or v_pre<0 or v_post<0 or v_pre+v_post<>v_total then raise exception 'INVALID_COUNT'; end if;
 if exists(select 1 from public.online_change_requests where enrollment_id=p_id and status='pending') then raise exception 'PENDING_REQUEST'; end if;
 for v_booking in select value::uuid from jsonb_array_elements_text(p_plan->'bookingIds') loop
   if exists(select 1 from public.online_package_sources where booking_id=v_booking and student_key=p_student_key and enrollment_id<>p_id) then raise exception 'SOURCE_USED'; end if;
 end loop;
 -- All writes below roll back together on any error. Recorded rows and IDs are never changed.
 if v_tutor is not null then
   perform pg_advisory_xact_lock(hashtext('online-tutor:'||v_tutor::text));
   if exists(select 1 from jsonb_array_elements(p_rows) r join public.online_sessions s on s.scheduled_date=(r->>'date')::date and left(s.scheduled_time_kr,5)=r->>'time' join public.online_enrollments e on e.id=s.enrollment_id where e.id<>p_id and coalesce(s.tutor_id,e.tutor_id)=v_tutor and e.status in ('active','scheduled') and s.status in ('scheduled','makeup')) then raise exception 'TUTOR_CONFLICT'; end if;
 end if;
 v_part:=case when v_pre>0 then p_plan->'pre' else p_plan->'post' end;
 select array_agg(value order by value) into v_days from jsonb_array_elements_text(v_part->'days');
 v_time:=v_part->'times'->>(v_part->'days'->>0);
 if not p_existing then
   insert into public.online_enrollments(id,student_name,customer_user_id,enrollment_type,start_date,total_sessions,used_sessions,days_of_week) values(p_id,p_enrollment->>'student_name',p_enrollment->>'customer_user_id','free_package',(p_enrollment->>'start_date')::date,v_total,0,v_days);
 end if;
 update public.online_enrollments set
  student_name=p_enrollment->>'student_name',student_name_en=p_enrollment->>'student_name_en',student_birth_year=p_enrollment->>'student_birth_year',customer_user_id=p_enrollment->>'customer_user_id',tutor_id=v_tutor,level=p_enrollment->>'level',notes=p_enrollment->>'notes',status=p_enrollment->>'status',portal_open=(p_enrollment->>'portal_open')::boolean,
  total_sessions=v_total,pre_sessions=v_pre,post_sessions=v_post,used_sessions=(p_enrollment->>'used_sessions')::integer,package_plan=p_plan,package_booking_id=(p_plan->'bookingIds'->>0)::uuid,
  start_date=(p_enrollment->>'start_date')::date,end_date=(p_enrollment->>'end_date')::date,duration_weeks=(p_enrollment->>'duration_weeks')::integer,class_duration_weeks=ceil(v_total/3.0),class_period=case when v_pre>0 and v_post>0 then 'split' when v_pre>0 then 'pre' else 'post' end,
  days_of_week=v_days,class_time_kr=v_time,class_time_ph=to_char(v_time::time-interval '1 hour','HH24:MI'),day_times=v_part->'times',sessions_per_week=cardinality(v_days),updated_at=now()
 where id=p_id;
 delete from public.online_package_sources where enrollment_id=p_id;
 insert into public.online_package_sources(booking_id,student_key,enrollment_id) select value::uuid,p_student_key,p_id from jsonb_array_elements_text(p_plan->'bookingIds');
 delete from public.online_sessions where enrollment_id=p_id and status='scheduled' and scheduled_date>=p_today and not coalesce(is_makeup_added,false) and original_session_id is null and coalesce(note,'')='' and coalesce(session_note,'')='' and coalesce(attitude,'')='' and coalesce(attitude_note,'')='' and recorded_at is null;
 for v_item in select value from jsonb_array_elements(p_rows) loop
   if (v_item->>'date')::date<p_today then raise exception 'INVALID_PAST_DATE'; end if;
   insert into public.online_sessions(enrollment_id,tutor_id,session_number,scheduled_date,scheduled_time_kr,scheduled_time_ph,status,package_phase) values(p_id,v_tutor,(v_item->>'number')::integer,(v_item->>'date')::date,v_item->>'time',to_char((v_item->>'time')::time-interval '1 hour','HH24:MI'),'scheduled',v_item->>'phase');
 end loop;
 return p_id;
end $$;
