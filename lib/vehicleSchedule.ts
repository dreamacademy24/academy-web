// 차량/기사 스케줄 자동 취합 엔진 (SSOT) — /admin/vehicle-schedule 전용
// ─────────────────────────────────────────────────────────────
// 목적: 흩어진 모든 차량 움직임을 하루 단위로 자동 취합해서
//   "놓친 차량"이 없는지 교차 확인하고, 기사 배정 초안(1차)을 만든다.
//
// 취합 소스 (5개):
//   1) pickup_requests   — 공항 픽업/드랍/환승 + 추가 픽드랍 (항시 포함·잠금)
//   2) shuttle_applications — 투어셔틀 신청 (신청분 = 실제 운행)
//   3) fieldtrip_applications — 애프터스쿨/필드트립 (요일 규칙 인코딩)
//   4) pickup_schedules  — 기존 수동 집↔학원 보드 (참고·유지, 자동은 별도)
//   5) bookings          — 집↔학원 자동 초안용 (재원생 기준)
//
// 규칙 (메이 확정 2026-09):
//   · 애프터스쿨: 월=아카데미 출발 / 수=베이스워터(Bayswater) · 시간은 요일별
//   · 필드트립: 픽업 10:15
//   · 체크인디테일 차량 + 추가 픽드랍 = 항상 포함 (locked)
//   · 워크플로우: 자동 1차 → 수동 2차 수정 → 전달 = 하루 기사 스케줄 완성
// ─────────────────────────────────────────────────────────────

import { getShSlots, SHUTTLE_HOLIDAYS, SHUTTLE_SPECIAL_MSG } from "./shuttleTours";

export type VehKind =
  | "pickup"      // 공항 → 숙소
  | "dropoff"     // 숙소 → 공항
  | "transfer"    // 숙소 → 숙소 (콤보 환승)
  | "extra"       // 추가 픽드랍 (직원 등록)
  | "shuttle"     // 투어셔틀
  | "afterschool" // 애프터스쿨
  | "fieldtrip"   // 필드트립
  | "commute";    // 집↔학원 (자동 초안)

export type VehSource =
  | "pickup_requests"
  | "shuttle_applications"
  | "fieldtrip_applications"
  | "pickup_schedules"
  | "bookings"
  | "manual";

export interface VehMovement {
  id: string;              // 안정적 키 (source+원본id 기반)
  date: string;            // YYYY-MM-DD
  time: string;            // "10:15" 또는 라벨
  sortTime: string;        // 정렬용 24h "HH:MM" (모르면 "99:99")
  kind: VehKind;
  source: VehSource;
  guest: string;           // 예약자/아이 이름
  location: string;        // 출발지
  destination: string;     // 도착지
  num_people: number;
  flight_info?: string;
  driver_id?: string | null;
  note?: string;
  locked?: boolean;        // 항시 포함 (체크인디테일·추가픽드랍)
  auto?: boolean;          // 자동 초안 (집↔학원 등, 수동 확정 대상)
}

export interface VehWarning {
  date: string;
  level: "high" | "info";
  text: string;
}

// ── 애프터스쿨 요일 규칙 (메이 확정) ───────────────────────────
// 월(1)=아카데미 출발, 수(3)=베이스워터. 나머지 요일은 애프터스쿨 없음.
export const AFTERSCHOOL_LOCATION: Record<number, string> = {
  1: "아카데미",
  3: "베이스워터(Bayswater)",
};
// 시간: 월 4:20~5:10pm / 그 외(수) 4:30~5:20pm (fieldtripPrograms.timeOfDate와 동일)
export function afterschoolTime(dateStr: string): { label: string; sort: string } {
  const dow = new Date(dateStr + "T00:00:00").getDay();
  return dow === 1
    ? { label: "4:20~5:10pm", sort: "16:20" }
    : { label: "4:30~5:20pm", sort: "16:30" };
}

