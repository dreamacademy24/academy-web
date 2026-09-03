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
  await supabase.rpc('exec_sql', { sql: `NOTIFY pgrst, 'reload schema';` }).catch(() => {})
  return NextResponse.json({ ok: true })
}
