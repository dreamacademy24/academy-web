update public.staff_notifications n set message=left(n.message,length(n.message)-length(left(c.text,80)))||c.text
from public.staff_task_comments c where n.type='task_comment' and not n.is_read and n.ref_id=c.task_id and n.id='tc:'||c.id||':'||n.to_id and length(c.text)>80 and right(n.message,80)=left(c.text,80);
