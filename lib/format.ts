// 표기 통일 공용 헬퍼 — 나이/날짜를 전 화면에서 동일하게 표시하기 위한 단일 소스.
// 데이터가 생년월일(YYYYMMDD)·연도(YYYY)·만나이(숫자)·"만N세" 등으로 섞여 저장돼 있어
// 어떤 형식이 와도 일관되게 변환한다.

// 나이 → "만N세".  지원 입력: YYYYMMDD / YYYY-MM-DD / YYYY / 숫자(이미 나이) / "만N세"
export function fmtAge(raw?: string | number | null): string {
  if (raw === undefined || raw === null) return "-";
  const s = String(raw).trim();
  if (!s) return "-";
  if (/만\s*\d+\s*세/.test(s)) return s.replace(/\s+/g, ""); // 이미 "만N세"
  const now = new Date();
  let by = 0, bm = 0, bd = 0;
  if (/^\d{8}$/.test(s)) { by = +s.slice(0, 4); bm = +s.slice(4, 6); bd = +s.slice(6, 8); }
  else if (/^\d{4}[-./]\d{1,2}[-./]\d{1,2}/.test(s)) { const p = s.split(/[-./]/); by = +p[0]; bm = +p[1]; bd = +p[2]; }
  else if (/^\d{4}$/.test(s)) { by = +s; } // 연도만
  else if (/^\d{1,2}$/.test(s)) { return `만${s}세`; } // 이미 나이 숫자
  if (by > 1900 && by <= now.getFullYear()) {
    let age = now.getFullYear() - by;
    if (bm) { const md = now.getMonth() + 1; if (md < bm || (md === bm && now.getDate() < bd)) age--; }
    if (age >= 0 && age < 100) return `만${age}세`;
  }
  return s; // 알 수 없는 형식은 원본 유지
}

// 숫자 나이만 필요할 때 (정렬/계산용). 못 구하면 null.
export function ageNum(raw?: string | number | null): number | null {
  const t = fmtAge(raw);
  const m = t.match(/만(\d+)세/);
  return m ? +m[1] : null;
}

// 날짜 → "YYYY-MM-DD" (로컬/타임존 안전, 문자열 파싱 기반).  지원: ISO, YYYY-MM-DD, YYYY/MM/DD 등
export function fmtDate(raw?: string | null): string {
  if (!raw) return "-";
  const s = String(raw).split("T")[0].trim();
  const m = s.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return s;
}
