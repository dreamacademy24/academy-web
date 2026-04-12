"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface Session { booking_id: string; booking_number: string; guest_name: string; expires: number }
interface TutorReq {
  id: string; student_name_kr: string | null; student_name_en: string | null;
  class_type: string | null; start_date: string | null; end_date: string | null;
  preferred_days_arr: string[] | null; preferred_time: string | null;
  status: string; created_at: string;
}

const DAYS = ["월","화","수","목","금","토"];
const LEVELS_ER = ["제로베이스","비기너","미디엄","어드밴스"];
const LEVELS_7 = ["제로베이스","비기너1","비기너2","미디엄1","미디엄2","어드밴스1","어드밴스2"];
const STYLES = ["놀이식","학습식","놀이+학습"];
const FOCUS = ["스피킹","리딩","보카","라이팅","파닉스","액티비티"];

const ST: Record<string, { label: string; bg: string; color: string }> = {
  pending:   { label: "대기중", bg: "#fef3c7", color: "#92400e" },
  confirmed: { label: "확정",   bg: "#dcfce7", color: "#166534" },
  cancelled: { label: "취소",   bg: "#fef2f2", color: "#dc2626" },
};

const INIT_FORM = {
  house_number: "", student_name_kr: "", student_name_en: "", student_age: "",
  class_type: "", start_date: "", end_date: "",
  preferred_days_arr: [] as string[], skip_dates: "", preferred_time: "",
  level_english: "", level_speaking: "", level_reading: "", level_writing: "",
  textbook: "", class_style: "", class_focus_arr: [] as string[],
  child_personality: "",
  privacy_agreed: false, rules_agreed: false,
};

