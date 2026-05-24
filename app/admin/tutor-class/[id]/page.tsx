"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface TutorRow {
  id: string;
  created_at: string;
  booking_id: string | null;
  guest_name: string | null;
  house_number: string | null;
  student_name_kr: string | null;
  student_name_en: string | null;
  student_age: string | null;
  student2_name: string | null;
  student2_eng_name: string | null;
  student2_age: string | null;
  class_type: string | null;
  sessions_per_day: number | null;
  start_date: string | null;
  end_date: string | null;
  preferred_days: string | null;
  preferred_time: string | null;
  skip_dates: string | null;
  level_english: string | null;
  level_speaking: string | null;
  level_reading: string | null;
  level_writing: string | null;
  textbook: string | null;
  class_style: string | null;
  class_focus: string | null;
  class_focus_arr: string[] | null;
  child_personality: string | null;
  privacy_agreed: boolean | null;
  rules_agreed: boolean | null;
  status: string;
  tutor_id: string | null;
  assigned_tutor_id: string | null;
  notes: string | null;
  admin_memo: string | null;
  total_sessions: number | null;
  total_amount: number | null;
}

interface Tutor { id: string; name: string }

const STATUS_OPTIONS = [
  { v: "pending",   label: "대기중" },
  { v: "reviewing", label: "검토중" },
  { v: "assigned",  label: "배정됨" },
  { v: "confirmed", label: "확정" },
  { v: "completed", label: "완료" },
  { v: "cancelled", label: "취소" },
];

function fmt(v: string | null | undefined) { return v && String(v).trim() !== "" ? v : "-"; }
function fmtLevel(v: string | null | undefined) {
  if (!v || String(v).trim() === "") return "-";
  if (v === "enrolled") return "재학생 (레벨 미배정)";
  return v;
}

