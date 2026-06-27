"use client";
import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

const POLICY_VERSION = "2026-체험단-v1";
const AGREE_LABELS = [
  "[필수] 제2~3조 콘텐츠 제작·게시 의무를 모두 이행하겠습니다.",
  "[필수] 제4조 — 자녀의 사진·영상으로 아카데미가 홍보 게시물을 제작·게시하고 최대 2년간 유지하는 것에 동의합니다.",
  "[필수] 제6조 취소·환불 불가 및 미이행 시 차액 환수에 동의합니다.",
  "[필수] 제7조 개인정보 수집·이용에 동의합니다.",
];

export default function ConsentPage() {
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [f, setF] = useState({ pname: "", phone: "", email: "", child: "", room: "", month: "", insta: "", blog: "", signer: "", sigdate: "" });
  const [agree, setAgree] = useState([false, false, false, false]);
  const [agreeErr, setAgreeErr] = useState(false);
  const [sigErr, setSigErr] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasSig = useRef(false);

  const up = (k: keyof typeof f, v: string) => setF(p => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/consent/${token}`);
        const j = await r.json();
        if (!r.ok) { setError(j.error === "invalid token" ? "유효하지 않은 링크입니다." : (j.error || "불러오기 실패")); setLoading(false); return; }
        const c = j.consent || {};
        if (c.status === "submitted") { setDone(true); setLoading(false); return; }
        setF(p => ({ ...p, pname: c.applicant_name || "", phone: c.phone || "", email: c.email || "", child: c.child || "", room: c.room || "", month: c.month || "", insta: c.insta || "", blog: c.blog || "", sigdate: new Date().toISOString().slice(0, 10) }));
      } catch { setError("불러오기 실패"); }
      setLoading(false);
    })();
  }, [token]);

  useEffect(() => {
    if (loading || done || error) return;
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext("2d"); if (!ctx) return;
    function fit() { const r = c!.getBoundingClientRect(); c!.width = r.width * 2; c!.height = r.height * 2; ctx!.scale(2, 2); ctx!.lineWidth = 2.2; ctx!.lineCap = "round"; ctx!.strokeStyle = "#1E1B16"; }
    fit();
    let drawing = false;
    function pos(e: MouseEvent | TouchEvent) { const r = c!.getBoundingClientRect(); const p = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as MouseEvent); return { x: p.clientX - r.left, y: p.clientY - r.top }; }
    function start(e: MouseEvent | TouchEvent) { drawing = true; hasSig.current = true; const p = pos(e); ctx!.beginPath(); ctx!.moveTo(p.x, p.y); e.preventDefault(); }
    function move(e: MouseEvent | TouchEvent) { if (!drawing) return; const p = pos(e); ctx!.lineTo(p.x, p.y); ctx!.stroke(); e.preventDefault(); }
    function end() { drawing = false; }
    c.addEventListener("mousedown", start); c.addEventListener("mousemove", move); window.addEventListener("mouseup", end);
    c.addEventListener("touchstart", start, { passive: false }); c.addEventListener("touchmove", move, { passive: false }); c.addEventListener("touchend", end);
    return () => { c.removeEventListener("mousedown", start); c.removeEventListener("mousemove", move); window.removeEventListener("mouseup", end); c.removeEventListener("touchstart", start); c.removeEventListener("touchmove", move); c.removeEventListener("touchend", end); };
  }, [loading, done, error]);

  function clearSig() { const c = canvasRef.current; if (!c) return; const ctx = c.getContext("2d"); ctx?.clearRect(0, 0, c.width, c.height); hasSig.current = false; }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const allAgree = agree.every(Boolean);
    setAgreeErr(!allAgree);
    setSigErr(!hasSig.current);
    if (!allAgree || !hasSig.current) return;
    if (!f.pname || !f.phone || !f.child || !f.room || !f.month || !f.insta || !f.signer) { alert("필수 항목(*)을 모두 입력해 주세요."); return; }
    setSubmitting(true);
    const signature = canvasRef.current?.toDataURL("image/png") || "";
    const r = await fetch(`/api/consent/${token}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicant_name: f.pname, phone: f.phone, email: f.email, child: f.child, room: f.room, month: f.month, insta: f.insta, blog: f.blog, signer_name: f.signer, sig_date: f.sigdate || null, agreed_items: AGREE_LABELS, signature, policy_version: POLICY_VERSION }),
    });
    setSubmitting(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { alert("제출 실패: " + (j.error || "")); return; }
    setDone(true); window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#6B6453", fontFamily: "'Noto Sans KR',sans-serif" }}>불러오는 중…</div>;
  if (error) return <div style={{ maxWidth: 520, margin: "60px auto", padding: 24, textAlign: "center", color: "#E8472C", fontFamily: "'Noto Sans KR',sans-serif", fontSize: 15 }}>⚠️ {error}</div>;

  return (<>
    <style>{`
.cf2{--ink:#1E1B16;--sub:#6B6453;--cream:#FFFDF6;--line:#ECE6D8;--yel:#FFCB36;--yel-d:#7A5A00;--red:#E8472C;--red-bg:#FDECE8;--blue:#2E75B6;--teal:#138A63;--card:#FFFFFF;background:#F3EFE4;color:var(--ink);font-family:'Apple SD Gothic Neo','Malgun Gothic','Noto Sans KR',sans-serif;line-height:1.7;min-height:100vh}
.cf2 .wrap{max-width:720px;margin:0 auto;padding:0 0 60px}
.cf2 header{background:var(--cream);padding:32px 28px 28px;border-bottom:4px solid var(--yel)}
.cf2 .brand{font-size:13px;font-weight:700;letter-spacing:.04em}.cf2 .brand span{color:var(--sub);font-weight:400}
.cf2 h1{font-size:25px;margin:14px 0 6px}.cf2 .meta{font-size:14px;color:var(--sub);margin:0}
.cf2 .badge{display:inline-block;background:var(--yel);color:var(--yel-d);font-size:13px;font-weight:700;padding:5px 14px;border-radius:20px;margin-top:14px}
.cf2 section{background:var(--card);margin:16px 14px 0;border:1px solid var(--line);border-radius:14px;padding:22px 24px}
.cf2 h2{font-size:17px;margin:0 0 12px;display:flex;align-items:center;gap:9px}
.cf2 h2 .n{background:var(--blue);color:#fff;font-size:13px;font-weight:700;width:26px;height:26px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.cf2 .art{font-size:15px;margin:0 0 9px}.cf2 ul{margin:6px 0 0;padding-left:20px}.cf2 li{font-size:15px;margin:5px 0}
.cf2 .hl{background:#FFF6D6;padding:1px 4px;border-radius:4px;font-weight:600}
.cf2 .warn{background:var(--red-bg);border-radius:10px;padding:12px 14px;font-size:14px;color:#A32D2D;margin-top:12px}
.cf2 label{display:block;font-size:14px;font-weight:600;margin:14px 0 6px}.cf2 label .req{color:var(--red)}
.cf2 input,.cf2 select,.cf2 textarea{width:100%;padding:11px 13px;border:1px solid #D6D0C2;border-radius:9px;font-size:15px;font-family:inherit;background:#fff;box-sizing:border-box}
.cf2 input:focus,.cf2 select:focus{outline:none;border-color:var(--blue);box-shadow:0 0 0 3px #2e75b622}
.cf2 .row{display:flex;gap:12px;flex-wrap:wrap}.cf2 .row>div{flex:1;min-width:140px}
.cf2 .check{display:flex;gap:11px;align-items:flex-start;background:#FAF8F1;border:1px solid var(--line);border-radius:10px;padding:13px 14px;margin-top:10px;cursor:pointer}
.cf2 .check input{margin-top:3px;width:19px;height:19px;flex:0 0 auto;accent-color:var(--teal)}.cf2 .check span{font-size:14.5px}
.cf2 .sigbox{border:1px dashed #C9C2B2;border-radius:10px;background:#fff;margin-top:8px}
.cf2 canvas{width:100%;height:170px;display:block;border-radius:10px;touch-action:none}
.cf2 .sigtools{display:flex;justify-content:space-between;align-items:center;margin-top:6px}
.cf2 .clear{background:none;border:1px solid #D6D0C2;border-radius:7px;padding:6px 12px;font-size:13px;cursor:pointer;color:var(--sub);font-family:inherit}
.cf2 .submit{display:block;width:calc(100% - 28px);margin:24px 14px 0;background:var(--yel);color:var(--ink);border:none;border-radius:14px;padding:18px;font-size:18px;font-weight:700;cursor:pointer;font-family:inherit}
.cf2 .note{font-size:13px;color:var(--sub);margin:16px 24px 0}
.cf2 .errx{color:var(--red);font-size:13px;margin:6px 0 0}
.cf2 .ok{background:#E4F4EE;border:1px solid #9FE1CB;border-radius:14px;margin:16px 14px 0;padding:26px;text-align:center}
.cf2 .ok h3{margin:0 0 8px;color:var(--teal);font-size:20px}.cf2 .ok p{margin:0;font-size:15px;color:#0C5840}
.cf2 footer{text-align:center;font-size:12px;color:var(--sub);margin-top:26px}
    `}</style>
    <div className="cf2"><div className="wrap">
      <header>
        <div className="brand">DREAM ACADEMY <span>· 세부드림아카데미 가족 영어캠프</span></div>
        <h1>체험단 참가 계약 및 동의서</h1>
        <p className="meta">26년 하반기(9·10·11월) · 4주 과정 · 숙소별 월 1팀 한정</p>
        <span className="badge">선착순 · 전액 입금 시 확정</span>
      </header>

      {done ? (
        <div className="ok"><h3>신청이 제출되었습니다 ✓</h3><p>담당 매니저가 카카오톡 채널로 확정 여부를 안내드릴 예정입니다.<br />감사합니다.</p></div>
      ) : (
      <form onSubmit={submit}>
        <section>
          <h2><span className="n">1</span> 신청자 정보</h2>
          <div className="row">
            <div><label>신청자(보호자) 성함 <span className="req">*</span></label><input value={f.pname} onChange={e => up("pname", e.target.value)} required /></div>
            <div><label>연락처 <span className="req">*</span></label><input type="tel" value={f.phone} onChange={e => up("phone", e.target.value)} placeholder="010-0000-0000" required /></div>
          </div>
          <label>이메일</label><input type="email" value={f.email} onChange={e => up("email", e.target.value)} placeholder="name@email.com" />
          <div className="row">
            <div><label>자녀 성함 / 나이 <span className="req">*</span></label><input value={f.child} onChange={e => up("child", e.target.value)} placeholder="예: 홍길동 / 7세" required /></div>
            <div><label>희망 숙소 <span className="req">*</span></label>
              <select value={f.room} onChange={e => up("room", e.target.value)} required><option value="">선택</option><option>드림하우스</option><option>제이파크</option><option>큐브나인</option><option>상담 후 결정</option></select></div>
          </div>
          <div className="row">
            <div><label>희망 기수(월) <span className="req">*</span></label><select value={f.month} onChange={e => up("month", e.target.value)} required><option value="">선택</option><option>9월</option><option>10월</option><option>11월</option></select></div>
            <div><label>운영 중인 인스타그램 계정 URL <span className="req">*</span></label><input type="url" value={f.insta} onChange={e => up("insta", e.target.value)} placeholder="https://instagram.com/계정" required /></div>
          </div>
          <label>블로그 / 카페 주소</label><input type="url" value={f.blog} onChange={e => up("blog", e.target.value)} placeholder="https://blog.naver.com/..." />
        </section>

        <section><h2><span className="n">2</span> 신청 자격</h2><ul>
          <li>실제로 운영하며 일상 소통이 있어온 인스타그램 계정 (체험단용 새 계정·비공개 계정 불가)</li>
          <li>블로그 또는 네이버 카페에 후기 작성이 가능한 분</li>
          <li>자녀와 함께 4주 일정 참여가 가능한 가족</li></ul></section>

        <section><h2><span className="n">3</span> 콘텐츠 제작·게시 의무</h2>
          <p className="art">선정된 참가자는 아래 콘텐츠를 모두 제작·게시합니다.</p><ul>
          <li>인스타그램 <b>피드 2회 · 릴스 3회 · 스토리 10회</b></li>
          <li>블로그·카페 후기 <b>3회</b> (동일 내용 게시 가능)</li>
          <li>모든 게시물에 <span className="hl">@세부드림아카데미 태그 + 지정 해시태그 + #광고 #협찬</span> 표기 필수</li>
          <li>게시 기한: 스토리는 연수 중 실시간, 그 외는 <b>귀국 후 2주 이내</b></li>
          <li>게시물은 <b>최소 3개월간</b> 삭제·비공개 금지</li>
          <li>게시 완료 후 링크와 조회수(인사이트) 캡처를 제출</li></ul></section>

        <section><h2><span className="n">4</span> 사진·영상 활용 동의</h2><ul>
          <li>세부드림아카데미는 <b>해당 학생(자녀)의 사진·영상</b>으로 공식 인스타그램 등 채널에 <b>홍보 게시물을 제작·게시</b>할 수 있습니다.</li>
          <li>위 홍보 게시물을 <b>최대 2년간 유지(노출)</b>할 수 있으며, 이에 대한 별도 대가는 없습니다(무상).</li>
          <li>참가자가 제작한 후기 콘텐츠를 아카데미가 <b>재게시·편집해 광고 등에 2차 활용</b>할 수 있습니다.</li>
          <li>자녀가 미성년자이므로 <b>법정대리인(부모)의 서명</b>으로 위 사용에 동의합니다.</li></ul></section>

        <section><h2><span className="n">5</span> 비용 · 예약</h2><ul>
          <li>SSP(7,000페소)·교재비·보증금·전기세 등 <b>현지 추가비는 본인 부담</b>입니다.</li>
          <li><b>전액 입금 시 예약이 확정</b>되며, 입금 순으로 선착순 마감됩니다.</li></ul></section>

        <section><h2><span className="n">6</span> 취소 · 환불 / 차액 환수</h2><ul>
          <li>체험단은 <b>전액 환불이 불가</b>합니다. (질병·천재지변 등 불가항력은 예외로 협의)</li>
          <li>콘텐츠 미이행·기한 초과·중도 삭제 시 <b>정가와 체험가의 차액을 환수</b>합니다.</li>
          <li>체험 기간 중 <b>타 캠프·브랜드와의 동시 협찬·참여를 제한</b>합니다.</li></ul>
          <div className="warn">예: 드림하우스 2인 체험가 350만원(정가 628만원) 참가 후 콘텐츠 미이행 시, 차액 278만원이 환수될 수 있습니다.</div></section>

        <section><h2><span className="n">7</span> 개인정보 수집 · 이용</h2>
          <p className="art">신청자·자녀의 성함, 연락처, SNS 계정 등은 체험단 운영·정산·콘텐츠 관리 목적으로 수집·이용되며, 목적 달성 후 관련 법령에 따라 파기됩니다.</p></section>

        <section><h2><span className="n">8</span> 동의 확인</h2>
          <p className="art">아래 항목에 모두 동의하셔야 신청이 완료됩니다.</p>
          {AGREE_LABELS.map((lab, i) => (
            <label key={i} className="check"><input type="checkbox" checked={agree[i]} onChange={e => setAgree(a => a.map((x, j) => j === i ? e.target.checked : x))} /><span>{lab.replace(/^\[필수\]\s*/, "")}</span></label>
          ))}
          {agreeErr && <p className="errx">모든 필수 항목에 동의해 주세요.</p>}</section>

        <section><h2><span className="n">9</span> 법정대리인(부모) 서명</h2>
          <div className="row">
            <div><label>서명자(부모) 성함 <span className="req">*</span></label><input value={f.signer} onChange={e => up("signer", e.target.value)} required /></div>
            <div><label>동의 일자</label><input type="date" value={f.sigdate} onChange={e => up("sigdate", e.target.value)} /></div>
          </div>
          <label>서명 <span className="req">*</span></label>
          <div className="sigbox"><canvas ref={canvasRef} /></div>
          <div className="sigtools"><span style={{ fontSize: 13, color: "#6B6453" }}>위 칸에 손가락 또는 마우스로 서명해 주세요</span><button type="button" className="clear" onClick={clearSig}>지우기</button></div>
          {sigErr && <p className="errx">서명을 입력해 주세요.</p>}</section>

        <button type="submit" className="submit" disabled={submitting}>{submitting ? "제출 중…" : "동의하고 신청 제출하기"}</button>
        <p className="note">제출 후 담당 매니저가 1~2일 내 확정 여부를 안내드립니다. 신청은 선착순이며 전액 입금 시 확정·마감됩니다.</p>
      </form>
      )}
      <footer>© 2026 Cebu Dream Academy · 카카오톡 @세부드림아카데미</footer>
    </div></div>
  </>);
}
