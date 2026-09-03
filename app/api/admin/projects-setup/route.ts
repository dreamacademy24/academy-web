import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// 프로젝트 트리 초기 세팅 — 멱등(IF NOT EXISTS만). 파괴적 변경 없음.
export async function POST(req: Request) {
  const { key } = await req.json().catch(() => ({ key: '' }))
  if (key !== 'dream-projects-2026') return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const ddl = `
-- 티쳐 전용 공간 구분 + 크로스 공유
ALTER TABLE project_nodes ADD COLUMN IF NOT EXISTS origin text DEFAULT 'team';
ALTER TABLE project_nodes ADD COLUMN IF NOT EXISTS team_shared boolean DEFAULT false;

-- 티쳐 전용 단위 업무 (내 업무 / 업무 탭)
CREATE TABLE IF NOT EXISTS teacher_tasks (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  body text DEFAULT '',
  assignees jsonb DEFAULT '[]'::jsonb,
  due date,
  status text DEFAULT 'todo',
  done boolean DEFAULT false,
  team_shared boolean DEFAULT false,
  title_ko text,
  body_ko text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  sort_idx int DEFAULT 0
);
ALTER TABLE teacher_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON teacher_tasks;
CREATE POLICY "all" ON teacher_tasks FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON teacher_tasks TO anon, authenticated;
ALTER TABLE teacher_tasks ADD COLUMN IF NOT EXISTS progress int DEFAULT 0;
ALTER TABLE teacher_tasks ADD COLUMN IF NOT EXISTS seen jsonb DEFAULT '[]'::jsonb;
ALTER TABLE teacher_tasks ADD COLUMN IF NOT EXISTS priority text DEFAULT 'normal';
ALTER TABLE teacher_tasks ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS teacher_task_comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id uuid,
  from_id text DEFAULT '',
  text text DEFAULT '',
  ts timestamptz DEFAULT now()
);
ALTER TABLE teacher_task_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON teacher_task_comments;
CREATE POLICY "all" ON teacher_task_comments FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON teacher_task_comments TO anon, authenticated;

-- 티쳐 전용 주간 체크 항목
CREATE TABLE IF NOT EXISTS teacher_weekly_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  assignees jsonb DEFAULT '[]'::jsonb,
  weekdays jsonb DEFAULT '[]'::jsonb,
  active boolean DEFAULT true,
  created_by text,
  created_at timestamptz DEFAULT now(),
  sort_idx int DEFAULT 0
);
ALTER TABLE teacher_weekly_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON teacher_weekly_items;
CREATE POLICY "all" ON teacher_weekly_items FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON teacher_weekly_items TO anon, authenticated;

CREATE TABLE IF NOT EXISTS teacher_weekly_checks (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  item_id uuid,
  check_date date,
  by_id text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(item_id, check_date, by_id)
);
ALTER TABLE teacher_weekly_checks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON teacher_weekly_checks;
CREATE POLICY "all" ON teacher_weekly_checks FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON teacher_weekly_checks TO anon, authenticated;
CREATE TABLE IF NOT EXISTS project_nodes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid,
  parent_id uuid,
  title text NOT NULL DEFAULT '',
  body text DEFAULT '',
  kind text DEFAULT 'folder',
  assignees jsonb DEFAULT '[]'::jsonb,
  due date,
  status text DEFAULT 'todo',
  done boolean DEFAULT false,
  files jsonb DEFAULT '[]'::jsonb,
  sort_idx int DEFAULT 0,
  teacher_shared boolean DEFAULT false,
  title_en text,
  body_en text,
  created_by text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE project_nodes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON project_nodes;
CREATE POLICY "all" ON project_nodes FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON project_nodes TO anon, authenticated;

CREATE TABLE IF NOT EXISTS project_node_comments (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  node_id uuid,
  from_id text DEFAULT '',
  text text DEFAULT '',
  text_en text,
  lang text DEFAULT 'ko',
  ts timestamptz DEFAULT now()
);
ALTER TABLE project_node_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "all" ON project_node_comments;
CREATE POLICY "all" ON project_node_comments FOR ALL USING (true) WITH CHECK (true);
GRANT ALL ON project_node_comments TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_project_nodes_project ON project_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_project_nodes_parent ON project_nodes(parent_id);
CREATE INDEX IF NOT EXISTS idx_pnc_node ON project_node_comments(node_id);
`
  const { error } = await supabase.rpc('exec_sql', { sql: ddl })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  try { await supabase.rpc('exec_sql', { sql: `NOTIFY pgrst, 'reload schema';` }) } catch {}
  return NextResponse.json({ ok: true })
}
