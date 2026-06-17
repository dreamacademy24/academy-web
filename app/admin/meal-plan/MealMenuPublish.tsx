"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { toastOk, toastErr } from "@/lib/toast";

interface MealDay { date: number; weekday: string; breakfast?: string[]; lunch: string[]; dinner_adult?: string[]; dinner_child?: string[]; snack?: string[]; }
interface Menu { id: string; kind: string; menu_date: string; image_url: string; published: boolean; meal_data?: MealDay[]; }
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

/* ---- 미리보기용 테이블 컴포넌트 ---- */

const DH_COLS = [
  { key: "breakfast", label: "🌅 아침", bg: "#fef3c7" },
  { key: "lunch", label: "☀️ 점심", bg: "#dbeafe" },
  { key: "dinner_adult", label: "🌙 저녁(어른)", bg: "#e0e7ff" },
  { key: "dinner_child", label: "🧒 저녁(아동)", bg: "#fce7f3" },
];
const WEEKDAY_LABELS = ["월", "화", "수", "목", "금"];

function groupByWeek(days: MealDay[]): MealDay[][] {
  const weeks: MealDay[][] = []; let cur: MealDay[] = [];
  for (const d of days) { cur.push(d); if (cur.length === 5 || d.weekday === "금") { weeks.push(cur); cur = []; } }
  if (cur.length > 0) weeks.push(cur);
  return weeks;
}

