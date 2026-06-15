"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toastOk, toastErr } from "@/lib/toast";

interface Menu { id: string; kind: string; menu_date: string; image_url: string; published: boolean; }
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const MEAL_ORDER = "🌅 아침 · ☀️ 점심 · 🌙 저녁(어른) · 🧒 저녁(아동)";

function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1200; let w = img.width, h = img.height;
        if (w > max) { h = Math.round(h * max / w); w = max; }
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const ctx = c.getContext("2d"); if (!ctx) { reject(new Error("canvas")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject; img.src = r.result as string;
    };
    r.onerror = reject; r.readAsDataURL(file);
  });
}

export default function MealMenuPublish({ kind }: { kind: "dreamhouse" | "academy" }) {
  const monthly = kind === "academy";
  const [base, setBase] = useState(() => new Date());
  const [menus, setMenus] = useState<Record<string, Menu>>({});
  const [busy, setBusy] = useState("");
  const [publishing, setPublishing] = useState(false);

  // 주간(월~금) 또는 월간(해당 월 1일)
  const monday = (() => { const d = new Date(base); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d; })();
  const weekDays = Array.from({ length: 5 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const monthFirst = new Date(base.getFullYear(), base.getMonth(), 1);
  const dates = monthly ? [ymd(monthFirst)] : weekDays.map(ymd);
  const periodLabel = monthly ? `${base.getFullYear()}년 ${base.getMonth() + 1}월` : `${monday.getMonth() + 1}/${monday.getDate()} ~ ${weekDays[4].getMonth() + 1}/${weekDays[4].getDate()}`;

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("meal_menus").select("*").eq("kind", kind).in("menu_date", dates);
    if (error) { toastErr("불러오기 실패: " + error.message); return; }
    const map: Record<string, Menu> = {};
    for (const m of (data || []) as Menu[]) map[m.menu_date] = m;
    setMenus(map);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, dates.join(",")]);
  useEffect(() => { load(); }, [load]);

  async function onUpload(date: string, file: File) {
    if (!file.type.startsWith("image/")) { toastErr("이미지 파일만 가능합니다"); return; }
    setBusy(date);
    try {
      const dataUrl = await compress(file);
      const existing = menus[date];
      if (existing) {
        const { error } = await supabase.from("meal_menus").update({ image_url: dataUrl, updated_at: new Date().toISOString() }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meal_menus").insert({ kind, menu_date: date, image_url: dataUrl, published: false });
        if (error) throw error;
      }
      toastOk("업로드됐어요"); load();
    } catch (e) { toastErr("업로드 실패: " + ((e as Error)?.message || "")); }
    setBusy("");
  }
  async function delMenu(date: string) {
    const existing = menus[date]; if (!existing) return;
    if (!window.confirm("이 식단을 삭제할까요?")) return;
    const { error } = await supabase.from("meal_menus").delete().eq("id", existing.id);
    if (error) { toastErr("삭제 실패: " + error.message); return; }
    toastOk("삭제됨"); load();
  }
  async function publish() {
    const have = dates.filter(d => menus[d]);
    if (have.length === 0) { toastErr("발행할 식단이 없습니다. 먼저 사진을 올려주세요."); return; }
    const who = monthly ? "모든 손님" : "올인원 손님";
    if (!window.confirm(`${periodLabel} 식단을 발행하고 ${who}에게 알림을 보낼까요?`)) return;
    setPublishing(true);
    try {
      const { error } = await supabase.from("meal_menus").update({ published: true }).eq("kind", kind).in("menu_date", have);
      if (error) throw error;
      let cnt = "";
      if (monthly) {
        // 모든 손님 = 전체 푸시 구독자
        await fetch("/api/portal/push/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "아카데미 식단 안내 🍽", body: `${base.getMonth() + 1}월 점심 식단표가 등록되었습니다.`, url: "/portal/meal-menu" }) }).catch(() => {});
        cnt = "모든 손님";
      } else {
        const { data: bk } = await supabase.from("bookings").select("id").eq("is_all_in_one", true);
        const ids = (bk || []).map((b: { id: string }) => b.id);
        if (ids.length) await fetch("/api/portal/push/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audience: "selected", target_ids: ids, title: "이번주 식단 안내 🍽", body: "이번주 드림하우스 식단표가 등록되었습니다.", url: "/portal/meal-menu" }) }).catch(() => {});
        cnt = `올인원 ${ids.length}팀`;
      }
      toastOk(`발행 완료 — ${cnt}에 알림 전송`); load();
    } catch (e) { toastErr("발행 실패: " + ((e as Error)?.message || "")); }
    setPublishing(false);
  }

  const publishedCount = dates.filter(d => menus[d]?.published).length;

  return (
    <div style={{ padding: "4px 2px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 14px", flexWrap: "wrap" }}>
        <button onClick={() => setBase(d => { const n = new Date(d); n.setDate(n.getDate() + (monthly ? 0 : -7)); if (monthly) n.setMonth(n.getMonth() - 1); return n; })} style={navBtn}>← 이전{monthly ? " 달" : " 주"}</button>
        <span style={{ fontWeight: 800, fontSize: 15, minWidth: 150, textAlign: "center" }}>{periodLabel}</span>
        <button onClick={() => setBase(d => { const n = new Date(d); n.setDate(n.getDate() + (monthly ? 0 : 7)); if (monthly) n.setMonth(n.getMonth() + 1); return n; })} style={navBtn}>다음{monthly ? " 달" : " 주"} →</button>
        <button onClick={() => setBase(new Date())} style={navBtn}>{monthly ? "이번 달" : "이번 주"}</button>
        <button onClick={publish} disabled={publishing} style={{ marginLeft: "auto", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: publishing ? 0.6 : 1 }}>
          {publishing ? "발행 중…" : `📢 발행 & 알림${publishedCount ? ` (발행됨)` : ""}`}
        </button>
      </div>
      {!monthly && <p style={{ fontSize: 12, color: "#6b7c93", margin: "0 0 12px" }}>항목 순서: {MEAL_ORDER} · 하루 1장씩 올리세요. <b>올인원 손님</b>에게만 보입니다.</p>}
      {monthly && <p style={{ fontSize: 12, color: "#6b7c93", margin: "0 0 12px" }}>학생 점심·간식(아카데미) 식단표 — 한 달에 1장(🍱 점심 · 🍪 간식 포함). <b>모든 손님</b>에게 보입니다.</p>}

      {monthly ? (
        <div style={{ maxWidth: 460 }}>
          {(() => { const date = ymd(monthFirst); const m = menus[date]; return (
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center" }}>
                <span style={{ fontWeight: 800, fontSize: 14 }}>{base.getMonth() + 1}월 식단표</span>
                {m?.published ? <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 8 }}>발행됨</span> : m ? <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: 8 }}>임시</span> : null}
              </div>
              <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                {m?.image_url ? <img src={m.image_url} alt="식단" style={{ width: "100%", borderRadius: 8, border: "1px solid #eef2f7" }} /> : <div style={{ height: 160, border: "2px dashed #cbd5e1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>사진 없음 — 아래에서 업로드</div>}
                <label style={uploadBtn}>{busy === date ? "업로드 중…" : (m ? "📷 사진 교체" : "📷 사진 올리기")}<input type="file" accept="image/*" style={{ display: "none" }} disabled={busy === date} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(date, f); e.target.value = ""; }} /></label>
                {m && <button onClick={() => delMenu(date)} style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 12, alignSelf: "flex-end" }}>삭제</button>}
              </div>
            </div>
          ); })()}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12 }}>
          {weekDays.map(d => {
            const date = ymd(d); const m = menus[date];
            return (
              <div key={date} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontWeight: 800, fontSize: 14 }}>{d.getMonth() + 1}/{d.getDate()} ({DOW[d.getDay()]})</span>
                  {m?.published ? <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 8 }}>발행</span> : m ? <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: 8 }}>임시</span> : null}
                </div>
                <div style={{ padding: 10, flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  {m?.image_url ? <img src={m.image_url} alt="식단" style={{ width: "100%", borderRadius: 8, border: "1px solid #eef2f7" }} /> : <div style={{ height: 110, border: "2px dashed #cbd5e1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 12, textAlign: "center" }}>사진 없음</div>}
                  <label style={uploadBtn}>{busy === date ? "업로드 중…" : (m ? "📷 교체" : "📷 올리기")}<input type="file" accept="image/*" style={{ display: "none" }} disabled={busy === date} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(date, f); e.target.value = ""; }} /></label>
                  {m && <button onClick={() => delMenu(date)} style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 11.5, alignSelf: "flex-end" }}>삭제</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const uploadBtn: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#2563eb", background: "#eff6ff", borderRadius: 7, padding: "7px 0", textAlign: "center", cursor: "pointer" };