// ── 시간 문자열 → 정렬용 24h ──────────────────────────────────
export function to24h(t?: string): string {
  if (!t) return "99:99";
  const s = String(t).trim();
  // "23:30", "8:30" 형태
  let m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m && !/[ap]m/i.test(s)) {
    return `${m[1].padStart(2, "0")}:${m[2]}`;
  }
  // "10:15~20", "10:00am", "4:00pm", "4:20~5:10pm"
  m = s.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])m/i);
  if (m) {
    let h = Number(m[1]);
    const min = m[2] || "00";
    const ap = m[3].toLowerCase();
    if (ap === "p" && h !== 12) h += 12;
    if (ap === "a" && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${min}`;
  }
  m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) return `${m[1].padStart(2, "0")}:${m[2]}`;
  return "99:99";
}

// ── 날짜 유틸 ─────────────────────────────────────────────────
export function weekDates(base: Date, weeks = 1): string[] {
  const d = new Date(base);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7)); // 그 주 월요일
  const out: string[] = [];
  for (let i = 0; i < 7 * weeks; i++) {
    const dd = new Date(d);
    dd.setDate(d.getDate() + i);
    out.push(
      `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`
    );
  }
  return out;
}
export function inRange(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

// ── 소스별 raw 타입 (느슨하게) ────────────────────────────────
export interface RawPickup {
  id: string | number;
  request_type: string;
  request_date: string;
  request_time?: string;
  location?: string;
  destination?: string;
  num_people?: number;
  flight_info?: string;
  driver_id?: string | null;
  bookings?: { booker_name?: string; house_no?: string; accom_room?: string } | null;
  guest_name?: string;
}
export interface RawShuttle {
  id: string | number;
  portal_name?: string;
  booker_name?: string;
  room_number?: string;
  tour_name?: string;
  tour_date?: string;
  depart_time?: string;
  people_count?: number;
  riders?: string;
  status?: string;
  driver_id?: string | null;
}
export interface RawFieldtrip {
  id: string | number;
  name?: string;
  date?: string; // "5-9-nimobrew, 6-13-shrine" 콤마 토큰
  room_number?: string;
  status?: string;
}

// ── 1) 픽드랍 (항시 포함·잠금) ────────────────────────────────
const AIRPORT = /공항|막탄|airport|cebu|mcia/i;
const PICKUP_KIND: Record<string, VehKind> = {
  pickup: "pickup", arrival: "pickup",
  dropoff: "dropoff", departure: "dropoff",
  transfer: "transfer",
  extra_pickup: "extra", extra_drop: "extra", additional: "extra", extra: "extra",
};
export function pickupMovements(rows: RawPickup[]): VehMovement[] {
  return (rows || []).map((p) => {
    const kind = PICKUP_KIND[p.request_type] || "extra";
    const guest = p.bookings?.booker_name || p.guest_name || "-";
    const room = p.bookings?.house_no || p.bookings?.accom_room || "";
    return {
      id: `pk_${p.id}`,
      date: String(p.request_date || "").slice(0, 10),
      time: p.request_time || "",
      sortTime: to24h(p.request_time),
      kind,
      source: "pickup_requests" as VehSource,
      guest,
      location: p.location || (kind === "pickup" ? "공항" : room),
      destination: p.destination || (kind === "dropoff" ? "공항" : room),
      num_people: Number(p.num_people) || 1,
      flight_info: p.flight_info || "",
      driver_id: p.driver_id ?? null,
      locked: true, // 체크인디테일 파생 + 추가 픽드랍 = 항시 포함
    };
  }).filter((m) => m.date);
}

// ── 2) 투어셔틀 (신청분) ──────────────────────────────────────
export function shuttleMovements(rows: RawShuttle[]): VehMovement[] {
  return (rows || [])
    .filter((s) => (s.status || "") !== "취소" && (s.status || "") !== "cancelled")
    .map((s) => ({
      id: `sh_${s.id}`,
      date: String(s.tour_date || "").slice(0, 10),
      time: s.depart_time || "",
      sortTime: to24h(s.depart_time),
      kind: "shuttle" as VehKind,
      source: "shuttle_applications" as VehSource,
      guest: s.booker_name || s.portal_name || "-",
      location: s.room_number || "숙소",
      destination: s.tour_name || "투어",
      num_people: Number(s.people_count) || 1,
      driver_id: s.driver_id ?? null,
      note: s.riders || "",
    }))
    .filter((m) => m.date);
}

// ── 3) 애프터스쿨/필드트립 (요일 규칙 인코딩) ─────────────────
// fieldtrip_applications.date = "월-일-키" 콤마결합. 각 토큰 = (날짜 + 프로그램).
export interface FtResolver {
  // token "월-일-키" → { date:"YYYY-MM-DD", isFieldtrip }  (배포 일정 우선)
  resolve: (token: string) => { date: string; isFieldtrip: boolean; name: string } | null;
}
export function afterschoolMovements(rows: RawFieldtrip[], resolver: FtResolver): VehMovement[] {
  const out: VehMovement[] = [];
  for (const r of rows || []) {
    if ((r.status || "") === "취소" || (r.status || "") === "cancelled") continue;
    const tokens = String(r.date || "").split(",").map((t) => t.trim()).filter(Boolean);
    for (const tok of tokens) {
      const info = resolver.resolve(tok);
      if (!info || !info.date) continue;
      const dow = new Date(info.date + "T00:00:00").getDay();
      if (info.isFieldtrip) {
        out.push({
          id: `ft_${r.id}_${tok}`,
          date: info.date,
          time: "픽업 10:15",
          sortTime: "10:15",
          kind: "fieldtrip",
          source: "fieldtrip_applications",
          guest: r.name || "-",
          location: "아카데미",
          destination: info.name || "필드트립",
          num_people: 1,
          note: r.room_number || "",
        });
      } else {
        const t = afterschoolTime(info.date);
        const loc = AFTERSCHOOL_LOCATION[dow] || "아카데미";
        out.push({
          id: `as_${r.id}_${tok}`,
          date: info.date,
          time: t.label,
          sortTime: t.sort,
          kind: "afterschool",
          source: "fieldtrip_applications",
          guest: r.name || "-",
          location: loc,               // 월=아카데미 / 수=베이스워터
          destination: info.name || "애프터스쿨",
          num_people: 1,
          note: r.room_number || "",
        });
      }
    }
  }
  return out;
}

// ── 4) 교차 확인: 놓친 차량 경고 ──────────────────────────────
// 투어셔틀 신청은 있는데 그 날 운행 규칙이 휴무이거나, 규칙상 셔틀이 있는데
// 신청이 0건인 날 등을 안내. (놓친 차량 방지용 = 메이 핵심 요구)
export function buildWarnings(
  dates: string[],
  movements: VehMovement[]
): VehWarning[] {
  const warns: VehWarning[] = [];
  const byDate = new Map<string, VehMovement[]>();
  for (const m of movements) {
    if (!byDate.has(m.date)) byDate.set(m.date, []);
    byDate.get(m.date)!.push(m);
  }
  for (const d of dates) {
    const day = byDate.get(d) || [];
    // 휴무일 안내
    if (SHUTTLE_HOLIDAYS.has(d)) {
      warns.push({ date: d, level: "info", text: SHUTTLE_SPECIAL_MSG[d] || "🚫 셔틀 휴무일" });
    }
    // 미배정 차량 (기사 없음) — locked/실운행만
    const unassigned = day.filter((m) => !m.driver_id && (m.kind === "pickup" || m.kind === "dropoff" || m.kind === "transfer" || m.kind === "shuttle"));
    if (unassigned.length) {
      warns.push({ date: d, level: "high", text: `기사 미배정 ${unassigned.length}건 (${unassigned.map((u) => u.guest).join(", ")})` });
    }
    // 셔틀 신청 있는데 규칙상 휴무 → 확인 필요
    const shuttleOnDay = day.filter((m) => m.kind === "shuttle");
    const slots = getShSlots(d);
    if (shuttleOnDay.length && slots === "holiday") {
      warns.push({ date: d, level: "high", text: `⚠️ 휴무일인데 투어셔틀 신청 ${shuttleOnDay.length}건 — 확인 필요` });
    }
  }
  return warns;
}

// ── 5) 전체 취합 ──────────────────────────────────────────────
export interface AggregateInput {
  pickups?: RawPickup[];
  shuttles?: RawShuttle[];
  fieldtrips?: RawFieldtrip[];
  ftResolver?: FtResolver;
  manual?: VehMovement[]; // 수동 2차 수정/추가분
}
export interface DaySchedule {
  date: string;
  movements: VehMovement[];
}
export interface AggregateResult {
  days: DaySchedule[];
  warnings: VehWarning[];
  total: number;
}
export function aggregate(input: AggregateInput, dates: string[]): AggregateResult {
  const all: VehMovement[] = [];
  all.push(...pickupMovements(input.pickups || []));
  all.push(...shuttleMovements(input.shuttles || []));
  if (input.ftResolver) all.push(...afterschoolMovements(input.fieldtrips || [], input.ftResolver));
  if (input.manual) all.push(...input.manual);

  const set = new Set(dates);
  const scoped = all.filter((m) => set.has(m.date));

  const days: DaySchedule[] = dates.map((d) => ({
    date: d,
    movements: scoped
      .filter((m) => m.date === d)
      .sort((a, b) => a.sortTime.localeCompare(b.sortTime) || a.kind.localeCompare(b.kind)),
  }));

  return {
    days,
    warnings: buildWarnings(dates, scoped),
    total: scoped.length,
  };
}
