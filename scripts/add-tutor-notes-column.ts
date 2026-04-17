import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  const { error } = await supabase.rpc('exec_sql', {
    sql: `ALTER TABLE online_enrollments ADD COLUMN IF NOT EXISTS tutor_notes TEXT;`
  })
  if (error) { console.log('❌', error.message); return }
  console.log('✅ tutor_notes 컬럼 추가 완료')

  try { await supabase.rpc('exec_sql', { sql: "NOTIFY pgrst, 'reload schema';" }) } catch (_) {}
}
run().catch(console.error)
