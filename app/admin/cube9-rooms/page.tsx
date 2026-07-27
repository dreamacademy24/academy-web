"use client";
import { useEffect, useMemo, useState } from "react";

const SB = "https://yiglafscjvjgkxpycevk.supabase.co";
const AK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZ2xhZnNjanZqZ2t4cHljZXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODgzMjcsImV4cCI6MjA4OTY2NDMyN30.k_HErGsz5oYkILWvUGRaU3x1IXKMQOuO5X312tDcXe4";
const H = { apikey: AK, Authorization: `Bearer ${AK}`, "Content-Type": "application/json" };
const KEY = "cube9_room_blocks";

const FULL_ACCESS = ["103", "104", "105", "106"];
const DELUXE = ["204", "205", "206", "207", "208", "209", "210"];

type Kind = "dream" | "resort" | "hold";
interface Block { id: string; room: string; name: string; ci: string; co: string; kind: Kind; memo?: string; }

const KIND_STYLE: Record<Kind, { bg: string; label: string }> = {
  dream: { bg: "#7c3aed", label: "드림 예약" },
  resort: { bg: "#f97316", label: "리조트 손님" },
  hold: { bg: "#0ea5e9", label: "가예약/홀드" },
};

function ymd(y: number, m: number, d: number) { return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
function daysIn(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

export default function Cube9Rooms() {
  const now = new Date();
  const [ym, setYm] = useState<[number, number]>([now.getFullYear(), now.getMonth() + 1]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<Block | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [y, m] = ym;
  const dim = daysIn(y, m);
  const monthS = ymd(y, m, 1), monthE = ymd(y, m, dim);

  useEffect(() => { (async () => {
    try {
      const r = await fetch(`${SB}/rest/v1/app_settings?key=eq.${KEY}&select=value`, { headers: H });
      const rows = await r.json();
      if (Array.isArray(rows) && rows[0]?.value) setBlocks(rows[0].value as Block[]);
    } catch {}
    setLoaded(true);
  })(); }, []);

  async function persist(next: Block[]) {
    setBlocks(next); setSaving(true);
    try {
      const r = await fetch(`${SB}/rest/v1/app_settings?on_conflict=key`, {
        method: "POST",
        headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([{ key: KEY, value: next }]),
      });
      if (!r.ok) alert("저장 실패 — 새로고침 후 다시 시도해 주세요 (" + r.status + ")");
    } catch { alert("저장 실패 — 네트워크 확인"); }
    setSaving(false);
  }

  const monthBlocks = useMemo(() => blocks.filter(b => b.ci <= monthE && b.co >= monthS), [blocks, monthS, monthE]);

  function barsFor(room: string) {
    return monthBlocks.filter(b => b.room === room).map(b => {
      const s = b.ci < monthS ? 1 : Number(b.ci.slice(8, 10));
      const e = b.co > monthE ? dim : Number(b.co.slice(8, 10));
      return { ...b, s, e: Math.max(s, e) };
    });
  }

  function openNew(room: string, day: number) {
    const ci = ymd(y, m, day);
    const co = ymd(y, m, Math.min(day + 1, dim));
    setEdit({ id: uid(), room, name: "", ci, co, kind: "resort", memo: "" });
    setIsNew(true);
  }
  function saveEdit() {
    if (!edit) return;
    if (!edit.name.trim()) { alert("이름을 입력해 주세요"); return; }
    if (!edit.ci || !edit.co || edit.co < edit.ci) { alert("날짜를 확인해 주세요"); return; }
    const next = isNew ? [...blocks, edit] : blocks.map(b => b.id === edit.id ? edit : b);
    persist(next); setEdit(null);
  }
  function delEdit() {
    if (!edit) return;
    if (!confirm(`'${edit.name}' 삭제할까요?`)) return;
    persist(blocks.filter(b => b.id !== edit.id)); setEdit(null);
  }

  const cellW = 34, nameW = 66;
  const roomRow = (room: string) => {
    const bars = barsFor(room);
    return (
      <div key={room} style={{ display: "flex", position: "relative", borderBottom: "1px solid #e2e8f0", height: 38 }}>
        <div style={{ flex: `0 0 ${nameW}px`, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, background: "#f8fafc", borderRight: "1px solid #e2e8f0" }}>{room}호</div>
        <div style={{ position: "relative", width: cellW * dim }}>
          {Array.from({ length: dim }, (_, i) => (
            <div key={i} onClick={() => openNew(room, i + 1)} title={`${m}/${i + 1} 등록`}
              style={{ position: "absolute", left: i * cellW, top: 0, width: cellW, height: "100%", borderRight: "1px solid #f1f5f9", cursor: "pointer", background: new Date(y, m - 1, i + 1).getDay() === 0 ? "#fef2f2" : new Date(y, m - 1, i + 1).getDay() === 6 ? "#eff6ff" : undefined }} />
          ))}
          {bars.map(b => (
            <div key={b.id} onClick={(e) => { e.stopPropagation(); setEdit({ ...b }); setIsNew(false); }}
              title={`${b.name} ${b.ci}~${b.co}${b.memo ? " · " + b.memo : ""}`}
              style={{ position: "absolute", left: (b.s - 1) * cellW + 2, width: (b.e - b.s + 1) * cellW - 4, top: 6, height: 26, background: KIND_STYLE[b.kind].bg, color: "#fff", borderRadius: 6, fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", padding: "0 6px", overflow: "hidden", whiteSpace: "nowrap", cursor: "pointer", zIndex: 2 }}>
              {b.name}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const groupHeader = (t: string) => (
    <div style={{ display: "flex", background: "#1e3a5f", color: "#fff", fontSize: 12.5, fontWeight: 800 }}>
      <div style={{ flex: `0 0 ${nameW}px`, padding: "6px 0", textAlign: "center" }}>{t.slice(0, 4)}</div>
      <div style={{ padding: "6px 10px" }}>{t}</div>
    </div>
  );

  return (
    <div style={{ padding: 20, fontFamily: "'Malgun Gothic','Noto Sans KR',sans-serif", overflowX: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 21, fontWeight: 900, margin: 0 }}>🐬 큐브나인 예약현황</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={() => setYm(([yy, mm]) => mm === 1 ? [yy - 1, 12] : [yy, mm - 1])} style={navBtn}>◀</button>
          <b style={{ fontSize: 16 }}>{y}년 {m}월</b>
          <button onClick={() => setYm(([yy, mm]) => mm === 12 ? [yy + 1, 1] : [yy, mm + 1])} style={navBtn}>▶</button>
          <button onClick={() => setYm([now.getFullYear(), now.getMonth() + 1])} style={{ ...navBtn, width: "auto", padding: "0 10px" }}>오늘</button>
        </div>
        <div style={{ display: "flex", gap: 10, fontSize: 12, alignItems: "center" }}>
          {(Object.keys(KIND_STYLE) as Kind[]).map(k => (
            <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 12, height: 12, borderRadius: 3, background: KIND_STYLE[k].bg, display: "inline-block" }} />{KIND_STYLE[k].label}
            </span>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "#64748b" }}>빈 칸 클릭 = 등록 · 막대 클릭 = 수정/삭제 {saving && "· 저장 중…"}</span>
      </div>

      {!loaded ? <div style={{ color: "#94a3b8", padding: 40 }}>불러오는 중…</div> : (
        <div style={{ border: "1px solid #cbd5e1", borderRadius: 10, overflow: "hidden", width: nameW + cellW * dim }}>
          <div style={{ display: "flex", background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
            <div style={{ flex: `0 0 ${nameW}px`, fontSize: 11, fontWeight: 700, color: "#64748b", display: "flex", alignItems: "center", justifyContent: "center" }}>룸</div>
            <div style={{ position: "relative", width: cellW * dim, height: 26 }}>
              {Array.from({ length: dim }, (_, i) => (
                <div key={i} style={{ position: "absolute", left: i * cellW, width: cellW, textAlign: "center", fontSize: 11.5, fontWeight: 700, lineHeight: "26px", color: new Date(y, m - 1, i + 1).getDay() === 0 ? "#dc2626" : new Date(y, m - 1, i + 1).getDay() === 6 ? "#2563eb" : "#334155" }}>{i + 1}</div>
              ))}
            </div>
          </div>
          {groupHeader("풀 억세스 룸")}
          {FULL_ACCESS.map(roomRow)}
          {groupHeader("디럭스 오션뷰 룸")}
          {DELUXE.map(roomRow)}
        </div>
      )}

      {edit && (
        <div onClick={() => setEdit(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 22, width: 360, maxWidth: "92vw" }}>
            <h3 style={{ margin: "0 0 14px", fontSize: 17 }}>{isNew ? "예약 등록" : "예약 수정"} — {edit.room}호</h3>
            <label style={lb}>이름</label>
            <input style={inp} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="게스트명 / 단체명" />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><label style={lb}>체크인</label><input type="date" style={inp} value={edit.ci} onChange={e => setEdit({ ...edit, ci: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label style={lb}>체크아웃</label><input type="date" style={inp} value={edit.co} onChange={e => setEdit({ ...edit, co: e.target.value })} /></div>
            </div>
            <label style={lb}>구분</label>
            <select style={inp} value={edit.kind} onChange={e => setEdit({ ...edit, kind: e.target.value as Kind })}>
              <option value="dream">드림 예약 (보라)</option>
              <option value="resort">리조트 손님 (주황)</option>
              <option value="hold">가예약/홀드 (하늘)</option>
            </select>
            <label style={lb}>메모</label>
            <input style={inp} value={edit.memo || ""} onChange={e => setEdit({ ...edit, memo: e.target.value })} placeholder="선택" />
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              {!isNew && <button onClick={delEdit} style={{ ...btn, background: "#fee2e2", color: "#b91c1c", border: "none" }}>삭제</button>}
              <div style={{ flex: 1 }} />
              <button onClick={() => setEdit(null)} style={btn}>취소</button>
              <button onClick={saveEdit} style={{ ...btn, background: "#1e3a5f", color: "#fff", border: "none" }}>저장</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const navBtn: React.CSSProperties = { width: 30, height: 30, border: "1px solid #cbd5e1", background: "#fff", borderRadius: 7, cursor: "pointer", fontSize: 12 };
const lb: React.CSSProperties = { display: "block", fontSize: 12, color: "#64748b", margin: "10px 0 4px", fontWeight: 700 };
const inp: React.CSSProperties = { width: "100%", padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const btn: React.CSSProperties = { padding: "9px 16px", border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 14 };
