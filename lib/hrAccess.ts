import { HR_COMPANIES } from './hr'

export const HR_COMPANY_SLUGS: Record<string, string> = { '아카데미': 'academy', '드림하우스': 'dreamhouse', '모리': 'mori', '88': '88' }
const MANAGERS: Record<string, string> = { menchu: '모리', janziel: '88', lziem: '드림하우스' }
export function hrAccess(username: string, role: string, configured?: string[] | null) {
  const user = username.trim().toLowerCase()
  const full = role === 'admin' && ['may', 'abby', 'bella'].includes(user)
  const assigned = MANAGERS[user]
  const companies = full ? [...HR_COMPANIES] : role === 'admin' && assigned && configured?.includes(assigned) ? [assigned] : []
  return { companies, full, language: user === 'may' ? 'ko' as const : 'en' as const }
}
