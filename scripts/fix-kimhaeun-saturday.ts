import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const ENROLLMENT_ID = '9d42bd8b-93f7-4cdc-b5ff-a9a42d82753c'

async function moveDate(from: string, to: string) {
  const { data, error } = await supabase
    .from('online_sessions')
    .update({ scheduled_date: to })
    .eq('enrollment_id', ENROLLMENT_ID)
    .eq('scheduled_date', from)
    .select('id, session_number, scheduled_date')

  if (error) { console.error(`UPDATE ${from} -> ${to} error:`, error.message); process.exit(1) }
  console.log(`${from} -> ${to}: ${data?.length ?? 0}건`, JSON.stringify(data))
}

async function main() {
  await moveDate('2026-06-13', '2026-06-12')
  await moveDate('2026-06-20', '2026-06-19')
}

main()