function MealCardPreview({ days, month, isAcademy }: { days: MealDay[]; month: number; isAcademy: boolean }) {
  if (isAcademy) {
    // 아카데미: 주간 그리드 (월~금), 간식=민트
    const weeks = groupByWeek(days);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {weeks.map((week, wi) => {
          const maxLunch = Math.max(...week.map(d => (d.lunch || []).length), 1);
          const maxSnack = Math.max(...week.map(d => (d.snack || []).length), 0);
          const dateRange = week.length > 0 ? `${month}/${week[0].date} ~ ${month}/${week[week.length - 1].date}` : "";
          return (
            <div key={wi} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ padding: "9px 14px", fontWeight: 800, fontSize: 14, borderBottom: "1px solid #f1f5f9" }}>
                {month}월 학생 점심·간식 <span style={{ fontSize: 11.5, fontWeight: 500, color: "#94a3b8" }}>({dateRange})</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 380 }}>
                  <thead>
                    <tr>{week.map((d, di) => <th key={di} style={{ background: "#1e3a5f", color: "#fff", padding: "6px 5px", fontWeight: 800, fontSize: 11.5, textAlign: "center", width: `${100 / week.length}%` }}>{WEEKDAY_LABELS[di] || d.weekday}</th>)}</tr>
                    <tr>{week.map((d, di) => <td key={di} style={{ background: "#f1f5f9", padding: "4px 5px", fontWeight: 800, fontSize: 11, textAlign: "center", color: "#1e3a5f", borderBottom: "2px solid #e2e8f0" }}>{d.date}({d.weekday})</td>)}</tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: maxLunch }, (_, ri) => (
                      <tr key={`l${ri}`}>{week.map((d, di) => <td key={di} style={{ padding: "3px 5px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", fontSize: 11.5, lineHeight: 1.5 }}>{(d.lunch || [])[ri] || ""}</td>)}</tr>
                    ))}
                    {maxSnack > 0 && Array.from({ length: maxSnack }, (_, ri) => (
                      <tr key={`s${ri}`}>{week.map((d, di) => <td key={di} style={{ padding: "3px 5px", borderBottom: "1px solid #d1fae5", verticalAlign: "top", fontSize: 11.5, lineHeight: 1.5, background: "#ecfdf5", color: "#059669", fontWeight: 600 }}>{(d.snack || [])[ri] || ""}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {maxSnack > 0 && <div style={{ padding: "5px 12px 7px", fontSize: 10.5, color: "#059669", fontWeight: 600 }}>▲ 민트색 = 간식</div>}
            </div>
          );
        })}
      </div>
    );
  }
  // 드림하우스: 날짜별 4열 테이블
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {days.map((day, i) => {
        const maxLen = Math.max(...DH_COLS.map(c => ((day as any)[c.key] || []).length), 1);
        return (
          <div key={i} style={{ background: "#fff", borderRadius: 12, overflow: "hidden", border: "1px solid #e2e8f0", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ padding: "9px 14px", fontWeight: 800, fontSize: 14, borderBottom: "1px solid #f1f5f9" }}>{month}/{day.date} ({day.weekday})</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, minWidth: 400 }}>
                <thead><tr>{DH_COLS.map(c => <th key={c.key} style={{ background: c.bg, padding: "6px 7px", fontWeight: 800, fontSize: 11, textAlign: "center", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{c.label}</th>)}</tr></thead>
                <tbody>{Array.from({ length: maxLen }, (_, ri) => (
                  <tr key={ri}>{DH_COLS.map(c => <td key={c.key} style={{ padding: "4px 7px", borderBottom: "1px solid #f1f5f9", verticalAlign: "top", fontSize: 11.5, lineHeight: 1.5 }}>{((day as any)[c.key] || [])[ri] || ""}</td>)}</tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
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
  const [ocrBusy, setOcrBusy] = useState(false);
  const [showImg, setShowImg] = useState(false); // 원본 이미지 토글

  // 올인원=해당 주 월요일 / 아카데미=해당 월 1일 (둘 다 한 장)
  const monday = (() => { const d = new Date(base); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0, 0, 0, 0); return d; })();
  const fri = (() => { const d = new Date(monday); d.setDate(monday.getDate() + 4); return d; })();
  const monthFirst = new Date(base.getFullYear(), base.getMonth(), 1);
  const targetDate = monthly ? ymd(monthFirst) : ymd(monday);
  const periodLabel = monthly ? `${base.getFullYear()}년 ${base.getMonth() + 1}월` : `${monday.getMonth() + 1}/${monday.getDate()} ~ ${fri.getMonth() + 1}/${fri.getDate()}`;
  const menuMonth = menu?.menu_date ? parseInt(menu.menu_date.split("-")[1], 10) : (monday.getMonth() + 1);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("meal_menus").select("*").eq("kind", kind).eq("menu_date", targetDate).maybeSingle();
    if (error && error.code !== "PGRST116") { toastErr("불러오기 실패: " + error.message); return; }
    setMenu((data || null) as Menu | null);
  }, [kind, targetDate]);
  useEffect(() => { load(); }, [load]);

  async function runOcr(file: File, menuId: string) {
    setOcrBusy(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("kind", kind);
      const res = await fetch("/api/ocr/meal", { method: "POST", body: fd });
      const json = await res.json();
      if (json.ok && json.days) {
        const { error } = await supabase.from("meal_menus").update({ meal_data: json.days }).eq("id", menuId);
        if (!error) { toastOk("✅ 식단 자동 인식 완료! 아래 미리보기를 확인하고 배포하세요"); load(); }
        else { toastErr("인식 데이터 저장 실패: " + error.message); console.error("meal_data save error:", error); }
      } else {
        toastErr("AI 인식 실패 — 이미지를 다시 올려보세요");
        console.warn("OCR failed:", json.error || json.raw);
      }
    } catch (e) { toastErr("AI 인식 오류"); console.warn("OCR fetch error:", e); }
    setOcrBusy(false);
  }

  async function onUpload(file: File) {
    if (!file.type.startsWith("image/")) { toastErr("이미지 파일만 가능합니다"); return; }
    setBusy(true);
    try {
      const dataUrl = await compress(file);
      let savedId = menu?.id;
      if (menu) {
        // 이미지 교체 시 기존 meal_data 초기화 (새로 OCR 돌려야 하니까)
        const { error } = await supabase.from("meal_menus").update({ image_url: dataUrl, meal_data: null, published: false, updated_at: new Date().toISOString() }).eq("id", menu.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("meal_menus").insert({ kind, menu_date: targetDate, image_url: dataUrl, published: false }).select("id").single();
        if (error) throw error;
        savedId = data?.id;
      }
      toastOk("이미지 업로드 완료 — AI가 식단을 인식합니다…"); await load();
      // OCR 자동 실행 (best-effort, 실패해도 이미지는 정상)
      if (savedId) runOcr(file, savedId);
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
    if (!menu.meal_data) { toastErr("AI 인식이 아직 완료되지 않았습니다. 잠시 기다려주세요."); return; }
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

  const hasMealData = menu?.meal_data && Array.isArray(menu.meal_data) && menu.meal_data.length > 0;

  return (
    <div style={{ padding: "4px 2px 20px", maxWidth: 600 }}>
      {/* 네비게이션 + 배포 버튼 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0 12px", flexWrap: "wrap" }}>
        <button onClick={() => setBase(d => { const n = new Date(d); if (monthly) n.setMonth(n.getMonth() - 1); else n.setDate(n.getDate() - 7); return n; })} style={navBtn}>← 이전{monthly ? " 달" : " 주"}</button>
        <span style={{ fontWeight: 800, fontSize: 15, minWidth: 150, textAlign: "center" }}>{periodLabel}</span>
        <button onClick={() => setBase(d => { const n = new Date(d); if (monthly) n.setMonth(n.getMonth() + 1); else n.setDate(n.getDate() + 7); return n; })} style={navBtn}>다음{monthly ? " 달" : " 주"} →</button>
        <button onClick={() => setBase(new Date())} style={navBtn}>{monthly ? "이번 달" : "이번 주"}</button>
      </div>
      <p style={{ fontSize: 12, color: "#6b7c93", margin: "0 0 12px" }}>
        {monthly
          ? <>학생 점심·간식(아카데미) 식단표 — 한 달에 1장(🍱 점심 · 🍪 간식 포함). <b>모든 손님</b>에게 보입니다.</>
          : <>드림하우스 올인원 식단표 — 한 주에 1장(항목 순서: {MEAL_ORDER}). <b>올인원 손님</b>에게만 보입니다.</>}
      </p>

      {/* STEP 1: 이미지 업로드 영역 (컴팩트) */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
        <div style={{ padding: "9px 12px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>① 식단표 이미지</span>
          {menu?.published ? <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, background: "#dcfce7", color: "#15803d", padding: "2px 8px", borderRadius: 8 }}>발행됨</span> : menu ? <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 800, background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: 8 }}>미발행</span> : null}
        </div>
        <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
          {/* 이미지가 있으면 작은 썸네일로, 없으면 드래그 영역 */}
          {menu?.image_url ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <img src={menu.image_url} alt="식단" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, border: "1px solid #eef2f7", cursor: "pointer", flexShrink: 0 }} onClick={() => setShowImg(!showImg)} />
              <div style={{ flex: 1, fontSize: 12, color: "#64748b" }}>
                {hasMealData ? "✅ AI 인식 완료" : ocrBusy ? "🔍 AI 인식 중…" : "이미지 업로드됨"}
                <br /><span style={{ fontSize: 11, color: "#94a3b8", cursor: "pointer", textDecoration: "underline" }} onClick={() => setShowImg(!showImg)}>{showImg ? "이미지 접기" : "원본 보기"}</span>
              </div>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", background: "#eff6ff", borderRadius: 8, padding: "7px 12px", cursor: "pointer", whiteSpace: "nowrap" }}>
                {busy ? "업로드 중…" : "📷 교체"}
                <input type="file" accept="image/*" style={{ display: "none" }} disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
              </label>
            </div>
          ) : (
            <label style={{ height: 120, border: "2px dashed #cbd5e1", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: 13, cursor: "pointer", flexDirection: "column", gap: 4 }}>
              {busy ? "업로드 중…" : <><span style={{ fontSize: 28 }}>📷</span>식단표 사진 올리기</>}
              <input type="file" accept="image/*" style={{ display: "none" }} disabled={busy} onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />
            </label>
          )}
          {/* 원본 이미지 펼치기 */}
          {showImg && menu?.image_url && <img src={menu.image_url} alt="식단 원본" style={{ width: "100%", borderRadius: 8, border: "1px solid #eef2f7" }} />}
          {/* OCR 진행 상태 */}
          {ocrBusy && <div style={{ padding: "10px 14px", background: "#eff6ff", borderRadius: 8, fontSize: 13, color: "#2563eb", fontWeight: 600, textAlign: "center" }}>🔍 AI가 식단을 인식하고 있습니다… (10~20초 소요)</div>}
          {menu && <button onClick={delMenu} style={{ border: "none", background: "none", color: "#cbd5e1", cursor: "pointer", fontSize: 11, alignSelf: "flex-end" }}>삭제</button>}
        </div>
      </div>

      {/* STEP 2: AI 인식 결과 미리보기 (카드형) */}
      {hasMealData && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>② 미리보기</span>
            <span style={{ fontSize: 11.5, color: "#64748b" }}>— 손님에게 이렇게 보입니다</span>
          </div>
          <MealCardPreview days={menu!.meal_data!} month={menuMonth} isAcademy={monthly} />
        </div>
      )}

      {/* STEP 3: 배포 버튼 */}
      {hasMealData && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>③ 배포</span>
          </div>
          <button onClick={openPicker} disabled={publishing || ocrBusy} style={{ width: "100%", background: menu?.published ? "#15803d" : "#1e3a5f", color: "#fff", border: "none", borderRadius: 10, padding: "13px 18px", fontWeight: 800, fontSize: 15, cursor: "pointer", opacity: (publishing || ocrBusy) ? 0.6 : 1 }}>
            {menu?.published ? "✅ 발행됨 — 다시 발행하기" : "📢 손님에게 발행 & 알림"}
          </button>
        </div>
      )}

      {/* 아직 meal_data가 없고 이미지만 있을 때 안내 */}
      {menu && !hasMealData && !ocrBusy && (
        <div style={{ padding: "14px 16px", background: "#fef3c7", borderRadius: 10, fontSize: 13, color: "#92400e", textAlign: "center", marginBottom: 14 }}>
          AI 인식에 실패했거나 아직 데이터가 없습니다. 이미지를 다시 올려보세요.
        </div>
      )}

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
