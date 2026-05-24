"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed, clearAdminAuth } from "@/lib/adminAuth";

export default function EngHubPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (isAdminAuthed()) setAuthed(true);
    else window.location.href = "/login";
  }, []);

  function logout() { clearAdminAuth(); router.push("/login"); }

  const cards = [
    { icon: "🎧", title: "Online Class", desc: "Attendance · Weekly Schedule", href: "/admin/online-class-attendance" },
    { icon: "🎓", title: "Tutor Classes", desc: "Requests · My Schedule · Weekly", href: "/admineng/tutor-class" },
  ];

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.hub-w{max-width:900px;margin:0 auto;padding:32px 20px}
.hub-top{display:flex;align-items:center;gap:12px;margin-bottom:28px}
.hub-top h1{font-size:22px;font-weight:800;flex:1}
.hub-back{padding:7px 14px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;font-weight:700;color:#475569;cursor:pointer;font-family:inherit}
.hub-back:hover{border-color:#1a6fc4;color:#1a6fc4}
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
        <h1>🌐 Local Staff Hub</h1>
        <p style={{ fontSize: 13, color: "#6b7c93" }}>Welcome! Choose a section below.</p>
        <button className="hub-back" onClick={() => router.push("/admin/hub")}>← Admin Hub</button>
      </div>

      <div className="hub-grid">
        {cards.map((c, i) => (
          <div key={i} className="hub-card" onClick={() => router.push(c.href)}>
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
        <button className="hub-logout" onClick={logout}>Logout</button>
      </div>
    </div>
  </>);
}
