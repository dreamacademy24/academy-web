"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";

interface ScheduleItem { time: string; main: string; sub: string; }
interface ProgramItem { num: string; label: string; name: string; desc: string; }
interface Notice {
  id: string;
  event_date: string;
  event_day: string;
  schedule: ScheduleItem[];
  programs: ProgramItem[];
  outfit_text: string;
  safety_text: string;
  pickup_text: string;
  footer_msg: string;
}

const FONT = "'Noto Sans KR',sans-serif";
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6, display: "block" };
const cardStyle: React.CSSProperties = { background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 20, marginBottom: 18 };
const textareaStyle: React.CSSProperties = { ...inputStyle, minHeight: 72, resize: "vertical", lineHeight: 1.6 };
const sectionTitleStyle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: "#0a2540" };
const addBtnStyle: React.CSSProperties = { padding: "6px 12px", fontSize: 12, fontWeight: 700, background: "#0a2540", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" };
const delBtnStyle: React.CSSProperties = { padding: "6px 8px", fontSize: 11, fontWeight: 700, background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" };

export default function SkatingNoticeEditor() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    (async () => {
      const { data, error } = await supabase
        .from("fieldtrip_notices")
        .select("*")
        .eq("category", "skating")
        .limit(1);
      if (error) { setErr("불러오기 실패: " + error.message); setLoading(false); return; }
      const row = data && data[0];
      if (!row) { setErr("category='skating' 레코드가 없습니다."); setLoading(false); return; }
      setNotice({
        id: row.id,
        event_date: row.event_date || "",
        event_day: row.event_day || "",
        schedule: Array.isArray(row.schedule) ? row.schedule : [],
        programs: Array.isArray(row.programs) ? row.programs : [],
        outfit_text: row.outfit_text || "",
        safety_text: row.safety_text || "",
        pickup_text: row.pickup_text || "",
        footer_msg: row.footer_msg || "",
      });
      setLoading(false);
    })();
  }, []);

  function set<K extends keyof Notice>(key: K, val: Notice[K]) {
    setNotice(n => n ? { ...n, [key]: val } : n);
  }
  function updSchedule(i: number, field: keyof ScheduleItem, val: string) {
    setNotice(n => { if (!n) return n; const s = [...n.schedule]; s[i] = { ...s[i], [field]: val }; return { ...n, schedule: s }; });
  }
  function addSchedule() { setNotice(n => n ? { ...n, schedule: [...n.schedule, { time: "", main: "", sub: "" }] } : n); }
  function delSchedule(i: number) { setNotice(n => n ? { ...n, schedule: n.schedule.filter((_, idx) => idx !== i) } : n); }
  function updProgram(i: number, field: keyof ProgramItem, val: string) {
    setNotice(n => { if (!n) return n; const p = [...n.programs]; p[i] = { ...p[i], [field]: val }; return { ...n, programs: p }; });
  }
  function addProgram() { setNotice(n => n ? { ...n, programs: [...n.programs, { num: "", label: "", name: "", desc: "" }] } : n); }
  function delProgram(i: number) { setNotice(n => n ? { ...n, programs: n.programs.filter((_, idx) => idx !== i) } : n); }

  async function save() {
    if (!notice) return;
    setSaving(true); setErr("");
    const { error } = await supabase
      .from("fieldtrip_notices")
      .update({
        event_date: notice.event_date,
        event_day: notice.event_day,
        schedule: notice.schedule,
        programs: notice.programs,
        outfit_text: notice.outfit_text,
        safety_text: notice.safety_text,
        pickup_text: notice.pickup_text,
        footer_msg: notice.footer_msg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", notice.id);
    setSaving(false);
    if (error) { setErr("저장 실패: " + error.message); return; }
    alert("저장되었습니다.");
  }

  if (loading) return <div style={{ padding: 40, fontFamily: FONT }}>불러오는 중...</div>;
  if (!notice) return <div style={{ padding: 40, fontFamily: FONT, color: "#dc2626" }}>{err || "데이터 없음"}</div>;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "24px 20px", fontFamily: FONT }}>
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>
        어드민홈 &gt; 직원업무 &gt; 안내문구 &gt; 필드트립 &gt; 스케이팅
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#0a2540", margin: 0 }}>스케이팅 필드트립 안내문 편집</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => window.open("/admin/notices/fieldtrip/skating/preview", "_blank")} style={{ padding: "9px 18px", fontSize: 13, fontWeight: 700, background: "#fff", color: "#0a2540", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>미리보기</button>
          <button onClick={save} disabled={saving} style={{ padding: "9px 18px", fontSize: 13, fontWeight: 700, background: saving ? "#94a3b8" : "#0a2540", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>{saving ? "저장 중..." : "저장"}</button>
        </div>
      </div>
      {err && <div style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>{err}</div>}

      {/* 행사 일자 */}
      <div style={cardStyle}>
        <div style={{ ...sectionTitleStyle, marginBottom: 14 }}>행사 일자</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div><label style={labelStyle}>날짜 (event_date)</label><input style={inputStyle} value={notice.event_date} onChange={e => set("event_date", e.target.value)} placeholder="2026. 05. 23" /></div>
          <div><label style={labelStyle}>요일 (event_day)</label><input style={inputStyle} value={notice.event_day} onChange={e => set("event_day", e.target.value)} placeholder="토요일" /></div>
        </div>
      </div>

      {/* 당일 일정 */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={sectionTitleStyle}>당일 일정 (schedule)</div>
          <button onClick={addSchedule} style={addBtnStyle}>+ 행 추가</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 1.4fr 56px", gap: 8, marginBottom: 6, fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>
          <div>시간</div><div>주요 일정</div><div>세부 설명</div><div />
        </div>
        {notice.schedule.map((s, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 1fr 1.4fr 56px", gap: 8, marginBottom: 8, alignItems: "center" }}>
            <input style={inputStyle} value={s.time} onChange={e => updSchedule(i, "time", e.target.value)} placeholder="10:20" />
            <input style={inputStyle} value={s.main} onChange={e => updSchedule(i, "main", e.target.value)} placeholder="픽업 시작" />
            <input style={inputStyle} value={s.sub} onChange={e => updSchedule(i, "sub", e.target.value)} placeholder="숙소에서 출발" />
            <button onClick={() => delSchedule(i)} style={delBtnStyle}>삭제</button>
          </div>
        ))}
        {notice.schedule.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>일정 항목이 없습니다.</div>}
      </div>

      {/* 프로그램 안내 */}
      <div style={cardStyle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={sectionTitleStyle}>프로그램 안내 (programs)</div>
          <button onClick={addProgram} style={addBtnStyle}>+ 카드 추가</button>
        </div>
        {notice.programs.map((p, i) => (
          <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginBottom: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "80px 1fr 1fr 56px", gap: 8, marginBottom: 8, alignItems: "center" }}>
              <input style={inputStyle} value={p.num} onChange={e => updProgram(i, "num", e.target.value)} placeholder="01" />
              <input style={inputStyle} value={p.label} onChange={e => updProgram(i, "label", e.target.value)} placeholder="라벨 (스케이팅)" />
              <input style={inputStyle} value={p.name} onChange={e => updProgram(i, "name", e.target.value)} placeholder="제목 (Skating)" />
              <button onClick={() => delProgram(i)} style={delBtnStyle}>삭제</button>
            </div>
            <textarea style={textareaStyle} value={p.desc} onChange={e => updProgram(i, "desc", e.target.value)} placeholder="프로그램 설명" />
          </div>
        ))}
        {notice.programs.length === 0 && <div style={{ fontSize: 12, color: "#94a3b8" }}>프로그램 항목이 없습니다.</div>}
      </div>

      {/* 안내 문구 */}
      <div style={cardStyle}>
        <div style={{ ...sectionTitleStyle, marginBottom: 14 }}>안내 문구</div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>복장 안내 (outfit_text)</label>
          <textarea style={textareaStyle} value={notice.outfit_text} onChange={e => set("outfit_text", e.target.value)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>안전 안내 (safety_text)</label>
          <textarea style={textareaStyle} value={notice.safety_text} onChange={e => set("safety_text", e.target.value)} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>개별 하원 안내 (pickup_text)</label>
          <textarea style={textareaStyle} value={notice.pickup_text} onChange={e => set("pickup_text", e.target.value)} />
        </div>
        <div>
          <label style={labelStyle}>푸터 메시지 (footer_msg)</label>
          <textarea style={textareaStyle} value={notice.footer_msg} onChange={e => set("footer_msg", e.target.value)} />
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 40 }}>
        <button onClick={() => window.open("/admin/notices/fieldtrip/skating/preview", "_blank")} style={{ padding: "10px 22px", fontSize: 13, fontWeight: 700, background: "#fff", color: "#0a2540", border: "1px solid #cbd5e1", borderRadius: 8, cursor: "pointer", fontFamily: "inherit" }}>미리보기</button>
        <button onClick={save} disabled={saving} style={{ padding: "10px 22px", fontSize: 13, fontWeight: 700, background: saving ? "#94a3b8" : "#0a2540", color: "#fff", border: "none", borderRadius: 8, cursor: saving ? "default" : "pointer", fontFamily: "inherit" }}>{saving ? "저장 중..." : "저장"}</button>
      </div>
    </div>
  );
}
