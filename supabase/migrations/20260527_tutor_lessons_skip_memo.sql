-- 튜터 수업 스킵일·튜터 코멘트
ALTER TABLE tutor_lessons ADD COLUMN IF NOT EXISTS skip_dates date[] DEFAULT '{}';
ALTER TABLE tutor_lessons ADD COLUMN IF NOT EXISTS tutor_memo text;
