/* 동명이인 자동 구분 — 새 예약 등록 시 활성 예약(체크아웃 안 지남·미취소)에
   같은 이름이 있으면 자동으로 B, C, D… 접미사를 붙여 반환.
   기존 예약 이름은 절대 변경하지 않음 (발행된 인보이스 보호). */

type SbMinimal = {
  from: (t: string) => {
    select: (q: string) => {
      ilike: (c: string, v: string) => {
        gte: (c: string, v: string) => PromiseLike<{ data: unknown[] | null }>;
      };
    };
  };
};

const SUFFIXES = ['B', 'C', 'D', 'E', 'F', 'G', 'H'];

export async function ensureUniqueBookerName(sb: SbMinimal, rawName: string): Promise<{ name: string; changed: boolean }> {
  const base = String(rawName || '').trim();
  if (!base) return { name: base, changed: false };
  const today = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const todayStr = `${today.getFullYear()}-${p2(today.getMonth() + 1)}-${p2(today.getDate())}`;
  let rows: Record<string, unknown>[] = [];
  try {
    const { data } = await sb.from('bookings')
      .select('booker_name,status,checkout_date')
      .ilike('booker_name', `${base}%`)
      .gte('checkout_date', todayStr);
    rows = (data || []) as Record<string, unknown>[];
  } catch { return { name: base, changed: false }; } // 조회 실패 시 원래 이름 유지 (등록은 막지 않음)
  const active = rows
    .filter(b => !String(b.status || '').includes('취소'))
    .map(b => String(b.booker_name || '').trim())
    // 정확히 "이름" 또는 "이름+영문 1글자"만 같은 사람 후보로 취급 (장수진아 같은 다른 이름 제외)
    .filter(n => n === base || (n.length === base.length + 1 && n.startsWith(base) && /^[A-Z]$/i.test(n.slice(-1))));
  if (!active.includes(base) && !active.length) return { name: base, changed: false };
  if (!active.includes(base) && active.length) {
    // 원본 이름은 비어있는데 B/C만 있는 특수 케이스 — 원본 그대로 사용 가능
    return { name: base, changed: false };
  }
  for (const ch of SUFFIXES) {
    if (!active.includes(base + ch)) return { name: base + ch, changed: true };
  }
  return { name: base + 'Z', changed: true };
}
