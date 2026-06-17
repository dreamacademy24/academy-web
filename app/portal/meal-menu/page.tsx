"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface MealDay {
  date: number;
  weekday: string;
  breakfast: string[];
  lunch: string[];
  dinner_adult: string[];
  dinner_child: string[];
}
interface Menu { kind: string; menu_date: string; image_url: string; meal_data?: MealDay[]; }
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const MEAL_ORDER = "🌅 아침 · ☀️ 점심 · 🌙 저녁(어른) · 🧒 저녁(아동)";

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

  const academyImg = menus[0]?.image_url;
  const mealData: MealDay[] | null = menus[0]?.meal_data && Array.isArray(menus[0].meal_data) ? menus[0].meal_data : null;
  const menuMonth = menus[0]?.menu_date ? parseInt(menus[0].menu_date.split("-")[1], 10) : (monday.getMonth() + 1);

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 18px 60px", fontFamily: "'Noto Sans KR',sans-serif", color: "#1a1a2e" }}>
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setBase(d => { const n = new Date(d); if (tab === "academy") n.setMonth(n.getMonth() - 1); else n.setDate(n.getDate() - 7); return n; })} style={navBtn}>← 이전</button>
        <span style={{ fontWeight: 800, fontSize: 14, flex: 1, textAlign: "center" }}>{tab === "academy" ? `${base.getFullYear()}년 ${base.getMonth() + 1}월` : weekLabel}</span>
        <button onClick={() => setBase(d => { const n = new Date(d); if (tab === "academy") n.setMonth(n.getMonth() + 1); else n.setDate(n.getDate() + 7); return n; })} style={navBtn}>다음 →</button>
        <button onClick={() => setBase(new Date())} style={navBtn}>{tab === "academy" ? "이번달" : "이번주"}</button>
      </div>

      {tab === "aio" ? (
        <>
          <p style={{ fontSize: 12, color: "#6b7c93", marginBottom: 14 }}>드림하우스 식단 · 항목 순서: {MEAL_ORDER}</p>
          {loading ? <Loading /> : !menus[0] ? <Empty text="아직 이번 주 식단이 등록되지 않았습니다." /> : (
            mealData ? (
              <MealCards days={mealData} month={menuMonth} />
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
          <p style={{ fontSize: 12, color: "#6b7c93", marginBottom: 14 }}>학생 점심·간식(아카데미) · 모든 학생 제공 · 🍱 점심 · 🍪 간식</p>
          {loading ? <Loading /> : !academyImg ? <Empty text="아직 이번 달 학생 식단이 등록되지 않았습니다." /> : (
            <div style={imgCard}>
              <div style={imgCardHd}>{base.getMonth() + 1}월 학생 점심 식단</div>
              <img src={academyImg} alt="학생 식단" style={{ width: "100%", display: "block" }} />
            </div>
          )}
        </>
      )}

      <div style={{ marginTop: 16, padding: "10px 13px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 10, fontSize: 12, color: "#92400e", lineHeight: 1.6 }}>
        ! 현지 재료 수급 문제로 메뉴는 별도 안내 없이 달라질 수 있습니다.
      </div>
    </div>
  );
}

/* ---- Meal Card UI ---- */

const MEAL_ROWS: { key: keyof Pick<MealDay, "breakfast" | "lunch" | "dinner_adult" | "dinner_child">; label: string; emoji: string; bg: string; border: string; text: string }[] = [
  { key: "breakfast", label: "아침", emoji: "🌅", bg: "#fef3c7", border: "#fde68a", text: "#92400e" },
  { key: "lunch", label: "점심", emoji: "☀️", bg: "#dbeafe", border: "#93c5fd", text: "#1e40af" },
  { key: "dinner_adult", label: "저녁 (어른)", emoji: "🌙", bg: "#e0e7ff", border: "#a5b4fc", text: "#3730a3" },
  { key: "dinner_child", label: "저녁 (아동)", emoji: "🧒", bg: "#fce7f3", border: "#f9a8d4", text: "#9d174d" },
];

function MealCards({ days, month }: { days: MealDay[]; month: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {days.map((day, i) => (
        <div key={i} style={{ background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)", border: "1px solid #e2e8f0" }}>
          {/* 카드 헤더 */}
          <div style={{ background: "#1e3a5f", color: "#fff", padding: "10px 16px", fontWeight: 800, fontSize: 15 }}>
            {month}/{day.date} ({day.weekday})
          </div>
          {/* 4행 메뉴 */}
          <div style={{ padding: "6px 10px 10px" }}>
            {MEAL_ROWS.map(row => {
              const items = day[row.key];
              if (!items || items.length === 0) return null;
              return (
                <div key={row.key} style={{ marginTop: 6 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 13 }}>{row.emoji}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: row.text }}>{row.label}</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, paddingLeft: 2 }}>
                    {items.map((item, j) => (
                      <span key={j} style={{ display: "inline-block", background: row.bg, border: `1px solid ${row.border}`, color: row.text, borderRadius: 7, padding: "3px 9px", fontSize: 12, fontWeight: 500, lineHeight: 1.5 }}>
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Loading() { return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>불러오는 중…</div>; }
function Empty({ text }: { text: string }) { return <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 12, padding: 44, textAlign: "center", color: "#94a3b8", fontSize: 14 }}>{text}</div>; }
const imgCard: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" };
const imgCardHd: React.CSSProperties = { padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontWeight: 800, fontSize: 14 };
const navBtn: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 11px", cursor: "pointer", fontWeight: 600, fontSize: 12.5 };
const tabBtn = (on: boolean): React.CSSProperties => ({ flex: 1, padding: "9px 0", borderRadius: 9, border: `1px solid ${on ? "#1e3a5f" : "#e2e8f0"}`, background: on ? "#1e3a5f" : "#fff", color: on ? "#fff" : "#64748b", fontWeight: 800, fontSize: 13, cursor: "pointer", fontFamily: "inherit" });
