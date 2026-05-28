"use client";
import { useState, useEffect, FormEvent } from "react";

type Staff = {
  username: string;
  name: string;
  role: string;
  color: string;
  initial: string;
};

export default function TeacherHubPage() {
  const [staff, setStaff] = useState<Staff | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("teacherSession");
      if (raw) setStaff(JSON.parse(raw));
    } catch {}
  }, []);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (!username.trim() || !password.trim()) {
      setErr("Please enter both username and password.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admineng/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErr(data.message || "Login failed.");
        setLoading(false);
        return;
      }
      localStorage.setItem("teacherSession", JSON.stringify(data.staff));
      setStaff(data.staff);
      setPassword("");
    } catch {
      setErr("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("teacherSession");
    setStaff(null);
    setUsername("");
    setPassword("");
  }

  if (!staff) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Noto Sans KR', Arial, sans-serif" }}>
        <form onSubmit={handleLogin} style={{ width: "100%", maxWidth: 380, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "32px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#3b5bdb", letterSpacing: "0.1em", marginBottom: 6 }}>DREAM ACADEMY</div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: "#1a1a2e", margin: 0 }}>Teacher Hub</h1>
            <p style={{ fontSize: 13, color: "#6b7280", marginTop: 8 }}>Welcome! Please sign in to continue.</p>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. admin-angel"
              autoComplete="username"
              style={{ width: "100%", padding: "11px 14px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              style={{ width: "100%", padding: "11px 14px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: 14, fontFamily: "inherit", outline: "none" }}
            />
          </div>

          {err && (
            <div style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "9px 12px", fontSize: 12, fontWeight: 600, marginBottom: 14 }}>
              {err}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{ width: "100%", padding: "12px 16px", background: loading ? "#94a3b8" : "#3b5bdb", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer", fontFamily: "inherit" }}
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f3f4f6", fontFamily: "'Noto Sans KR', Arial, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 24px" }}>
        <div style={{ maxWidth: 880, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: staff.color || "#6366f1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14 }}>
            {staff.initial || staff.name?.slice(0, 1) || "?"}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#1a1a2e" }}>Hello, {staff.name}! 👋</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{staff.username}</div>
          </div>
          <button onClick={logout} style={{ padding: "7px 14px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#dc2626", cursor: "pointer", fontFamily: "inherit" }}>
            Logout
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "28px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {/* Card 1: My Class Schedule */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "22px 22px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📅</div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a1a2e", marginBottom: 6 }}>My Class Schedule</h2>
            <p style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 16, lineHeight: 1.5 }}>View your weekly teaching schedule</p>
            <a
              href={`/admin/tutor-my-schedule?user=${encodeURIComponent(staff.username)}`}
              style={{ display: "inline-block", padding: "9px 18px", background: "#3b5bdb", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}
            >
              View Schedule
            </a>
          </div>

          {/* Card 2: Class Requests (Coming Soon) */}
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "22px 22px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 28 }}>📋</div>
              <span style={{ padding: "3px 9px", background: "#fef3c7", color: "#92400e", borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: "0.05em" }}>COMING SOON</span>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "#1a1a2e", marginBottom: 6 }}>Class Requests</h2>
            <p style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 16, lineHeight: 1.5 }}>View your submitted class requests</p>
            <button
              disabled
              style={{ padding: "9px 18px", background: "#e5e7eb", color: "#9ca3af", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "not-allowed", fontFamily: "inherit" }}
            >
              View Requests
            </button>
          </div>
        </div>

        <div style={{ marginTop: 28, padding: "14px 18px", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, fontSize: 12, color: "#6b7280", textAlign: "center" }}>
          For questions or concerns, please contact your Korean manager.
        </div>
      </div>
    </div>
  );
}
