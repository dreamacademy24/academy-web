"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { blocksToTimeOverrides, toFocusArr, toDateArr } from "@/lib/scheduleBlocks";
import { countLessonDays } from "@/lib/lessonDates";
import { fmtAge } from "@/lib/format";

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
  schedule_blocks?: Array<{ days: string[]; time: string; sessions_per_day: number }> | null;
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
    const spd = row.sessions_per_day || 1;
    const classDaysArr = row.preferred_days ? row.preferred_days.split(",").map(d => d.trim()).filter(Boolean) : [];
    // 회차 = 실제 수업 "일수"(휴일/토요일제약/skip 반영, 타임 곱 X)
    const computedSessions = countLessonDays(row.start_date, row.end_date, classDaysArr, toDateArr((row as any).skip_dates));
    const priceNum = parseFloat(price) || 0;   // 기본단가(타임 1 기준)
    const dailyRate = priceNum * spd;          // 하루치 단가 = 기본단가 × 타임
    const computedAmount = dailyRate * computedSessions;  // 총액 = 단가 × 일수

    // tutorId 정규화 — UUID면 그대로, 이름(또는 잘못된 값)이면 tutors 테이블에서 name 매칭 후 id로 변환
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    let resolvedTutorId: string | null = null;
    if (tutorId) {
      if (UUID_RE.test(tutorId)) {
        resolvedTutorId = tutorId;
      } else {
        const want = String(tutorId).trim();
        const match = tutors.find(t => t.name === want)
          || tutors.find(t => (t.name || "").toLowerCase() === want.toLowerCase());
        if (match) {
          resolvedTutorId = match.id;
          console.log("[save] tutorId(name) → uuid 변환:", want, "→", match.id);
        } else {
          console.warn("[save] tutorId가 UUID도 아니고 tutors에서 name 매칭도 실패:", tutorId);
        }
      }
    }

    const payload: Record<string, unknown> = {
      status,
      assigned_tutor_id: resolvedTutorId,
      tutor_id: resolvedTutorId,
      admin_memo: memo || null,
      total_sessions: computedSessions || null,
      total_amount: computedAmount || null,
    };
    const { error } = await supabase.from("tutor_requests")
      .update(payload)
      .eq("id", row.id);
    if (error) { setSaving(false); setMsg("저장 실패: " + error.message); return; }

    // tutor_lessons UPSERT — 튜터가 배정되면 status 와 무관하게 실행
    console.log("[save] status:", status, "| resolvedTutorId:", resolvedTutorId, "| row.id:", row.id);
    let lessonMsg = "";
    if (resolvedTutorId) {
      const tutorUuid = resolvedTutorId;
      const classDaysArr = row.preferred_days
        ? row.preferred_days.split(",").map(d => d.trim()).filter(Boolean)
        : null;
      const requestRefMemo = `request_id: ${row.id}`;
      const memoCombined = memo ? `${memo}\n${requestRefMemo}` : requestRefMemo;
      const lessonPayload: Record<string, unknown> = {
        tutor_id: tutorUuid,
        start_date: row.start_date,
        end_date: row.end_date,
        sessions_per_day: row.sessions_per_day || 1,
        class_days: classDaysArr,
        class_time: row.preferred_time,
        class_type: row.class_type,
        hourly_rate: dailyRate,            // 하루치 단가 저장 (총액 = 단가 × 일수)
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
        class_focus: toFocusArr(row.class_focus_arr ?? (row as any).class_focus),
        status: "active",
        admin_memo: memoCombined,
        application_id: row.id,   // FK 명시 (memo 문자열에만 의존하지 않도록)
      };
      console.log("[save] tutor_lessons payload:", lessonPayload);
      // 기존 연결 수업 조회 — application_id 또는 memo request_id (두 생성 경로 모두 커버)
      const { data: byApp } = await supabase.from("tutor_lessons").select("id").eq("application_id", row.id);
      const { data: byMemo } = await supabase.from("tutor_lessons").select("id").ilike("admin_memo", `%request_id: ${row.id}%`);
      const linkedIds = Array.from(new Set([...(byApp || []), ...(byMemo || [])].map((x: { id: string }) => x.id)));
      if (linkedIds.length > 0) {
        // 대표 1건을 새 튜터/내용으로 UPDATE → 튜터 재배정 시 tutor_id 자동 동기화
        const keepId = linkedIds[0];
        const { error: upErr } = await supabase.from("tutor_lessons").update(lessonPayload).eq("id", keepId);
        if (upErr) { console.error("[save] tutor_lessons UPDATE 실패:", upErr); lessonMsg = " (수업 동기화 실패: " + upErr.message + ")"; }
        else {
          console.log("[save] tutor_lessons UPDATED id=", keepId, "(tutor_id 동기화)");
          // 중복(유령) 수업 정리 — 대표 외 나머지 + 그 회차 삭제
          const dupIds = linkedIds.slice(1);
          if (dupIds.length > 0) {
            await supabase.from("tutor_lesson_sessions").delete().in("lesson_id", dupIds);
            const { error: dupErr } = await supabase.from("tutor_lessons").delete().in("id", dupIds);
            if (dupErr) console.error("[save] 중복 수업 정리 실패:", dupErr);
            else console.log("[save] 중복 수업 정리:", dupIds);
          }
        }
      } else {
        const to = blocksToTimeOverrides(row.schedule_blocks);
        const skipArr = toDateArr((row as any).skip_dates);
        let insertPayload: Record<string, unknown> = lessonPayload;
        if (Object.keys(to).length > 0) insertPayload = { ...insertPayload, time_overrides: to };
        if (skipArr.length > 0) insertPayload = { ...insertPayload, skip_dates: skipArr };
        const { data: ins, error: insErr } = await supabase.from("tutor_lessons").insert(insertPayload).select().single();
        if (insErr) { console.error("[save] tutor_lessons INSERT 실패:", insErr); lessonMsg = " (수업 생성 실패: " + insErr.message + ")"; }
        else {
          console.log("[save] tutor_lessons INSERTED id=", ins?.id);
          // 정산 자동 청구: 수업 최초 생성 시(=이 INSERT 분기) 튜터비를 settlement_items에 charge 등록.
          // UPDATE 분기(재저장)에는 없으므로 수업당 1회만 — 중복 없음. (목록 확정 경로와 동일 정책)
          const _bid = (row as any).booking_id;
          if (_bid && (computedAmount || 0) > 0) {
            const _md = (d: string) => (d ? d.slice(5).replace("-", "/") : "");
            const _label = `튜터비 · ${row.student_name_kr || row.student_name_en || ""}${row.start_date ? ` (${_md(row.start_date)}~${_md(row.end_date)})` : ""}`;
            const { error: _ce } = await supabase.from("settlement_items").insert({
              booking_id: _bid, kind: "charge", label: _label, amount: computedAmount,
              item_date: row.start_date || new Date().toISOString().slice(0, 10),
              status: "approved", recorded_by: "시스템(튜터확정)",
            });
            if (_ce) console.error("[save] 정산 자동청구 실패(수업은 정상):", _ce);
          }
        }
      }
    } else if (tutorId) {
      // 튜터를 선택했는데 UUID/이름 매칭에 실패한 케이스 — null 저장 방지 + 경고
      console.warn("[save] tutorId 해석 실패로 tutor_lessons 동기화 스킵:", tutorId);
      lessonMsg = " (수업 동기화 스킵: 튜터 ID 해석 실패 — 이름이 tutors 테이블에 존재하는지 확인)";
    } else {
      // 튜터 미배정(배정 해제) — 이전에 배정되어 생성된 tutor_lessons(+회차)가 남아
      // 선생님 화면에 "유령 수업"으로 보이는 문제 방지: 연결 수업을 함께 정리.
      const { data: byApp } = await supabase.from("tutor_lessons").select("id").eq("application_id", row.id);
      const { data: byMemo } = await supabase.from("tutor_lessons").select("id").ilike("admin_memo", `%request_id: ${row.id}%`);
      const orphanIds = Array.from(new Set([...(byApp || []), ...(byMemo || [])].map((x: { id: string }) => x.id)));
      if (orphanIds.length > 0) {
        await supabase.from("tutor_lesson_sessions").delete().in("lesson_id", orphanIds);
        const { error: delErr } = await supabase.from("tutor_lessons").delete().in("id", orphanIds);
        if (delErr) { console.error("[save] 미배정 정리 실패:", delErr); lessonMsg = " (이전 배정 수업 정리 실패: " + delErr.message + ")"; }
        else { console.log("[save] 미배정 → 이전 수업 정리 완료:", orphanIds); lessonMsg = " (이전 배정 수업 정리됨)"; }
      } else {
        console.log("[save] 튜터 미배정 → 정리할 수업 없음");
      }
    }

    setSaving(false);
    setMsg("저장되었습니다." + lessonMsg);
    load();
  }

  async function remove() {
    if (!row) return;
    if (!confirm(`${row.guest_name || ""}님의 신청을 삭제하시겠습니까?\n⚠️ 연결된 확정 수업(주간 스케줄·인보이스)도 함께 삭제됩니다.\n되돌릴 수 없습니다.`)) return;
    setDeleting(true); setMsg("");

    // 연결된 tutor_lessons 수집 — application_id 또는 admin_memo의 "request_id: <id>" (두 생성 경로 모두 커버)
    const { data: byApp } = await supabase.from("tutor_lessons").select("id").eq("application_id", row.id);
    const { data: byMemo } = await supabase.from("tutor_lessons").select("id").ilike("admin_memo", `%request_id: ${row.id}%`);
    const lessonIds = Array.from(new Set([...(byApp || []), ...(byMemo || [])].map((x: { id: string }) => x.id)));

    // 연결 수업의 회차(tutor_lesson_sessions) → 수업(tutor_lessons) 순서로 삭제 후 신청 삭제
    if (lessonIds.length > 0) {
      const { error: se } = await supabase.from("tutor_lesson_sessions").delete().in("lesson_id", lessonIds);
      if (se) { setDeleting(false); setMsg("연결 회차 삭제 실패: " + se.message); return; }
      const { error: le } = await supabase.from("tutor_lessons").delete().in("id", lessonIds);
      if (le) { setDeleting(false); setMsg("연결 수업 삭제 실패: " + le.message); return; }
    }

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
            <div className="dt-row"><span className="dt-k">접수일</span><span className="dt-v">{row.created_at ? (() => { const d = new Date(row.created_at); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; })() : "-"}</span></div>
            <div className="dt-row"><span className="dt-k">예약자</span><span className="dt-v">{fmt(row.guest_name || row.house_number)}</span></div>
            <div className="dt-row"><span className="dt-k">학생 (한)</span><span className="dt-v">{fmt(row.student_name_kr)}</span></div>
            <div className="dt-row"><span className="dt-k">학생 (영)</span><span className="dt-v">{fmt(row.student_name_en)}</span></div>
            <div className="dt-row"><span className="dt-k">나이</span><span className="dt-v">{row.class_type === "1:2" && row.student2_age ? `${fmtAge(row.student_age)} / ${fmtAge(row.student2_age)}` : fmtAge(row.student_age)}</span></div>
            {(row.student2_name || row.student2_eng_name) && (<>
              <div className="dt-row"><span className="dt-k">학생2 (한)</span><span className="dt-v">{fmt(row.student2_name)}</span></div>
              <div className="dt-row"><span className="dt-k">학생2 (영)</span><span className="dt-v">{fmt(row.student2_eng_name)}</span></div>
              <div className="dt-row"><span className="dt-k">학생2 나이</span><span className="dt-v">{fmtAge(row.student2_age)}</span></div>
            </>)}
          </div>

          <div className="dt-card">
            <h2>수업 유형 · 일정</h2>
            <div className="dt-row"><span className="dt-k">수업 유형</span><span className="dt-v">{fmt(row.class_type)}</span></div>
            <div className="dt-row"><span className="dt-k">기간</span><span className="dt-v">{fmt(row.start_date)} ~ {fmt(row.end_date)}</span></div>
            {Array.isArray(row.schedule_blocks) && row.schedule_blocks.length > 0 ? (
              row.schedule_blocks.map((b, i) => {
                const daysStr = Array.isArray(b.days) ? b.days.join('·') : '';
                const spd = Number(b.sessions_per_day) === 2 ? '2타임' : '1타임';
                return (
                  <div key={i} className="dt-row">
                    <span className="dt-k">일정 {i+1}</span>
                    <span className="dt-v">{daysStr || '-'} — {b.time || '-'} ({spd})</span>
                  </div>
                );
              })
            ) : (
              <>
                <div className="dt-row"><span className="dt-k">타임</span><span className="dt-v">{row.sessions_per_day === 2 ? "2타임 (100분)" : "1타임 (50분)"}</span></div>
                <div className="dt-row"><span className="dt-k">요일</span><span className="dt-v">{fmt(row.preferred_days)}</span></div>
                <div className="dt-row"><span className="dt-k">시간</span><span className="dt-v">{fmt(row.preferred_time)}</span></div>
              </>
            )}
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
              const spd = row.sessions_per_day || 1;
              const classDaysArr = row.preferred_days ? row.preferred_days.split(",").map(d => d.trim()).filter(Boolean) : [];
              // 회차 = 실제 수업 "일수"(휴일/토요일제약/skip 반영, 타임 곱 X)
              const computedSessions = countLessonDays(row.start_date, row.end_date, classDaysArr, toDateArr((row as any).skip_dates));
              const priceNum = parseFloat(price) || 0;   // 기본단가(타임 1 기준)
              const dailyRate = priceNum * spd;          // 하루치 단가
              const computedAmount = dailyRate * computedSessions;
              return (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  <div>
                    <label className="dt-lbl">기본단가 (₱/타임)</label>
                    <input className="dt-inp" type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} placeholder="예: 300" />
                    <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>기본 {row.class_type === '1:2' ? '350' : '300'} ({row.class_type || '1:1'}) · 하루치 ₱{dailyRate.toLocaleString()} ({spd}타임)</div>
                  </div>
                  <div>
                    <label className="dt-lbl">총 회차 (자동, 일수)</label>
                    <input className="dt-inp" type="number" value={computedSessions} readOnly style={{ background: "#f1f5f9", color: "#1a1a2e" }} />
                    <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>실제 수업일 {computedSessions}일</div>
                  </div>
                  <div>
                    <label className="dt-lbl">총 금액 ₱ (자동)</label>
                    <input className="dt-inp" type="number" value={computedAmount} readOnly style={{ background: "#f1f5f9", color: "#16a34a", fontWeight: 700 }} />
                    <div style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 3 }}>= ₱{dailyRate.toLocaleString()}(하루치) × {computedSessions}일</div>
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