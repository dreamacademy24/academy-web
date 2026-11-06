CREATE OR REPLACE FUNCTION public.guard_online_winter_session()
RETURNS trigger LANGUAGE plpgsql SET search_path TO public AS $$
BEGIN
 IF NEW.status IS DISTINCT FROM 'scheduled' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND NEW.scheduled_date IS NOT DISTINCT FROM OLD.scheduled_date AND NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
 IF EXISTS (SELECT 1 FROM public.holidays WHERE date=NEW.scheduled_date AND is_deployed) THEN
   RAISE EXCEPTION '%은 학원 휴일이라 화상영어를 신청할 수 없습니다.', NEW.scheduled_date;
 END IF;
 IF public.online_package_peak(NEW.scheduled_date) THEN
   RAISE EXCEPTION '%은 화상영어 방학·성수기 휴무일입니다.', NEW.scheduled_date;
 END IF;
 RETURN NEW;
END $$;
