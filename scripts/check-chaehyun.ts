import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function run() {
  console.log('students 테이블 — 이채현 이름만으로 재조회')
  const { data: students, error: sErr } = await supabase
    .from('students')
    .select('*')
    .or('name_kr.ilike.%이채현%,name_en.ilike.%chaehyun%')
    .order('created_at', { ascending: true })
  if (sErr) { console.log('error:', sErr.message); return }
  console.log(`발견: ${students?.length || 0}건`)
  ;(students || []).forEach(s => console.log(s))
}

run().catch(console.error)
