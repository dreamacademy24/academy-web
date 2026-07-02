"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";
import { JPARK_ROOMS, JPARK_EXTRA_PERSON, JPARK_TIER_LABEL, jparkTier, CUBENINE_ROOMS, calcNights } from "@/lib/resortRates";

type Resort = "jaypark" | "cubenine";
const RESORT_LABEL: Record<Resort, string> = { jaypark: "제이파크", cubenine: "큐브나인" };
const RESORT_EN: Record<Resort, string> = { jaypark: "Jpark Island Resort & Waterpark, Mactan, Cebu", cubenine: "Cube Nine Residence, Cebu" };

interface BookingLite {
  id: string; booker_name: string; booker_english: string | null; status: string;
  checkin_date: string | null; checkout_date: string | null; accom_type: string | null;
  jp_room_type: string | null; cn_room_type: string | null;
  seg1_type: string | null; seg1_checkin: string | null; seg1_checkout: string | null;
  seg2_type: string | null; seg2_checkin: string | null; seg2_checkout: string | null;
}
interface InvRow {
  id: string; invoice_no: string; resort: string; booking_id: string | null; guest_name: string;
  room_type: string; period_start: string; period_end: string; nights: number;
  unit_price: number; extra_person: number; extra_price: number; amount: number;
  currency: string; rate_tier: string | null; memo: string | null; status: string;
  paid_date: string | null; created_at: string;
}

