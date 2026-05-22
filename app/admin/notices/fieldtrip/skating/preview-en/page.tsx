"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface ScheduleItem { time: string; main: string; sub: string; }
interface ProgramItem { num: string; label: string; name: string; desc: string; }
interface Notice {
  event_date: string;
  event_day: string;
  schedule: ScheduleItem[];
}

const FONT = "'Noto Sans KR',sans-serif";
const BAR_COLORS = ["#0a2540", "#1d6fa5", "#1d9e75"];
const btnStyle: React.CSSProperties = { padding: "10px 22px", fontSize: 14, fontWeight: 700, background: "#0a2540", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: FONT };

// 영어 고정 문구 (DB 콘텐츠는 한국어 — 영어 안내문은 아래 문구 사용)
const OUTFIT_TEXT = "If your child has long sleeves and long pants, please have them wear it. A jacket is also recommended. 🧦 Socks & personal water bottle are required!";
const SAFETY_TEXT = "Our teachers will be with the students at all times. A safety briefing will be held before skating begins, and staff will accompany students throughout all activities. 🍳 As lunch is served after 1:00 PM, please make sure your child has a hearty breakfast before departure!";
const PICKUP_HTML = "Parents wishing to pick up their child at SM Seaside may do so at the designated exit only. Please contact us <span style='color:#dc2626;font-weight:600;'>in advance</span> so we can provide the exact time and gate location. We will notify you separately if there are any delays due to traffic.";
const FOOTER_MSG = "We will do our best to ensure all children have a safe and memorable experience. Thank you! 😊";

// 영어 텍스트만 고정 — 시간(time)은 DB notice.schedule[i].time 을 index 순서로 사용
const SCHEDULE_EN_TEXT = [
  { main: "Pickup begins", sub: "Depart from accommodation" },
  { main: "Arrive at SM Seaside", sub: "Prepare and enter the skating rink" },
  { main: "Skating ends", sub: "" },
  { main: "Lunch at Jollibee 🍔", sub: "Students order their own food in English" },
  { main: "Move to Mart", sub: "Students shop for snacks using their Money Mission earnings" },
  { main: "Depart for accommodation", sub: "" },
  { main: "Expected arrival", sub: "Estimated between 15:10–15:20" },
];

const PROGRAMS_EN: ProgramItem[] = [
  {
    num: "01", label: "Skating", name: "Skating",
    desc: "All Junior students will participate in skating. A professional skating instructor will be present, and Bear Skate Aids are available so even first-timers can join safely and confidently.",
  },
  {
    num: "02", label: "Money Mission", name: "Money Mission",
    desc: "While skating, students discover mission cards around the rink and complete simple challenges — like clapping or balancing. Each completed mission earns a reward, which becomes their snack shopping budget at the mart!",
  },
  {
    num: "03", label: "English Ordering", name: "English Ordering",
    desc: "At Jollibee, students practice ordering food entirely in English — a fun, real-world chance to use the expressions they've been learning in class!",
  },
];

function SectionTitle({ title }: { title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, borderBottom: "2px solid #0a2540", paddingBottom: 6 }}>
      <span style={{ fontSize: 16, fontWeight: 800, color: "#0a2540" }}>{title}</span>
    </div>
  );
}

