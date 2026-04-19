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
}

const TUTOR_ACCOUNTS: Account[] = [
  { userId: "admin-ann",     displayLabel: "T.Ann",     sessionName: "T.Ann",     color: TUTOR_COLORS["T.Ann"],     staffId: "admin-ann" },
  { userId: "admin-angel",   displayLabel: "T.Angel",   sessionName: "T.Angel",   color: TUTOR_COLORS["T.Angel"],   staffId: "admin-angel" },
  { userId: "admin-carla",   displayLabel: "T.Carla",   sessionName: "T.Carla",   color: TUTOR_COLORS["T.Carla"],   staffId: "admin-carla" },
  { userId: "admin-amelyn",  displayLabel: "T.Amelyn",  sessionName: "T.Amelyn",  color: TUTOR_COLORS["T.Amelyn"],  staffId: "admin-amelyn" },
  { userId: "admin-cristel", displayLabel: "T.Cristel", sessionName: "T.Cristel", color: TUTOR_COLORS["T.Cristel"], staffId: "admin-cristel" },
];

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

  function submit() {
    if (!selected || submitting) return;
    setSubmitting(true);
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center px-4 py-10 font-sans">
      <div className="w-full max-w-5xl">
        <header className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">Dream Academy</h1>
          <p className="text-sm sm:text-base text-slate-500 mt-2">Online Class Portal</p>
        </header>

        <p className="text-center text-slate-600 text-sm sm:text-base mb-6">Select your account to sign in</p>

        {/* Tutors */}
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Tutors</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
          {TUTOR_ACCOUNTS.map(a => (
            <button
              key={a.userId}
              type="button"
              onClick={() => setSelected(a)}
              aria-label={`Sign in as ${a.displayLabel}`}
              className="aspect-square rounded-2xl shadow-md text-white font-bold text-lg sm:text-xl flex items-center justify-center transition-transform duration-150 hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-slate-400"
              style={{ backgroundColor: a.color }}
            >
              {a.displayLabel}
            </button>
          ))}
        </div>

        <div className="border-t border-slate-200 my-6"></div>

        {/* Administrators */}
        <div className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Administrators</div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {ADMIN_ACCOUNTS.map(a => (
            <button
              key={a.userId}
              type="button"
              onClick={() => setSelected(a)}
              aria-label={`Sign in as ${a.displayLabel}`}
              className="aspect-square sm:aspect-[2/1] rounded-2xl shadow-md text-white font-bold flex flex-col items-center justify-center gap-1 transition-transform duration-150 hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-slate-400"
              style={{ backgroundColor: a.color }}
            >
              <span className="text-xl sm:text-2xl">{a.displayLabel}</span>
              {a.badge && (
                <span className="text-[10px] font-bold bg-white/25 rounded px-2 py-0.5 tracking-wider">{a.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Password modal */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-label={`Password for ${selected.displayLabel}`}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-6 py-5 text-white" style={{ backgroundColor: selected.color }}>
              <div className="text-xs uppercase tracking-wider opacity-80">Sign in as</div>
              <div className="text-2xl font-bold mt-1">{selected.displayLabel}</div>
            </div>
            <div className="p-6">
              <input
                ref={inputRef}
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(""); }}
                onKeyDown={e => { if (e.key === "Enter") submit(); }}
                autoFocus
                autoComplete="current-password"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg text-base outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
              {error && (
                <div className="mt-3 text-sm text-red-600" role="alert">{error}</div>
              )}
              <div className="flex gap-2 mt-5">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 py-3 rounded-lg border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-lg text-white font-semibold disabled:opacity-60"
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
  );
}
