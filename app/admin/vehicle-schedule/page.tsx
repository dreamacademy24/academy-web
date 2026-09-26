"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";
import {
  aggregate, weekDates, to24h,
  type VehMovement, type FtResolver, type AggregateResult,
} from "@/lib/vehicleSchedule";
import {
  buildScheduleByMd, mergeWithFallback, resolveProgram,
  type DeployedScheduleItem,
} from "@/lib/fieldtripPrograms";

const DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const KIND: Record<string, { emoji: string; bg: string; color: string; label: string }> = {
  pickup:      { emoji: "🛬", bg: "#dbeafe", color: "#1e40af", label: "공항픽업" },
  dropoff:     { emoji: "🛫", bg: "#dcfce7", color: "#166534", label: "공항드랍" },
  transfer:    { emoji: "🔄", bg: "#fae8ff", color: "#86198f", label: "환승" },
  extra:       { emoji: "🚐", bg: "#ede9fe", color: "#6d28d9", label: "추가픽드랍" },
  shuttle:     { emoji: "🚌", bg: "#fef3c7", color: "#92400e", label: "투어셔틀" },
  afterschool: { emoji: "🎒", bg: "#ffedd5", color: "#9a3412", label: "애프터스쿨" },
  fieldtrip:   { emoji: "🧭", bg: "#cffafe", color: "#155e75", label: "필드트립" },
  commute:     { emoji: "🏠", bg: "#f1f5f9", color: "#334155", label: "집↔학원" },
};

function fDate(d: string) {
  const dt = new Date(d + "T00:00:00");
  return `${dt.getMonth() + 1}/${dt.getDate()} (${DAYS[dt.getDay()]})`;
}

interface Driver { id: string; name: string }
type DayState = {
  confirmed?: boolean;
  overrides?: Record<string, { driver_id?: string | null; time?: string; note?: string }>;
  manual?: VehMovement[];
  updated_by?: string;
  updated_at?: string;
};

