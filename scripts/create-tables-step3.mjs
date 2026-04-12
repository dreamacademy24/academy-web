import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  const env = readFileSync('.env.local', 'utf-8')
  const getVal = (k) => env.match(new RegExp(k + '=(.+)'))?.[1]?.trim()
  process.env.NEXT_PUBLIC_SUPABASE_URL = getVal('NEXT_PUBLIC_SUPABASE_URL')
  process.env.SUPABASE_SERVICE_ROLE_KEY = getVal('SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const sqls = [
`CREATE TABLE IF NOT EXISTS students (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id uuid REFERENCES bookings_new(id) ON DELETE SET NULL,
  name_kr text NOT NULL,
  name_en text,
  age text,
  level text CHECK (level IN ('kinder','junior')),
  class_type text CHECK (class_type IN ('morning','fullday')),
  academy_start date,
  academy_end date,
  pickup_location text,
  address_detail text,
  ssp boolean DEFAULT false,
  photo_allowed boolean DEFAULT true,
  special_request text,
  created_at timestamptz DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS academy_enrollments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  level text,
  class_type text,
  start_date date,
  end_date date,
  weeks int DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now()
)`,
`CREATE TABLE IF NOT EXISTS ssp_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  ssp_amount int DEFAULT 7000,
  ssp_id int DEFAULT 4000,
  issue_date date,
  receipt_sent_date date,
  transport_fee int DEFAULT 0,
  deposit int DEFAULT 0,
  exempted boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
)`
]

for (const sql of sqls) {
  const { error } = await supabase.rpc('exec_sql', { sql }).single()
  if (error) {
    // rpc 없으면 직접 fetch로 시도
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ sql })
    })
    console.log(sql.split('\n')[0], '->', res.status)
  } else {
    console.log(sql.split('\n')[0], '-> OK')
  }
}
