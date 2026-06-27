"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";
import { supabase } from "@/lib/supabase";

interface Row { id: string; public_token: string; booking_id: string | null; recipient_name: string; title: string; agreed: boolean; signature_name: string | null; submitted_at: string | null; created_at: string; }
interface Bk { id: string; booker_name: string | null; reservation_no: string | null; }

export default function ConsentsAdminPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [bookings, setBookings] = useState<Bk[]>([]);
  const [name, setName] = useState("");
  const [bid, setBid] = useState("");
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/consents");
    const j = await r.json();
    setRows(j.rows || []);
  }, []);

  useEffect(() => {
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    setReady(true);
    load();
    supabase.from("bookings").select("id, booker_name, reservation_no").order("created_at", { ascending: false }).limit(500).then(({ data }) => setBookings((data || []) as Bk[]));
  }, [load]);

  function flash(m: string) { setToast(m); setTimeout(() => setToast(""), 2500); }

  async function create() {
    const nm = name.trim();
    if (!nm) { flash("받는 사람 이름을 입력해 주세요."); return; }
    setCreating(true);
    const info = getAdminInfo();
    const r = await fetch("/api/admin/consents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recipient_name: nm, booking_id: bid || null, created_by: info?.name || "" }) });
    setCreating(false);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { flash("생성 실패: " + (j.error || "")); return; }
    setName(""); setBid("");
    flash("동의서 생성됨 — 링크를 복사해 보내세요.");
    load();
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/consent/${token}`;
    navigator.clipboard.writeText(url).then(() => flash("링크 복사됨: " + url)).catch(() => flash(url));
  }

  async function del(id: string) {
    if (!window.confirm("이 동의서를 삭제할까요?")) return;
    await fetch(`/api/admin/consents?id=${id}`, { method: "DELETE" });
    load();
  }

  if (!ready) return null;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 18px 60px", fontFamily: "'Noto Sans KR',sans-serif", color: "#1a1a2e" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <button onClick={() => router.push("/admin/hub")} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "7px 12px", cursor: "pointer", fontWeight: 600 }}>← 관리자 홈</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, flex: 1 }}>📝 동의서함</h1>
      </div>
      <p style={{ fontSize: 13, color: "#6b7c93", marginBottom: 16 }}>건별로 생성 → 1:1 전용 링크를 해당 손님에게만 보내세요. 공개 목록은 만들지 않습니다.</p>

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: 16, marginBottom: 18, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 180px" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>받는 사람 이름</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="예: 홍길동" style={{ width: "100%", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }} />
        </div>
        <div style={{ flex: "1 1 220px" }}>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>예약 연결 (선택)</div>
          <select value={bid} onChange={e => { setBid(e.target.value); const b = bookings.find(x => x.id === e.target.value); if (b && !name.trim()) setName(b.booker_name || ""); }} style={{ width: "100%", padding: "9px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" }}>
            <option value="">연결 안 함</option>
            {bookings.map(b => <option key={b.id} value={b.id}>{b.booker_name || "(이름없음)"} · {b.reservation_no || ""}</option>)}
          </select>
        </div>
        <button onClick={create} disabled={creating} style={{ padding: "10px 18px", background: creating ? "#94a3b8" : "#1a6fc4", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", height: 38 }}>{creating ? "생성 중…" : "+ 동의서 생성"}</button>
      </div>

      {toast && <div style={{ background: "#1e293b", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 12.5, marginBottom: 12, wordBreak: "break-all" }}>{toast}</div>}

      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 0.8fr 0.9fr 1.4fr", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 12, fontWeight: 700, color: "#64748b" }}>
          <span>받는 사람</span><span>상태</span><span>제출일</span><span>관리</span>
        </div>
        {rows.length === 0 ? <div style={{ padding: 30, textAlign: "center", color: "#cbd5e1", fontSize: 13 }}>아직 생성된 동의서가 없습니다.</div> :
          rows.map(r => (
            <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1.3fr 0.8fr 0.9fr 1.4fr", padding: "11px 14px", borderBottom: "1px solid #f8fafc", alignItems: "center", fontSize: 13 }}>
              <span style={{ fontWeight: 600 }}>{r.recipient_name}{r.signature_name && r.signature_name !== r.recipient_name ? <span style={{ color: "#94a3b8", fontSize: 11 }}> (서명: {r.signature_name})</span> : null}</span>
              <span>{r.submitted_at ? <span style={{ background: "#dcfce7", color: "#15803d", fontSize: 11, fontWeight: 800, padding: "2px 9px", borderRadius: 10 }}>제출됨</span> : <span style={{ background: "#fef3c7", color: "#b45309", fontSize: 11, fontWeight: 800, padding: "2px 9px", borderRadius: 10 }}>대기</span>}</span>
              <span style={{ fontSize: 11.5, color: "#94a3b8" }}>{r.submitted_at ? r.submitted_at.slice(0, 10) : "-"}</span>
              <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => copyLink(r.public_token)} style={{ fontSize: 11.5, padding: "5px 9px", background: "#eff6ff", color: "#1a6fc4", border: "1px solid #bfdbfe", borderRadius: 6, cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}>🔗 링크 복사</button>
                <button onClick={() => window.open(`/consent/${r.public_token}`, "_blank")} style={{ fontSize: 11.5, padding: "5px 9px", background: "#fff", color: "#475569", border: "1px solid #e2e8f0", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>보기</button>
                <button onClick={() => del(r.id)} style={{ fontSize: 11.5, padding: "5px 9px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>삭제</button>
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}
