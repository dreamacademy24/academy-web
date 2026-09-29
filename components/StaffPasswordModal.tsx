"use client";
import { useState } from "react";

// 직원 본인 비밀번호 변경 (DB 저장, /api/staff/password) — 현지직원용 영어 + 한글 병기
export default function StaffPasswordModal({ force, onClose, onDone }: { force?: boolean; onClose: () => void; onDone?: () => void }) {
  const [cur, setCur] = useState(""); const [nx, setNx] = useState(""); const [nx2, setNx2] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false); const [ok, setOk] = useState(false);
  const go = async () => {
    setErr("");
    if (nx.length < 4) return setErr("New password must be at least 4 characters.");
    if (nx !== nx2) return setErr("New passwords do not match.");
    setBusy(true);
    try {
      const r = await fetch("/api/staff/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ current: cur, next: nx }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Could not change password.");
      setOk(true); onDone?.();
      setTimeout(onClose, 1500);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const inp: React.CSSProperties = { width: "100%", padding: "11px 12px", borderRadius: 9, border: "1px solid #cbd5e1", fontSize: 14, boxSizing: "border-box", marginTop: 8 };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#fff", borderRadius: 14, padding: "24px 22px", width: 360, maxWidth: "100%", fontFamily: "inherit" }}>
        <div style={{ fontSize: 17, fontWeight: 800 }}>🔑 Change Password</div>
        {force && <div style={{ fontSize: 12.5, color: "#b45309", marginTop: 6, lineHeight: 1.5 }}>Welcome! Please change your temporary password to your own password now.</div>}
        {ok ? <div style={{ marginTop: 16, color: "#16a34a", fontWeight: 700 }}>✓ Password changed and saved. Use your new password next time.</div> : <>
          <input type="password" value={cur} onChange={e => setCur(e.target.value)} placeholder="Current password" style={inp} />
          <input type="password" value={nx} onChange={e => setNx(e.target.value)} placeholder="New password (4+ characters)" style={inp} />
          <input type="password" value={nx2} onChange={e => setNx2(e.target.value)} placeholder="Confirm new password" style={inp} onKeyDown={e => { if (e.key === "Enter") go(); }} />
          {err && <div style={{ color: "#dc2626", fontSize: 12.5, marginTop: 8 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            {!force && <button onClick={onClose} style={{ flex: 1, padding: 10, borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", cursor: "pointer" }}>Cancel</button>}
            <button disabled={busy} onClick={go} style={{ flex: 2, padding: 10, borderRadius: 8, border: "none", background: "#2563eb", color: "#fff", fontWeight: 700, cursor: "pointer" }}>{busy ? "Saving…" : "Change Password"}</button>
          </div>
        </>}
      </div>
    </div>
  );
}
