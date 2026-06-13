-- 공지 게시판형: 제목 + 첨부 이미지 컬럼 추가
ALTER TABLE staff_notices ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE staff_notices ADD COLUMN IF NOT EXISTS files jsonb DEFAULT '[]';
NOTIFY pgrst, 'reload schema';
