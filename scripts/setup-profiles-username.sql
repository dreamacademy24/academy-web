-- profiles 테이블에 username 컬럼 추가 (아이디 기반 로그인)
-- Supabase SQL Editor에서 실행

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- 조회 성능용 인덱스
CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);
