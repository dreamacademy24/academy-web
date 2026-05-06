"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface FormState {
  q1: string; // 예약자 성함 + 입실 일자
  q2: string; // 투숙자 영문이름
  q3: string; // 베드 세팅
  q4: string; // 유심 대여
  q5: string; // 애프터/필드트립
  q6: string; // 기타
}

export default function CheckinFormPage() {
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({ q1: "", q2: "", q3: "", q4: "", q5: "", q6: "" });
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch(`/api/checkin/${token}`);
        if (!res.ok) {
          if (res.status === 404) setError("유효하지 않은 링크입니다");
          else setError("로딩 실패");
          setLoading(false);
          return;
        }
        const d = await res.json();
        const det = d.detail;
        if (det.submitted_at) {
          setSubmitted(true);
          setLoading(false);
          return;
        }
        // pre-fill from existing fields
        setForm({
          q1: det.booker_name || "",
          q2: det.guest_names_en || "",
          q3: det.bed_setting || "",
          q4: det.usim_request || "",
          q5: det.after_trip_request || "",
          q6: det.extra_requests || "",
        });
        setLoading(false);
      } catch {
        setError("네트워크 오류");
        setLoading(false);
      }
    })();
  }, [token]);

  function up<K extends keyof FormState>(k: K, v: string) { setForm(prev => ({ ...prev, [k]: v })); }

  async function submit() {
    if (!form.q1.trim()) { alert("1번 문항(예약자 성함과 입실 일자)을 입력해주세요."); return; }
    setSubmitting(true);
    const res = await fetch(`/api/checkin/${token}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booker_name: form.q1,
        guest_names_en: form.q2,
        bed_setting: form.q3,
        usim_request: form.q4,
        after_trip_request: form.q5,
        extra_requests: form.q6,
      }),
    });
    setSubmitting(false);
    if (!res.ok) { const j = await res.json().catch(()=>({})); alert("제출 실패: " + (j.error || "")); return; }
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f7f9fc;color:#1a1a2e;line-height:1.6}
.cf-w{max-width:680px;margin:0 auto;padding:32px 20px 60px}
.cf-h{text-align:center;padding:20px 0 28px;border-bottom:2px solid #e2e8f0;margin-bottom:24px}
.cf-h .brand{font-size:14px;font-weight:700;color:#1a6fc4;letter-spacing:.05em;margin-bottom:4px}
.cf-h h1{font-size:22px;font-weight:800;color:#1a1a2e;line-height:1.4}
.cf-h .desc{font-size:13px;color:#6b7c93;margin-top:8px}
.q{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.04);margin-bottom:14px;border:1px solid #e2e8f0}
.q-num{display:inline-block;background:#1a6fc4;color:#fff;width:24px;height:24px;border-radius:50%;text-align:center;font-size:13px;font-weight:800;line-height:24px;margin-right:8px}
.q-title{font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:6px}
.q-hint{font-size:12px;color:#6b7c93;margin-bottom:10px;line-height:1.5}
.q-hint b{color:#1a6fc4}
.fi{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff}.fi:focus{border-color:#1a6fc4}
.ta{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;resize:vertical;min-height:100px}.ta:focus{border-color:#1a6fc4}
.btn-submit{display:block;width:100%;padding:16px;background:#1a6fc4;color:#fff;font-size:16px;font-weight:800;border:none;border-radius:12px;cursor:pointer;font-family:inherit;margin-top:20px;box-shadow:0 4px 14px rgba(26,111,196,0.25)}
.btn-submit:hover{background:#0d3d7a}.btn-submit:disabled{background:#94a3b8;cursor:not-allowed;box-shadow:none}
.notice{padding:32px;text-align:center;background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,0.05);font-size:15px;color:#475569;line-height:1.7}
.notice.ok{color:#166534;background:#f0fdf4;border:1px solid #bbf7d0}
.notice.err{color:#dc2626;background:#fef2f2;border:1px solid #fecaca}
@media(max-width:600px){.cf-w{padding:20px 14px 40px}.q{padding:16px}.cf-h h1{font-size:18px}}
    `}</style>
    <div className="cf-w">
      <div className="cf-h">
        <div className="brand">DREAM ACADEMY · DREAM HOUSE</div>
        <h1>드림하우스 체크인 사전 정보 수집 폼</h1>
        <div className="desc">아래 6가지 정보를 입력해 주세요. 입실 준비에 활용됩니다.</div>
      </div>

      {loading && <div className="notice">로딩 중...</div>}
      {!loading && error && <div className="notice err">{error}</div>}
      {!loading && !error && submitted && (
        <div className="notice ok">이미 제출하셨습니다. 감사합니다! 🙏</div>
      )}
      {!loading && !error && done && (
        <div className="notice ok">설문에 참여해 주셔서 감사합니다 ^^<br/>곧 세부에서 만나요 ^^</div>
      )}

      {!loading && !error && !submitted && !done && (<>
        <div className="q">
          <div className="q-title"><span className="q-num">1</span>예약자 대표 성함과 입실 일자</div>
          <div className="q-hint">예: <b>홍길동, 2026년 5월 9일</b></div>
          <input className="fi" value={form.q1} onChange={e=>up("q1",e.target.value)} placeholder="홍길동, 2026년 5월 9일"/>
        </div>

        <div className="q">
          <div className="q-title"><span className="q-num">2</span>투숙자 전체인원 영문이름</div>
          <div className="q-hint">예: <b>kim ooo / yoo ooo ooo</b> (가족 전원의 영문이름)</div>
          <input className="fi" value={form.q2} onChange={e=>up("q2",e.target.value)} placeholder="kim ooo / yoo ooo ooo"/>
        </div>

        <div className="q">
          <div className="q-title"><span className="q-num">3</span>원하시는 베드 세팅</div>
          <div className="q-hint">보통 <b>2~3인: 마스터룸 베드2개</b> / <b>4인 이상: 마스터룸 베드2개 + 작은방 베드1개</b></div>
          <input className="fi" value={form.q3} onChange={e=>up("q3",e.target.value)} placeholder="원하시는 베드 구성을 작성해 주세요"/>
        </div>

        <div className="q">
          <div className="q-title"><span className="q-num">4</span>유심 대여 신청 (GB 수량)</div>
          <div className="q-hint">대여를 원하시면 인원 수와 GB 수량을 작성해 주세요. (필요 없으시면 비워두세요)</div>

          <div style={{background:"#f8f9fa",border:"1px solid #e2e8f0",borderRadius:8,padding:16,marginBottom:12,fontSize:12.5,lineHeight:1.7,color:"#374151"}}>
            <div style={{fontWeight:800,fontSize:14,marginBottom:8,color:"#1a1a2e"}}>📱 유심 대여 서비스</div>

            <div style={{fontWeight:700,color:"#1a6fc4",marginTop:6,marginBottom:4}}>#기본 안내</div>
            <ul style={{paddingLeft:18,margin:0}}>
              <li>제공 요금제 → <b>Smart 올데이터+ 요금제</b></li>
              <li>통신사 관계 없이 <b>무제한 통화</b> <span style={{color:"#6b7c93"}}>(※ 유선전화 제외)</span></li>
              <li>데이터 포함</li>
              <li>이용 가능 요금제 기간: <b>3일 / 7일 / 30일</b> → 요금제: 유료
                <div style={{paddingLeft:8,color:"#475569",marginTop:2}}>→ 원하시는 기간(GB)을 선택해 알려주시면 해당 요금제로 세팅된 유심을 제공해드립니다.</div>
              </li>
            </ul>

            <div style={{fontWeight:700,marginTop:10,marginBottom:4,color:"#1a1a2e"}}>요금 (30일 기준)</div>
            <ul style={{paddingLeft:18,margin:0}}>
              <li>24GB → <b>P499</b></li>
              <li>36GB → <b>P599</b></li>
              <li>48GB → <b>P699</b></li>
            </ul>

            <div style={{fontWeight:700,color:"#dc2626",marginTop:10,marginBottom:4}}>#유의사항</div>
            <ul style={{paddingLeft:18,margin:0,color:"#475569"}}>
              <li>통신사 <b>smart</b> 유심만 제공합니다</li>
              <li>제공되는 유심은 투숙객의 편의를 위한 무상 서비스입니다</li>
              <li>기타 요금제, 국제전화 사용 등에 대한 안내는 지원하지 않습니다</li>
              <li>통신불량 관련 문의는 <b>Smart 고객센터 또는 대리점</b>에 직접 문의해 주세요</li>
            </ul>

            <div style={{marginTop:10,padding:"8px 10px",background:"#fef3c7",border:"1px solid #fde68a",borderRadius:6,fontSize:12,color:"#92400e",fontWeight:600}}>
              ⚠️ 유심 반납 안내: 퇴실 시, 지급된 유심은 <b>반드시 반납</b>해 주세요.
            </div>

            <div style={{marginTop:8,fontSize:11.5,color:"#6b7c93"}}>예시 입력) <b>24gb, 2개</b></div>
          </div>

          <input className="fi" value={form.q4} onChange={e=>up("q4",e.target.value)} placeholder="예: 24gb, 2개"/>
        </div>

        <div className="q">
          <div className="q-title"><span className="q-num">5</span>애프터스쿨 / 필드트립 사전 신청</div>
          <div className="q-hint">원하시는 프로그램과 날짜를 자유롭게 작성해 주세요. (선택)</div>
          <textarea className="ta" value={form.q5} onChange={e=>up("q5",e.target.value)} placeholder="예: 5/12 도자기 체험, 5/15 호핑투어 ..."/>
        </div>

        <div className="q">
          <div className="q-title"><span className="q-num">6</span>기타 요청사항</div>
          <div className="q-hint">추가 픽드랍, 가족 추가 픽업, 알러지 등 자유롭게 작성해 주세요. (선택)</div>
          <textarea className="ta" value={form.q6} onChange={e=>up("q6",e.target.value)} placeholder="자유롭게 작성"/>
        </div>

        <button className="btn-submit" onClick={submit} disabled={submitting}>
          {submitting ? "제출 중..." : "제출하기"}
        </button>
      </>)}
    </div>
  </>);
}
