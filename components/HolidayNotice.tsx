"use client";
// 부킹1 · 부킹2(그 외 손님 화면) 공용 휴무일 안내 — 배너 + 팝업.
// 두 페이지가 같은 컴포넌트를 쓰므로 문구/디자인이 절대 어긋나지 않는다.
import { fmtHolidayList, HOLIDAY_NOTICE_LINES, type HolidayItem } from "@/lib/holidays";

/* 기간 내 휴무일 안내 배너 */
export function HolidayBanner({ hits }: { hits: HolidayItem[] }) {
  if (!hits.length) return null;
  return (
    <div style={{ marginTop: 16, padding: "13px 15px", background: "#fffbeb", border: "1.5px solid #fcd34d", borderRadius: 10 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: "#b45309", marginBottom: 7 }}>
        🏖️ 선택하신 기간에 휴무일이 있어요 — {fmtHolidayList(hits)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {HOLIDAY_NOTICE_LINES.map(l => (
          <div key={l.icon} style={{ display: "flex", gap: 7, alignItems: "flex-start", background: l.bg, borderRadius: 7, padding: "7px 10px" }}>
            <span style={{ fontWeight: 800, color: l.ic }}>{l.icon}</span>
            <span style={{ fontSize: 12.5, color: l.color, fontWeight: 600 }}>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* 기간 선택 시 1회 뜨는 휴무일 안내 팝업 */
export function HolidayPopup({ hits, onClose }: { hits: HolidayItem[] | null; onClose: () => void }) {
  if (!hits) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, padding: "24px 22px", maxWidth: 420, width: "100%" }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 10 }}>🏖️ 휴무일 안내</div>
        <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, marginBottom: 8 }}>
          선택하신 기간에 아래 휴무일이 포함되어 있어요.
        </div>
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "10px 13px", fontSize: 13.5, fontWeight: 700, color: "#b45309", marginBottom: 10 }}>
          {fmtHolidayList(hits)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 16 }}>
          {HOLIDAY_NOTICE_LINES.map(l => (
            <div key={l.icon} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: l.bg, borderRadius: 8, padding: "9px 11px" }}>
              <span style={{ fontWeight: 800, color: l.ic }}>{l.icon}</span>
              <span style={{ fontSize: 13, color: l.color, fontWeight: 600 }}>{l.text}</span>
            </div>
          ))}
        </div>
        <button onClick={onClose}
          style={{ width: "100%", padding: 13, background: "#7c3aed", color: "#fff", border: "none", borderRadius: 10, fontSize: 14.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>
          확인했어요
        </button>
      </div>
    </div>
  );
}
