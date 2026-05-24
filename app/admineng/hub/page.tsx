"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed, getAdminInfo, clearAdminAuth } from "@/lib/adminAuth";

export default function LocalStaffHubPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    const info = getAdminInfo();
    if (info) setName(info.name);
    setReady(true);
  }, [router]);

  function logout() { clearAdminAuth(); router.push("/login"); }

  if (!ready) return null;

  const cards = [
    { icon: "🎧", title: "Online Class",  desc: "Attendance · Weekly Schedule",      href: "/admin/online-class-attendance" },
    { icon: "💻", title: "Video English", desc: "Class schedule · Availability",     href: "/admin/online-class" },
    { icon: "🎓", title: "Tutor Classes", desc: "Requests · My Schedule · Weekly",   href: "/admineng/tutor-class" },
  ];

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.hub-w{max-width:820px;margin:0 auto;padding:28px 20px;}
.hub-top{display:flex;justify-content:flex-end;margin-bottom:10px;}
.hub-back{background:#fff;border:1px solid #cbd5e1;color:#475569;padding:7px 14px;border-radius:8px;cursor:pointer;font-size:12px;font-family:inherit;font-weight:600;text-decoration:none;display:inline-block;}.hub-back:hover{color:#1a6fc4;border-color:#1a6fc4;}
.hub-h{text-align:center;margin-bottom:20px;}
.hub-h h1{font-size:22px;font-weight:800;margin-bottom:4px;}
.hub-h p{font-size:13px;color:#6b7c93;}
.hub-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:24px;}
.hub-card{border-radius:12px;padding:14px 16px;cursor:pointer;border:2px solid transparent;transition:all 180ms;display:flex;align-items:center;gap:12px;}
.hub-card:hover{transform:translateY(-2px);}
.hub-card .ic{font-size:26px;width:44px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:10px;flex-shrink:0;background:rgba(255,255,255,0.15);}
.hub-card .tx{flex:1;min-width:0;}
.hub-card h2{font-size:14px;font-weight:800;margin-bottom:2px;line-height:1.2;}
.hub-card p{font-size:11px;line-height:1.4;opacity:0.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.card-gray{background:#fff;color:#1a1a2e;box-shadow:0 2px 12px rgba(0,0,0,0.05);border:1px solid #e2e8f0;}
.card-gray:hover{border-color:#1a6fc4;box-shadow:0 4px 20px rgba(26,111,196,0.1);}
.card-gray .ic{background:#f1f5f9;}
.hub-footer{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;}
.hub-link{color:#6b7c93;font-size:12px;font-weight:600;text-decoration:none;padding:7px 14px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;}.hub-link:hover{color:#1a6fc4;border-color:#1a6fc4;}
.logout{background:none;border:none;color:#94a3b8;font-size:11px;cursor:pointer;margin-top:20px;display:block;text-align:center;width:100%;font-family:'Noto Sans KR',sans-serif;}.logout:hover{color:#dc2626;}
@media(max-width:500px){.hub-grid{grid-template-columns:1fr;}.hub-w{padding:20px 14px;}}
    `}</style>
    <div className="hub-w">
      <div className="hub-top">
        <a className="hub-back" href="/admin/hub">← Admin Hub</a>
      </div>
      <div className="hub-h">
        <h1>🌐 Local Staff Hub</h1>
        <p>Welcome, {name}</p>
      </div>
      <div className="hub-grid">
        {cards.map((c, i) => (
          <div key={i} className="hub-card card-gray" onClick={() => router.push(c.href)}>
            <div className="ic">{c.icon}</div>
            <div className="tx">
              <h2>{c.title}</h2>
              <p>{c.desc}</p>
            </div>
          </div>
        ))}
      </div>
      <div className="hub-footer">
        <a className="hub-link" href="/guide">Staff Guide</a>
        <a className="hub-link" href="/">Home</a>
      </div>
      <button className="logout" onClick={logout}>Logout</button>
    </div>
  </>);
}
