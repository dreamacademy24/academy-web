-- Online English holidays are separate from accommodation peak pricing.
CREATE OR REPLACE FUNCTION public.online_package_peak(d date)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO public AS $$
 select case
 when extract(month from d) in (1,2) then true
 when extract(year from d)=2026 and extract(month from d)=12 then extract(day from d)>=24
 when extract(year from d)=2027 then (extract(month from d)=7 and extract(day from d)>=18) or (extract(month from d)=8 and extract(day from d)<=30) or (extract(month from d)=12 and extract(day from d)>=19)
 else (extract(month from d)=7 and extract(day from d)>=15) or extract(month from d)=8 or (extract(month from d)=12 and extract(day from d)>=15) end;
$$;

-- All enrollment types, including legacy non-package sessions, must obey winter closure.
CREATE OR REPLACE FUNCTION public.guard_online_winter_session()
RETURNS trigger LANGUAGE plpgsql SET search_path TO public AS $$
begin
 if NEW.status is distinct from 'scheduled' then return NEW; end if;
 if TG_OP='UPDATE' and NEW.scheduled_date is not distinct from OLD.scheduled_date and NEW.status is not distinct from OLD.status then return NEW; end if;
 if NEW.scheduled_date >= date '2026-12-24' and
   (extract(month from NEW.scheduled_date) in (1,2) or (NEW.scheduled_date between date '2026-12-24' and date '2026-12-31')) then
   raise exception '화상영어 겨울 휴무 기간입니다. 12월 23일까지 수업하며, 남은 회차는 3월부터 진행해주세요.';
 end if;
 return NEW;
end $$;
CREATE TRIGGER guard_online_winter_session BEFORE INSERT OR UPDATE OF scheduled_date,status
ON public.online_sessions FOR EACH ROW EXECUTE FUNCTION public.guard_online_winter_session();