export default function VehicleSchedulePage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [base, setBase] = useState(new Date());
  const [weeks, setWeeks] = useState(1);          // 기본 1주, 2~3주 미리보기
  const [loading, setLoading] = useState(false);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [result, setResult] = useState<AggregateResult | null>(null);
  const [states, setStates] = useState<Record<string, DayState>>({}); // date → 수동수정/전달 상태
  const [saving, setSaving] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    if (!isAdminAuthed()) { router.replace("/login"); return; }
    setAuthed(true);
  }, [router]);

  const dates = useMemo(() => weekDates(base, weeks), [base, weeks]);
  const from = dates[0], to = dates[dates.length - 1];

  const load = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/vehicle-schedule?from=${from}&to=${to}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "load failed");
      setDrivers(j.drivers || []);
      setStates(j.overrides || {});

      // 애프터스쿨/필드트립 토큰 해석기 (배포 일정 우선 + 하드코딩 폴백)
      const byMd = buildScheduleByMd(mergeWithFallback((j.scheduleItems || []) as DeployedScheduleItem[]));
      const yFrom = Number(from.slice(0, 4)), yTo = Number(to.slice(0, 4));
      const resolver: FtResolver = {
        resolve: (token: string) => {
          const p = resolveProgram(token, byMd);
          if (!p) return null;
          // "월-일" → 조회 기간에 맞는 연도 선택
          const mkd = (y: number) => `${y}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
          let date = mkd(yFrom);
          if (!(date >= from && date <= to) && yTo !== yFrom) { const d2 = mkd(yTo); if (d2 >= from && d2 <= to) date = d2; }
          return { date, isFieldtrip: p.isFieldtrip, name: p.name };
        },
      };

      const agg = aggregate(
        { pickups: j.pickups || [], shuttles: j.shuttles || [], fieldtrips: j.fieldtrips || [], ftResolver: resolver },
        dates
      );
      setResult(agg);
    } catch (e) {
      setResult(null);
      setSavedMsg("불러오기 실패: " + (e as Error).message);
    } finally { setLoading(false); }
  }, [authed, from, to, dates]);

  useEffect(() => { load(); }, [load]);

  // 자동 취합 + 수동 오버레이 병합
  const mergedDays = useMemo(() => {
    if (!result) return [];
    return result.days.map((d) => {
      const st = states[d.date] || {};
      const ov = st.overrides || {};
      const autoMoves = d.movements.map((m) => {
        const o = ov[m.id];
        return o ? { ...m, driver_id: "driver_id" in o ? o.driver_id ?? null : m.driver_id, time: o.time || m.time, note: o.note ?? m.note } : m;
      });
      const manual = (st.manual || []).map((m) => ({ ...m }));
      const all = [...autoMoves, ...manual].sort((a, b) => (a.sortTime || to24h(a.time)).localeCompare(b.sortTime || to24h(b.time)));
      return { date: d.date, confirmed: !!st.confirmed, movements: all };
    });
  }, [result, states]);

  const setOverride = (date: string, id: string, patch: { driver_id?: string | null; time?: string; note?: string }) => {
    setStates((prev) => {
      const st = { ...(prev[date] || {}) };
      st.overrides = { ...(st.overrides || {}), [id]: { ...(st.overrides?.[id] || {}), ...patch } };
      return { ...prev, [date]: st };
    });
  };
  const addManual = (date: string) => {
    setStates((prev) => {
      const st = { ...(prev[date] || {}) };
      const m: VehMovement = { id: `mn_${Date.now()}`, date, time: "", sortTime: "99:99", kind: "extra", source: "manual", guest: "", location: "", destination: "", num_people: 1, driver_id: null };
      st.manual = [...(st.manual || []), m];
      return { ...prev, [date]: st };
    });
  };
  const patchManual = (date: string, id: string, patch: Partial<VehMovement>) => {
    setStates((prev) => {
      const st = { ...(prev[date] || {}) };
      st.manual = (st.manual || []).map((m) => m.id === id ? { ...m, ...patch, sortTime: patch.time ? to24h(patch.time) : m.sortTime } : m);
      return { ...prev, [date]: st };
    });
  };
  const removeManual = (date: string, id: string) => {
    setStates((prev) => {
      const st = { ...(prev[date] || {}) };
      st.manual = (st.manual || []).filter((m) => m.id !== id);
      return { ...prev, [date]: st };
    });
  };

  const saveDay = async (date: string, confirmed?: boolean) => {
    setSaving(date);
    try {
      const st = { ...(states[date] || {}) };
      if (confirmed !== undefined) st.confirmed = confirmed;
      const by = getAdminInfo()?.name || "admin";
      const r = await fetch(`/api/admin/vehicle-schedule`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, by, state: st }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "save failed");
      setStates((prev) => ({ ...prev, [date]: j.state }));
      setSavedMsg(`${fDate(date)} 저장됨` + (st.confirmed ? " · 전달완료 ✅" : ""));
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (e) {
      setSavedMsg("저장 실패: " + (e as Error).message);
    } finally { setSaving(null); }
  };

  if (!authed) return null;

  const highWarns = (result?.warnings || []).filter((w) => w.level === "high");
  const infoWarns = (result?.warnings || []).filter((w) => w.level === "info");

  return (
    <div style={{ background: "#f4f6f8", minHeight: "100vh", fontFamily: '"Malgun Gothic","Apple SD Gothic Neo",sans-serif' }}>
      {/* 툴바 */}
      <div style={{ position: "sticky", top: 0, zIndex: 40, background: "#1c2530", color: "#fff", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "11px 16px", boxShadow: "0 2px 8px rgba(0,0,0,.18)" }}>
        <b style={{ fontSize: 15 }}>🚗 차량·기사 스케줄 <span style={{ color: "#9fb0c2", fontWeight: 400, fontSize: 12 }}>(자동 취합)</span></b>
        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          <button onClick={() => { const d = new Date(base); d.setDate(d.getDate() - 7); setBase(d); }} style={btn}>◀ 이전주</button>
          <button onClick={() => setBase(new Date())} style={btn}>이번주</button>
          <button onClick={() => { const d = new Date(base); d.setDate(d.getDate() + 7); setBase(d); }} style={btn}>다음주 ▶</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
          {[1, 2, 3].map((w) => (
            <button key={w} onClick={() => setWeeks(w)} style={{ ...btn, background: weeks === w ? "#2563eb" : "#2f3e50", borderColor: weeks === w ? "#2563eb" : "#44566b" }}>{w}주</button>
          ))}
        </div>
        <button onClick={load} style={{ ...btn, marginLeft: 8 }}>🔄 새로고침</button>
        <span style={{ marginLeft: "auto", fontSize: 12, color: savedMsg.includes("실패") ? "#fca5a5" : "#5fe08a" }}>
          {loading ? "불러오는 중…" : savedMsg || `${from} ~ ${to} · 총 ${result?.total ?? 0}건`}
        </span>
      </div>

      <div style={{ maxWidth: 1100, margin: "16px auto", padding: "0 14px" }}>
        {/* 놓친 차량/경고 */}
        {(highWarns.length > 0 || infoWarns.length > 0) && (
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 16px", marginBottom: 14 }}>
            <b style={{ fontSize: 13, color: "#b91c1c" }}>⚠️ 확인 필요 ({highWarns.length}건)</b>
            {highWarns.map((w, i) => (
              <div key={i} style={{ fontSize: 13, marginTop: 6, color: "#7f1d1d" }}>· <b>{fDate(w.date)}</b> {w.text}</div>
            ))}
            {infoWarns.map((w, i) => (
              <div key={"i" + i} style={{ fontSize: 12.5, marginTop: 5, color: "#64748b" }}>· {fDate(w.date)} {w.text}</div>
            ))}
            {highWarns.length === 0 && <div style={{ fontSize: 12.5, marginTop: 4, color: "#16a34a" }}>미배정 차량 없음 — 기사 배정 완료 ✅</div>}
          </div>
        )}

        {/* 하루 단위 카드 */}
        {mergedDays.map((day) => {
          const isHoliday = infoWarns.some((w) => w.date === day.date);
          return (
            <div key={day.date} style={{ background: "#fff", border: `1px solid ${day.confirmed ? "#86efac" : "#e5e7eb"}`, borderRadius: 12, marginBottom: 12, overflow: "hidden", boxShadow: "0 2px 10px rgba(20,30,45,.05)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: day.confirmed ? "#f0fdf4" : "#f8fafc", borderBottom: "1px solid #eef2f6" }}>
                <b style={{ fontSize: 15 }}>{fDate(day.date)}</b>
                {isHoliday && <span style={{ fontSize: 11, background: "#fee2e2", color: "#b91c1c", padding: "2px 8px", borderRadius: 20 }}>휴무일</span>}
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{day.movements.length}건</span>
                <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                  <button onClick={() => addManual(day.date)} style={{ ...miniBtn, background: "#f1f5f9", color: "#334155" }}>+ 수동 추가</button>
                  <button disabled={saving === day.date} onClick={() => saveDay(day.date)} style={{ ...miniBtn, background: "#e0e7ff", color: "#3730a3" }}>💾 저장</button>
                  <button disabled={saving === day.date} onClick={() => saveDay(day.date, !day.confirmed)} style={{ ...miniBtn, background: day.confirmed ? "#16a34a" : "#fbbf24", color: day.confirmed ? "#fff" : "#78350f" }}>
                    {day.confirmed ? "✅ 전달완료" : "📤 전달(확정)"}
                  </button>
                </div>
              </div>

              {day.movements.length === 0 ? (
                <div style={{ padding: "14px", color: "#94a3b8", fontSize: 13 }}>차량 일정 없음</div>
              ) : (
                <div style={{ padding: "6px 0" }}>
                  {day.movements.map((m) => {
                    const k = KIND[m.kind] || KIND.extra;
                    const isManual = m.source === "manual";
                    const drivable = ["pickup", "dropoff", "transfer", "shuttle", "extra", "commute"].includes(m.kind);
                    return (
                      <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderTop: "1px solid #f4f6f8", fontSize: 13, flexWrap: "wrap" }}>
                        <span style={{ minWidth: 58, fontWeight: 700, color: "#0f172a" }}>{m.time || "--:--"}</span>
                        <span style={{ background: k.bg, color: k.color, padding: "2px 8px", borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: "nowrap" }}>{k.emoji} {k.label}</span>
                        {isManual ? (
                          <>
                            <input value={m.guest} placeholder="이름" onChange={(e) => patchManual(day.date, m.id, { guest: e.target.value })} style={inp(90)} />
                            <input value={m.time} placeholder="시간" onChange={(e) => patchManual(day.date, m.id, { time: e.target.value })} style={inp(60)} />
                            <input value={m.location} placeholder="출발" onChange={(e) => patchManual(day.date, m.id, { location: e.target.value })} style={inp(90)} />
                            <span style={{ color: "#94a3b8" }}>→</span>
                            <input value={m.destination} placeholder="도착" onChange={(e) => patchManual(day.date, m.id, { destination: e.target.value })} style={inp(90)} />
                          </>
                        ) : (
                          <>
                            <b style={{ minWidth: 70 }}>{m.guest}</b>
                            <span style={{ color: "#475569" }}>{m.location} <span style={{ color: "#cbd5e1" }}>→</span> {m.destination}</span>
                            {m.num_people > 1 && <span style={{ color: "#64748b" }}>· {m.num_people}명</span>}
                            {m.flight_info && <span style={{ color: "#0369a1", fontSize: 12 }}>✈️ {m.flight_info}</span>}
                            {m.note && <span style={{ color: "#94a3b8", fontSize: 12 }}>{m.note}</span>}
                            {m.locked && <span title="체크인디테일/추가픽드랍 — 항시 포함" style={{ fontSize: 11 }}>🔒</span>}
                          </>
                        )}
                        <span style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                          {drivable && (
                            <select
                              value={m.driver_id || ""}
                              onChange={(e) => isManual ? patchManual(day.date, m.id, { driver_id: e.target.value || null }) : setOverride(day.date, m.id, { driver_id: e.target.value || null })}
                              style={{ ...inp(0), padding: "4px 6px", border: m.driver_id ? "1px solid #cbd5e1" : "1px solid #f59e0b", background: m.driver_id ? "#fff" : "#fffbeb" }}
                            >
                              <option value="">기사 미배정</option>
                              {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          )}
                          {isManual && <button onClick={() => removeManual(day.date, m.id)} style={{ ...miniBtn, background: "#fee2e2", color: "#b91c1c", padding: "3px 7px" }}>✕</button>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <div style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", padding: "8px 0 40px" }}>
          자동 1차 취합 → 기사 배정·수동 수정(2차) → 📤 전달(확정) = 하루 기사 스케줄 완성<br />
          체크인디테일 차량·추가 픽드랍은 🔒 항시 포함 · 집↔학원 수동 보드(<a href="/ashuttle" target="_blank" style={{ color: "#2563eb" }}>기존 셔틀표</a>)는 그대로 유지됩니다.
        </div>
      </div>
    </div>
  );
}

const btn: React.CSSProperties = { background: "#2f3e50", color: "#fff", border: "1px solid #44566b", padding: "5px 11px", borderRadius: 7, cursor: "pointer", fontSize: 12.5 };
const miniBtn: React.CSSProperties = { border: "none", padding: "5px 10px", borderRadius: 7, cursor: "pointer", fontSize: 12, fontWeight: 700 };
const inp = (w: number): React.CSSProperties => ({ width: w || undefined, padding: "4px 7px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12.5 });
