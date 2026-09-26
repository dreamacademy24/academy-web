-- Preserve replies even when an author deletes the original comment.
ALTER TABLE public.staff_task_comments ADD COLUMN IF NOT EXISTS parent_id text;
ALTER TABLE public.staff_task_comments ADD COLUMN IF NOT EXISTS mention_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS staff_task_comments_parent_idx ON public.staff_task_comments (task_id,parent_id) WHERE parent_id IS NOT NULL;
