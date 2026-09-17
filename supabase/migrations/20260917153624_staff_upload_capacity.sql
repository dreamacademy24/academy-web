alter table public.staff_messages drop constraint staff_messages_files_check;
alter table public.staff_messages add constraint staff_messages_files_check check (jsonb_array_length(files)<=30);
