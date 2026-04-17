"use client";

export default function TutorGuidePage() {
  const accounts = [
    { tutor: "T.Ann", username: "admin-ann", password: "ann2026!" },
    { tutor: "T.Angel", username: "admin-angel", password: "angel2026!" },
    { tutor: "T.Carla", username: "admin-carla", password: "carla2026!" },
    { tutor: "T.Amelyn", username: "admin-amelyn", password: "amelyn2026!" },
    { tutor: "T.Cristel", username: "admin-cristel", password: "cristel2026!" },
  ];

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.gw{max-width:860px;margin:0 auto;padding:32px 24px 60px}
.g-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px}
.g-top h1{font-size:26px;font-weight:800;line-height:1.3}
.g-top .sub{font-size:13px;color:#6b7c93;margin-top:4px}
.g-back{padding:8px 16px;background:#fff;color:#6b7c93;font-size:13px;font-weight:600;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;white-space:nowrap}
.g-back:hover{color:#1a6fc4;border-color:#1a6fc4}

.sec{background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:20px}
.sec h2{font-size:18px;font-weight:800;margin-bottom:14px;display:flex;align-items:center;gap:8px;color:#1a1a2e}
.sec h3{font-size:15px;font-weight:700;margin:18px 0 10px;color:#1a6fc4}
.sec p{font-size:14px;line-height:1.7;color:#475569;margin-bottom:10px}
.sec ul, .sec ol{padding-left:20px;margin:8px 0 12px}
.sec li{font-size:14px;line-height:1.8;color:#475569}
.sec code{background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:13px;color:#1a6fc4;font-family:'SF Mono',Consolas,monospace}
.sec strong{color:#1a1a2e;font-weight:700}
.sec a{color:#1a6fc4;text-decoration:none;font-weight:600}
.sec a:hover{text-decoration:underline}

.tbl-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px;margin:12px 0}
.cred-tbl{width:100%;border-collapse:collapse;font-size:13px;min-width:480px}
.cred-tbl th{background:#f8fafc;padding:10px 14px;text-align:left;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0}
.cred-tbl td{padding:10px 14px;border-bottom:1px solid #f1f5f9;font-family:'SF Mono',Consolas,monospace;font-size:13px}
.cred-tbl tr:last-child td{border-bottom:none}

.callout{background:#fef9c3;border-left:4px solid #eab308;border-radius:6px;padding:12px 16px;margin:12px 0}
.callout.info{background:#eff6ff;border-color:#3b82f6}
.callout.warn{background:#fef2f2;border-color:#dc2626}
.callout p{margin:0;font-size:13px;color:#1a1a2e}

.status-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:14px 0}
.status-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
.status-card .label{font-weight:700;font-size:14px;margin-bottom:4px}
.status-card .desc{font-size:12px;color:#6b7c93;line-height:1.5}
.status-card.attended{background:#f0fdf4;border-color:#bbf7d0}
.status-card.attended .label{color:#166534}
.status-card.absent{background:#fef2f2;border-color:#fecaca}
.status-card.absent .label{color:#991b1b}
.status-card.resched{background:#fff7ed;border-color:#fed7aa}
.status-card.resched .label{color:#9a3412}
.status-card.makeup{background:#fef3c7;border-color:#fde047}
.status-card.makeup .label{color:#92400e}

.cta{display:inline-block;padding:11px 22px;background:#1a6fc4;color:#fff;font-size:14px;font-weight:700;border-radius:10px;text-decoration:none;margin-top:4px}
.cta:hover{background:#0d3d7a}

@media(max-width:600px){
  .gw{padding:20px 16px 40px}
  .sec{padding:20px}
  .g-top h1{font-size:22px}
  .status-grid{grid-template-columns:1fr}
}
    `}</style>

    <div className="gw">
      <div className="g-top">
        <div>
          <h1>Online Class Tutor Guide</h1>
          <div className="sub">Dream Academy · English Online Class System</div>
        </div>
        <a href="/tutor/online-class" className="g-back">← Dashboard</a>
      </div>

      {/* 1. Login */}
      <div className="sec">
        <h2>🔐 1. Login</h2>
        <p><strong>URL:</strong> <a href="https://dreamacademyph.com/login">https://dreamacademyph.com/login</a></p>
        <p>Use your assigned credentials below:</p>
        <div className="tbl-wrap">
          <table className="cred-tbl">
            <thead>
              <tr>
                <th>Tutor</th>
                <th>Username</th>
                <th>Password</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map(a => (
                <tr key={a.username}>
                  <td>{a.tutor}</td>
                  <td>{a.username}</td>
                  <td>{a.password}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{marginTop:12}}>After login, you will be automatically redirected to your dashboard at <code>/tutor/online-class</code>.</p>
        <div className="callout warn">
          <p>⚠️ Please change your password after first login (if password change feature is available). Never share your credentials with other tutors.</p>
        </div>
      </div>

      {/* 2. Dashboard */}
      <div className="sec">
        <h2>📊 2. Your Dashboard</h2>
        <p>Your dashboard at <code>/tutor/online-class</code> has two main tabs:</p>
        <h3>👩‍🎓 My Students</h3>
        <p>A full list of all students currently assigned to you. Each row shows the student name, scheduled days, class time (Korea), total sessions, used sessions, and remaining sessions.</p>
        <h3>📆 My Schedule</h3>
        <p>Upcoming sessions for the current week. You can see each day&apos;s classes with time, student name, and session number.</p>
      </div>

      {/* 3. Recording Attendance */}
      <div className="sec">
        <h2>✅ 3. Recording Attendance</h2>
        <p>After each class:</p>
        <ol>
          <li>Find the session in your schedule</li>
          <li>Click the <strong>[Attendance]</strong> button on the session row</li>
          <li>Select the appropriate status from the options below</li>
          <li>Add a short note if needed (optional)</li>
          <li>Save — the record is updated instantly</li>
        </ol>
        <h3>Status Options</h3>
        <div className="status-grid">
          <div className="status-card attended">
            <div className="label">✓ Attended</div>
            <div className="desc">Student joined and completed the class. Counts as one used session.</div>
          </div>
          <div className="status-card absent">
            <div className="label">✗ Absent</div>
            <div className="desc">Student did not join without prior notice. Counts as one used session.</div>
          </div>
          <div className="status-card resched">
            <div className="label">⟳ Rescheduled</div>
            <div className="desc">Class moved to another date. Select the new date when saving.</div>
          </div>
          <div className="status-card makeup">
            <div className="label">△ Makeup</div>
            <div className="desc">A compensation session for a previously missed class. Does not deduct from total.</div>
          </div>
        </div>
      </div>

      {/* 4. Schedule Rules */}
      <div className="sec">
        <h2>📅 4. Class Schedule Rules</h2>
        <ul>
          <li>Classes follow each student&apos;s assigned days and Korea time — all times shown on your dashboard are in <strong>Korea Standard Time (KST, UTC+9)</strong>.</li>
          <li>Philippine Time (PHT) is <strong>1 hour behind KST</strong> (e.g. KST 19:30 = PHT 18:30).</li>
          <li><strong>Saturday classes</strong> may have a different time than weekday classes — check each session carefully.</li>
          <li>Holiday dates (Korean public holidays, academy-specific closures) are <strong>automatically excluded</strong> from the schedule. No classes are generated on those days.</li>
        </ul>
      </div>

      {/* 5. Cancellation Policy */}
      <div className="sec">
        <h2>📋 5. Cancellation & Attendance Policy</h2>
        <ul>
          <li><strong>4+ days before class:</strong> Free reschedule or cancel — no session deducted.</li>
          <li><strong>Less than 4 days before class:</strong> Session counts as <em>used</em> — no refund or reschedule.</li>
          <li><strong>No show without notice:</strong> Session counts as <em>used</em>.</li>
        </ul>
        <div className="callout info">
          <p>💡 Students manage their own cancellations through the customer portal. You only need to record the final attendance status after the class.</p>
        </div>
      </div>

      {/* 6. Need Help? */}
      <div className="sec">
        <h2>🆘 6. Need Help?</h2>
        <p>Contact <strong>May</strong> for:</p>
        <ul>
          <li>Login issues (forgot password, account locked)</li>
          <li>Student information changes</li>
          <li>Schedule conflicts or missing sessions</li>
          <li>Any technical problems with the system</li>
        </ul>
        <p style={{marginTop:16}}>
          📧 <a href="mailto:may@dreamacademyph.com">may@dreamacademyph.com</a>
        </p>
        <a href="/tutor/online-class" className="cta">Go to Dashboard →</a>
      </div>
    </div>
  </>);
}
