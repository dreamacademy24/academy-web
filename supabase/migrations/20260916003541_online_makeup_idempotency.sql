DO $migration$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.auto_add_makeup_session()'::regprocedure) INTO definition;
 IF position('where id=NEW.enrollment_id;' in definition)=0 OR position('if NEW.status=''makeup'' and OLD.status=''scheduled'' then' in definition)=0 THEN
 RAISE EXCEPTION 'Unexpected makeup trigger definition';
 END IF;
 definition:=replace(definition,'where id=NEW.enrollment_id;','where id=NEW.enrollment_id for update;');
 definition:=replace(definition,'if NEW.status=''makeup'' and OLD.status=''scheduled'' then','if NEW.status=''makeup'' and OLD.status=''scheduled'' and not exists(select 1 from public.online_sessions where original_session_id=NEW.id) then');
 EXECUTE definition;
END $migration$;
