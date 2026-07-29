/* 드림하우스 룸 단일 소스 — 룸 캘린더(app/dreamhouse-rooms)와 동일 목록.
   ⚠️ 룸 추가/폐지 시 여기와 dreamhouse-rooms/page.tsx ROOMS를 함께 수정 */
export const DH_ROOMS = [
  'b13L10', 'b16L19',
  'b17L7', 'b17L8', 'b17L9',
  'b17L10', 'b17L11', 'b17L12', 'b17L13', 'b17L14', 'b17L15', 'b17L16', 'b17L17', 'b17L18',
];

export const normRoom = (r: unknown) => String(r || '').replace(/\s+/g, '').toLowerCase();

type SbLike = {
  from: (t: string) => {
    select: (q: string) => {
      neq: (c: string, v: string) => {
        not: (c: string, op: string, v: null) => {
          neq: (c: string, v: string) => {
            lt: (c: string, v: string) => {
              gte: (c: string, v: string) => PromiseLike<{ data: unknown[] | null }>;
            };
          };
        };
      };
    };
  };
};

/* 기간(ci~co)에 비어있는 드림하우스 룸 목록.
   - 취소 예약 제외
   - 콤보 예약은 드림하우스 구간(seg)만 점유로 판정
   - 대소문자/공백 정규화 */
export async function fetchDhAvailRooms(sb: SbLike, bookingId: string, ci: string, co: string): Promise<string[]> {
  const { data: ov } = await sb.from('bookings')
    .select('accom_room,status,checkout_date,late_checkout,seg1_type,seg1_checkin,seg1_checkout,seg2_type,seg2_checkin,seg2_checkout')
    .neq('id', bookingId)
    .not('accom_room', 'is', null)
    .neq('accom_room', '')
    .lt('checkin_date', co)
    .gte('checkout_date', ci);
  const rows = (ov || []) as Record<string, unknown>[];
  const addDay = (d: string) => { const t = new Date(d + 'T00:00:00'); t.setDate(t.getDate() + 1); return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
  // 레이트 체크아웃(22:30)이면 체크아웃 당일도 점유 → 실효 체크아웃 +1일 (예약 최종 체크아웃 구간에만 적용)
  const effCo = (b: Record<string, unknown>, segCo: string) =>
    (b.late_checkout && segCo === String(b.checkout_date || '').slice(0, 10)) ? addDay(segCo) : segCo;
  const occ = rows
    .filter(b => !String(b.status || '').includes('취소'))
    .filter(b => {
      const segs = [
        [b.seg1_type, b.seg1_checkin, b.seg1_checkout],
        [b.seg2_type, b.seg2_checkin, b.seg2_checkout],
      ].filter(s => s[0]);
      if (segs.length) {
        const dh = segs.filter(s => String(s[0]) === 'dreamhouse');
        if (!dh.length) return false; // 드림하우스 구간 없으면 점유 아님
        return dh.some(s => String(s[1] || '') < co && effCo(b, String(s[2] || '').slice(0, 10)) > ci);
      }
      return effCo(b, String(b.checkout_date || '').slice(0, 10)) > ci;
    })
    .map(b => normRoom(b.accom_room));
  return DH_ROOMS.filter(r => !occ.includes(normRoom(r)));
}
