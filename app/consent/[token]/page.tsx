"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

// ※ 실제 약관 문구로 교체하세요 (메이 제공 예정)
const CONSENT_TITLE = "체험단 참여 동의서";
const CONSENT_TERMS: { h: string; b: string }[] = [
  { h: "1. 체험단 참여 안내", b: "본 동의서는 드림아카데미 체험단 프로그램 참여에 관한 동의서입니다. (※ 실제 안내 문구로 교체 예정)" },
  { h: "2. 촬영·사진 활용 동의", b: "체험 기간 중 촬영된 사진·영상이 드림아카데미 홍보(SNS, 블로그, 웹사이트 등)에 활용될 수 있음에 동의합니다. (※ 교체 예정)" },
  { h: "3. 후기 작성", b: "체험 후 정해진 기간 내 후기를 작성·게시하는 것에 동의합니다. (※ 교체 예정)" },
  { h: "4. 개인정보 처리", b: "참여 진행 및 연락을 위해 제공한 개인정보가 목적 범위 내에서 처리됨에 동의합니다. (※ 교체 예정)" },
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
