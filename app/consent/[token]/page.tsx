"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

const CONSENT_TITLE = "드림아카데미 체험단 참여 동의서 (보호자용)";
const CONSENT_TERMS: { h: string; b: string }[] = [
  { h: "1. 체험단 안내", b: "본 동의서는 드림아카데미(필리핀 세부 영어캠프) 체험단 프로그램 참여에 관한 보호자 동의서입니다. 체험단은 프로그램을 체험가(할인·혜택)로 참여하는 대신, 후기 작성과 홍보 콘텐츠 활용에 협조하는 프로그램입니다." },
  { h: "2. 촬영 및 콘텐츠 활용 동의 (사진·영상)", b: "체험 기간 중 자녀 및 보호자의 활동 사진·영상이 촬영될 수 있으며, 이를 드림아카데미의 홍보 목적(공식 SNS·블로그·카페·홈페이지·광고 등)으로 활용하는 것에 동의합니다." },
  { h: "3. 후기 작성 협조", b: "체험 종료 후 안내된 기간 내에 솔직한 후기를 블로그·SNS 등에 작성·게시하는 것에 협조합니다. 게시물에는 안내된 필수 정보(지정 해시태그 등)를 포함합니다." },
  { h: "4. 개인정보 수집·이용 동의", b: "체험단 운영·연락·일정 안내를 위해 보호자 성함, 연락처 등 개인정보를 수집·이용하는 것에 동의합니다. 수집된 정보는 목적 달성 후 관련 법령에 따라 보관 후 파기됩니다." },
  { h: "5. 초상권 및 게시물 사용", b: "체험단으로 게시한 후기·사진·영상에 대해 드림아카데미가 홍보 목적으로 재게시·공유·편집하여 활용할 수 있음에 동의합니다." },
  { h: "6. 유의사항 및 동의 확인", b: "체험단 혜택은 위 협조사항 이행을 전제로 제공됩니다. 부득이하게 협조가 어려운 경우 사전에 담당자에게 알려 주세요. 본인은 위 내용을 충분히 읽고 이해하였으며, 미성년 자녀의 보호자로서 이에 동의합니다." },
];

interface ConsentData { recipient_name: string | null; title: string | null; terms_version: string | null; agreed: boolean; signature_name: string | null; submitted_at: string | null; }

export default function ConsentPage() {
  const params = useParams();
  const token = params.token as string;
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConsentData | null>(null);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/consent/${token}`);
        const j = await r.json();
        if (!r.ok) { setError(j.error || "유효하지 않은 링크입니다."); setLoading(false); return; }
        setData(j.consent);
        if (j.consent?.submitted_at) { setDone(true); setName(j.consent.signature_name || ""); }
      } catch { setError("불러오기 실패"); }
      setLoading(false);
    })();
  }, [token]);

  async function submit() {
    if (!agreed) { alert("약관에 동의해 주세요."); return; }
    if (!name.trim()) { alert("성함을 입력해 주세요. (서명)"); return; }
    setSubmitting(true);
    const r = await fetch(`/api/consent/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agreed: true, signature_name: name.trim() }) });
    setSubmitting(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { alert("제출 실패: " + (j.error || "")); return; }
    setDone(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "#94a3b8", fontFamily: "'Noto Sans KR',sans-serif" }}>불러오는 중…</div>;
  if (error) return <div style={{ maxWidth: 520, margin: "60px auto", padding: 24, textAlign: "center", color: "#dc2626", fontFamily: "'Noto Sans KR',sans-serif", fontSize: 15 }}>⚠️ {error}</div>;

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 60px", fontFamily: "'Noto Sans KR',sans-serif", color: "#1a1a2e", lineHeight: 1.6 }}>
      <div style={{ textAlign: "center", padding: "20px 0 24px", borderBottom: "2px solid #e2e8f0", marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#1a6fc4", letterSpacing: ".05em", marginBottom: 4 }}>DREAM ACADEMY</div>
        <h1 style={{ fontSize: 22, fontWeight: 800 }}>{data?.title || CONSENT_TITLE}</h1>
        {data?.recipient_name && <div style={{ fontSize: 13, color: "#6b7c93", marginTop: 8 }}>{data.recipient_name} 님</div>}
      </div>

      {done ? (
        <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 14, padding: 28, textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#047857", marginBottom: 6 }}>✅ 동의서가 제출되었습니다</div>
          <div style={{ fontSize: 13.5, color: "#15803d" }}>감사합니다! 서명: <b>{name}</b></div>
        </div>
      ) : (<>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 22, marginBottom: 16 }}>
          {CONSENT_TERMS.map((t, i) => (
            <div key={i} style={{ marginBottom: i === CONSENT_TERMS.length - 1 ? 0 : 16 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 5 }}>{t.h}</div>
              <div style={{ fontSize: 13.5, color: "#475569", whiteSpace: "pre-wrap" }}>{t.b}</div>
            </div>
          ))}
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 10, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, padding: "14px 16px", marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)} style={{ width: 20, height: 20, flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 700, color: "#1e40af" }}>위 내용을 모두 확인하였으며 이에 동의합니다.</span>
        </label>

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>서명 (성함을 입력해 주세요)</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 홍길동" style={{ width: "100%", padding: "12px 14px", border: "1px solid #cbd5e1", borderRadius: 10, fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
        </div>

        <button onClick={submit} disabled={submitting} style={{ width: "100%", padding: "14px", background: submitting ? "#94a3b8" : "#1a6fc4", color: "#fff", border: "none", borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: submitting ? "not-allowed" : "pointer", fontFamily: "inherit" }}>
          {submitting ? "제출 중…" : "동의하고 제출하기"}
        </button>
      </>)}
    </div>
  );
}