export default function SkatingNoticePreviewEn() {
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("fieldtrip_notices")
        .select("*")
        .eq("category", "skating")
        .limit(1);
      if (error) { setErr("불러오기 실패: " + error.message); setLoading(false); return; }
      const row = data && data[0];
      if (!row) { setErr("category='skating' 레코드가 없습니다."); setLoading(false); return; }
      setNotice({
        event_date: row.event_date || "",
        event_day: row.event_day || "",
        schedule: Array.isArray(row.schedule) ? row.schedule : [],
      });
      setLoading(false);
    })();
  }, []);

  async function saveImage() {
    const el = document.getElementById("notice-area");
    if (!el) return;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
    const link = document.createElement("a");
    link.download = "skating_fieldtrip_notice_en.png";
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading) return <div style={{ padding: 40, fontFamily: FONT }}>Loading...</div>;
  if (!notice) return <div style={{ padding: 40, fontFamily: FONT, color: "#dc2626" }}>{err || "No data"}</div>;

  const eventDay = (notice.event_day || "").replace("토요일", "Saturday");

  // 시간은 DB(notice.schedule)에서 실시간 반영, 영어 텍스트는 SCHEDULE_EN_TEXT 고정 (index 매핑)
  const scheduleEn: ScheduleItem[] = notice.schedule.map((item, i) => ({
    time: item.time,
    main: SCHEDULE_EN_TEXT[i]?.main ?? item.main,
    sub: SCHEDULE_EN_TEXT[i]?.sub ?? item.sub,
  }));

  return (
    <div className="preview-bg" style={{ background: "#e2e8f0", minHeight: "100vh", padding: "30px 20px", fontFamily: FONT }}>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .preview-bg { background: #fff !important; padding: 0 !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          @page { size: A4; margin: 8mm; }
        }
      `}</style>

      <div className="no-print" style={{ maxWidth: 860, margin: "0 auto 16px", display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button onClick={() => router.back()} style={{ ...btnStyle, background: "#fff", color: "#0a2540", border: "1px solid #cbd5e1" }}>← Back</button>
        <button onClick={() => window.print()} style={btnStyle}>🖨️ Print</button>
        <button onClick={saveImage} style={{ ...btnStyle, background: "#1d9e75" }}>🖼️ Save as Image</button>
      </div>

      <div id="notice-area" style={{ maxWidth: 860, margin: "0 auto", background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", borderRadius: 4, overflow: "hidden" }}>
        {/* HEADER */}
        <div style={{ background: "#0a2540", color: "#fff", padding: "26px 36px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.65, marginBottom: 8 }}>dream academy cebu · field trip notice</div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>Field Trip Parent Notice</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, opacity: 0.6, marginBottom: 4 }}>DATE</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{notice.event_date}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{eventDay}</div>
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 22 }}>
          {/* SECTION 1 — SCHEDULE */}
          <section>
            <SectionTitle title="Schedule" />
            <div>
              {scheduleEn.map((s, i) => {
                const isLast = i === scheduleEn.length - 1;
                const dotColor = isLast ? "#1d9e75" : "#0a2540";
                return (
                  <div key={i} style={{ display: "flex", gap: 14 }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 12 }}>
                      <div style={{ width: 11, height: 11, borderRadius: "50%", background: dotColor, flexShrink: 0, marginTop: 3 }} />
                      {!isLast && <div style={{ width: 2, flex: 1, background: "#cbd5e1", minHeight: 16 }} />}
                    </div>
                    <div style={{ display: "flex", gap: 14, flex: 1, paddingBottom: isLast ? 0 : 14 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0a2540", width: 72, flexShrink: 0 }}>{s.time}</div>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>{s.main}</div>
                        {s.sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>{s.sub}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* SECTION 2 — PROGRAMS */}
          <section>
            <SectionTitle title="Programs" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              {PROGRAMS_EN.map((p, i) => (
                <div key={i} style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ height: 3, background: BAR_COLORS[i % 3] }} />
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700 }}>{[p.num, p.label].filter(Boolean).join(" · ")}</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0a2540", margin: "4px 0 8px" }}>{p.name}</div>
                    <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.65 }}>{p.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* SECTION 3 — NOTICES */}
          <section>
            <SectionTitle title="Notices" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0a2540", marginBottom: 6 }}>👕 Outfit Guide</div>
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.65 }}>{OUTFIT_TEXT}</div>
                </div>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1d9e75", marginBottom: 6 }}>🛡️ Safety Notice</div>
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.65 }}>{SAFETY_TEXT}</div>
                </div>
              </div>
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#b45309", marginBottom: 6 }}>🚗 Individual Pickup</div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.65 }} dangerouslySetInnerHTML={{ __html: PICKUP_HTML }} />
              </div>
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <div style={{ borderTop: "1px solid #e2e8f0", padding: "14px 36px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>{FOOTER_MSG}</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#0a2540", textAlign: "right", lineHeight: 1.3 }}>DREAM ACADEMY<br />CEBU</div>
        </div>
      </div>
    </div>
  );
}
