-- 1. 배포 일정 테이블
CREATE TABLE IF NOT EXISTS schedule_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('shuttle','afterschool','fieldtrip')),
  date date NOT NULL,
  title text NOT NULL,
  description text,
  is_deployed boolean DEFAULT false,
  deploy_month text,        -- 'YYYY-MM' 형식 (월 단위 배포 관리용)
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. 휴일 테이블
CREATE TABLE IF NOT EXISTS holidays (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  date date NOT NULL UNIQUE,
  name text NOT NULL,       -- 예: '독립기념일', '크리스마스'
  year int NOT NULL,
  is_deployed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- RLS 설정
ALTER TABLE schedule_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

-- 어드민(service role)은 전체 접근
-- 포털(anon)은 배포된 항목만 읽기 가능
CREATE POLICY "anon_read_deployed_schedule" ON schedule_items
  FOR SELECT TO anon USING (is_deployed = true);

CREATE POLICY "anon_read_deployed_holidays" ON holidays
  FOR SELECT TO anon USING (is_deployed = true);
