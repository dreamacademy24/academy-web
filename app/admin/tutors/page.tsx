"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Tutor { id: string; name: string; phone: string; specialty: string; hourly_rate: number; is_active: boolean }
interface Lesson { id: string; student_name: string; tutor_name: string; lesson_date: string; lesson_time: string; lesson_type: string; status: string }

type Tab = "list" | "schedule" | "invoice";
type ModalMode = null | { data?: Tutor };

const DAYS = ["월","화","수","목","금","토","일"];
function weekDates(base: Date): string[] {
  const d = new Date(base);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => { const dd = new Date(d); dd.setDate(d.getDate() + i); return dd.toISOString().slice(0, 10); });
}
function fShort(d: string) { const dt = new Date(d + "T00:00:00"); return `${dt.getMonth() + 1}/${dt.getDate()}(${DAYS[(dt.getDay() + 6) % 7]})`; }
function fmt(n: number) { return n.toLocaleString(); }

const ST: Record<string, { label: string; bg: string; color: string }> = {
  scheduled: { label: "예정", bg: "#f1f5f9", color: "#64748b" },
  attended:  { label: "출석", bg: "#dcfce7", color: "#166534" },
  absent:    { label: "결석", bg: "#fef2f2", color: "#dc2626" },
};

export default function TutorsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("list");

  // list tab
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [form, setForm] = useState({ name: "", phone: "", specialty: "", hourly_rate: 0 });

  // schedule tab
  const [baseDate, setBaseDate] = useState(new Date());
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [popup, setPopup] = useState<{ tutor: string; date: string; items: Lesson[] } | null>(null);
  const dates = weekDates(baseDate);
  const today = new Date().toISOString().slice(0, 10);

  // invoice tab
  const [selTutor, setSelTutor] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [invLessons, setInvLessons] = useState<Lesson[]>([]);

  const loadTutors = useCallback(async () => {
    const { data } = await supabase.from("tutors").select("*").order("name");
    if (data) setTutors(data as Tutor[]);
  }, []);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else window.location.href = "/login"; }, []);
  useEffect(() => { if (authed) loadTutors(); }, [authed, loadTutors]);

  // Load schedule lessons when schedule tab active
  useEffect(() => {
    if (!authed || tab !== "schedule") return;
    (async () => {
      const { data } = await supabase.from("online_class_enrollments").select("*")
        .gte("lesson_date", dates[0]).lte("lesson_date", dates[6]).order("lesson_time");
      if (data) setLessons(data as Lesson[]);
    })();
  }, [authed, tab, dates[0], dates[6]]);

  // Load invoice lessons
  useEffect(() => {
    if (!authed || tab !== "invoice" || !selTutor) return;
    (async () => {
      const start = month + "-01"; const end = month + "-31";
      const { data } = await supabase.from("online_class_enrollments").select("*")
        .eq("tutor_name", selTutor).gte("lesson_date", start).lte("lesson_date", end)
        .order("lesson_date").order("lesson_time");
      if (data) setInvLessons(data as Lesson[]);
    })();
  }, [authed, tab, selTutor, month]);

  useEffect(() => {
    if (tab === "invoice" && tutors.length > 0 && !selTutor) {
      const active = tutors.find(t => t.is_active);
      if (active) setSelTutor(active.name);
    }
  }, [tab, tutors, selTutor]);

  // list tab functions
  function openModal(t?: Tutor) {
    setForm({ name: t?.name || "", phone: t?.phone || "", specialty: t?.specialty || "", hourly_rate: t?.hourly_rate ?? 0 });
    setModal(t ? { data: t } : {});
  }
  async function saveTutor() {
    if (!form.name.trim()) { alert("이름을 입력하세요."); return; }
    if (modal?.data) {
      await supabase.from("tutors").update({ name: form.name.trim(), phone: form.phone.trim(), specialty: form.specialty.trim(), hourly_rate: form.hourly_rate }).eq("id", modal.data.id);
    } else {
      await supabase.from("tutors").insert({ name: form.name.trim(), phone: form.phone.trim(), specialty: form.specialty.trim(), hourly_rate: form.hourly_rate });
    }
    setModal(null); loadTutors();
  }
  async function toggleActive(id: string, current: boolean) {
    await supabase.from("tutors").update({ is_active: !current }).eq("id", id);
    loadTutors();
  }

  // schedule tab
  function shift(n: number) { const d = new Date(baseDate); d.setDate(d.getDate() + n * 7); setBaseDate(d); }
  function cellLessons(tutorName: string, date: string) {
    return lessons.filter(l => l.tutor_name === tutorName && l.lesson_date === date);
  }
  const todayLessons = lessons.filter(l => l.lesson_date === today).sort((a, b) => (a.lesson_time || "").localeCompare(b.lesson_time || ""));

  // invoice tab calcs
  const invTutor = tutors.find(t => t.name === selTutor);
  const invRate = invTutor?.hourly_rate || 0;
  const invAttended = invLessons.filter(l => l.status === "attended");
  const invTotal = invAttended.length * invRate;

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.tu-w{max-width:1000px;margin:0 auto;padding:28px 20px}
.tu-top{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.tu-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.tu-back:hover{background:#e2e8f0}
.tu-top h1{font-size:22px;font-weight:800;flex:1}
.tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:12px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
.tab{flex:1;padding:11px 8px;font-size:13px;font-weight:700;text-align:center;border:none;border-radius:10px;cursor:pointer;font-family:inherit;background:transparent;color:#6b7c93}
.tab.ac{background:#1a6fc4;color:#fff}
.btn{padding:10px 18px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 150ms}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#0d3d7a}
.btn-sm{padding:6px 12px;font-size:12px}
.btn-gray{background:#f1f5f9;color:#475569}.btn-gray:hover{background:#e2e8f0}
.sec{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,0.05);margin-bottom:14px;overflow-x:auto}
.sec-head{display:flex;align-items:center;gap:8px;margin-bottom:14px}
.sec-head h2{font-size:15px;font-weight:700;flex:1}
.tbl{width:100%;border-collapse:collapse;font-size:13px}
.tbl th{background:#f8fafc;padding:10px 12px;text-align:left;font-weight:700;font-size:12px;color:#6b7c93;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.tbl td{padding:10px 12px;border-bottom:1px solid #f1f5f9}
.tbl tr:hover{background:#f8fafc}
.tbl .sum td{font-weight:800;font-size:14px;background:#f0f7ff;border-top:2px solid #1a6fc4}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.badge-on{background:#dcfce7;color:#166534}.badge-off{background:#fef2f2;color:#dc2626}
.b-att{background:#dcfce7;color:#166534}.b-abs{background:#fef2f2;color:#dc2626}.b-sch{background:#f1f5f9;color:#64748b}
.acts{display:flex;gap:6px;flex-wrap:wrap}
.empty{text-align:center;padding:28px;color:#94a3b8;font-size:13px}
.grid{width:100%;border-collapse:collapse;font-size:12px;min-width:640px}
.grid th{background:#f8fafc;padding:10px 6px;font-weight:700;color:#6b7c93;border:1px solid #e2e8f0;text-align:center;white-space:nowrap}
.grid td{border:1px solid #e2e8f0;padding:6px;vertical-align:top;text-align:center;min-width:80px;height:50px}
.grid .tutor-cell{background:#f8fafc;font-weight:700;text-align:left;padding:8px 10px}
.chip{display:inline-block;padding:2px 8px;border-radius:5px;font-size:11px;font-weight:600;cursor:pointer;margin:1px}
.chip-0{color:#cbd5e1}
.nav{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.nav button{padding:6px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit}.nav button:hover{background:#e2e8f0}
.nav .cur{font-size:14px;font-weight:700;min-width:170px;text-align:center}
.toolbar{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;align-items:center}
.toolbar select,.toolbar input{padding:8px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff}
.inv-box{padding:24px;border:2px solid #e2e8f0;border-radius:12px;margin-bottom:14px}
.inv-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #1a1a2e}
.inv-title{font-size:20px;font-weight:900;letter-spacing:0.05em}
.inv-sub{font-size:11px;color:#6b7c93;margin-top:4px}
.inv-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13px}
.inv-grid .lbl{font-weight:700;color:#6b7c93}.inv-grid .val{font-weight:600}
.inv-total{font-size:22px;font-weight:900;color:#1a6fc4;text-align:right;padding-top:12px;border-top:2px solid #1a6fc4;margin-top:12px}
.overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:100;padding:24px}
.modal{background:#fff;border-radius:16px;padding:28px;width:100%;max-width:420px;box-shadow:0 20px 60px rgba(0,0,0,0.15);max-height:85vh;overflow-y:auto}
.modal h3{font-size:18px;font-weight:800;margin-bottom:20px}
.modal label{display:block;font-size:13px;font-weight:600;color:#475569;margin-bottom:4px}
.modal input{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:14px;font-family:inherit;outline:none;margin-bottom:14px}
.modal-foot{display:flex;gap:8px;justify-content:flex-end;margin-top:8px}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:16px;margin-bottom:10px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.card.inactive{opacity:0.5}
.card-av{width:42px;height:42px;border-radius:12px;background:#dbeafe;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
.card-info{flex:1;min-width:0}.card-info .nm{font-size:15px;font-weight:700}.card-info .sub{font-size:12px;color:#6b7c93;margin-top:2px}
@media print{body{background:#fff!important}.tu-top,.tabs,.toolbar,.nav,.acts,.btn,.btn-sm{display:none!important}.tu-w{padding:0;max-width:100%}.sec,.inv-box{box-shadow:none;border-radius:0}}
@media(max-width:700px){.tu-w{padding:20px 12px}.toolbar{flex-direction:column;align-items:stretch}.nav{flex-wrap:wrap}}
    `}</style>
    <div className="tu-w">
      <div className="tu-top">
        <button className="tu-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>튜터 관리</h1>
      </div>

      <div className="tabs">
        <button className={`tab${tab === "list" ? " ac" : ""}`} onClick={() => setTab("list")}>👩‍🏫 튜터 목록</button>
        <button className={`tab${tab === "schedule" ? " ac" : ""}`} onClick={() => setTab("schedule")}>📅 튜터 스케줄</button>
        <button className={`tab${tab === "invoice" ? " ac" : ""}`} onClick={() => setTab("invoice")}>💰 튜터 인보이스</button>
      </div>

      {/* 탭1: 튜터 목록 */}
      {tab === "list" && (
        <div className="sec">
          <div className="sec-head">
            <h2>🚗 튜터 목록</h2>
            <button className="btn btn-sm btn-blue" onClick={() => openModal()}>+ 튜터 추가</button>
          </div>
          {tutors.length === 0 ? <div className="empty">등록된 튜터가 없습니다</div> : (
            <table className="tbl">
              <thead><tr><th>이름</th><th>연락처</th><th>전공/특기</th><th>시급</th><th>상태</th><th>액션</th></tr></thead>
              <tbody>
                {tutors.map(t => (
                  <tr key={t.id} style={t.is_active ? {} : { opacity: 0.5 }}>
                    <td style={{ fontWeight: 700 }}>{t.name}</td>
                    <td>{t.phone || "-"}</td>
                    <td>{t.specialty || "-"}</td>
                    <td>{t.hourly_rate ? "₱" + t.hourly_rate.toLocaleString() : "-"}</td>
                    <td><span className={`badge ${t.is_active ? "badge-on" : "badge-off"}`}>{t.is_active ? "활성" : "비활성"}</span></td>
                    <td><div className="acts">
                      <button className="btn btn-sm btn-gray" onClick={() => openModal(t)}>수정</button>
                      <button className="btn btn-sm btn-gray" onClick={() => toggleActive(t.id, t.is_active)}>{t.is_active ? "비활성화" : "활성화"}</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* 탭2: 튜터 스케줄 */}
      {tab === "schedule" && (<>
        <div className="toolbar">
          <div className="nav">
            <button onClick={() => shift(-1)}>← 이전</button>
            <span className="cur">{fShort(dates[0])} ~ {fShort(dates[6])}</span>
            <button onClick={() => shift(1)}>다음 →</button>
            <button onClick={() => setBaseDate(new Date())}>이번 주</button>
          </div>
        </div>
        <div className="sec">
          <table className="grid">
            <thead>
              <tr><th>튜터</th>{dates.map(d => <th key={d} style={d === today ? { background: "#eff6ff", color: "#1a6fc4" } : {}}>{fShort(d)}</th>)}</tr>
            </thead>
            <tbody>
              {tutors.filter(t => t.is_active).map(t => (
                <tr key={t.id}>
                  <td className="tutor-cell">{t.name}</td>
                  {dates.map(d => {
                    const items = cellLessons(t.name, d);
                    return (
                      <td key={d} style={d === today ? { background: "#f0f7ff" } : {}}
                        onClick={() => items.length > 0 && setPopup({ tutor: t.name, date: d, items })}>
                        {items.length === 0 ? <span className="chip-0">-</span> :
                          <span className="chip" style={{ background: "#dbeafe", color: "#1e40af" }}>{items.length}건</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {tutors.filter(t => t.is_active).length === 0 && <tr><td colSpan={8} className="empty">활성 튜터가 없습니다</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="sec">
          <div className="sec-head"><h2>오늘의 수업 ({today})</h2></div>
          {todayLessons.length === 0 ? <div className="empty">오늘 수업이 없습니다</div> : (
            <table className="tbl">
              <thead><tr><th>시간</th><th>학생</th><th>튜터</th><th>유형</th><th>상태</th></tr></thead>
              <tbody>
                {todayLessons.map(l => {
                  const st = ST[l.status] || ST.scheduled;
                  return (
                    <tr key={l.id}>
                      <td>{l.lesson_time || "-"}</td>
                      <td style={{ fontWeight: 600 }}>{l.student_name || "-"}</td>
                      <td>{l.tutor_name || "-"}</td>
                      <td>{l.lesson_type || "-"}</td>
                      <td><span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </>)}

      {/* 탭3: 튜터 인보이스 */}
      {tab === "invoice" && (<>
        <div className="toolbar">
          <select value={selTutor} onChange={e => setSelTutor(e.target.value)}>
            <option value="">튜터 선택</option>
            {tutors.filter(t => t.is_active).map(t => <option key={t.id} value={t.name}>{t.name} (₱{fmt(t.hourly_rate)}/hr)</option>)}
          </select>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
          <button className="btn btn-blue" onClick={() => window.print()}>🖨 인쇄/PDF</button>
        </div>
        <div className="inv-box">
          <div className="inv-head">
            <div><div className="inv-title">TUTOR INVOICE</div><div className="inv-sub">Dream Academy Philippines</div></div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{month}</div>
              <div style={{ fontSize: 11, color: "#6b7c93" }}>발행일: {new Date().toLocaleDateString("ko-KR")}</div>
            </div>
          </div>
          <div className="inv-grid">
            <div><span className="lbl">NAME: </span><span className="val">{selTutor || "-"}</span></div>
            <div><span className="lbl">CLASS FEE: </span><span className="val">₱{fmt(invRate)}/hr</span></div>
            <div><span className="lbl">DAYS (Attended): </span><span className="val">{invAttended.length}일</span></div>
            <div><span className="lbl">LEVEL / CLASS: </span><span className="val">1:1 / 1:2</span></div>
          </div>
          <div className="inv-total">TOTAL: ₱{fmt(invTotal)}</div>
        </div>
        <div className="sec">
          {invLessons.length === 0 ? <div className="empty">해당 월 수업 내역이 없습니다</div> : (
            <table className="tbl">
              <thead><tr><th>날짜</th><th>학생</th><th>유형</th><th>시간</th><th>상태</th><th style={{ textAlign: "right" }}>단가</th><th style={{ textAlign: "right" }}>금액</th></tr></thead>
              <tbody>
                {invLessons.map(l => {
                  const isAtt = l.status === "attended";
                  return (
                    <tr key={l.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{l.lesson_date || "-"}</td>
                      <td style={{ fontWeight: 600 }}>{l.student_name || "-"}</td>
                      <td>{l.lesson_type || "-"}</td>
                      <td>{l.lesson_time || "-"}</td>
                      <td><span className={`badge ${isAtt ? "b-att" : l.status === "absent" ? "b-abs" : "b-sch"}`}>
                        {isAtt ? "출석" : l.status === "absent" ? "결석" : "예정"}
                      </span></td>
                      <td style={{ textAlign: "right" }}>{isAtt ? "₱" + fmt(invRate) : "-"}</td>
                      <td style={{ textAlign: "right", fontWeight: isAtt ? 700 : 400 }}>{isAtt ? "₱" + fmt(invRate) : "-"}</td>
                    </tr>
                  );
                })}
                <tr className="sum">
                  <td colSpan={5} style={{ textAlign: "right" }}>합계 ({invAttended.length}건)</td>
                  <td></td>
                  <td style={{ textAlign: "right" }}>₱{fmt(invTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
          <div style={{ marginTop: 20, padding: 16, background: "#fef3c7", borderRadius: 10, fontSize: 11, color: "#92400e", lineHeight: 1.6 }}>
            <b>규정 안내:</b><br/>
            • Payment is made monthly based on attended lessons.<br/>
            • Class fee is calculated per attended class (absent/cancelled lessons are excluded).<br/>
            • Please confirm this invoice with Dream Academy staff before payment.
          </div>
        </div>
      </>)}
    </div>

    {/* 튜터 편집 모달 */}
    {modal && (
      <div className="overlay" onClick={() => setModal(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>{modal.data ? "튜터 수정" : "튜터 추가"}</h3>
          <label>이름 *</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Amelyn" autoFocus />
          <label>연락처</label>
          <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="09XX-XXX-XXXX" />
          <label>전공/특기</label>
          <input value={form.specialty} onChange={e => setForm({ ...form, specialty: e.target.value })} placeholder="English, Math" />
          <label>시간당 단가 (₱)</label>
          <input type="number" value={form.hourly_rate || ""} onChange={e => setForm({ ...form, hourly_rate: parseInt(e.target.value) || 0 })} placeholder="300" />
          <div className="modal-foot">
            <button className="btn btn-gray" onClick={() => setModal(null)}>취소</button>
            <button className="btn btn-blue" onClick={saveTutor}>저장</button>
          </div>
        </div>
      </div>
    )}

    {/* 스케줄 셀 팝업 */}
    {popup && (
      <div className="overlay" onClick={() => setPopup(null)}>
        <div className="modal" onClick={e => e.stopPropagation()}>
          <h3>{popup.tutor} — {fShort(popup.date)}</h3>
          <table className="tbl">
            <thead><tr><th>시간</th><th>학생</th><th>유형</th><th>상태</th></tr></thead>
            <tbody>
              {popup.items.map(l => {
                const st = ST[l.status] || ST.scheduled;
                return (
                  <tr key={l.id}>
                    <td>{l.lesson_time || "-"}</td>
                    <td style={{ fontWeight: 600 }}>{l.student_name || "-"}</td>
                    <td>{l.lesson_type || "-"}</td>
                    <td><span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button className="btn btn-gray" onClick={() => setPopup(null)} style={{ width: "100%", marginTop: 12 }}>닫기</button>
        </div>
      </div>
    )}
  </>);
}