function fmtMoney(n: number, cur: string) {
  return (cur === "PHP" ? "₱" : "₩") + Number(n || 0).toLocaleString();
}
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
  const [guest, setGuest] = useState("");
  const [roomKey, setRoomKey] = useState("");
  const [ps, setPs] = useState(""); const [pe, setPe] = useState("");
  const [unit, setUnit] = useState<string>("");
  const [extraP, setExtraP] = useState<string>("0");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<InvRow | null>(null);

  const nights = calcNights(ps, pe);
  const isJp = resort === "jaypark";
  const tier = isJp ? jparkTier(nights) : null;
  const currency = isJp ? "PHP" : "KRW";
  const extraPrice = isJp ? JPARK_EXTRA_PERSON : 0;
  const rooms = isJp ? JPARK_ROOMS.map(r => ({ key: r.key, label: `${r.label} (${r.location})` })) : CUBENINE_ROOMS.map(r => ({ key: r.key, label: r.label }));

  // 룸/기간 바뀌면 단가 자동 제안
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

  const amount = nights * (Number(unit) || 0) + nights * (Number(extraP) || 0) * extraPrice;

  const loadBookings = useCallback(async () => {
    const { data } = await supabase.from("bookings")
      .select("id,booker_name,booker_english,status,checkin_date,checkout_date,accom_type,jp_room_type,cn_room_type,seg1_type,seg1_checkin,seg1_checkout,seg2_type,seg2_checkin,seg2_checkout")
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
    setGuest(b.booker_english || b.booker_name || "");
    const kw = resort === "jaypark" ? "jaypark" : "cubenine";
    let s = b.checkin_date || "", e = b.checkout_date || "";
    if ((b.seg1_type || "") === kw && b.seg1_checkin) { s = b.seg1_checkin; e = b.seg1_checkout || e; }
    else if ((b.seg2_type || "") === kw && b.seg2_checkin) { s = b.seg2_checkin; e = b.seg2_checkout || e; }
    setPs((s || "").slice(0, 10)); setPe((e || "").slice(0, 10));
  }

  async function generate() {
    if (!guest.trim()) { alert("손님 이름을 입력해주세요."); return; }
    if (!ps || !pe || nights <= 0) { alert("기간을 확인해주세요."); return; }
    if (!roomKey) { alert("룸 타입을 선택해주세요."); return; }
    if (!Number(unit)) { alert("단가를 입력해주세요."); return; }
    setSaving(true);
    const roomLabel = rooms.find(r => r.key === roomKey)?.label || roomKey;
    const invoiceNo = `RI-${today().replace(/-/g, "")}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const payload = {
      invoice_no: invoiceNo, resort, booking_id: selBooking || null, guest_name: guest.trim(),
      room_type: roomLabel, period_start: ps, period_end: pe, nights,
      unit_price: Number(unit), extra_person: Number(extraP) || 0, extra_price: extraPrice,
      amount, currency, rate_tier: tier, memo: memo.trim() || null, status: "unpaid",
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

  const recent = useMemo(() => invoices.filter(v => v.resort === resort), [invoices, resort]);

  if (!authed) return null;

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
.inv-doc{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:34px 38px;max-width:640px;margin:0 auto}
.inv-doc h3{font-size:22px;letter-spacing:2px;margin-bottom:4px}
.inv-kv{display:grid;grid-template-columns:150px 1fr;gap:6px 12px;font-size:13.5px;margin:16px 0}
.inv-kv .k{color:#6b7c93;font-weight:700}
.inv-total{display:flex;justify-content:space-between;align-items:center;border-top:2px solid #1a1a2e;margin-top:14px;padding-top:12px;font-size:16px;font-weight:900}
@media print{
  body{background:#fff!important}
  .no-print{display:none!important}
  .rw{padding:0!important;max-width:none!important}
  .inv-doc{border:none!important;max-width:none!important}
}
    `}</style>
    <div className="rw">
      <div className="rh no-print">
        <h1>🏨 리조트 인보이스 생성</h1>
        <div className="rtabs">
          {(["jaypark", "cubenine"] as Resort[]).map(r => (
            <button key={r} className={`rtab${resort === r ? " ac" : ""}`} onClick={() => { setResort(r); setRoomKey(""); setUnit(""); setPreview(null); }}>{RESORT_LABEL[r]}</button>
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
        <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 6 }}>{RESORT_LABEL[resort]} 포함 예약 {bookings.length}건</div>
      </div>

      <div className="card no-print">
        <h2>2. 인보이스 내용</h2>
        <div className="fr">
          <div><span className="fl">손님 이름 (영문 권장)</span><input className="fi" value={guest} onChange={e => setGuest(e.target.value)} placeholder="HONG GILDONG" /></div>
          <div><span className="fl">룸 타입</span>
            <select className="fsl" value={roomKey} onChange={e => setRoomKey(e.target.value)}>
              <option value="">— 선택 —</option>
              {rooms.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div className="fr">
          <div><span className="fl">체크인</span><input className="fi" type="date" value={ps} onChange={e => setPs(e.target.value)} /></div>
          <div><span className="fl">체크아웃</span><input className="fi" type="date" value={pe} onChange={e => setPe(e.target.value)} /></div>
          <div><span className="fl">박 수 (자동)</span><input className="fi" value={nights ? `${nights}박` : "-"} readOnly style={{ background: "#f3f4f6" }} /></div>
          {isJp && <div><span className="fl">요금 단계 (자동)</span><input className="fi" value={tier ? JPARK_TIER_LABEL[tier] : "-"} readOnly style={{ background: "#f3f4f6" }} /></div>}
        </div>
        <div className="fr">
          <div><span className="fl">1박 단가 ({currency === "PHP" ? "₱ 페소" : "₩ 원화"}) — 수정 가능</span><input className="fi" type="number" value={unit} onChange={e => setUnit(e.target.value)} /></div>
          {isJp && <div><span className="fl">Extra Person (₱{JPARK_EXTRA_PERSON.toLocaleString()}/박)</span>
            <select className="fsl" value={extraP} onChange={e => setExtraP(e.target.value)}>
              {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}명</option>)}
            </select>
          </div>}
          <div><span className="fl">메모 (선택)</span><input className="fi" value={memo} onChange={e => setMemo(e.target.value)} placeholder="예: B동 요청, 얼리체크인" /></div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>합계: <span style={{ color: "#7c3aed" }}>{fmtMoney(amount, currency)}</span>
            {nights > 0 && Number(unit) > 0 && <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, marginLeft: 8 }}>({fmtMoney(Number(unit), currency)} × {nights}박{isJp && Number(extraP) > 0 ? ` + Extra ${extraP}명` : ""})</span>}
          </div>
          <button className="gen" disabled={saving} onClick={generate}>{saving ? "생성 중..." : "🧾 인보이스 생성"}</button>
        </div>
      </div>

      {preview && (
        <div className="card" style={{ background: "#f8fafc" }}>
          <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginBottom: 10 }}>
            <button className="rtab" onClick={() => window.print()}>🖨️ 인쇄 / PDF</button>
            <button className="rtab" onClick={() => setPreview(null)}>닫기</button>
          </div>
          <div className="inv-doc">
            <h3>INVOICE</h3>
            <div style={{ fontSize: 12.5, color: "#6b7c93" }}>No. {preview.invoice_no} · Issued {preview.created_at?.slice(0, 10)}</div>
            <div className="inv-kv">
              <span className="k">From</span><span>Dream Company (Dream Academy)</span>
              <span className="k">To</span><span>{RESORT_EN[preview.resort as Resort]}</span>
              <span className="k">Guest</span><span style={{ fontWeight: 800 }}>{preview.guest_name}</span>
              <span className="k">Room Type</span><span>{preview.room_type}</span>
              <span className="k">Period</span><span>{preview.period_start} ~ {preview.period_end} ({preview.nights} nights)</span>
              <span className="k">Rate / Night</span><span>{fmtMoney(preview.unit_price, preview.currency)}</span>
              {preview.extra_person > 0 && (<>
                <span className="k">Extra Person</span><span>{preview.extra_person} × {fmtMoney(preview.extra_price, preview.currency)} / night</span>
              </>)}
              {preview.memo && (<><span className="k">Note</span><span>{preview.memo}</span></>)}
            </div>
            <div className="inv-total"><span>TOTAL</span><span>{fmtMoney(preview.amount, preview.currency)}</span></div>
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
                <td style={{ fontWeight: 800 }}>{fmtMoney(v.amount, v.currency)}</td>
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
