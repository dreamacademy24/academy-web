"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";
import { JPARK_ROOMS, JPARK_EXTRA_PERSON, JPARK_TIER_LABEL, jparkTier, CUBENINE_ROOMS, calcNights } from "@/lib/resortRates";

type Resort = "jaypark" | "cubenine";
const RESORT_LABEL: Record<Resort, string> = { jaypark: "제이파크", cubenine: "큐브나인" };
const RESORT_X: Record<Resort, string> = { jaypark: "Dream Academy X J-park", cubenine: "Dream Academy X Cube Nine" };

interface Item { label: string; amount: number }
interface BookingLite {
  id: string; reservation_no: string | null; booker_name: string; booker_english: string | null; status: string;
  checkin_date: string | null; checkout_date: string | null; accom_type: string | null;
  students: unknown; extra_guardians: unknown;
  seg1_type: string | null; seg1_checkin: string | null; seg1_checkout: string | null;
  seg2_type: string | null; seg2_checkin: string | null; seg2_checkout: string | null;
}
interface InvRow {
  id: string; invoice_no: string; resort: string; booking_id: string | null; guest_name: string;
  room_type: string; period_start: string; period_end: string; nights: number;
  unit_price: number; extra_person: number; extra_price: number; amount: number;
  currency: string; rate_tier: string | null; memo: string | null; status: string;
  paid_date: string | null; created_at: string;
  items: Item[] | null; guests_kr: string | null; guests_en: string | null;
  reservation_no: string | null; res_status: string | null; special_request: string | null;
}

function num(n: number) { return Number(n || 0).toLocaleString(); }
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseArr(v: unknown): Record<string, string>[] {
  try { const p = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(p) ? p : []; } catch { return []; }
}

