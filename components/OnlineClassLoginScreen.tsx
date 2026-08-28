"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { validateOnlineClassLogin, setAdminAuthed } from "@/lib/adminAuth";
import { TUTOR_COLORS } from "@/lib/tutorColors";

interface Account {
  userId: string;
  displayLabel: string;  // shown on the card and modal header
  sessionName: string;   // stored via setAdminAuthed; must match /login/page.tsx
  color: string;
  staffId: string;
  badge?: string;
  isTutor?: boolean;
}

const ADMIN_ACCOUNTS: Account[] = [
  { userId: "admin-may", displayLabel: "May",   sessionName: "May", color: "#A855F7", staffId: "may", badge: "CEO" },
  { userId: "admin-ceo", displayLabel: "Admin", sessionName: "CEO", color: "#1F2937", staffId: "ceo", badge: "CEO" },
];

interface Props {
  /** Called after a successful admin (May/CEO) login so the parent can
   *  flip its local state to 'authed' without a page refresh. Tutors
   *  are routed to /tutor/online-class directly, bypassing this callback. */
  onAuthenticated?: () => void;
}

export default function OnlineClassLoginScreen({ onAuthenticated }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Account | null>(null);
  const [tutorAccounts, setTutorAccounts] = useState<Account[]>([]);
  useEffect(() => {
    fetch("/api/online-class/tutors").then(r => r.ok ? r.json() : { tutors: [] }).then(d => {
      const accts: Account[] = (d.tutors || []).map((t: any) => ({
        userId: t.staff_user_id || t.id,
        displayLabel: t.name_display,
        sessionName: t.name_display,
        color: TUTOR_COLORS[t.name_display] || "#94a3b8",
        staffId: t.staff_user_id || "",
        isTutor: true,
      }));
      setTutorAccounts(accts);
    }).catch(() => {});
  }, []);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset modal state and focus the input when a new card is selected
  useEffect(() => {
    if (!selected) return;
    setPassword("");
    setError("");
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [selected]);

  // ESC closes modal
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  function closeModal() {
    setSelected(null);
    setPassword("");
    setError("");
    setSubmitting(false);
  }

  async function submit() {
    if (!selected || submitting) return;
    setSubmitting(true);
    // 현지 티쳐: staff_accounts(DB) 인증 → staffId(=staff_user_id)로 저장하면 티쳐 화면이 본인 수강생을 찾음
    if (selected.isTutor) {
      try {
        const r = await fetch("/api/admineng/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: selected.staffId, password }) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.success) {
          setError("Incorrect password. Please try again.");
          setPassword(""); setSubmitting(false);
          setTimeout(() => inputRef.current?.focus(), 0);
          return;
        }
        setAdminAuthed(selected.staffId, { role: "tutor", name: selected.sessionName, staffId: selected.staffId });
        router.push("/tutor/online-class");
      } catch {
        setError("Login failed. Please try again."); setSubmitting(false);
      }
      return;
    }
    // 관리자(May/CEO): 기존 방식
    const res = validateOnlineClassLogin(selected.userId, password);
    if (!res || !res.success) {
      setError("Incorrect password. Please try again.");
      setPassword("");
      setSubmitting(false);
      setTimeout(() => inputRef.current?.focus(), 0);
      return;
    }
    setAdminAuthed(res.userId, {
      role: res.role,
      name: selected.sessionName,
      staffId: selected.staffId,
    });
    if (res.role === "tutor") {
      router.push("/tutor/online-class");
    } else {
      onAuthenticated?.();
    }
  }

  return (<>
    <style>{`
.ocl-wrap{min-height:100vh;background:#f1f5f9;font-family:'Noto Sans KR',system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1a1a2e;padding:40px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.ocl-inner{width:100%;max-width:1040px;box-sizing:border-box}
.ocl-head{text-align:center;margin-bottom:28px}
.ocl-head h1{font-size:28px;font-weight:800;color:#1a1a2e;letter-spacing:-0.02em;margin:0}
.ocl-head .sub{font-size:14px;color:#6b7c93;margin-top:6px}
.ocl-intro{text-align:center;color:#475569;font-size:14px;margin:0 0 20px}
.ocl-section-label{font-size:12px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 10px}
.ocl-card-grid{display:grid;gap:12px;box-sizing:border-box}
.ocl-card-grid.tutors{grid-template-columns:repeat(2,1fr)}
.ocl-card-grid.admins{grid-template-columns:repeat(2,1fr);max-width:520px;margin:0 auto}
.ocl-card{position:relative;aspect-ratio:1/1;border-radius:16px;border:none;color:#fff;font-family:inherit;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.1);transition:transform .15s ease,box-shadow .15s ease;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px;text-align:center;box-sizing:border-box}
.ocl-card:hover{transform:translateY(-2px);box-shadow:0 6px 16px rgba(0,0,0,0.18)}
.ocl-card:focus{outline:none}
.ocl-card:focus-visible{outline:none;box-shadow:0 0 0 3px #94a3b8,0 6px 16px rgba(0,0,0,0.18)}
.ocl-card-label{font-size:18px;font-weight:800;line-height:1.2}
.ocl-card-badge{display:inline-block;font-size:10px;font-weight:700;letter-spacing:0.08em;background:rgba(255,255,255,0.25);color:#fff;border-radius:4px;padding:3px 8px;margin-top:2px}
.ocl-divider{border:none;border-top:1px solid #e2e8f0;margin:24px 0}
.ocl-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;padding:16px;z-index:1000}
.ocl-modal{background:#fff;border-radius:16px;box-shadow:0 20px 50px rgba(0,0,0,0.25);width:100%;max-width:360px;overflow:hidden;box-sizing:border-box}
.ocl-modal-header{padding:20px 24px;color:#fff}
.ocl-modal-header-sub{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.85}
.ocl-modal-header-name{font-size:22px;font-weight:800;margin-top:4px}
.ocl-modal-body{padding:22px 24px 24px}
.ocl-input{width:100%;padding:12px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:15px;font-family:inherit;outline:none;color:#1a1a2e;background:#fff;transition:border-color .15s,box-shadow .15s;box-sizing:border-box}
.ocl-input:focus{border-color:#1a6fc4;box-shadow:0 0 0 3px rgba(26,111,196,0.15)}
.ocl-error{margin-top:10px;color:#dc2626;font-size:14px;font-weight:600}
.ocl-btn-row{display:flex;gap:8px;margin-top:18px}
.ocl-btn{flex:1;padding:12px;border-radius:8px;font-size:14px;font-weight:700;font-family:inherit;cursor:pointer;transition:background .15s,opacity .15s;border:1px solid transparent;box-sizing:border-box}
.ocl-btn-cancel{background:#fff;color:#475569;border-color:#e2e8f0}
.ocl-btn-cancel:hover{background:#f8fafc}
.ocl-btn-submit{color:#fff;border:none}
.ocl-btn-submit:disabled{opacity:0.6;cursor:not-allowed}
@media (min-width:640px){
  .ocl-card-grid{gap:16px}
  .ocl-card-grid.tutors{grid-template-columns:repeat(3,1fr)}
  .ocl-card-label{font-size:20px}
}
@media (min-width:768px){
  .ocl-card-grid.tutors{grid-template-columns:repeat(5,1fr)}
  .ocl-head h1{font-size:34px}
}
    `}</style>
    <div className="ocl-wrap">
      <div className="ocl-inner">
        <header className="ocl-head">
          <h1>Dream Academy</h1>
          <div className="sub">Online Class Portal</div>
        </header>

        <p className="ocl-intro">Select your account to sign in</p>

        {/* Tutors */}
        <div className="ocl-section-label">Tutors</div>
        <div className="ocl-card-grid tutors">
          {tutorAccounts.map(a => (
            <button
              key={a.userId}
              type="button"
              onClick={() => setSelected(a)}
              aria-label={`Sign in as ${a.displayLabel}`}
              className="ocl-card"
              style={{ backgroundColor: a.color }}
            >
              <span className="ocl-card-label">{a.displayLabel}</span>
            </button>
          ))}
        </div>

        <hr className="ocl-divider" />

        {/* Administrators */}
        <div className="ocl-section-label">Administrators</div>
        <div className="ocl-card-grid admins">
          {ADMIN_ACCOUNTS.map(a => (
            <button
              key={a.userId}
              type="button"
              onClick={() => setSelected(a)}
              aria-label={`Sign in as ${a.displayLabel}`}
              className="ocl-card"
              style={{ backgroundColor: a.color }}
            >
              <span className="ocl-card-label">{a.displayLabel}</span>
              {a.badge && <span className="ocl-card-badge">{a.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      {/* Password modal */}
      {selected && (
        <div
          className="ocl-modal-backdrop"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-label={`Password for ${selected.displayLabel}`}
        >
          <div className="ocl-modal" onClick={e => e.stopPropagation()}>
            <div className="ocl-modal-header" style={{ backgroundColor: selected.color }}>
              <div className="ocl-modal-header-sub">Sign in as</div>
              <div className="ocl-modal-header-name">{selected.displayLabel}</div>
            </div>
            <div className="ocl-modal-body">
              <input
                ref={inputRef}
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") submit(); }}
                autoFocus
                autoComplete="current-password"
                className="ocl-input"
              />
              {error && (
                <div className="ocl-error" role="alert">{error}</div>
              )}
              <div className="ocl-btn-row">
                <button
                  type="button"
                  onClick={closeModal}
                  className="ocl-btn ocl-btn-cancel"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="ocl-btn ocl-btn-submit"
                  style={{ backgroundColor: selected.color }}
                >
                  {submitting ? "Signing in…" : "Sign In"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  </>);
}
