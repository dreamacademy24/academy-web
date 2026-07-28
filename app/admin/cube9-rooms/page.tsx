"use client";
import { useEffect, useMemo, useState } from "react";

const SB = "https://yiglafscjvjgkxpycevk.supabase.co";
const AK = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpZ2xhZnNjanZqZ2t4cHljZXZrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwODgzMjcsImV4cCI6MjA4OTY2NDMyN30.k_HErGsz5oYkILWvUGRaU3x1IXKMQOuO5X312tDcXe4";
const H = { apikey: AK, Authorization: `Bearer ${AK}`, "Content-Type": "application/json" };
const KEY = "cube9_room_blocks";
const MEMO_KEY = "cube9_month_memo";

const FULL_ACCESS = ["103", "104", "105", "106"];
const DELUXE = ["204", "205", "206", "207", "208", "209", "210"];
const ROOMS = [...FULL_ACCESS, ...DELUXE];

interface Block { id: string; room: string; name: string; ci: string; co: string; kind?: string; memo?: string; booking_id?: string; }
interface DreamBk { id: string; name: string; ci: string; co: string; roomType: string; people: string; accom: string; }

function ymd(y: number, m: number, d: number) { return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }
function daysIn(y: number, m: number) { return new Date(y, m, 0).getDate(); }
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export default function Cube9Rooms() {
  const now = new Date();
  const todayStr = ymd(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const [ym, setYm] = useState<[number, number]>([now.getFullYear(), now.getMonth() + 1]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [memos, setMemos] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<Block | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [dreamBks, setDreamBks] = useState<DreamBk[]>([]);
  const [y, m] = ym;
  const dim = daysIn(y, m);
  const monthS = ymd(y, m, 1), monthE = ymd(y, m, dim);
  const ymKey = `${y}-${String(m).padStart(2, "0")}`;

  useEffect(() => { (async () => {
    try {
      const r = await fetch(`${SB}/rest/v1/app_settings?key=in.(${KEY},${MEMO_KEY})&select=key,value`, { headers: H });
      const rows = await r.json();
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (row.key === KEY && row.value) setBlocks(row.value as Block[]);
          if (row.key === MEMO_KEY && row.value) setMemos(row.value as Record<string, string>);
        }
      }
    } catch {}
    // 우리 시스템 큐브나인 예약 로드 (단독 + 콤보 seg)
    try {
      const q = "select=id,booker_name,checkin_date,checkout_date,accom_type,cn_room_type,seg1_type,seg1_checkin,seg1_checkout,seg2_type,seg2_checkin,seg2_checkout,status,adults,children&accom_type=ilike.*" + encodeURIComponent("큐브") + "*&order=checkin_date.asc";
      const r2 = await fetch(`${SB}/rest/v1/bookings?${q}`, { headers: H });
      const rows2 = await r2.json();
      if (Array.isArray(rows2)) {
        const out: DreamBk[] = [];
        for (const b of rows2) {
          if (String(b.status || "").includes("취소")) continue;
          let ci = b.checkin_date, co = b.checkout_date;
          if (b.seg1_type === "cubenine") { ci = b.seg1_checkin; co = b.seg1_checkout; }
          else if (b.seg2_type === "cubenine") { ci = b.seg2_checkin; co = b.seg2_checkout; }
          if (!ci || !co) continue;
          if (String(co) < "2026-01-01") continue;
          out.push({ id: String(b.id), name: b.booker_name || "?", ci: String(ci).slice(0, 10), co: String(co).slice(0, 10), roomType: b.cn_room_type || "", people: `${b.adults || 0}+${b.children || 0}`, accom: b.accom_type || "" });
        }
        setDreamBks(out);
      }
    } catch {}
    setLoaded(true);
  })(); }, []);

  async function saveSetting(key: string, value: unknown) {
    setSaving(true);
    try {
      const r = await fetch(`${SB}/rest/v1/app_settings?on_conflict=key`, {
        method: "POST",
        headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify([{ key, value }]),
      });
      if (!r.ok) alert("저장 실패 (" + r.status + ") — 새로고침 후 다시 시도해 주세요");
    } catch { alert("저장 실패 — 네트워크 확인"); }
    setSaving(false);
  }
  const persist = (next: Block[]) => { setBlocks(next); saveSetting(KEY, next); };

  const monthBlocks = useMemo(() => blocks.filter(b => b.ci <= monthE && b.co >= monthS), [blocks, monthS, monthE]);
  const checkins = monthBlocks.filter(b => b.ci >= monthS && b.ci <= monthE).length;
  const checkouts = monthBlocks.filter(b => b.co >= monthS && b.co <= monthE).length;
  const emptyRooms = ROOMS.filter(r => !monthBlocks.some(b => b.room === r));
  const conflicts = useMemo(() => {
    const out: { room: string; date: string }[] = [];
    for (const r of ROOMS) {
      const bs = blocks.filter(b => b.room === r).sort((a, b2) => a.ci.localeCompare(b2.ci));
      for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
        if (bs[i].ci < bs[j].co && bs[j].ci < bs[i].co) out.push({ room: r, date: bs[j].ci > bs[i].ci ? bs[j].ci : bs[i].ci });
      }
    }
    return out;
  }, [blocks]);

  const assignedIds = useMemo(() => new Set(blocks.map(b => b.booking_id).filter(Boolean)), [blocks]);
  const unassigned = useMemo(() => dreamBks.filter(d => !assignedIds.has(d.id) && d.co >= todayStr), [dreamBks, assignedIds, todayStr]);
  function assignDream(d: DreamBk) {
    const defRoom = (d.roomType || "").includes("풀") ? FULL_ACCESS[0] : DELUXE[0];
    setEdit({ id: uid(), room: defRoom, name: d.name, ci: d.ci, co: d.co, kind: "dream", memo: (d.accom.includes("+") ? "콤보 · " : "") + (d.roomType || ""), booking_id: d.id });
    setIsNew(true);
  }
  function cellBlock(room: string, dateStr: string) {
    return blocks.find(b => b.room === room && b.ci <= dateStr && b.co >= dateStr) || null;
  }
  function openNew(room: string, dateStr: string) {
    const d = new Date(dateStr + "T00:00:00"); d.setDate(d.getDate() + 1);
    setEdit({ id: uid(), room, name: "", ci: dateStr, co: ymd(d.getFullYear(), d.getMonth() + 1, d.getDate()), memo: "" });
    setIsNew(true);
  }
  function saveEdit() {
    if (!edit) return;
    if (!edit.name.trim()) { alert("이름을 입력해 주세요"); return; }
    if (!edit.ci || !edit.co || edit.co < edit.ci) { alert("날짜를 확인해 주세요"); return; }
    persist(isNew ? [...blocks, edit] : blocks.map(b => b.id === edit.id ? edit : b));
    setEdit(null);
  }
  function delEdit() {
    if (!edit || !confirm(`'${edit.name}' 삭제할까요?`)) return;
    persist(blocks.filter(b => b.id !== edit.id)); setEdit(null);
  }

  const colW = 96, dateW = 86;
  return (
    <div style={{ display: "flex", gap: 16, padding: 18, fontFamily: "'Malgun Gothic','Noto Sans KR',sans-serif", alignItems: "flex-start" }}>
      <div style={{ flex: "0 0 218px", display: "flex", flexDirection: "column", gap: 12 }}>
        <h1 style={{ fontSize: 19, fontWeight: 900, margin: "2px 0 2px" }}>🐬 Cube Nine 예약현황</h1>
        <div style={panel}>
          <b style={pTitle}>범례</b>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginTop: 6 }}><span style={{ width: 13, height: 13, borderRadius: 3, background: "#c7d8f7", border: "1px solid #7ba3e0", display: "inline-block" }} />큐브 예약</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginTop: 4 }}><span style={{ width: 13, height: 13, borderRadius: 3, background: "#ffe93b", border: "1px solid #d4a900", display: "inline-block" }} />드림 예약 (우리 손님)</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginTop: 4 }}><span style={{ width: 13, height: 13, borderRadius: 3, background: "#fff", border: "1px solid #cbd5e1", display: "inline-block" }} />빈 날</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, marginTop: 4 }}><span style={{ width: 13, height: 13, borderRadius: 3, background: "#fde8e8", border: "1px solid #ef4444", display: "inline-block" }} />⚠ 중복 (기간 겹침)</div>
        </div>
        {unassigned.length > 0 && (
          <div style={{ ...panel, borderColor: "#86efac", background: "#f0fdf4" }}>
            <b style={{ ...pTitle, color: "#166534" }}>🏷 우리 예약 · 룸 배정 대기 ({unassigned.length})</b>
            {unassigned.map(d => (
              <div key={d.id} style={{ marginTop: 8, padding: "8px 9px", background: "#fff", border: "1px solid #d1fae5", borderRadius: 8 }}>
                <div style={{ fontSize: 12.5, fontWeight: 800 }}>{d.name} <span style={{ fontWeight: 500, color: "#64748b" }}>({d.people}명)</span></div>
                <div style={{ fontSize: 11.5, color: "#475569", marginTop: 2 }}>{d.ci.slice(5)} ~ {d.co.slice(5)} · {d.roomType || "룸타입 미정"}{d.accom.includes("+") ? " · 콤보" : ""}</div>
                <button onClick={() => assignDream(d)} style={{ marginTop: 6, width: "100%", padding: "6px 0", background: "#16a34a", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>룸 배정하기</button>
              </div>
            ))}
          </div>
        )}
        <div style={panel}>
          <b style={pTitle}>📋 이번 달 요약</b>
          <div style={sumRow}><span>총 예약</span><b style={{ color: "#1d4ed8" }}>{monthBlocks.length}건</b></div>
          <div style={sumRow}><span>체크인 예정</span><b style={{ color: "#059669" }}>{checkins}건</b></div>
          <div style={sumRow}><span>체크아웃 예정</span><b style={{ color: "#dc2626" }}>{checkouts}건</b></div>
        </div>
        {conflicts.filter(c => c.date >= monthS).length > 0 && (
          <div style={{ ...panel, borderColor: "#fca5a5", background: "#fff7f7" }}>
            <b style={{ ...pTitle, color: "#b91c1c" }}>⚠ 확인 필요 (중복)</b>
            {conflicts.filter(c => c.date >= monthS).map((c, i) => <div key={i} style={{ fontSize: 12, marginTop: 5, color: "#7f1d1d" }}><span style={{ background: "#fecaca", borderRadius: 4, padding: "1px 6px", fontWeight: 800, marginRight: 5 }}>중복</span>{c.date} · {c.room}호</div>)}
          </div>
        )}
        <div style={panel}>
          <b style={pTitle}>🏨 이번 달 빈 방</b>
          <div style={{ fontSize: 12.5, marginTop: 6, color: emptyRooms.length ? "#334155" : "#94a3b8", lineHeight: 1.7 }}>
            {emptyRooms.length ? emptyRooms.map(r => r + "호").join(" · ") : "모든 룸 예약 있음"}
          </div>
        </div>
        <div style={panel}>
          <b style={pTitle}>📝 이달 메모</b>
          <textarea value={memos[ymKey] || ""} onChange={e => setMemos({ ...memos, [ymKey]: e.target.value })}
            onBlur={() => saveSetting(MEMO_KEY, memos)}
            placeholder="메모를 입력하세요…" style={{ width: "100%", minHeight: 84, marginTop: 6, border: "1px solid #e2e8f0", borderRadius: 8, padding: 8, fontSize: 12.5, fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" }} />
        </div>
        {saving && <div style={{ fontSize: 12, color: "#64748b" }}>저장 중…</div>}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          <button onClick={() => setYm(([yy, mm]) => mm === 1 ? [yy - 1, 12] : [yy, mm - 1])} style={navBtn}>◀</button>
          <b style={{ fontSize: 17 }}>{y}년 {m}월</b>
          <button onClick={() => setYm(([yy, mm]) => mm === 12 ? [yy + 1, 1] : [yy, mm + 1])} style={navBtn}>▶</button>
          <button onClick={() => setYm([now.getFullYear(), now.getMonth() + 1])} style={{ ...navBtn, width: "auto", padding: "0 12px", background: "#1e3a5f", color: "#fff", border: "none" }}>오늘</button>
          <span style={{ fontSize: 12, color: "#64748b" }}>빈 칸 클릭 = 등록 · 예약 칸 클릭 = 수정/삭제</span>
        </div>
        {!loaded ? <div style={{ color: "#94a3b8", padding: 40 }}>불러오는 중…</div> : (
          <div style={{ overflowX: "auto", border: "1px solid #cbd5e1", borderRadius: 10 }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: dateW + colW * ROOMS.length }}>
              <thead>
                <tr>
                  <th rowSpan={2} style={{ ...th, width: dateW, background: "#1e293b", color: "#fff" }}>날짜</th>
                  <th colSpan={FULL_ACCESS.length} style={{ ...th, background: "#1e3a5f", color: "#fff" }}>풀 억세스 룸</th>
                  <th colSpan={DELUXE.length} style={{ ...th, background: "#155e63", color: "#fff" }}>디럭스 오션뷰 룸</th>
                </tr>
                <tr>
                  {ROOMS.map(r => <th key={r} style={{ ...th, width: colW, background: FULL_ACCESS.includes(r) ? "#28517f" : "#1f7078", color: "#fff" }}>{r}호</th>)}
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const nm = m === 12 ? 1 : m + 1, ny = m === 12 ? y + 1 : y;
                  const rows: { y: number; m: number; d: number; sep?: boolean }[] = [];
                  for (let d = 1; d <= dim; d++) rows.push({ y, m, d });
                  rows.push({ y: ny, m: nm, d: 0, sep: true });
                  for (let d = 1; d <= daysIn(ny, nm); d++) rows.push({ y: ny, m: nm, d });
                  return rows;
                })().map((row, ri) => {
                  if (row.sep) return (
                    <tr key={"sep" + ri}><td colSpan={ROOMS.length + 1} style={{ background: "#1e293b", color: "#fff", textAlign: "center", fontWeight: 900, fontSize: 13, padding: "7px 0" }}>{row.y}년 {row.m}월</td></tr>
                  );
                  const d = row.d;
                  const dateStr = ymd(row.y, row.m, d);
                  const dow = new Date(row.y, row.m - 1, d).getDay();
                  const isToday = dateStr === todayStr;
                  return (
                    <tr key={dateStr} style={{ background: isToday ? "#eef4ff" : undefined }}>
                      <td style={{ ...dateTd, color: dow === 0 ? "#dc2626" : dow === 6 ? "#2563eb" : "#334155", background: isToday ? "#dbe7ff" : "#f8fafc", fontWeight: isToday ? 900 : 700 }}>
                        {isToday && <div style={{ fontSize: 9, color: "#1d4ed8", fontWeight: 900 }}>TODAY</div>}
                        {d}일 {DOW[dow]}
                      </td>
                      {ROOMS.map(r => {
                        const b = cellBlock(r, dateStr);
                        const isCi = b && b.ci === dateStr;
                        const dup = b && conflicts.some(c => c.room === r && b.ci <= c.date && b.co >= c.date);
                        return (
                          <td key={r}
                            onClick={() => b ? (setEdit({ ...b }), setIsNew(false)) : openNew(r, dateStr)}
                            title={b ? `${b.name} ${b.ci}~${b.co}${b.memo ? " · " + b.memo : ""}` : `${row.m}/${d} ${r}호 등록`}
                            style={{ ...cellTd, cursor: "pointer", background: b ? (dup ? "#fde8e8" : b.kind === "dream" ? "#ffe93b" : "#c7d8f7") : (dow === 0 ? "#fff8f8" : dow === 6 ? "#f6faff" : "#fff"), borderTop: isCi ? (b!.kind === "dream" ? "2px solid #d4a900" : "2px solid #3b6cc7") : cellTd.borderTop }}>
                            {isCi && <div style={{ fontSize: 11.5, fontWeight: 800, color: b!.kind === "dream" ? "#713f12" : "#1e3a8a", lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{dup && "⚠ "}{b!.kind === "dream" ? "🏷 " : ""}{b!.name}</div>}
                            {isCi && b!.memo && <div style={{ fontSize: 10, color: "#3b5b94", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b!.memo}</div>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {edit && (
        <div onClick={() => setEdit(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 22, width: 360, maxWidth: "92vw" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 17 }}>{isNew ? "큐브 예약 등록" : "큐브 예약 수정"}</h3>
            <label style={lb}>룸</label>
            <select style={inp} value={edit.room} onChange={e => setEdit({ ...edit, room: e.target.value })}>
              <optgroup label="풀 억세스 룸">{FULL_ACCESS.map(r => <option key={r} value={r}>{r}호</option>)}</optgroup>
              <optgroup label="디럭스 오션뷰 룸">{DELUXE.map(r => <option key={r} value={r}>{r}호</option>)}</optgroup>
            </select>
            <label style={lb}>이름</label>
            <input style={inp} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="게스트명 / 단체명" />
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}><label style={lb}>체크인</label><input type="date" style={inp} value={edit.ci} onChange={e => setEdit({ ...edit, ci: e.target.value })} /></div>
              <div style={{ flex: 1 }}><label style={lb}>체크아웃</label><input type="date" style={inp} value={edit.co} onChange={e => setEdit({ ...edit, co: e.target.value })} /></div>
            </div>
            <label style={lb}>메모</label>
            <input style={inp} value={edit.memo || ""} onChange={e => setEdit({ ...edit, memo: e.target.value })} placeholder="선택 (예: 105·106 함께)" />
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

const panel: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "12px 14px" };
const pTitle: React.CSSProperties = { fontSize: 13, fontWeight: 800, color: "#334155" };
const sumRow: React.CSSProperties = { display: "flex", justifyContent: "space-between", fontSize: 13, marginTop: 7 };
const navBtn: React.CSSProperties = { width: 30, height: 30, border: "1px solid #cbd5e1", background: "#fff", borderRadius: 7, cursor: "pointer", fontSize: 12 };
const th: React.CSSProperties = { padding: "7px 4px", fontSize: 12.5, fontWeight: 800, border: "1px solid rgba(255,255,255,.15)" };
const dateTd: React.CSSProperties = { padding: "5px 8px", fontSize: 12.5, borderBottom: "1px solid #e2e8f0", borderRight: "1px solid #cbd5e1", textAlign: "center", whiteSpace: "nowrap" };
const cellTd: React.CSSProperties = { padding: "3px 5px", height: 30, borderBottom: "1px solid #eef2f7", borderRight: "1px solid #eef2f7", verticalAlign: "top", maxWidth: 96, borderTop: "1px solid transparent" };
const lb: React.CSSProperties = { display: "block", fontSize: 12, color: "#64748b", margin: "10px 0 4px", fontWeight: 700 };
const inp: React.CSSProperties = { width: "100%", padding: "9px 10px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit" };
const btn: React.CSSProperties = { padding: "9px 16px", border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, cursor: "pointer", fontFamily: "inherit", fontSize: 14 };
