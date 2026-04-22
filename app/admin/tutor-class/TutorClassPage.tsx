"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";
import TutorApplications from "../tutors/TutorApplications";
import TutorLessonList from "./TutorLessonList";

type Tab = "applications" | "schedule" | "students" | "invoice";

export default function TutorClassPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<Tab>("applications");

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.tc-w{max-width:1500px;margin:0 auto;padding:28px 20px}
.tc-top{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.tc-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.tc-back:hover{background:#e2e8f0}
.tc-top h1{font-size:22px;font-weight:800;flex:1}
.tc-top .sub{font-size:12.5px;color:#6b7c93;font-weight:600}
.tc-tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:12px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
.tc-tab{flex:1;padding:11px 8px;font-size:13px;font-weight:700;text-align:center;border:none;border-radius:10px;cursor:pointer;font-family:inherit;background:transparent;color:#6b7c93;transition:all 120ms}
.tc-tab:hover:not(.ac){background:#f1f5f9}
.tc-tab.ac{background:#1a6fc4;color:#fff}
.tc-placeholder{background:#fff;border-radius:14px;padding:56px 28px;box-shadow:0 2px 12px rgba(0,0,0,0.05);text-align:center}
.tc-ph-icon{font-size:56px;margin-bottom:14px;opacity:0.8}
.tc-ph-title{font-size:18px;font-weight:800;color:#1a1a2e;margin-bottom:8px}
.tc-ph-note{display:inline-block;padding:3px 10px;background:#fef3c7;color:#92400e;border-radius:999px;font-size:11.5px;font-weight:700;margin-bottom:20px}
.tc-ph-list{display:inline-block;text-align:left;font-size:13.5px;color:#475569;line-height:1.9}
.tc-ph-list li{list-style:none;padding-left:4px}
@media(max-width:700px){.tc-w{padding:20px 12px}.tc-tabs{flex-wrap:wrap}.tc-tab{flex:1 1 45%}}
    `}</style>
    <div className="tc-w">
      <div className="tc-top">
        <button className="tc-back" onClick={() => router.push("/admin/hub")} aria-label="뒤로">←</button>
        <h1>🎓 튜터 수업 관리</h1>
        <span className="sub">드림하우스 방문 튜터 통합</span>
      </div>

      <div className="tc-tabs" role="tablist">
        <button className={`tc-tab${tab === "applications" ? " ac" : ""}`} onClick={() => setTab("applications")} role="tab" aria-selected={tab === "applications"}>
          📬 신청 수신함
        </button>
        <button className={`tc-tab${tab === "schedule" ? " ac" : ""}`} onClick={() => setTab("schedule")} role="tab" aria-selected={tab === "schedule"}>
          📅 주간 스케줄
        </button>
        <button className={`tc-tab${tab === "students" ? " ac" : ""}`} onClick={() => setTab("students")} role="tab" aria-selected={tab === "students"}>
          👥 수강생 목록
        </button>
        <button className={`tc-tab${tab === "invoice" ? " ac" : ""}`} onClick={() => setTab("invoice")} role="tab" aria-selected={tab === "invoice"}>
          💰 인보이스
        </button>
      </div>

      {tab === "applications" && <TutorApplications />}

      {tab === "schedule" && (
        <div className="tc-placeholder">
          <div className="tc-ph-icon">📅</div>
          <div className="tc-ph-title">주간 스케줄</div>
          <div className="tc-ph-note">다음 세션에서 구현 예정</div>
          <ul className="tc-ph-list">
            <li>✓ 월~일 그리드 (online-class This Week 스타일)</li>
            <li>✓ 튜터별 색상 구분</li>
            <li>✓ 세션 클릭 시 상세 모달</li>
            <li>✓ 이전/다음 주 네비게이션</li>
          </ul>
        </div>
      )}

      {tab === "students" && <TutorLessonList />}

      {tab === "invoice" && (
        <div className="tc-placeholder">
          <div className="tc-ph-icon">💰</div>
          <div className="tc-ph-title">인보이스</div>
          <div className="tc-ph-note">다음 세션에서 구현 예정</div>
          <ul className="tc-ph-list">
            <li>✓ 수강생별 인보이스 미리보기</li>
            <li>✓ Dream Academy 헤더 + 학생 정보 + 달력 그리드 + 규정 안내</li>
            <li>✓ PDF 다운로드 / 이미지 저장</li>
          </ul>
        </div>
      )}
    </div>
  </>);
}
