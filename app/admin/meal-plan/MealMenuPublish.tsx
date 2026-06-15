"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toastOk, toastErr } from "@/lib/toast";

interface Menu { id: string; kind: string; menu_date: string; image_url: string; published: boolean; }
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const MEAL_ORDER = "🌅 아침 · ☀️ 점심 · 🌙 저녁(어른) · 🧒 저녁(아동)";

function compress(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1400; let w = img.width, h = img.height;
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
  const [menu, setMenu] = useState<Menu | null>(null);
  const [busy, setBusy] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cands, setCands] = useState<{ id: string; name: string; room: string; ci: string; co: string }[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [loadingCands, setLoadingCands] = useState(false);

  // 올인원=해당 주 월요일 / 아카데미=해당 월 1일 (둘 다 한 장)
  const monday = (() => { const d = new Date(base); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d; })();
  const fri = (() => { const d = new Date(monday); d.setDate(monday.getDate() + 4); return d; })();
  const monthFirst = new Date(base.getFullYear(), base.getMonth(), 1);
  const targetDate = monthly ? ymd(monthFirst) : ymd(monday);
  const periodLabel = monthly ? `${base.getFullYear()}년 ${base.getMonth() + 1}월` : `${monday.getMonth() + 1}/${monday.getDate()} ~ ${fri.getMonth() + 1}/${fri.getDate()}`;

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("meal_menus").select("*").eq("kind", kind).eq("menu_date", targetDate).maybeSingle();
    if (error && error.code !== "PGRST116") { toastErr("불러오기 실패: " + error.message); return; }
    setMenu((data || null) as Menu | null);
  }, [kind, targetDate]);
  useEffect(() => { load(); }, [load]);

  async function onUpload(file: File) {
    if (!file.type.startsWith("image/")) { toastErr("이미지 파일만 가능합니다"); return; }
    setBusy(true);
    try {
      const dataUrl = await compress(file);
      if (menu) {
        const { error } = await supabase.from("meal_menus").update({ image_url: dataUrl, updated_at: new Date().toISOString() }).eq("id", menu.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("meal_menus").insert({ kind, menu_date: targetDate, image_url: dataUrl, published: false });
        if (error) throw error;
      }
      toastOk("업로드됐어요"); load();
    } catch (e) { toastErr("업로드 실패: " + ((e as Error)?.message || "")); }
    setBusy(false);
  }
  async function delMenu() {
    if (!menu || !window.confirm("이 식단을 삭제할까요?")) return;
    const { error } = await supabase.from("meal_menus").delete().eq("id", menu.id);
    if (error) { toastErr("삭제 실패: " + error.message); return; }
    toastOk("삭제됨"); setMenu(null);
  }
  // 발행 → 받을 손님 선택 모달 (투숙중 자동 선택)
  async function openPicker() {
    if (!menu) { toastErr("발행할 식단이 없습니다. 먼저 사진을 올려주세요."); return; }
    setPickerOpen(true); setLoadingCands(true);
    const today = ymd(new Date());
    let q = supabase.from("bookings").select("id, booker_name, house_no, checkin_date, checkout_date");
    if (!monthly) q = q.eq("is_all_in_one", true); // 올인원만
    const { data } = await q;
    const staying = (data || []).filter((b: any) => {
      const ci = (b.checkin_date || "").slice(0, 10), co = (b.checkout_date || "").slice(0, 10);
      return ci && ci <= today && (!co || co >= today); // 투숙중
    }).map((b: any) => ({ id: b.id, name: b.booker_name || "(이름없음)", room: b.house_no || "", ci: (b.checkin_date || "").slice(0, 10), co: (b.checkout_date || "").slice(0, 10) }));
    staying.sort((a: any, b: any) => a.name.localeCompare(b.name));
    setCands(staying);
    setSel(new Set(staying.map((s: any) => s.id))); // 기본 전체 선택(투숙중)
    setLoadingCands(false);
  }
  async function doPublish() {
    if (!menu) return;
    const ids = [...sel];
    if (ids.length === 0) { toastErr("받을 손님을 1팀 이상 선택하세요"); return; }
    setPublishing(true);
    try {
      const { error } = await supabase.from("meal_menus").update({ published: true }).eq("id", menu.id);
      if (error) throw error;
      const title = monthly ? "아카데미 식단 안내 🍽" : "이번주 식단 안내 🍽";
      const body = monthly ? `${base.getMonth() + 1}월 점심·간식 식단표가 등록되었습니다.` : "이번주 드림하우스 식단표가 등록되었습니다.";
      await fetch("/api/portal/push/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ audience: "selected", target_ids: ids, title, body, url: "/portal/meal-menu" }) }).catch(() => {});
      toastOk(`발행 완료 — ${ids.length}팀에 알림 전송`);
      setPickerOpen(false); load();
    } catch (e) { toastErr("발행 실패: " + ((e as Error)?.message || "")); }
    setPublishing(false);
  }

  return (
    <div style={{ padding: "4px 2px 20px", maxWidth: 560 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 12px", flexWrap: "wrap" }}>
        <button onClick={() => setBase(d => { const n = new Date(d); if (monthly) n.setMonth(n.getMonth() - 1); else n.setDate(n.getDate() - 7); return n; })} style={navBtn}>← 이전{monthly ? " 달" : " 주"}</button>
        <span style={{ fontWeight: 800, fontSize: 15, minWidth: 150, textAlign: "center" }}>{periodLabel}</span>
        <button onClick={() => setBase(d => { const n = new Date(d); if (monthly) n.setMonth(n.getMonth() + 1); else n.setDate(n.getDate() + 7); return n; })} style={navBtn}>다음{monthly ? " 달" : " 주"} →</button>
        <button onClick={() => setBase(new Date())} style={navBtn}>{monthly ? "이번 달" : "이번 주"}</button>
        <button onClick={openPicker} disabled={publishing} style={{ marginLeft: "auto", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 9, padding: "10px 18px", fontWeight: 800, fontSize: 14, cursor: "pointer", opacity: publishing ? 0.6 : 1 }}>
          {`📢 발행 & 알림${menu?.published ? " (발행됨)" : ""}`}
        </button>
      </div>
      <p style={{ fontSize: 12, color: "#6b7c93", margin: "0 0 12px" }}>
        {monthly
          ? <>학생 점심·간식(아카데미) 식단표 — 한 달에 1장(🍱 점심 · 🍪 간식 포함). <b>모든 손님</b>에게 보입니다.</>
          : <>드림하우스 올인원 식단표 — 한 주에 1장(항목 순서: {MEAL_ORDER}). <b>올인원 손님</b>에게만 보입니다.</>}
      </p>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center" }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{monthly ? `${base.getMonth() + 1}월 식단표` : "이번 주 식단표"}</span>
          {menu?.published ? <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 8 }}>발행됨</span> : menu ? <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: 8 }}>임시저장</span> : null}
        </div>
        <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {menu?.image_url ? <img src={menu.image_url} alt="식단" style={{ width: "100%", borderRadius: 8, border: "1px solid #eef2f7" }} /> : <div style={{ height: 170, border: "2px dashed #cbd5e1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13 }}>사진 없음 — 아래에서 업로드</div>}
          <label style={{ fontSize: 13, fontWeight: 700, color: "#2563eb", background: "#eff6ff", borderRadius: 8, padding: "9px 0", textAlign: "center", cursor: "pointer" }}>
            {busy ? "업로드 중…" : (menu ? "📷 사진 교체" : "📷 사진 올리기")}
            <input type="file" accept="image/*" style={{ display: "none" }} disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
          </label>
          {menu && <button onClick={delMenu} style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 12, alignSelf: "flex-end" }}>삭제</button>}
        </div>
      </div>

      {/* 받는 손님 선택 모달 */}
      {pickerOpen && (
        <div onClick={() => setPickerOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 20, width: "100%", maxWidth: 460, maxHeight: "86vh", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 3 }}>받을 손님 선택</div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 10 }}>{monthly ? "투숙중인 손님" : "투숙중인 올인원 손님"}이 자동 선택됩니다. 빼고 싶은 분은 체크 해제하세요.</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
              <button onClick={() => setSel(new Set(cands.map(c => c.id)))} style={{ fontSize: 12, border: "1px solid #e2e8f0", background: "#fff", borderRadius: 7, padding: "5px 11px", cursor: "pointer", fontWeight: 600 }}>전체 선택</button>
              <button onClick={() => setSel(new Set())} style={{ fontSize: 12, border: "1px solid #e2e8f0", background: "#fff", borderRadius: 7, padding: "5px 11px", cursor: "pointer", fontWeight: 600 }}>전체 해제</button>
              <span style={{ marginLeft: "auto", fontSize: 12.5, fontWeight: 700, color: "#1e3a5f", alignSelf: "center" }}>{sel.size} / {cands.length}팀</span>
            </div>
            <div style={{ flex: 1, overflowY: "auto", border: "1px solid #f1f5f9", borderRadius: 8 }}>
              {loadingCands ? <div style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>불러오는 중…</div>
                : cands.length === 0 ? <div style={{ padding: 24, textAlign: "center", color: "#cbd5e1", fontSize: 13 }}>투숙중인 {monthly ? "손님" : "올인원 손님"}이 없습니다</div>
                : cands.map(c => (
                  <label key={c.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderBottom: "1px solid #f8fafc", cursor: "pointer" }}>
                    <input type="checkbox" checked={sel.has(c.id)} onChange={e => { setSel(prev => { const n = new Set(prev); if (e.target.checked) n.add(c.id); else n.delete(c.id); return n; }); }} />
                    <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{c.name} <span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 400 }}>{c.room}</span></span>
                    <span style={{ fontSize: 11, color: "#94a3b8" }}>{c.ci?.slice(5)}~{c.co?.slice(5)}</span>
                  </label>
                ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={() => setPickerOpen(false)} style={{ flex: 1, padding: "11px 0", border: "1px solid #e2e8f0", background: "#fff", borderRadius: 9, fontWeight: 700, cursor: "pointer", fontSize: 13 }}>취소</button>
              <button onClick={doPublish} disabled={publishing || sel.size === 0} style={{ flex: 2, padding: "11px 0", border: "none", background: publishing || sel.size === 0 ? "#94a3b8" : "#1e3a5f", color: "#fff", borderRadius: 9, fontWeight: 800, cursor: "pointer", fontSize: 13.5 }}>{publishing ? "발행 중…" : `📢 ${sel.size}팀에 발행 & 알림`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontWeight: 600, fontSize: 13 };
