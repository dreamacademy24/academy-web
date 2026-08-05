"use client";
import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { fetchStudentCalFingerprint, SC_SEEN_KEY } from "@/lib/scFingerprint";

type Staff = {
  username: string;
  name: string;
  role: string;
  color: string;
  initial: string;
};

export default function EngHubPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<Staff | null>(null);
  const [ready, setReady] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [scNew, setScNew] = useState(false); // Student Calendar 업데이트 뱃지

  useEffect(() => {
    if (!staff) return;
    let cancelled = false;
    fetchStudentCalFingerprint(supabase).then(fp => {
      if (cancelled || !fp) return;
      try {
        const seen = localStorage.getItem(SC_SEEN_KEY);
        setScNew(seen !== fp);
      } catch {}
    });
    return () => { cancelled = true; };
  }, [staff]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // 1) teacherSession 있으면 바로 사용
    try {
      const raw = localStorage.getItem("teacherSession");
      if (raw) { setStaff(JSON.parse(raw)); setReady(true); return; }
    } catch {}
    // 2) 어드민(korean_admin)으로 이미 로그인돼 있으면 자동 teacherSession 생성
    try {
      const adminInfo = localStorage.getItem("adminInfo");
      const adminToken = localStorage.getItem("adminToken");
      if (adminToken && adminInfo) {
        const info = JSON.parse(adminInfo);
        if (info.staffId) {
          const autoStaff: Staff = {
            username: info.staffId.startsWith("admin-") ? info.staffId : `admin-${info.staffId}`,
            name: info.name || info.staffId,
            role: "korean_admin",
            color: "#1e3a5f",
            initial: (info.name || "?").slice(0, 2).toUpperCase(),
          };
          localStorage.setItem("teacherSession", JSON.stringify(autoStaff));
          setStaff(autoStaff);
          setReady(true);
          return;
        }
      }
    } catch {}
    setReady(true);
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

  const cards = [
    { icon: "🗓", title: "Class Schedule", desc: "By teacher · By student · Print", href: "/admineng/class-schedule" },
    { icon: "🎧", title: "Online Class", desc: "Attendance · Weekly Schedule", href: "/admin/online-class-attendance" },
    { icon: "🎓", title: "Tutor Classes", desc: "Requests · My Schedule · Weekly", href: "/admineng/tutor-class" },
    { icon: "📅", title: "Student Calendar", desc: "Weekly schedule · New in · Graduation", href: "/admineng/student-calendar" },
    { icon: "🌿", title: "After School / Field Trip", desc: "Weekly prep — class · house · students", href: "/admineng/afterschool" },
    { icon: "🚐", title: "Shuttle Schedule", desc: "Pick up · Drop off · Daily", href: "/ashuttle" },
  ];

  if (!ready) return null;

  if (!staff) {
    return (
      <div style={{ minHeight: "100vh", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Noto Sans KR', Arial, sans-serif" }}>
        <form onSubmit={handleLogin} style={{ width: "100%", maxWidth: 380, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "32px 28px", boxShadow: "0 4px 24px rgba(0,0,0,0.04)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#3b5bdb", marginBottom: 6 }}>Dream Academy</div>
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

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.hub-w{max-width:900px;margin:0 auto;padding:32px 20px}
.hub-top{display:flex;align-items:center;gap:12px;margin-bottom:20px}
.hub-top h1{font-size:22px;font-weight:800;flex:1}
.hub-who{display:flex;align-items:center;gap:10px;padding:14px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:20px}
.hub-who .avatar{width:38px;height:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:14px}
.hub-who .nm{flex:1;font-size:14px;font-weight:800}
.hub-who .un{font-size:11px;color:#6b7280;margin-top:2px}
.hub-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;margin-bottom:28px}
.hub-card{border-radius:12px;padding:16px 18px;cursor:pointer;border:1px solid #e2e8f0;transition:all 180ms;display:flex;align-items:center;gap:12px;background:#fff;color:#1a1a2e;box-shadow:0 2px 12px rgba(0,0,0,0.05)}
.hub-card:hover{border-color:#1a6fc4;transform:translateY(-2px);box-shadow:0 4px 20px rgba(26,111,196,0.1)}
.hub-card .ic{font-size:26px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;flex-shrink:0;background:#f1f5f9}
.hub-card h2{font-size:14px;font-weight:800;margin-bottom:2px}
.hub-card p{font-size:11px;line-height:1.4;opacity:0.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hub-foot{display:flex;align-items:center;gap:16px;padding-top:16px;border-top:1px solid #e2e8f0}
.hub-link{font-size:12.5px;color:#6b7c93;font-weight:600;text-decoration:none}.hub-link:hover{color:#1a6fc4}
.hub-logout{margin-left:auto;padding:8px 16px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:12.5px;font-weight:700;color:#dc2626;cursor:pointer;font-family:inherit}
.hub-logout:hover{background:#fef2f2;border-color:#fca5a5}
    `}</style>
    <div className="hub-w">
      <div className="hub-top">
        <h1>🌐 Teacher Hub</h1>
        <p style={{ fontSize: 13, color: "#6b7c93" }}>Welcome! Choose a section below.</p>
      </div>

      <div className="hub-who">
        <div className="avatar" style={{ background: staff.color || "#6366f1" }}>{staff.initial || staff.name?.slice(0, 1) || "?"}</div>
        <div style={{ flex: 1 }}>
          <div className="nm">Hello, {staff.name}! 👋</div>
          <div className="un">{staff.username}</div>
        </div>
        <button className="hub-logout" onClick={logout}>Sign Out</button>
      </div>

      <div className="hub-grid">
        {cards.map((c, i) => (
          <div key={i} className="hub-card" style={{ position: "relative" }} onClick={() => router.push(c.href)}>
            {c.href === "/admineng/student-calendar" && scNew && (
              <span title="New update (new student / schedule change)" style={{ position: "absolute", top: 10, right: 12, width: 10, height: 10, borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 0 3px #fee2e2" }} />
            )}
            <div className="ic">{c.icon}</div>
            <div className="tx">
              <h2>{c.title}</h2>
              <p>{c.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="hub-foot">
        <a className="hub-link" href="/guide">Staff Guide</a>
        <a className="hub-link" href="/">Home</a>
        <a href="/admin/hub" style={{ marginLeft: "auto", padding: "8px 16px", background: "#1a6fc4", color: "#fff", borderRadius: 8, fontSize: 12.5, fontWeight: 700, textDecoration: "none", display: "inline-block" }}>🔒 Admin</a>
      </div>
    </div>
  </>);
}