export default function ResortInvoicePage() {
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    if (!isAdminAuthed()) { window.location.href = "/login"; return; }
    setAuthed(true);
  }, []);

  const [resort, setResort] = useState<Resort>("jaypark");
  const [bookings, setBookings] = useState<BookingLite[]>([]);
  const [invoices, setInvoices] = useState<InvRow[]>([]);
  const [selBooking, setSelBooking] = useState("");
  const [guest, setGuest] = useState("");           // Reservation Name (영문)
  const [resNo, setResNo] = useState("");
  const [resStatus, setResStatus] = useState("tentatively");
  const [guestsKr, setGuestsKr] = useState("");
  const [guestsEn, setGuestsEn] = useState("");
  const [roomKey, setRoomKey] = useState("");
  const [ps, setPs] = useState(""); const [pe, setPe] = useState("");
  const [unit, setUnit] = useState<string>("");
  const [extraP, setExtraP] = useState<string>("0");
  const [customItems, setCustomItems] = useState<Item[]>([]);
  const [specialReq, setSpecialReq] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<InvRow | null>(null);
  const [emailTo, setEmailTo] = useState("");
  const [sending, setSending] = useState(false);
  const [savingImg, setSavingImg] = useState(false);

  useEffect(() => {
    try { setEmailTo(localStorage.getItem("resortEmail_" + resort) || ""); } catch {}
  }, [resort]);

  const nights = calcNights(ps, pe);
  const isJp = resort === "jaypark";
  const tier = isJp ? jparkTier(nights) : null;
  const currency = isJp ? "PHP" : "KRW";
  const rooms = isJp ? JPARK_ROOMS.map(r => ({ key: r.key, label: r.label })) : CUBENINE_ROOMS.map(r => ({ key: r.key, label: r.label }));
  const roomLabel = rooms.find(r => r.key === roomKey)?.label || "";

  useEffect(() => {
    if (!roomKey) return;
    if (isJp) {
      const r = JPARK_ROOMS.find(x => x.key === roomKey);
      if (r && tier) setUnit(String(r[tier]));
    } else {
      const r = CUBENINE_ROOMS.find(x => x.key === roomKey);
      if (r) setUnit(String(r.nightly));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, tier, isJp]);

  // 자동 항목 + 커스텀 항목 합치기
  const items: Item[] = useMemo(() => {
    const list: Item[] = [];
    if (nights > 0 && Number(unit) > 0 && roomLabel) {
      list.push({ label: `${nights} nights in a ${roomLabel} Room`, amount: nights * Number(unit) });
    }
    if (isJp && Number(extraP) > 0 && nights > 0) {
      list.push({ label: `Extra Person × ${extraP} (${nights} nights)`, amount: Number(extraP) * JPARK_EXTRA_PERSON * nights });
    }
    return [...list, ...customItems];
  }, [nights, unit, roomLabel, isJp, extraP, customItems]);
  const amount = items.reduce((a, i) => a + (Number(i.amount) || 0), 0);

  const loadBookings = useCallback(async () => {
    const { data } = await supabase.from("bookings")
      .select("id,reservation_no,booker_name,booker_english,status,checkin_date,checkout_date,accom_type,students,extra_guardians,seg1_type,seg1_checkin,seg1_checkout,seg2_type,seg2_checkin,seg2_checkout")
      .order("checkin_date", { ascending: false }).limit(300);
    const kw = resort === "jaypark" ? ["제이파크", "jaypark"] : ["큐브", "cubenine"];
    const list = ((data || []) as BookingLite[]).filter(b => {
      if ((b.status || "").includes("취소")) return false;
      const at = (b.accom_type || "").toLowerCase();
      return kw.some(k => at.includes(k)) || [b.seg1_type, b.seg2_type].some(t => kw.some(k => (t || "").toLowerCase().includes(k)));
    });
    setBookings(list);
  }, [resort]);

  const loadInvoices = useCallback(async () => {
    const { data } = await supabase.from("resort_invoices").select("*").order("created_at", { ascending: false }).limit(100);
    setInvoices((data || []) as InvRow[]);
  }, []);

  useEffect(() => { if (authed) { loadBookings(); setSelBooking(""); } }, [authed, resort, loadBookings]);
  useEffect(() => { if (authed) loadInvoices(); }, [authed, loadInvoices]);

  function pickBooking(id: string) {
    setSelBooking(id);
    const b = bookings.find(x => x.id === id);
    if (!b) return;
    setGuest((b.booker_english || b.booker_name || "").toUpperCase());
    setResNo(b.reservation_no || "");
    const kw = resort === "jaypark" ? "jaypark" : "cubenine";
    let s = b.checkin_date || "", e = b.checkout_date || "";
    if ((b.seg1_type || "") === kw && b.seg1_checkin) { s = b.seg1_checkin; e = b.seg1_checkout || e; }
    else if ((b.seg2_type || "") === kw && b.seg2_checkin) { s = b.seg2_checkin; e = b.seg2_checkout || e; }
    setPs((s || "").slice(0, 10)); setPe((e || "").slice(0, 10));
    // 투숙객 명단 = 예약자 + 추가 보호자 + 학생
    const kr: string[] = [], en: string[] = [];
    if (b.booker_name) kr.push(b.booker_name);
    if (b.booker_english) en.push(b.booker_english.toUpperCase());
    parseArr(b.extra_guardians).forEach(g => { if (g.kor) kr.push(g.kor); if (g.eng) en.push(String(g.eng).toUpperCase()); });
    parseArr(b.students).forEach(st => {
      const k = st.korName || st.name_kr || st.name || ""; const e2 = st.engName || st.name_en || "";
      if (k && k !== "-") kr.push(k); if (e2 && e2 !== "-") en.push(String(e2).toUpperCase());
    });
    setGuestsKr(kr.join(", ")); setGuestsEn(en.join(", "));
  }

  async function generate() {
    if (!guest.trim()) { alert("Reservation Name(영문 이름)을 입력해주세요."); return; }
    if (!ps || !pe || nights <= 0) { alert("체크인/체크아웃 날짜를 확인해주세요."); return; }
    if (!roomKey) { alert("룸 타입을 선택해주세요."); return; }
    if (items.length === 0) { alert("금액 항목이 없습니다. 단가를 확인해주세요."); return; }
    setSaving(true);
    const invoiceNo = `RI-${today().replace(/-/g, "")}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const payload = {
      invoice_no: invoiceNo, resort, booking_id: selBooking || null, guest_name: guest.trim(),
      room_type: roomLabel, period_start: ps, period_end: pe, nights,
      unit_price: Number(unit) || 0, extra_person: Number(extraP) || 0, extra_price: isJp ? JPARK_EXTRA_PERSON : 0,
      amount, currency, rate_tier: tier, status: "unpaid",
      items, guests_kr: guestsKr.trim() || null, guests_en: guestsEn.trim() || null,
      reservation_no: resNo.trim() || null, res_status: resStatus, special_request: specialReq.trim() || null,
    };
    const { data, error } = await supabase.from("resort_invoices").insert(payload).select().single();
    setSaving(false);
    if (error) { alert("저장 실패: " + error.message); return; }
    setPreview(data as InvRow);
    loadInvoices();
  }

  async function removeInvoice(id: string) {
    if (!confirm("이 인보이스를 삭제할까요?")) return;
    const { error } = await supabase.from("resort_invoices").delete().eq("id", id);
    if (error) { alert("삭제 실패: " + error.message); return; }
    if (preview?.id === id) setPreview(null);
    loadInvoices();
  }

  async function captureDoc(): Promise<string | null> {
    const el = document.getElementById("resort-inv-doc");
    if (!el) return null;
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
    return canvas.toDataURL("image/png");
  }

  async function saveImage() {
    if (!preview) return;
    setSavingImg(true);
    try {
      const url = await captureDoc();
      if (!url) return;
      const a = document.createElement("a");
      a.href = url; a.download = `invoice_${preview.invoice_no}.png`; a.click();
    } finally { setSavingImg(false); }
  }

  async function sendEmail() {
    if (!preview) return;
    const to = emailTo.trim();
    if (!to) { alert("받는 이메일 주소를 입력해주세요."); return; }
    if (!confirm(`${RESORT_LABEL[preview.resort as Resort]} (${to})로 인보이스 이미지를 보낼까요?`)) return;
    setSending(true);
    try {
      try { localStorage.setItem("resortEmail_" + preview.resort, to); } catch {}
      const img = await captureDoc();
      const r = await fetch("/api/resort-invoice/email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to,
          subject: `[Dream Company] Invoice ${preview.invoice_no} — ${preview.guest_name}`,
          text: `Hello,\n\nPlease find the attached invoice for the reservation below.\n\nGuest: ${preview.guest_name}\nRoom: ${preview.room_type}\nPeriod: ${preview.period_start} ~ ${preview.period_end} (${preview.nights} nights)\nTotal: ${num(preview.amount)} ${preview.currency}\n\nThank you.\nDream Company (Dream Academy)`,
          imageBase64: img, filename: `invoice_${preview.invoice_no}.png`,
        }),
      });
      const d = await r.json();
      if (!r.ok) { alert("발송 실패: " + (d.error || r.status)); return; }
      alert("이메일을 보냈습니다. ✅");
    } finally { setSending(false); }
  }

  const recent = useMemo(() => invoices.filter(v => v.resort === resort), [invoices, resort]);
  if (!authed) return null;

  const pvItems: Item[] = preview ? (Array.isArray(preview.items) && preview.items.length > 0 ? preview.items : [{ label: `${preview.nights} nights in a ${preview.room_type} Room`, amount: preview.amount }]) : [];

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.rw{max-width:1200px;margin:0 auto;padding:24px 18px 60px}
.rh{display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.rh h1{font-size:20px;font-weight:800;flex:1}
.rtabs{display:flex;gap:6px}
.rtab{padding:9px 20px;border:1px solid #e2e8f0;background:#fff;border-radius:9px;font-size:13.5px;font-weight:800;cursor:pointer;font-family:inherit;color:#475569}
.rtab.ac{background:#1a6fc4;border-color:#1a6fc4;color:#fff}
.card{background:#fff;border-radius:12px;padding:18px;box-shadow:0 2px 12px rgba(0,0,0,0.05);margin-bottom:14px}
.card h2{font-size:14px;font-weight:800;color:#1a6fc4;margin-bottom:12px;padding-bottom:7px;border-bottom:1px solid #e2e8f0}
.fl{display:block;font-size:11px;font-weight:700;color:#6b7c93;margin-bottom:4px}
.fi,.fsl{width:100%;padding:9px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;background:#fff}
.fr{display:flex;gap:10px;margin-bottom:10px;flex-wrap:wrap}
.fr>div{flex:1;min-width:150px}
.gen{padding:12px 26px;background:#7c3aed;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:800;cursor:pointer;font-family:inherit}
.gen:disabled{opacity:0.6;cursor:not-allowed}
.tbl{width:100%;border-collapse:collapse;font-size:12.5px}
.tbl th{background:#f8fafc;text-align:left;padding:8px 10px;font-size:11.5px;color:#475569;border-bottom:1px solid #e5e7eb}
.tbl td{padding:8px 10px;border-bottom:1px solid #f3f4f6}
.badge{display:inline-block;padding:2px 9px;border-radius:6px;font-size:11px;font-weight:800}
/* ── 인보이스 문서 (샘플 양식) ── */
.inv-doc{background:#fff;padding:36px 40px;max-width:820px;margin:0 auto;font-family:'Noto Sans KR',Arial,sans-serif;color:#111}
.inv-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;gap:12px}
.inv-title{background:#fdf6dd;padding:12px 34px;font-size:30px;font-weight:800;letter-spacing:4px;font-family:Georgia,serif}
.inv-x{font-size:14px;font-weight:800;margin-bottom:4px}
.inv-h2{font-size:24px;font-weight:900;margin-bottom:8px}
.ci{width:100%;border-collapse:collapse;font-size:13.5px}
.ci th{background:#f3f4f6;border:1px solid #cbd5e1;padding:9px 10px;font-weight:800;width:170px;text-align:center}
.ci td{border:1px solid #cbd5e1;padding:9px 12px;text-align:center}
.po{border:1px solid #cbd5e1;margin-top:8px}
.po-h{border-bottom:1px solid #cbd5e1;padding:9px 12px;font-size:17px;font-weight:900}
.po-items{min-height:130px;padding:12px}
.po-item{display:flex;justify-content:space-between;font-size:14px;padding:4px 2px}
.po-foot{display:grid;grid-template-columns:170px 1fr 170px 1fr;border-top:1px solid #cbd5e1;font-size:14px}
.po-foot .k{background:#f3f4f6;padding:10px;font-weight:800;text-align:center;border-right:1px solid #cbd5e1}
.po-foot .v{padding:10px 14px;text-align:right;font-weight:700;border-right:1px solid #cbd5e1}
.oc{display:grid;grid-template-columns:170px 1fr;border:1px solid #cbd5e1;margin-top:8px;font-size:14px}
.oc .k{background:#f3f4f6;padding:12px;font-weight:800;text-align:center;border-right:1px solid #cbd5e1}
.oc .v{padding:12px 14px}
@media print{
  body{background:#fff!important}
  .no-print{display:none!important}
  .rw{padding:0!important;max-width:none!important}
  .card{box-shadow:none!important;border:none!important}
}
    `}</style>
    <div className="rw">
      <div className="rh no-print">
        <h1>🏨 리조트 인보이스 생성</h1>
        <div className="rtabs">
          {(["jaypark", "cubenine"] as Resort[]).map(r => (
            <button key={r} className={`rtab${resort === r ? " ac" : ""}`} onClick={() => { setResort(r); setRoomKey(""); setUnit(""); setPreview(null); setCustomItems([]); }}>{RESORT_LABEL[r]}</button>
          ))}
        </div>
      </div>

      <div className="card no-print">
        <h2>1. 예약 불러오기 (선택)</h2>
        <select className="fsl" value={selBooking} onChange={e => pickBooking(e.target.value)}>
          <option value="">— 예약 선택 안 함 (직접 입력) —</option>
          {bookings.map(b => (
            <option key={b.id} value={b.id}>
              {b.booker_name}{b.booker_english ? ` (${b.booker_english})` : ""} · {(b.checkin_date || "").slice(0, 10)} ~ {(b.checkout_date || "").slice(0, 10)} · {b.accom_type || ""}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 6 }}>{RESORT_LABEL[resort]} 포함 예약 {bookings.length}건 — 선택하면 이름·기간·투숙객 명단 자동 입력</div>
      </div>

      <div className="card no-print">
        <h2>2. 인보이스 내용</h2>
        <div className="fr">
          <div><span className="fl">Reservation Name (영문)</span><input className="fi" value={guest} onChange={e => setGuest(e.target.value)} placeholder="JIN HUI SU" /></div>
          <div><span className="fl">Reservation Number</span><input className="fi" value={resNo} onChange={e => setResNo(e.target.value)} placeholder="(선택)" /></div>
          <div><span className="fl">Reservation Status</span>
            <select className="fsl" value={resStatus} onChange={e => setResStatus(e.target.value)}>
              <option value="tentatively">tentatively</option>
              <option value="confirmed">confirmed</option>
            </select>
          </div>
        </div>
        <div className="fr">
          <div><span className="fl">체크인</span><input className="fi" type="date" value={ps} onChange={e => setPs(e.target.value)} /></div>
          <div><span className="fl">체크아웃</span><input className="fi" type="date" value={pe} onChange={e => setPe(e.target.value)} /></div>
          <div><span className="fl">룸 타입</span>
            <select className="fsl" value={roomKey} onChange={e => setRoomKey(e.target.value)}>
              <option value="">— 선택 —</option>
              {rooms.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
          <div><span className="fl">박 수 {isJp && tier ? `· ${JPARK_TIER_LABEL[tier]}` : ""}</span><input className="fi" value={nights ? `${nights} nights` : "-"} readOnly style={{ background: "#f3f4f6" }} /></div>
        </div>
        <div className="fr">
          <div><span className="fl">1박 단가 ({currency}) — 수정 가능</span><input className="fi" type="number" value={unit} onChange={e => setUnit(e.target.value)} /></div>
          {isJp && <div><span className="fl">Extra Person (₱{num(JPARK_EXTRA_PERSON)}/박)</span>
            <select className="fsl" value={extraP} onChange={e => setExtraP(e.target.value)}>
              {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}명</option>)}
            </select>
          </div>}
        </div>
        <div className="fr">
          <div><span className="fl">Guest Name (korean) — 쉼표로 구분</span><input className="fi" value={guestsKr} onChange={e => setGuestsKr(e.target.value)} placeholder="서지영, 정승연, 진희수" /></div>
        </div>
        <div className="fr">
          <div><span className="fl">Guest Name (En)</span><input className="fi" value={guestsEn} onChange={e => setGuestsEn(e.target.value)} placeholder="SEO JI YOUNG, JUNG SEUNG YEON" /></div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <span className="fl">추가 항목 (조식 등)</span>
          {customItems.map((it, i) => (
            <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <input className="fi" style={{ flex: 2 }} value={it.label} onChange={e => setCustomItems(cs => cs.map((c, j) => j === i ? { ...c, label: e.target.value } : c))} placeholder="Breakfast - 7 Days (2 Kids)" />
              <input className="fi" style={{ flex: 1 }} type="number" value={it.amount || ""} onChange={e => setCustomItems(cs => cs.map((c, j) => j === i ? { ...c, amount: Number(e.target.value) } : c))} placeholder="금액" />
              <button className="rtab" style={{ color: "#dc2626" }} onClick={() => setCustomItems(cs => cs.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button className="rtab" style={{ padding: "6px 14px", fontSize: 12 }} onClick={() => setCustomItems(cs => [...cs, { label: "", amount: 0 }])}>+ 항목 추가</button>
        </div>
        <div className="fr">
          <div><span className="fl">Special Requests (영문)</span><input className="fi" value={specialReq} onChange={e => setSpecialReq(e.target.value)} placeholder="If possible, we would like to request a room with twin beds" /></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>Total: <span style={{ color: "#7c3aed" }}>{num(amount)} {currency}</span></div>
          <button className="gen" disabled={saving} onClick={generate}>{saving ? "생성 중..." : "🧾 인보이스 생성"}</button>
        </div>
      </div>

      {preview && (
        <div className="card" style={{ background: "#f8fafc" }}>
          <div className="no-print" style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <input className="fi" style={{ maxWidth: 260 }} value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="받는 이메일 (리조트)" />
            <button className="rtab" disabled={sending} onClick={sendEmail}>{sending ? "발송 중..." : "📧 이메일 보내기"}</button>
            <button className="rtab" disabled={savingImg} onClick={saveImage}>{savingImg ? "저장 중..." : "📷 이미지 저장"}</button>
            <button className="rtab" onClick={() => window.print()}>🖨️ 인쇄</button>
            <button className="rtab" onClick={() => setPreview(null)}>닫기</button>
          </div>
          <div className="inv-doc" id="resort-inv-doc">
            <div className="inv-top">
              <img src="/dream-academy-logo.png" alt="Dream Company" style={{ height: 54, width: "auto" }} />
              <div className="inv-title">INVOICE</div>
            </div>
            <div className="inv-x">{RESORT_X[preview.resort as Resort]}</div>
            <div className="inv-h2">Customer Information</div>
            <table className="ci"><tbody>
              <tr><th>Reservation Name</th><td>{preview.guest_name}</td><th>Reservation Number</th><td>{preview.reservation_no || ""}</td></tr>
              <tr><th>Reservation Date</th><td>{preview.created_at?.slice(0, 10)}</td><th>Reservation Status</th><td style={{ fontWeight: 800 }}>{preview.res_status || "tentatively"}</td></tr>
              <tr><th>Check-In</th><td>{preview.period_start}</td><th>time</th><td>오후 3:00</td></tr>
              <tr><th>Check-Out</th><td>{preview.period_end}</td><th>time</th><td style={{ color: "#dc2626", fontWeight: 700 }}>12:00 noon</td></tr>
              <tr><th>Room Type</th><td>{preview.room_type}</td><th>Nights</th><td>{preview.nights} nights</td></tr>
              <tr><th>Guest Name(korean)</th><td colSpan={3} style={{ textAlign: "left" }}>{preview.guests_kr || ""}</td></tr>
              <tr><th>Guest Name(En)</th><td colSpan={3} style={{ textAlign: "left" }}>{preview.guests_en || ""}</td></tr>
            </tbody></table>
            <div className="inv-h2" style={{ marginTop: 26 }}>Invoice Details</div>
            <div className="po">
              <div className="po-h">Purchase Order</div>
              <div className="po-items">
                {pvItems.map((it, i) => (
                  <div key={i} className="po-item"><span>{it.label}</span><span style={{ fontWeight: i === 0 ? 500 : 800 }}>{num(it.amount)}</span></div>
                ))}
              </div>
              <div className="po-foot">
                <div className="k">Total Amount</div><div className="v">{num(preview.amount)}</div>
                <div className="k">Payment Amount</div><div className="v" style={{ borderRight: "none" }}>{num(preview.amount)}</div>
              </div>
            </div>
            <div className="inv-h2" style={{ marginTop: 26, fontSize: 19 }}>Other Confirmation Items</div>
            <div className="oc">
              <div className="k">Special Requests</div>
              <div className="v">{preview.special_request || "-"}</div>
            </div>
          </div>
        </div>
      )}

      <div className="card no-print">
        <h2>최근 생성된 인보이스 — {RESORT_LABEL[resort]} ({recent.length})</h2>
        {recent.length === 0 ? <div style={{ color: "#9ca3af", fontSize: 13, padding: 14, textAlign: "center" }}>아직 없습니다.</div> : (
          <table className="tbl"><thead><tr>
            <th>번호</th><th>손님</th><th>룸</th><th>기간</th><th>박</th><th>금액</th><th>상태</th><th style={{ width: 120 }}></th>
          </tr></thead><tbody>
            {recent.map(v => (
              <tr key={v.id}>
                <td style={{ fontWeight: 700, color: "#1a6fc4" }}>{v.invoice_no}</td>
                <td style={{ fontWeight: 700 }}>{v.guest_name}</td>
                <td>{v.room_type}</td>
                <td>{v.period_start} ~ {v.period_end}</td>
                <td>{v.nights}</td>
                <td style={{ fontWeight: 800 }}>{num(v.amount)} {v.currency}</td>
                <td>{v.status === "paid"
                  ? <span className="badge" style={{ background: "#dcfce7", color: "#166534" }}>결제완료</span>
                  : <span className="badge" style={{ background: "#fef3c7", color: "#92400e" }}>미결제</span>}</td>
                <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                  <button className="rtab" style={{ padding: "4px 10px", fontSize: 11, marginRight: 4 }} onClick={() => setPreview(v)}>보기</button>
                  <button className="rtab" style={{ padding: "4px 10px", fontSize: 11, color: "#dc2626" }} onClick={() => removeInvoice(v.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody></table>
        )}
      </div>
    </div>
  </>);
}
