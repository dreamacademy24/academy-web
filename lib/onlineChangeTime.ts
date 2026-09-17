export function exactChangeTime(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/)
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null
}

export function changeTimeChoices(value: unknown): string[] {
  if (typeof value !== 'string' || !value.trim()) return []
  const parts = value.split(/\s*(?:\bor\b|또는|혹은|\/|,)\s*/i)
  const times = parts.map(exactChangeTime)
  return times.every(Boolean) ? Array.from(new Set(times as string[])) : []
}

export function resolveChangeTime(requested: unknown, selected: unknown): string | null {
  if (!requested && !selected) return null // Date-only change keeps the current time.
  const time = exactChangeTime(selected || requested)
  if (!time) throw new Error('승인할 수업 시간을 한국시간 HH:MM 형식으로 하나 선택해주세요.')
  const choices = changeTimeChoices(requested)
  if (choices.length && !choices.includes(time)) throw new Error('요청한 후보 시간 중 하나를 선택해주세요.')
  return time
}
