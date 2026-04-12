-- profiles 테이블 확장
-- Supabase SQL Editor에서 실행
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS children jsonb DEFAULT '[]';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address text;
