"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface MealDay {
  date: number;
  weekday: string;
  breakfast?: string[];
  lunch: string[];
  dinner_adult?: string[];
  dinner_child?: string[];
  snack?: string[];
}
interface Menu { kind: string; menu_date: string; image_url: string; meal_data?: MealDay[]; }
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function PortalMealMenuPage() {
  const router = useRouter();
  const [aio, setAio] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"aio" | "academy">("aio");
  const [base, setBase] = useState(() => new Date());
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);

  const monday = (() => { const d = new Date(base); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d; })();
  const weekDays = Array.from({ length: 5 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const weekLabel = `${monday.getMonth() + 1}/${monday.getDate()} ~ ${weekDays[4].getMonth() + 1}/${weekDays[4].getDate()}`;
  const monthFirst = new Date(base.getFullYear(), base.getMonth(), 1);

  useEffect(() => { try { localStorage.setItem("meal_seen", new Date().toISOString()); } catch {} }, []);

  useEffect(() => {
    async function init() {
      if (typeof window === "undefined") return;
      let bid: string | null = null;
      try { const raw = localStorage.getItem("portalSession"); if (raw) { const s = JSON.parse(raw); if (s.booking_id && Date.now() < s.expires) bid = s.booking_id; } } catch {}
      if (!bid) { const { data } = await supabase.auth.getSession(); if (data.session) bid = data.session.user.user_metadata?.booking_id || data.session.user.id; }
      if (!bid) { router.replace("/portal"); return; }
      const { data: bk } = await supabase.from("bookings").select("is_all_in_one").eq("id", bid).maybeSingle();
      const isAio = !!bk?.is_all_in_one;
      setAio(isAio);
      setTab(isAio ? "aio" : "academy");
    }
    init();
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    if (tab === "aio") {
      const { data } = await supabase.from("meal_menus").select("kind, menu_date, image_url, meal_data").eq("kind", "dreamhouse").eq("published", true).eq("menu_date", ymd(monday));
      setMenus((data || []) as Menu[]);
    } else {
      const { data } = await supabase.from("meal_menus").select("kind, menu_date, image_url, meal_data").eq("kind", "academy").eq("published", true).eq("menu_date", ymd(monthFirst));
      setMenus((data || []) as Menu[]);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, monday.getTime(), base]);
  useEffect(() => { if (aio !== null) load(); }, [aio, load]);

  if (aio === null) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontFamily: "'Noto Sans KR',sans-serif" }}>불러오는 중…</div>;

  const mealData: MealDay[] | null = menus[0]?.meal_data && Array.isArray(menus[0].meal_data) ? menus[0].meal_data : null;
  const menuMonth = menus[0]?.menu_date ? parseInt(menus[0].menu_date.split("-")[1], 10) : (base.getMonth() + 1);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 18px 60px", fontFamily: "'Noto Sans KR',sans-serif", color: "#1a1a2e" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={() => router.push("/portal/dashboard")} style={{ background: "none", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontWeight: 600 }}>← 마이페이지</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, flex: 1 }}>🍽 식단</h1>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {aio && <button onClick={() => setTab("aio")} style={tabBtn(tab === "aio")}>🏠 올인원 식단</button>}
        <button onClick={() => setTab("academy")} style={tabBtn(tab === "academy")}>🎓 학생 식단</button>
      </div>

      {/* 기간 네비 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <button onClick={() => setBase(d => { const n = new Date(d); if (tab === "academy") n.setMonth(n.getMonth() - 1); else n.setDate(n.getDate() - 7); return n; })} style={navBtn}>← 이전</button>
        <span style={{ fontWeight: 800, fontSize: 14, flex: 1, textAlign: "center" }}>{tab === "academy" ? `${base.getFullYear()}년 ${base.getMonth() + 1}월` : weekLabel}</span>
        <button onClick={() => setBase(d => { const n = new Date(d); if (tab === "academy") n.setMonth(n.getMonth() + 1); else n.setDate(n.getDate() + 7); return n; })} style={navBtn}>다음 →</button>
        <button onClick={() => setBase(new Date())} style={navBtn}>{tab === "academy" ? "이번달" : "이번주"}</button>
      </div>

      {tab === "aio" ? (
        <>
          <p style={{ fontSize: 12, color: "#6b7c93", marginBottom: 14 }}>드림하우스 식단 · 🌅 아침 · ☀️ 점심 · 🌙 저녁(어른) · 🧒 저녁(아동)</p>
          {loading ? <Loading /> : !menus[0] ? <Empty text="아직 이번 주 식단이 등록되지 않았습니다." /> : (
            mealData ? (
              <DreamhouseCards days={mealData} month={menuMonth} />
            ) : (
              <div style={imgCard}>
                <div style={imgCardHd}>{weekLabel} 드림하우스 식단</div>
                <img src={menus[0].image_url} alt="이번주 식단" style={{ width: "100%", display: "block" }} />
              </div>
            )
          )}
        </>
      ) : (
        <>
          <p style={{ fontSize: 12, color: "#6b7c93", marginBottom: 14 }}>학생 점심·간식(아카데미) · 모든 학생 · <span style={{ color: "#059669", fontWeight: 700, textDecoration: "underline" }}>민트색 = 간식</span></p>
          {loading ? <Loading /> : !menus[0] ? <Empty text="아직 이번 달 학생 식단이 등록되지 않았습니다." /> : (
            mealData ? (
              <AcademyWeeklyTable days={mealData} month={menuMonth} />
            ) : (
              <div style={imgCard}>
                <div style={imgCardHd}>{base.getMonth() + 1}월 학생 점심 식단</div>
                <img src={menus[0].image_url} alt="학생 식단" style={{ width: "100%", display: "block" }} />
              </div>
            )
          )}
        </>
      )}

      <div style={{ marginTop: 16, padding: "10px 13px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
        ⚠ 현지 재료 수급 문제로 메뉴는 별도 안내 없이 달라질 수 있습니다.
      </div>
    </div>
  );
}

/* ==== 드림하우스 올인원 — 날짜별 4열 테이블 카드 ==== */

const DH_COLS = [
  { key: "breakfast", label: "🌅 아침", bg: "#fef3c7" },
  { key: "lunch", label: "☀️ 점심", bg: "#dbeafe" },
  { key: "dinner_adult", label: "🌙 저녁(어른)", bg: "#e0e7ff" },
  { key: "dinner_child", label: "🧒 저녁(아동)", bg: "#fce7f3" },
];

function DreamhouseCards({ days, month }: { days: MealDay[]; month: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {days.map((day, i) => {
        const maxLen = Math.max(...DH_COLS.map(c => ((day as any)[c.key] || []).length), 1);
        return (
          <div key={i} style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "10px 16px", fontWeight: 800, fontSize: 16, borderBottom: "1px solid #f1f5f9" }}>
              {month}/{day.date} ({day.weekday})
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 480 }}>
                <thead>
                  <tr>
                    {DH_COLS.map(c => (
                      <th key={c.key} style={{ background: c.bg, padding: "7px 8px", fontWeight: 800, fontSize: 12, textAlign: "center", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{c.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: maxLen }, (_, ri) => (
                    <tr key={ri}>
                      {DH_COLS.map(c => {
                        const items: string[] = (day as any)[c.key] || [];
                        return (
                          <td key={c.key} style={{ padding: "5px 8px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", fontSize: 12.5, lineHeight: 1.5 }}>
                            {items[ri] || ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ==== 아카데미 학생 — 주간 그리드 테이블 (간식=민트) ==== */

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금"];

function groupByWeek(days: MealDay[]): MealDay[][] {
  // 5일씩 묶기 (월~금)
  const weeks: MealDay[][] = [];
  let cur: MealDay[] = [];
  for (const d of days) {
    cur.push(d);
    if (cur.length === 5 || d.weekday === "금") {
      weeks.push(cur);
      cur = [];
    }
  }
  if (cur.length > 0) weeks.push(cur);
  return weeks;
}

function AcademyWeeklyTable({ days, month }: { days: MealDay[]; month: number }) {
  const weeks = groupByWeek(days);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {weeks.map((week, wi) => {
        const maxLunch = Math.max(...week.map(d => (d.lunch || []).length), 1);
        const maxSnack = Math.max(...week.map(d => (d.snack || []).length), 0);
        const dateRange = week.length > 0 ? `${month}/${week[0].date} ~ ${month}/${week[week.length - 1].date}` : "";
        return (
          <div key={wi} style={{ background: "#fff", borderRadius: 14, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "10px 16px", fontWeight: 800, fontSize: 15, borderBottom: "1px solid #f1f5f9" }}>
              {month}월 학생 점심·간식 식단 <span style={{ fontSize: 12, fontWeight: 500, color: "#94a3b8" }}>({dateRange})</span>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 420 }}>
                {/* 요일 헤더 */}
                <thead>
                  <tr>
                    {week.map((d, di) => (
                      <th key={di} style={{ background: "#1e3a5f", color: "#fff", padding: "7px 6px", fontWeight: 800, fontSize: 12, textAlign: "center", width: `${100 / week.length}%` }}>
                        {WEEKDAY_LABELS[di] || d.weekday}
                      </th>
                    ))}
                  </tr>
                  {/* 날짜 서브헤더 */}
                  <tr>
                    {week.map((d, di) => (
                      <td key={di} style={{ background: "#f1f5f9", padding: "5px 6px", fontWeight: 800, fontSize: 12, textAlign: "center", color: "#1e3a5f", borderBottom: "2px solid #e2e8f0" }}>
                        {d.date}({d.weekday})
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* 점심 행들 */}
                  {Array.from({ length: maxLunch }, (_, ri) => (
                    <tr key={`l${ri}`}>
                      {week.map((d, di) => (
                        <td key={di} style={{ padding: "4px 6px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", fontSize: 12, lineHeight: 1.5 }}>
                          {(d.lunch || [])[ri] || ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {/* 간식 행들 (민트색) */}
                  {maxSnack > 0 && Array.from({ length: maxSnack }, (_, ri) => (
                    <tr key={`s${ri}`}>
                      {week.map((d, di) => (
                        <td key={di} style={{ padding: "4px 6px", borderBottom: "1px solid #d1fae5", verticalAlign: "top", fontSize: 12, lineHeight: 1.5, background: "#ecfdf5", color: "#059669", fontWeight: 600 }}>
                          {(d.snack || [])[ri] || ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {maxSnack > 0 && (
              <div style={{ padding: "6px 14px 8px", fontSize: 11, color: "#059669", fontWeight: 600 }}>
                ▲ 맨 아래 민트색 = 간식
              </div>
            )}
          </div>
        );
      })}
      <p style={{ fontSize: 11.5, color: "#94a3b8", textAlign: "center" }}>통학형·큐브 손님도 이 학생 식단 탭은 보입니다 (점심은 모두 제공).</p>
    </div>
  );
}

function Loading() { return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>불러오는 중…</div>; }
function Empty({ text }: { text: string }) { return <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 12, padding: 44, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>{text}</div>; }
const imgCard: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" };
const imgCardHd: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontWeight: 800, fontSize: 14 };
const navBtn: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 11px", cursor: "pointer", fontWeight: 600, fontSize: 12.5 };
const tabBtn = (on: boolean): React.CSSProperties => ({ flex: 1, padding: "9px 0", borderRadius: 9, border: `1px solid ${on ? "#1e3a5f" : "#e2e8f0"}`, background: on ? "#1e3a5f" : "#fff", color: on ? "#fff" : "#64748b", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" });
