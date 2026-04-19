export default function TutorGuidePage() {
  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.gw{max-width:860px;margin:0 auto;padding:32px 24px 60px}
.g-top{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;flex-wrap:wrap;gap:12px}
.g-top h1{font-size:24px;font-weight:800;line-height:1.4}
.g-top .sub{font-size:13px;color:#6b7c93;margin-top:4px}
.g-back{padding:8px 16px;background:#fff;color:#6b7c93;font-size:13px;font-weight:600;border:1px solid #e2e8f0;border-radius:8px;text-decoration:none;white-space:nowrap}
.g-back:hover{color:#1a6fc4;border-color:#1a6fc4}
.sec{background:#fff;border-radius:14px;padding:28px;box-shadow:0 2px 12px rgba(0,0,0,0.06);margin-bottom:20px}
.sec h2{font-size:17px;font-weight:800;margin-bottom:20px;display:flex;align-items:center;gap:8px}
.sec h3{font-size:15px;font-weight:700;margin:20px 0 12px;color:#1a1a2e}
.tg-sec p{font-size:14px;line-height:1.7;color:#475569;margin-bottom:10px}
.tg-sec ul,.tg-sec ol{padding-left:20px;margin:8px 0 12px}
.tg-sec li{font-size:14px;line-height:1.8;color:#475569}
.tg-sec code{background:#f1f5f9;padding:2px 8px;border-radius:4px;font-size:13px;color:#1a6fc4;font-family:'SF Mono',Consolas,monospace}
.tg-sec strong{color:#1a1a2e;font-weight:700}
.tg-sec a{color:#1a6fc4;text-decoration:none;font-weight:600}
.tg-sec a:hover{text-decoration:underline}
.tg-tbl-wrap{overflow-x:auto;border:1px solid #e2e8f0;border-radius:10px;margin:12px 0}
.tg-cred{width:100%;border-collapse:collapse;font-size:13px;min-width:460px}
.tg-cred th{background:#f8fafc;padding:10px 14px;text-align:left;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0;font-size:12px}
.tg-cred td{padding:10px 14px;border-bottom:1px solid #f1f5f9;font-family:'SF Mono',Consolas,monospace;font-size:13px}
.tg-cred tr:last-child td{border-bottom:none}
.tg-status{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:14px 0}
.tg-status-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px}
.tg-status-card .lbl{font-weight:700;font-size:14px;margin-bottom:4px}
.tg-status-card .dsc{font-size:12px;color:#6b7c93;line-height:1.5}
.tg-status-card.attended{background:#f0fdf4;border-color:#bbf7d0}
.tg-status-card.attended .lbl{color:#166534}
.tg-status-card.absent{background:#fef2f2;border-color:#fecaca}
.tg-status-card.absent .lbl{color:#991b1b}
.tg-status-card.makeup{background:#fef3c7;border-color:#fde047}
.tg-status-card.makeup .lbl{color:#92400e}
.tg-callout{border-radius:8px;padding:12px 16px;margin:12px 0;font-size:13px;line-height:1.6}
.tg-callout.info{background:#eff6ff;border-left:4px solid #3b82f6;color:#1e3a8a}
.tg-callout.warn{background:#fef2f2;border-left:4px solid #dc2626;color:#991b1b}
.callout-green{background:#dcfce7;border:1px solid #86efac;border-radius:10px;padding:14px 18px;font-size:13px;color:#166534;line-height:1.8;margin:12px 0}
.qa-item{background:#f8fafc;border:1px solid #e2e8f0;border-left:3px solid #60a5fa;border-radius:8px;padding:12px 16px;margin-bottom:10px}
.qa-item .q{font-size:13px;font-weight:700;color:#1a1a2e;margin-bottom:6px}
.qa-item .a{font-size:13px;color:#475569;line-height:1.8;margin:0}
.decision-tbl{width:100%;border-collapse:collapse;font-size:13px;margin:10px 0;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
.decision-tbl th{background:#f8fafc;padding:10px 14px;text-align:left;font-weight:700;color:#475569;font-size:12px;border-bottom:1px solid #e2e8f0}
.decision-tbl td{padding:10px 14px;border-bottom:1px solid #f1f5f9;color:#475569;line-height:1.6}
.decision-tbl td:last-child{font-weight:700;color:#1a1a2e;white-space:nowrap}
.decision-tbl tr:last-child td{border-bottom:none}
.note-cat{margin-top:16px;margin-bottom:6px;font-size:12px;font-weight:800;color:#1a6fc4;text-transform:uppercase;letter-spacing:0.08em}
.note-ex{background:#f8fafc;border-left:3px solid #22c55e;border-radius:6px;padding:10px 14px;margin-bottom:8px;font-size:13px;color:#334155;line-height:1.6;font-style:italic}
.note-ex.bad{border-left-color:#dc2626;background:#fef2f2;color:#7f1d1d}
.note-ex .icon{font-style:normal;margin-right:6px}
@media (max-width:600px){
  .gw{padding:20px 16px 40px}
  .sec{padding:20px}
  .tg-status{grid-template-columns:1fr}
  .decision-tbl td:last-child{white-space:normal}
}
    `}</style>

    <div className="gw">
      <div className="g-top">
        <div>
          <h1>Tutor Guide — Online Class System</h1>
          <p className="sub">Quick reference for recording attendance and writing notes</p>
        </div>
        <a href="/tutor/online-class" className="g-back">← Back to Dashboard</a>
      </div>

      {/* §1. Welcome */}
      <div className="sec tg-sec">
        <h2>👋 1. Welcome</h2>
        <p>
          This is the official attendance and notes system used by Dream Academy&apos;s online class program.
          The tutors (you) use it to record what happened in each class. The Korean admin (May) uses it in
          real time to follow your students&apos; progress and to answer parents&apos; questions.
        </p>
        <p>
          Your daily job here is simple: <strong>after each class ends, open your dashboard, mark the
          session&apos;s status, and add a short note if anything was worth mentioning.</strong> That&apos;s it.
        </p>
      </div>

      {/* §2. Logging In */}
      <div className="sec tg-sec">
        <h2>🔐 2. Logging In</h2>
        <p>You have two ways to log in. Both work.</p>

        <h3>A. Direct access (recommended — new)</h3>
        <p>
          Open <a href="https://dreamacademyph.com/admin/online-class-attendance">https://dreamacademyph.com/admin/online-class-attendance</a>,
          tap your card (T.Ann / T.Angel / T.Carla / T.Amelyn / T.Cristel), enter your password, and you go
          straight to your dashboard.
        </p>

        <h3>B. Original login page</h3>
        <p>
          Open <a href="https://dreamacademyph.com/login">https://dreamacademyph.com/login</a> and enter your
          username and password. You will be redirected to your dashboard automatically.
        </p>

        <h3>Your credentials</h3>
        <div className="tg-tbl-wrap">
          <table className="tg-cred">
            <thead>
              <tr><th>Tutor</th><th>Username</th><th>Password</th></tr>
            </thead>
            <tbody>
              <tr><td>T.Ann</td><td>admin-ann</td><td>ann2026!</td></tr>
              <tr><td>T.Angel</td><td>admin-angel</td><td>angel2026!</td></tr>
              <tr><td>T.Carla</td><td>admin-carla</td><td>carla2026!</td></tr>
              <tr><td>T.Amelyn</td><td>admin-amelyn</td><td>amelyn2026!</td></tr>
              <tr><td>T.Cristel</td><td>admin-cristel</td><td>cristel2026!</td></tr>
            </tbody>
          </table>
        </div>

        <div className="tg-callout info">
          💡 Your session stays active for 24 hours. You don&apos;t need to log in every time.
        </div>
      </div>

      {/* §3. Your Dashboard */}
      <div className="sec tg-sec">
        <h2>📊 3. Your Dashboard (<code>/tutor/online-class</code>)</h2>
        <p>Three tabs across the top:</p>
        <ol>
          <li><strong>Today</strong> — sessions scheduled for today.</li>
          <li><strong>My Students</strong> — all your assigned students with schedule, time, and remaining sessions.</li>
          <li><strong>My Schedule</strong> — weekly view of all upcoming classes.</li>
        </ol>

        <p>Date navigation sits on the Today tab: <code>◀ Previous</code> / <code>[date]</code> / <code>Next ▶</code>. Tap the date to open a calendar.</p>

        <h3>Each session card shows</h3>
        <ul>
          <li><strong>Time</strong> — your local Philippine Time followed by Korea Time.
            Example: <code>17:00 · KR 18:00</code> means 5:00 PM your time, 6:00 PM for the student in Korea.</li>
          <li><strong>Student name</strong></li>
          <li><strong>Session number</strong> (e.g. <code>Session #5</code> — the 5th lesson of their package)</li>
          <li><strong>Status badge</strong> (top right): Scheduled / Attended / Absent / Makeup</li>
          <li><strong>Four buttons</strong>: <code>↺ Undo</code> / <code>✓ Attended</code> / <code>✗ Absent</code> / <code>△ Makeup</code></li>
          <li><strong>NOTES field</strong> (optional)</li>
        </ul>
      </div>

      {/* §4. Recording Attendance */}
      <div className="sec tg-sec">
        <h2>✍️ 4. Recording Attendance — Step by Step</h2>
        <p>After each class:</p>
        <ol>
          <li><strong>Step 1</strong> — Open the <strong>Today</strong> tab (it opens by default).</li>
          <li><strong>Step 2</strong> — Find the session you just finished.</li>
          <li><strong>Step 3</strong> — Tap one of the three status buttons:
            <ul style={{marginTop:6}}>
              <li><strong>✓ Attended</strong> — student joined and completed the class (deducts 1 session).</li>
              <li><strong>✗ Absent</strong> — student did not join without prior notice (still deducts).</li>
              <li><strong>△ Makeup</strong> — compensation class for a previously missed session (does <strong>not</strong> deduct from their package).</li>
            </ul>
          </li>
          <li><strong>Step 4</strong> — (Optional but encouraged) type notes in the NOTES field.</li>
          <li><strong>Step 5</strong> — Done. The record saves automatically.</li>
        </ol>

        <h3>Made a mistake?</h3>
        <p>
          Tap the <code>↺ Undo</code> button on that session. The status returns to &quot;Scheduled&quot; and
          you can re-select.
        </p>

        <div className="tg-callout warn">
          ⚠️ <strong>Record attendance right after class ends.</strong> If you wait until later, you may forget
          details, and May can&apos;t see today&apos;s report.
        </div>
      </div>

      {/* §5. Status Types */}
      <div className="sec tg-sec">
        <h2>🎯 5. Status Types — Which One to Use?</h2>

        <div className="tg-status">
          <div className="tg-status-card attended">
            <div className="lbl">✓ Attended</div>
            <div className="dsc">Student joined and completed the class. Counts as one used session.</div>
          </div>
          <div className="tg-status-card absent">
            <div className="lbl">✗ Absent</div>
            <div className="dsc">Student did not join without prior notice. Counts as one used session.</div>
          </div>
          <div className="tg-status-card makeup">
            <div className="lbl">△ Makeup</div>
            <div className="dsc">Compensation class for a previously missed session. Does not deduct from the package.</div>
          </div>
        </div>

        <h3>Decision table</h3>
        <div className="tg-tbl-wrap">
          <table className="decision-tbl">
            <thead>
              <tr><th>Situation</th><th>Status</th></tr>
            </thead>
            <tbody>
              <tr><td>Student joined on time and stayed the full class</td><td>Attended</td></tr>
              <tr><td>Student joined late (5, 10, 15 min) but completed the class</td><td>Attended + NOTE</td></tr>
              <tr><td>Student left early</td><td>Attended + NOTE (explain why)</td></tr>
              <tr><td>Student didn&apos;t show up at all and didn&apos;t notify</td><td>Absent</td></tr>
              <tr><td>Student&apos;s parent notified 1 hour before that they can&apos;t join</td><td>Absent + NOTE</td></tr>
              <tr><td>You&apos;re doing a class that makes up for a missed one</td><td>Makeup</td></tr>
              <tr><td>Internet/tech issue cut the class short (e.g., 5 min class)</td><td>Attended + NOTE (let May decide if it counts)</td></tr>
              <tr><td>You&apos;re unsure</td><td>Leave as Scheduled. Ask May. Don&apos;t guess.</td></tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* §6. NOTES */}
      <div className="sec tg-sec">
        <h2>📝 6. NOTES — The Most Important Part ★</h2>

        <h3>Why notes matter</h3>
        <p>
          The Korean admin (May) sees your notes in real time. Parents often ask about their child&apos;s
          class. Good notes give May the context to answer parents without needing to call you. Notes also
          build a long-term record of each student&apos;s progress.
        </p>

        <h3>When to write a note</h3>
        <p>Write one if <strong>any</strong> of the following apply:</p>
        <ul>
          <li>Something unusual happened (late, early leave, no show, tech issue)</li>
          <li>The student&apos;s mood or behavior stood out (very engaged / very tired / upset / surprisingly quiet)</li>
          <li>The student made notable learning progress or struggled with something</li>
          <li>You tried something new (different activity, harder material, slower pace)</li>
          <li>Health, family, or personal situation affected the class</li>
          <li>You contacted the parent or the parent contacted you</li>
          <li>You want May to know anything the parent might ask about</li>
        </ul>

        <h3>When NOT to write a note</h3>
        <ul>
          <li>Totally normal class, nothing unusual → leave blank. Blank is fine.</li>
          <li>Don&apos;t force a note just to fill the box.</li>
        </ul>

        <h3>Writing tips</h3>
        <ul>
          <li>Keep it short. 1–3 sentences is plenty.</li>
          <li>Write in plain, factual English. Like a text to a coworker.</li>
          <li>Stick to what <strong>happened</strong>, not your feelings or judgments.</li>
          <li>Use the student&apos;s behavior as the subject (&quot;Student was...&quot;), not yours.</li>
          <li>If you&apos;re unsure whether something is worth noting, write it anyway — May can decide what to pass on to parents.</li>
          <li><strong>Notes save automatically when you click or tap outside the box.</strong> Wait 1–2 seconds before closing the page.</li>
        </ul>

        <h3>Good examples</h3>
        <p>Organized by category — find the situation closest to yours and use it as a model.</p>

        <div className="note-cat">Attendance &amp; Timing</div>
        <div className="note-ex"><span className="icon">✓</span>Joined 10 min late, stayed the full class.</div>
        <div className="note-ex"><span className="icon">✓</span>Student left 15 min early — mom said they had a dentist appointment.</div>
        <div className="note-ex"><span className="icon">✓</span>No show. Tried calling, no answer. Will check with May tomorrow.</div>

        <div className="note-cat">Technical Issues</div>
        <div className="note-ex"><span className="icon">✓</span>Zoom kept freezing. Class cut short around 25 min mark.</div>
        <div className="note-ex"><span className="icon">✓</span>Student&apos;s microphone didn&apos;t work for the first 10 min. Used chat instead.</div>
        <div className="note-ex"><span className="icon">✓</span>Power outage on my side for 5 min. Extended the class 5 min to make up.</div>

        <div className="note-cat">Engagement &amp; Mood</div>
        <div className="note-ex"><span className="icon">✓</span>Very engaged today. Volunteered answers, laughed a lot.</div>
        <div className="note-ex"><span className="icon">✓</span>Seemed tired, slower responses than usual. Kept it light today.</div>
        <div className="note-ex"><span className="icon">✓</span>Great mood — proud that he finished his homework on his own.</div>

        <div className="note-cat">Learning Progress</div>
        <div className="note-ex"><span className="icon">✓</span>Finished Unit 7. Ready to start Unit 8 next class.</div>
        <div className="note-ex"><span className="icon">✓</span>Still struggling with past tense. Will review again next time.</div>
        <div className="note-ex"><span className="icon">✓</span>First time reading aloud without getting stuck. Big progress.</div>

        <div className="note-cat">Health</div>
        <div className="note-ex"><span className="icon">✓</span>Student has a cold, voice was low. Kept talking time shorter.</div>
        <div className="note-ex"><span className="icon">✓</span>Said stomach hurt, looked uncomfortable. Cut class 10 min early.</div>

        <div className="note-cat">Parent Contact</div>
        <div className="note-ex"><span className="icon">✓</span>Mom messaged before class that student will be absent.</div>
        <div className="note-ex"><span className="icon">✓</span>Talked briefly with dad at the end about homework expectations.</div>

        <h3>Bad examples — don&apos;t write these</h3>
        <div className="note-ex bad"><span className="icon">✗</span>&quot;I think this student doesn&apos;t care about English.&quot; — opinion / judgment.</div>
        <div className="note-ex bad"><span className="icon">✗</span>&quot;His mom is really pushy, I don&apos;t like dealing with her.&quot; — complaint, confidential.</div>
        <div className="note-ex bad"><span className="icon">✗</span>&quot;Student told me his parents argue at home.&quot; — private family info. If it&apos;s a safety concern, call May directly; don&apos;t write it here.</div>
        <div className="note-ex bad"><span className="icon">✗</span>&quot;Good class.&quot; — too vague. If this is all, just leave blank.</div>
        <div className="note-ex bad"><span className="icon">✗</span>A 3-paragraph essay about the student — too long, May won&apos;t read it all.</div>
      </div>

      {/* §7. Time Zones */}
      <div className="sec tg-sec">
        <h2>🕒 7. Time Zones — Important</h2>
        <ul>
          <li><strong>Philippine Time (PHT)</strong> = your local time = shown <strong>first</strong> on each session card.</li>
          <li><strong>Korea Standard Time (KST)</strong> = 1 hour <strong>ahead</strong> of PHT = shown after <code>· KR</code>.</li>
        </ul>
        <p>Example card: <code>17:00 · KR 18:00</code> means:</p>
        <ul>
          <li>Your class starts at 5:00 PM Philippine time.</li>
          <li>For the student in Korea, it&apos;s 6:00 PM.</li>
        </ul>
        <div className="tg-callout info">
          💡 Saturday classes may have different times than weekdays. Always check the time on each card, don&apos;t assume.
        </div>
      </div>

      {/* §8. Cancellation Policy */}
      <div className="sec tg-sec">
        <h2>⚠️ 8. Cancellation Policy (Quick Reference)</h2>
        <p>
          Students manage their own cancellations through a separate parent portal. <strong>You don&apos;t
          need to handle cancellations.</strong>
        </p>
        <ul>
          <li><strong>4+ days notice:</strong> free reschedule (no session deducted).</li>
          <li><strong>Less than 4 days:</strong> session counts as used.</li>
          <li><strong>No show:</strong> session counts as used.</li>
        </ul>
        <div className="tg-callout info">
          💡 Your only job is to record what actually happened <strong>after</strong> the class.
        </div>
      </div>

      {/* §9. Common Issues */}
      <div className="sec tg-sec">
        <h2>🛟 9. Common Issues</h2>
        <div className="qa-item">
          <div className="q">Q1. I marked attendance by mistake.</div>
          <p className="a">Tap the <strong>↺ Undo</strong> button on that session. Status returns to Scheduled and you can re-select.</p>
        </div>
        <div className="qa-item">
          <div className="q">Q2. My notes didn&apos;t save.</div>
          <p className="a">Click or tap outside the notes box, then wait 1–2 seconds before closing the page. Notes save automatically on blur.</p>
        </div>
        <div className="qa-item">
          <div className="q">Q3. The Today tab shows the wrong date.</div>
          <p className="a">Use the <strong>◀ Previous</strong> / <strong>Next ▶</strong> buttons, or tap the date in the middle to open a calendar and pick a specific date. Tap <strong>Today</strong> to return.</p>
        </div>
        <div className="qa-item">
          <div className="q">Q4. My student list is empty.</div>
          <p className="a">Your tutor profile may not be linked to your account. Contact May.</p>
        </div>
        <div className="qa-item">
          <div className="q">Q5. I can&apos;t see other tutors&apos; students.</div>
          <p className="a">By design. Each tutor sees only their own students.</p>
        </div>
      </div>

      {/* §10. Need Help */}
      <div className="sec tg-sec">
        <h2>💬 10. Need Help?</h2>
        <p>Contact <strong>May</strong> for:</p>
        <ul>
          <li>Login issues</li>
          <li>Student info changes</li>
          <li>Schedule conflicts</li>
          <li>Any technical problem</li>
        </ul>
        <p style={{marginTop:14}}>
          📧 <a href="mailto:may@dreamacademyph.com">may@dreamacademyph.com</a>
        </p>
        <p>(Also KakaoTalk if you have it.)</p>
      </div>
    </div>
  </>);
}