export default function PortalTutorPage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [requests, setRequests] = useState<TutorReq[]>([]);
  const [form, setForm] = useState(INIT_FORM);
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("portalSession");
      if (!raw) { router.replace("/portal"); return; }
      const s: Session = JSON.parse(raw);
      if (s.expires < Date.now()) { localStorage.removeItem("portalSession"); router.replace("/portal"); return; }
      setSession(s);
    } catch { router.replace("/portal"); }
  }, [router]);

  useEffect(() => {
    if (!session) return;
    (async () => {
      const res = await fetch(`/api/portal/tutor?booking_id=${session.booking_id}`);
      if (res.ok) { const d = await res.json(); setRequests(d.requests || []); }
    })();
  }, [session]);

  async function reload() {
    if (!session) return;
    const res = await fetch(`/api/portal/tutor?booking_id=${session.booking_id}`);
    if (res.ok) { const d = await res.json(); setRequests(d.requests || []); }
  }

  function toggleDay(d: string) {
    setForm(f => ({ ...f, preferred_days_arr: f.preferred_days_arr.includes(d) ? f.preferred_days_arr.filter(x => x !== d) : [...f.preferred_days_arr, d] }));
  }
  function toggleFocus(d: string) {
    setForm(f => {
      if (f.class_focus_arr.includes(d)) return { ...f, class_focus_arr: f.class_focus_arr.filter(x => x !== d) };
      if (f.class_focus_arr.length >= 2) { setMsg("수업 방향 상세는 최대 2개까지 선택 가능합니다."); return f; }
      setMsg("");
      return { ...f, class_focus_arr: [...f.class_focus_arr, d] };
    });
  }

  async function submit() {
    if (!session) return;
    if (!form.student_name_kr.trim()) { setMsg("학생 이름을 입력해주세요."); return; }
    if (!form.class_type) { setMsg("수업 유형을 선택해주세요."); return; }
    if (!form.privacy_agreed || !form.rules_agreed) { setMsg("개인정보 동의와 튜터 규정 동의를 체크해주세요."); return; }
    setSaving(true); setMsg("");
    const res = await fetch("/api/portal/tutor", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking_id: session.booking_id, guest_name: session.guest_name, ...form }),
    });
    setSaving(false);
    if (!res.ok) { const r = await res.json(); setMsg(r.error || "신청 실패"); return; }
    setDone(true);
    setForm(INIT_FORM);
    reload();
  }

  async function cancel(id: string) {
    if (!confirm("신청을 취소하시겠습니까?")) return;
    const res = await fetch(`/api/portal/tutor?id=${id}`, { method: "DELETE" });
    if (!res.ok) { const r = await res.json(); alert(r.error || "취소 실패"); return; }
    reload();
  }

  if (!session) return null;

  return (<>
    <style>{`
.tu-w{max-width:720px;margin:0 auto;padding:24px 24px 40px}
.tu-back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;font-size:13px;color:#6b7c93;cursor:pointer;font-family:inherit;font-weight:600;margin-bottom:12px}.tu-back:hover{color:#1a6fc4}
.tu-head{background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:16px;padding:20px;color:#fff;margin-bottom:12px}
.tu-head h1{font-size:19px;font-weight:800;margin-bottom:2px}.tu-head p{font-size:12px;opacity:0.8}
.sec{background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 8px rgba(0,0,0,0.04);margin-bottom:10px}
.sec h2{font-size:14px;font-weight:800;color:#1a6fc4;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.q{margin-bottom:16px}
.q-label{display:block;font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:6px}
.q-label .req{color:#dc2626;margin-left:3px}
.q-hint{display:block;font-size:11px;color:#94a3b8;margin-bottom:6px}
.inp,.sel,.area{width:100%;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff}.inp:focus,.sel:focus,.area:focus{border-color:#1a6fc4}
.area{resize:vertical;min-height:60px}
.opts{display:flex;flex-wrap:wrap;gap:6px}
.opt{padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;cursor:pointer;background:#fff;font-family:inherit;font-weight:500;user-select:none}
.opt:hover{border-color:#94a3b8}
.opt.on{background:#1a6fc4;color:#fff;border-color:#1a6fc4}
.agree{margin-bottom:12px}
.agree label{display:flex;align-items:flex-start;gap:8px;cursor:pointer;padding:10px 12px;background:#f8fafc;border-radius:8px;font-size:13px;line-height:1.5}
.agree input{width:18px;height:18px;margin-top:1px;accent-color:#1a6fc4;flex-shrink:0}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.btn{width:100%;padding:14px;background:linear-gradient(135deg,#1a6fc4,#7c3aed);color:#fff;font-size:15px;font-weight:700;border:none;border-radius:12px;cursor:pointer;font-family:inherit;margin-top:4px}.btn:hover{opacity:0.9}.btn:disabled{opacity:0.5;cursor:not-allowed}
.msg{margin-top:10px;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:600;text-align:center}
.msg-ok{background:#dcfce7;color:#166534;border:1px solid #bbf7d0}.msg-err{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.done-box{background:#dcfce7;border-radius:12px;padding:28px;text-align:center;border:1px solid #bbf7d0}
.done-box .icon{font-size:40px;margin-bottom:8px}
.done-box .ttl{font-size:17px;font-weight:800;color:#166534;margin-bottom:6px}
.done-box .sub{font-size:13px;color:#166534;opacity:0.9}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:14px;margin-bottom:8px;background:#f8fafc}
.card.cancelled{opacity:0.5}
.card-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:6px}
.card-title{font-size:14px;font-weight:700}
.badge{display:inline-block;padding:3px 10px;border-radius:6px;font-size:11px;font-weight:700}
.info{font-size:12px;color:#475569;line-height:1.6}.info .k{font-weight:700;color:#6b7c93;margin-right:4px}
.cancel{margin-top:8px;padding:6px 14px;font-size:12px;font-weight:600;border:1px solid #fecaca;background:#fef2f2;color:#dc2626;border-radius:7px;cursor:pointer;font-family:inherit}.cancel:hover{background:#fee2e2}
.empty{text-align:center;padding:24px;color:#94a3b8;font-size:13px}
.num{display:inline-block;width:20px;height:20px;border-radius:50%;background:#1a6fc4;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:20px;margin-right:6px}
@media(max-width:500px){.tu-w{padding:20px 16px}.row2{grid-template-columns:1fr}}
    `}</style>
    <div className="tu-w">
      <button className="tu-back" onClick={() => router.push("/portal/dashboard")}>← 대시보드로</button>
      <div className="tu-head"><h1>👩‍🏫 튜터 수업 신청</h1><p>{session.guest_name}님 · 원어민 1:1 또는 1:2 수업</p></div>

      {done ? (
        <div className="done-box">
          <div className="icon">✅</div>
          <div className="ttl">신청이 완료되었습니다</div>
          <div className="sub">담당자가 확인 후 연락드립니다.</div>
          <button onClick={() => setDone(false)} style={{ marginTop: 16, padding: "10px 20px", background: "#fff", color: "#166534", border: "1px solid #bbf7d0", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", fontSize: 13 }}>추가 신청</button>
        </div>
      ) : (<>
      <div className="sec">
        <h2>기본 정보</h2>
        <div className="q">
          <label className="q-label"><span className="num">1</span>드림하우스 넘버 또는 예약자 성함</label>
          <input className="inp" value={form.house_number} onChange={e => setForm({ ...form, house_number: e.target.value })} placeholder="예: B17 L4 / 김갑현" />
        </div>
        <div className="q">
          <label className="q-label"><span className="num">2</span>학생 이름 (한글 + 영문)<span className="req">*</span></label>
          <div className="row2">
            <input className="inp" value={form.student_name_kr} onChange={e => setForm({ ...form, student_name_kr: e.target.value })} placeholder="김사랑" />
            <input className="inp" value={form.student_name_en} onChange={e => setForm({ ...form, student_name_en: e.target.value })} placeholder="kim sa rang" />
          </div>
        </div>
        <div className="q">
          <label className="q-label"><span className="num">3</span>학생 나이</label>
          <span className="q-hint">예: 2019.09.03 만5세</span>
          <input className="inp" value={form.student_age} onChange={e => setForm({ ...form, student_age: e.target.value })} />
        </div>
      </div>

      <div className="sec">
        <h2>수업 유형 및 일정</h2>
        <div className="q">
          <label className="q-label"><span className="num">4</span>수업 유형<span className="req">*</span></label>
          <div className="opts">
            <button type="button" className={`opt${form.class_type === "1:1" ? " on" : ""}`} onClick={() => setForm({ ...form, class_type: "1:1" })}>1:1 (₱300/시간)</button>
            <button type="button" className={`opt${form.class_type === "1:2" ? " on" : ""}`} onClick={() => setForm({ ...form, class_type: "1:2" })}>1:2 (₱350/시간)</button>
          </div>
        </div>
        <div className="q">
          <label className="q-label"><span className="num">5·6</span>수업 시작일 ~ 종료일</label>
          <div className="row2">
            <input className="inp" type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
            <input className="inp" type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>
        </div>
        <div className="q">
          <label className="q-label"><span className="num">7</span>원하는 수업 요일 (복수 선택)</label>
          <div className="opts">
            {DAYS.map(d => (
              <button key={d} type="button" className={`opt${form.preferred_days_arr.includes(d) ? " on" : ""}`} onClick={() => toggleDay(d)}>{d}</button>
            ))}
          </div>
        </div>
        <div className="q">
          <label className="q-label"><span className="num">8</span>빠지는 날짜 / 변경 날짜</label>
          <textarea className="area" value={form.skip_dates} onChange={e => setForm({ ...form, skip_dates: e.target.value })} placeholder="예: 4/15 결석, 4/17 오전→오후 변경" />
        </div>
        <div className="q">
          <label className="q-label"><span className="num">9</span>원하는 수업 시간</label>
          <input className="inp" value={form.preferred_time} onChange={e => setForm({ ...form, preferred_time: e.target.value })} placeholder="예: 오전10시~오후12시" />
        </div>
      </div>

      <div className="sec">
        <h2>학생 레벨</h2>
        <div className="q">
          <label className="q-label"><span className="num">10</span>영어 레벨</label>
          <div className="opts">
            {LEVELS_ER.map(l => (
              <button key={l} type="button" className={`opt${form.level_english === l ? " on" : ""}`} onClick={() => setForm({ ...form, level_english: l })}>{l}</button>
            ))}
          </div>
        </div>
        {[
          { key: "level_speaking", num: 11, label: "스피킹 레벨" },
          { key: "level_reading",  num: 12, label: "리딩 레벨" },
          { key: "level_writing",  num: 13, label: "라이팅 레벨" },
        ].map(f => (
          <div key={f.key} className="q">
            <label className="q-label"><span className="num">{f.num}</span>{f.label}</label>
            <div className="opts">
              {LEVELS_7.map(l => (
                <button key={l} type="button" className={`opt${(form as any)[f.key] === l ? " on" : ""}`} onClick={() => setForm({ ...form, [f.key]: l })}>{l}</button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="sec">
        <h2>수업 방향</h2>
        <div className="q">
          <label className="q-label"><span className="num">14</span>사용 영어 교재</label>
          <input className="inp" value={form.textbook} onChange={e => setForm({ ...form, textbook: e.target.value })} placeholder="예: Phonics Fun 1, Smart Reading" />
        </div>
        <div className="q">
          <label className="q-label"><span className="num">15</span>수업 방향</label>
          <div className="opts">
            {STYLES.map(s => (
              <button key={s} type="button" className={`opt${form.class_style === s ? " on" : ""}`} onClick={() => setForm({ ...form, class_style: s })}>{s}</button>
            ))}
          </div>
        </div>
        <div className="q">
          <label className="q-label"><span className="num">16</span>수업 방향 상세 (최대 2개)</label>
          <div className="opts">
            {FOCUS.map(f => (
              <button key={f} type="button" className={`opt${form.class_focus_arr.includes(f) ? " on" : ""}`} onClick={() => toggleFocus(f)}>{f}</button>
            ))}
          </div>
        </div>
        <div className="q">
          <label className="q-label"><span className="num">17</span>아이 성향 / 흥미</label>
          <textarea className="area" value={form.child_personality} onChange={e => setForm({ ...form, child_personality: e.target.value })} placeholder="예: 활발하고 말이 많음, 스포츠/공룡 좋아함" />
        </div>
      </div>

      <div className="sec">
        <h2>동의<span style={{ color: "#dc2626", marginLeft: 4 }}>*</span></h2>
        <div className="agree">
          <label>
            <input type="checkbox" checked={form.privacy_agreed} onChange={e => setForm({ ...form, privacy_agreed: e.target.checked })} />
            <span>개인정보 수집 및 이용에 동의합니다. (수업 매칭 및 튜터 배정 목적)</span>
          </label>
        </div>
        <div className="agree">
          <label>
            <input type="checkbox" checked={form.rules_agreed} onChange={e => setForm({ ...form, rules_agreed: e.target.checked })} />
            <span>튜터 규정에 동의합니다. (취소/변경 규정, 결제 방식 등)</span>
          </label>
        </div>
        <button className="btn" onClick={submit} disabled={saving}>{saving ? "신청 중..." : "튜터 수업 신청하기"}</button>
        {msg && <div className={`msg ${msg.includes("완료") ? "msg-ok" : "msg-err"}`}>{msg}</div>}
      </div>
      </>)}

      <div className="sec">
        <h2>신청 내역 ({requests.length}건)</h2>
        {requests.length === 0 ? <div className="empty">아직 신청 내역이 없습니다</div> :
          requests.map(r => {
            const st = ST[r.status] || ST.pending;
            return (
              <div key={r.id} className={`card${r.status === "cancelled" ? " cancelled" : ""}`}>
                <div className="card-top">
                  <div className="card-title">{r.student_name_kr || "-"} {r.student_name_en ? `(${r.student_name_en})` : ""}</div>
                  <span className="badge" style={{ background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <div className="info">
                  <div><span className="k">유형:</span>{r.class_type || "-"}</div>
                  <div><span className="k">기간:</span>{r.start_date || "-"} ~ {r.end_date || "-"}</div>
                  <div><span className="k">요일:</span>{(r.preferred_days_arr || []).join(",") || "-"}</div>
                  <div><span className="k">시간:</span>{r.preferred_time || "-"}</div>
                  <div><span className="k">신청일:</span>{r.created_at?.slice(0, 10)}</div>
                </div>
                {r.status === "pending" && <button className="cancel" onClick={() => cancel(r.id)}>신청 취소</button>}
              </div>
            );
          })
        }
      </div>
    </div>
  </>);
}
