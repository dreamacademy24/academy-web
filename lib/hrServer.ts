import { createClient } from '@supabase/supabase-js'
import { hrSessionFromReq } from './hrAuth'
import { hrAccess } from './hrAccess'

export const hrDb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
export async function currentHr(req: Request) {
  const token = hrSessionFromReq(req)
  if (!token) return null
  // Re-read current grants: old signed tokens must not retain revoked company access.
  const { data, error } = await hrDb.from('hr_accounts').select('username,role,name,employee_id,companies,is_active,must_change_pw').eq('username', token.username).maybeSingle()
  if (error) throw new Error('HR account verification is temporarily unavailable.')
  if (!data?.is_active) return null
  const access = hrAccess(data.username, data.role, data.companies)
  return access.companies.length ? { ...data, ...access } : null
}
export function hrError(error: unknown) {
  console.error('[HR]', error instanceof Error ? error.message : 'Request failed')
  return Response.json({ error: 'Unable to save or load HR data. Please retry. / 인사 정보를 처리하지 못했습니다. 다시 시도해주세요.' }, { status: 503 })
}