export default function TutorRequestDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const [row, setRow] = useState<TutorRow | null>(null);
  const [tutors, setTutors] = useState<Tutor[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const [status, setStatus] = useState<string>("pending");
  const [tutorId, setTutorId] = useState<string>("");
  const [memo, setMemo] = useState<string>("");
  const [price, setPrice] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

  function computeWeeks(start: string | null | undefined, end: string | null | undefined): number {
    if (!start || !end) return 0;
    const s = new Date(start), e = new Date(end);
    const diff = e.getTime() - s.getTime();
    if (isNaN(diff) || diff < 0) return 0;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, Math.ceil(days / 7));
  }
  function countDays(preferred_days: string | null | undefined): number {
    if (!preferred_days) return 0;
    return preferred_days.split(',').map(s => s.trim()).filter(Boolean).length;
  }
  function defaultPrice(classType: string | null | undefined): number {
    return classType === '1:2' ? 350 : 300;
  }

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const [reqRes, tutorRes] = await Promise.all([
      supabase.from("tutor_requests").select("*").eq("id", id).maybeSingle(),
      supabase.from("tutors").select("id, name").eq("is_active", true).order("name"),
    ]);
    setLoading(false);
    if (reqRes.error) { setMsg("불러오기 실패: " + reqRes.error.message); return; }
    const r = reqRes.data as TutorRow | null;
    if (!r) { setMsg("신청 정보를 찾을 수 없습니다."); return; }
    setRow(r);
    setStatus(r.status || "pending");
    setTutorId(r.assigned_tutor_id || r.tutor_id || "");
    setMemo(r.admin_memo || r.notes || "");
    const existingPrice = (r as any).price_per_session;
    setPrice(existingPrice != null ? String(existingPrice) : String(defaultPrice(r.class_type)));
    setTutors((tutorRes.data || []) as Tutor[]);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  async function save() {
    if (!row) return;
    setSaving(true); setMsg("");
    const weeks = computeWeeks(row.start_date, row.end_date);
    const daysPerWeek = countDays(row.preferred_days);
    const spd = row.sessions_per_day || 1;
    const computedSessions = weeks * daysPerWeek * spd;
    const priceNum = parseFloat(price) || 0;
    const computedAmount = computedSessions * priceNum;
    const payload: Record<string, unknown> = {
      status,
      assigned_tutor_id: tutorId || null,
      tutor_id: tutorId || null,
      admin_memo: memo || null,
      total_sessions: computedSessions || null,
      total_amount: computedAmount || null,
    };
    const { error } = await supabase.from("tutor_requests")
      .update(payload)
      .eq("id", row.id);
    if (error) { setSaving(false); setMsg("저장 실패: " + error.message); return; }

    // tutor_lessons UPSERT — assigned/confirmed/수업중/active 상태이고 튜터 배정됐을 때
    const ACTIVE_STATES = ["assigned", "confirmed", "수업중", "active"];
    if (tutorId && ACTIVE_STATES.includes(status)) {
      const lessonPayload: Record<string, unknown> = {
        application_id: row.id,
        tutor_id: tutorId,
        start_date: row.start_date,
        end_date: row.end_date,
        sessions_per_day: row.sessions_per_day || 1,
        class_days: row.preferred_days,
        class_time: row.preferred_time,
        class_type: row.class_type,
        house_or_reserver: row.guest_name,
        student_names: row.student_name_kr || (row as any).student_name || "",
        student_ages: row.student_age,
        total_sessions: computedSessions || null,
        total_amount: computedAmount || null,
        overall_level: row.level_english,
        speaking_level: row.level_speaking,
        reading_level: row.level_reading,
        writing_level: row.level_writing,
        class_style: row.class_style,
        class_focus: (row as any).class_focus || (Array.isArray(row.class_focus_arr) ? row.class_focus_arr.join(",") : null),
        status: "active",
      };
      const { data: existing } = await supabase
        .from("tutor_lessons")
        .select("id")
        .eq("application_id", row.id)
        .maybeSingle();
      if (existing?.id) {
        const { error: upErr } = await supabase.from("tutor_lessons").update(lessonPayload).eq("id", existing.id);
        if (upErr) console.error("tutor_lessons UPDATE 실패:", upErr);
      } else {
        const { error: insErr } = await supabase.from("tutor_lessons").insert(lessonPayload);
        if (insErr) console.error("tutor_lessons INSERT 실패:", insErr);
      }
    }

    setSaving(false);
    setMsg("저장되었습니다.");
    load();
  }

  async function remove() {
    if (!row) return;
    if (!confirm(`${row.guest_name || ""}님의 신청을 삭제하시겠습니까?\n되돌릴 수 없습니다.`)) return;
    setDeleting(true); setMsg("");
    const { error } = await supabase.from("tutor_requests").delete().eq("id", row.id);
    setDeleting(false);
    if (error) { setMsg("삭제 실패: " + error.message); return; }
    router.push("/admin/tutor-class");
  }

  if (!id) return null;

  return (<>
    <style>{`
*{box-sizing:border-box}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.dt-w{max-width:980px;margin:0 auto;padding:24px}
.dt-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;gap:12px;flex-wrap:wrap}
.dt-back{background:#fff;border:1px solid #cbd5e1;color:#475569;padding:8px 14px;border-radius:8px;cursor:pointer;font-size:13px;font-family:inherit;font-weight:600}.dt-back:hover{color:#1a6fc4}
.dt-title{font-size:20px;font-weight:800;color:#1a1a2e}
.dt-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
@media(max-width:760px){.dt-grid{grid-template-columns:1fr}}
.dt-card{background:#fff;border-radius:14px;padding:18px 20px;box-shadow:0 2px 12px rgba(0,0,0,0.05)}
.dt-card h2{font-size:14px;font-weight:800;color:#1a6fc4;margin:0 0 12px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.dt-row{display:flex;justify-content:space-between;gap:10px;padding:7px 0;font-size:13px;border-bottom:1px dashed #f1f5f9}
.dt-row:last-child{border-bottom:none}
.dt-k{color:#6b7c93;font-weight:600;flex-shrink:0}
.dt-v{color:#1a1a2e;font-weight:500;text-align:right;word-break:break-word}
.dt-pre{white-space:pre-wrap;text-align:left;flex:1;font-size:12px;line-height:1.6;background:#f8fafc;padding:8px 10px;border-radius:6px;color:#475569}
.dt-actions{display:flex;flex-direction:column;gap:10px}
.dt-inp,.dt-sel,.dt-area{width:100%;padding:9px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff}
.dt-area{min-height:80px;resize:vertical}
.dt-btn{padding:11px 16px;background:#1a6fc4;color:#fff;border:none;border-radius:9px;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit}.dt-btn:hover{background:#155a9e}.dt-btn:disabled{opacity:0.6}
.dt-lbl{display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:4px}
.dt-msg{margin-top:8px;padding:9px 12px;border-radius:8px;font-size:12px;font-weight:600;text-align:center}
.dt-msg.ok{background:#dcfce7;color:#166534}
.dt-msg.err{background:#fef2f2;color:#dc2626}
.dt-empty{padding:40px;text-align:center;color:#94a3b8;font-size:14px;background:#fff;border-radius:12px}
    `}</style>
    <div className="dt-w">
      <div className="dt-head">
        <button className="dt-back" onClick={() => router.push("/admin/tutor-class")}>← 목록으로</button>
        <span className="dt-title">👩‍🏫 튜터 신청 상세</span>
        <div style={{ width: 80 }} />
      </div>

      {loading ? (
        <div className="dt-empty">불러오는 중...</div>
      ) : !row ? (
        <div className="dt-empty">{msg || "신청 정보를 찾을 수 없습니다."}</div>
      ) : (<>
        <div className="dt-grid">
          <div className="dt-card">
            <h2>기본 정보</h2>
            <div className="dt-row"><span className="dt-k">접수일</span><span className="dt-v">{row.created_at?.slice(0,10) || "-"}</span></div>
            <div className="dt-row"><span className="dt-k">예약자</span><span className="dt-v">{fmt(row.guest_name || row.house_number)}</span></div>
            <div className="dt-row"><span className="dt-k">학생 (한)</span><span className="dt-v">{fmt(row.student_name_kr)}</span></div>
            <div className="dt-row"><span className="dt-k">학생 (영)</span><span className="dt-v">{fmt(row.student_name_en)}</span></div>
            <div className="dt-row"><span className="dt-k">나이</span><span className="dt-v">{fmt(row.student_age)}</span></div>
            {(row.student2_name || row.student2_eng_name) && (<>
              <div className="dt-row"><span className="dt-k">학생2 (한)</span><span className="dt-v">{fmt(row.student2_name)}</span></div>
              <div className="dt-row"><span className="dt-k">학생2 (영)</span><span className="dt-v">{fmt(row.student2_eng_name)}</span></div>
              <div className="dt-row"><span className="dt-k">학생2 나이</span><span className="dt-v">{fmt(row.student2_age)}</span></div>
            </>)}
          </div>

          <div className="dt-card">
            <h2>수업 유형 · 일정</h2>
            <div className="dt-row"><span className="dt-k">수업 유형</span><span className="dt-v">{fmt(row.class_type)}</span></div>
            <div className="dt-row"><span className="dt-k">타임</span><span className="dt-v">{row.sessions_per_day === 2 ? "2타임 (100분)" : "1타임 (50분)"}</span></div>
            <div className="dt-row"><span className="dt-k">기간</span><span className="dt-v">{fmt(row.start_date)} ~ {fmt(row.end_date)}</span></div>
            <div className="dt-row"><span className="dt-k">요일</span><span className="dt-v">{fmt(row.preferred_days)}</span></div>
            <div className="dt-row"><span className="dt-k">시간</span><span className="dt-v">{fmt(row.preferred_time)}</span></div>
            <div className="dt-row"><span className="dt-k">빠지는 날</span><span className="dt-v">{fmt(row.skip_dates)}</span></div>
          </div>

          <div className="dt-card">
            <h2>영어 레벨</h2>
            <div className="dt-row"><span className="dt-k">전체</span><span className="dt-v">{fmtLevel(row.level_english)}</span></div>
            <div className="dt-row"><span className="dt-k">스피킹</span><span className="dt-v">{fmtLevel(row.level_speaking)}</span></div>
            <div className="dt-row"><span className="dt-k">리딩</span><span className="dt-v">{fmtLevel(row.level_reading)}</span></div>
            <div className="dt-row"><span className="dt-k">라이팅</span><span className="dt-v">{fmtLevel(row.level_writing)}</span></div>
          </div>

          <div className="dt-card">
            <h2>수업 방향</h2>
            <div className="dt-row"><span className="dt-k">교재</span><span className="dt-v">{fmt(row.textbook)}</span></div>
            <div className="dt-row"><span className="dt-k">수업 방향</span><span className="dt-v">{fmt(row.class_style)}</span></div>
            <div className="dt-row"><span className="dt-k">상세</span><span className="dt-v">{Array.isArray(row.class_focus_arr) && row.class_focus_arr.length > 0 ? row.class_focus_arr.join(", ") : fmt(row.class_focus)}</span></div>
            <div className="dt-row" style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}>
              <span className="dt-k">아이 성향 / 요청 사항</span>
              <div className="dt-pre">{row.child_personality || "-"}</div>
            </div>
          </div>
        </div>

        <div className="dt-card" style={{ marginTop: 14 }}>
          <h2>어드민 처리</h2>
          <div className="dt-actions">
            <div>
              <label className="dt-lbl">상태</label>
              <select className="dt-sel" value={status} onChange={e => setStatus(e.target.value)}>
                {STATUS_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="dt-lbl">담당 튜터</label>
              <select className="dt-sel" value={tutorId} onChange={e => setTutorId(e.target.value)}>
                <option value="">-- 미배정 --</option>
                {tutors.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {(() => {
              const weeks = computeWeeks(row.start_date, row.end_date);
              const daysPerWeek = countDays(row.preferred_days);
              const spd = row.sessions_per_day || 1;
              const computedSessions = weeks * daysPerWeek * spd;
              const priceNum = parseFloat(price) || 0;
              const computedAmount = computedSessions * priceNum;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <label className="dt-lbl">단가 (₱/회)</label>
                    <input className="dt-inp" type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} placeholder="예: 300" />
                    <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>기본 {row.class_type === '1:2' ? '350' : '300'} ({row.class_type || '1:1'})</div>
                  </div>
                  <div>
                    <label className="dt-lbl">총 회차 (자동)</label>
                    <input className="dt-inp" type="number" value={computedSessions} readOnly style={{ background: "#f1f5f9", color: "#1a1a2e" }} />
                    <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>{weeks}주 × {daysPerWeek}일 × {spd}타임</div>
                  </div>
                  <div>
                    <label className="dt-lbl">총 금액 ₱ (자동)</label>
                    <input className="dt-inp" type="number" value={computedAmount} readOnly style={{ background: "#f1f5f9", color: "#16a34a", fontWeight: 700 }} />
                    <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>= {computedSessions}회 × ₱{priceNum}</div>
                  </div>
                </div>
              );
            })()}
            <div>
              <label className="dt-lbl">어드민 메모</label>
              <textarea className="dt-area" value={memo} onChange={e => setMemo(e.target.value)} placeholder="어드민 메모..." />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="dt-btn" style={{ flex: 1 }} onClick={save} disabled={saving}>{saving ? "저장 중..." : "💾 저장"}</button>
              <button className="dt-btn" style={{ background: "#dc2626" }} onClick={remove} disabled={deleting}>{deleting ? "삭제 중..." : "🗑 삭제"}</button>
            </div>
            {msg && <div className={`dt-msg ${msg.includes("실패") ? "err" : "ok"}`}>{msg}</div>}
          </div>
        </div>
      </>)}
    </div>
  </>);
}
