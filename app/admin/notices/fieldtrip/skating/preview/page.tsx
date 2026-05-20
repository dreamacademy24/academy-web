"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface ScheduleItem { time: string; main: string; sub: string; }
interface ProgramItem { num: string; label: string; name: string; desc: string; }
interface Notice {
  title: string;
  event_date: string;
  event_day: string;
  schedule: ScheduleItem[];
  programs: ProgramItem[];
  outfit_text: string;
  safety_text: string;
  pickup_text: string;
  footer_msg: string;
}

const FONT = "'Noto Sans KR',sans-serif";
const BAR_COLORS = ["#0a2540", "#1d6fa5", "#1d9e75"];
const btnStyle: React.CSSProperties = { padding: "10px 22px", fontSize: 14, fontWeight: 700, background: "#0a2540", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontFamily: FONT };

function SectionTitle({ ko, en }: { ko: string; en: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12, borderBottom: "2px solid #0a2540", paddingBottom: 6 }}>
      <span style={{ fontSize: 16, fontWeight: 800, color: "#0a2540" }}>{ko}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 1 }}>· {en}</span>
    </div>
  );
}

export default function SkatingNoticePreview() {
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
        title: row.title || "필드트립 안내문",
        event_date: row.event_date || "",
        event_day: row.event_day || "",
        schedule: Array.isArray(row.schedule) ? row.schedule : [],
        programs: Array.isArray(row.programs) ? row.programs : [],
        outfit_text: row.outfit_text || "",
        safety_text: row.safety_text || "",
        pickup_text: row.pickup_text || "",
        footer_msg: row.footer_msg || "",
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
    link.download = "skating_fieldtrip_notice.png";
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  if (loading) return <div style={{ padding: 40, fontFamily: FONT }}>불러오는 중...</div>;
  if (!notice) return <div style={{ padding: 40, fontFamily: FONT, color: "#dc2626" }}>{err || "데이터 없음"}</div>;

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
        <button onClick={() => window.print()} style={btnStyle}>🖨️ 인쇄</button>
        <button onClick={saveImage} style={{ ...btnStyle, background: "#1d9e75" }}>🖼️ 이미지 저장</button>
      </div>

      <div id="notice-area" style={{ maxWidth: 860, margin: "0 auto", background: "#fff", boxShadow: "0 4px 20px rgba(0,0,0,0.12)", borderRadius: 4, overflow: "hidden" }}>
        {/* HEADER */}
        <div style={{ background: "#0a2540", color: "#fff", padding: "26px 36px", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: 1, opacity: 0.65, marginBottom: 8 }}>dream academy cebu · field trip notice</div>
            <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.1 }}>{notice.title}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 10, letterSpacing: 1.5, opacity: 0.6, marginBottom: 4 }}>DATE</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{notice.event_date}</div>
            <div style={{ fontSize: 13, opacity: 0.8 }}>{notice.event_day}</div>
          </div>
        </div>

        {/* BODY */}
        <div style={{ padding: "28px 36px", display: "flex", flexDirection: "column", gap: 22 }}>
          {/* SECTION 1 — SCHEDULE */}
          <section>
            <SectionTitle ko="당일 일정" en="SCHEDULE" />
            <div>
              {notice.schedule.map((s, i) => {
                const isLast = i === notice.schedule.length - 1;
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
            <SectionTitle ko="프로그램 안내" en="PROGRAMS" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
              {notice.programs.map((p, i) => (
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
            <SectionTitle ko="안내 사항" en="NOTICES" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#0a2540", marginBottom: 6 }}>👕 복장 안내</div>
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.65 }}>{notice.outfit_text}</div>
                </div>
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "14px 16px" }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#1d9e75", marginBottom: 6 }}>🛡️ 안전 안내</div>
                  <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.65 }}>{notice.safety_text}</div>
                </div>
              </div>
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "14px 16px" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#b45309", marginBottom: 6 }}>🚗 개별 하원</div>
                <div style={{ fontSize: 12, color: "#475569", lineHeight: 1.65 }}>{notice.pickup_text}</div>
              </div>
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <div style={{ borderTop: "1px solid #e2e8f0", padding: "14px 36px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>{notice.footer_msg}</div>
          <div style={{ fontSize: 11, fontWeight: 800, color: "#0a2540", textAlign: "right", lineHeight: 1.3 }}>DREAM ACADEMY<br />CEBU</div>
        </div>
      </div>
    </div>
  );
}
