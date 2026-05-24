"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Session { booking_id: string; booking_number: string; guest_name: string; expires: number }

const TOURS = [
  "H-Mart 쇼핑",
  "SM 씨사이드 쇼핑",
  "막탄 쉬라인",
  "파롤라 (Parola)",
  "세부 사파리",
  "펀파크 (Fun Park)",
  "란타우 (Lantaw)",
  "안조 월드 (Anjo World)",
  "일콜소 (Il Corso)",
];

export default function PortalShuttlePage() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [form, setForm] = useState({ tour_name: TOURS[0], date: "", num_people: 1, notes: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("portalSession");
      if (!raw) { router.replace("/portal"); return; }
      const s: Session = JSON.parse(raw);
      if (!s.booking_id || s.expires < Date.now()) {
        localStorage.removeItem("portalSession");
        router.replace("/portal");
        return;
      }
      setSession(s);
    } catch { router.replace("/portal"); }
  }, [router]);

  async function submit() {
    if (!session) return;
    if (!form.date) { setMsg("날짜를 선택해주세요."); return; }
    if (!form.tour_name) { setMsg("투어를 선택해주세요."); return; }
    if (!form.num_people || form.num_people < 1) { setMsg("인원을 입력해주세요."); return; }

    setSaving(true); setMsg("");
    const { error } = await supabase.from("shuttle_applications").insert({
      booking_id: session.booking_id,
      portal_name: session.guest_name,
      tour_name: form.tour_name,
      date: form.date,
      num_people: form.num_people,
      notes: form.notes || null,
      status: "pending",
    });
    setSaving(false);
    if (error) { setMsg(error.message || "신청 실패"); return; }
    router.push("/portal/dashboard");
  }

  if (!session) return null;

  return (<>
    <style>{`
.sh-w{max-width:640px;margin:0 auto;padding:24px 24px 40px;font-family:'Noto Sans KR',sans-serif;color:#1a1a2e}
.sh-back{display:inline-flex;align-items:center;gap:4px;background:none;border:none;font-size:13px;color:#6b7c93;cursor:pointer;font-family:inherit;font-weight:600;margin-bottom:12px}.sh-back:hover{color:#1a6fc4}
.sh-head{background:linear-gradient(135deg,#1a6fc4,#7c3aed);border-radius:16px;padding:20px;color:#fff;margin-bottom:12px}
.sh-head h1{font-size:18px;font-weight:800;margin-bottom:2px}
.sh-head p{font-size:12px;opacity:0.8}
.sec{background:#fff;border-radius:12px;padding:18px;box-shadow:0 1px 8px rgba(0,0,0,0.04);margin-bottom:10px}
.sec h2{font-size:14px;font-weight:800;color:#1a6fc4;margin-bottom:14px;padding-bottom:6px;border-bottom:1px solid #e2e8f0}
.lbl{display:block;font-size:12px;font-weight:700;color:#475569;margin-bottom:6px}
.inp,.sel,.area{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:9px;font-size:14px;font-family:inherit;outline:none;margin-bottom:12px;background:#fff;box-sizing:border-box}.inp:focus,.sel:focus,.area:focus{border-color:#1a6fc4}
.area{resize:vertical;min-height:80px}
.btn{width:100%;padding:14px;background:linear-gradient(135deg,#1a6fc4,#7c3aed);color:#fff;font-size:15px;font-weight:700;border:none;border-radius:12px;cursor:pointer;font-family:inherit;margin-top:4px}.btn:hover{opacity:0.9}.btn:disabled{opacity:0.5;cursor:not-allowed}
.msg{margin-top:10px;padding:10px 14px;border-radius:10px;font-size:13px;font-weight:600;text-align:center;background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
    `}</style>
    <div className="sh-w">
      <button className="sh-back" onClick={() => router.push("/portal/dashboard")}>← 대시보드로</button>
      <div className="sh-head">
        <h1>🚌 투어 셔틀 신청</h1>
        <p>{session.guest_name}님 · 드림아카데미 무료 투어 셔틀</p>
      </div>

      <div className="sec">
        <h2>셔틀 신청하기</h2>
        <label className="lbl">투어 선택</label>
        <select className="sel" value={form.tour_name} onChange={e => setForm({ ...form, tour_name: e.target.value })}>
          {TOURS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <label className="lbl">날짜</label>
        <input className="inp" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />

        <label className="lbl">인원수</label>
        <input className="inp" type="number" min={1} max={12} value={form.num_people} onChange={e => setForm({ ...form, num_people: parseInt(e.target.value) || 1 })} />

        <label className="lbl">요청사항</label>
        <textarea className="area" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="예: 유아 카시트 필요, 픽업 위치 등" />

        <button className="btn" onClick={submit} disabled={saving}>{saving ? "신청 중..." : "셔틀 신청하기"}</button>
        {msg && <div className="msg">{msg}</div>}
      </div>
    </div>
  </>);
}
