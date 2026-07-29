"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed, getAdminInfo } from "@/lib/adminAuth";
import { JPARK_ROOMS, JPARK_EXTRA_PERSON, JPARK_TIER_LABEL, jparkTier, CUBENINE_ROOMS, calcNights } from "@/lib/resortRates";
import ResortInvoiceDoc from "./ResortInvoiceDoc";

type Resort = "jaypark" | "cubenine";
const RESORT_LABEL: Record<Resort, string> = { jaypark: "제이파크", cubenine: "큐브나인" };

interface Item { label: string; amount: number }
interface BookingLite {
  id: string; reservation_no: string | null; booker_name: string; booker_english: string | null; status: string;
  checkin_date: string | null; checkout_date: string | null; accom_type: string | null;
  students: unknown; extra_guardians: unknown; special_request?: string | null;
  jp_room_type?: string | null; cn_room_type?: string | null;
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
  confirm_no: string | null;
}

function num(n: number) { return Number(n || 0).toLocaleString(); }
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseArr(v: unknown): Record<string, string>[] {
  try { const p = typeof v === "string" ? JSON.parse(v) : v; return Array.isArray(p) ? p : []; } catch { return []; }
}

// 손님 인보이스 한글 항목 → 리조트용 영어 라벨 자동 변환 (규칙 기반)
const MONTH_EN = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function koLabelToEn(t: string): string {
  let s = String(t || "");
  s = s.replace(/(\d{1,2})월\s*(\d{1,2})일\s*~\s*(\d{1,2})월\s*(\d{1,2})일/g, (_m, m1, d1, m2, d2) => `${MONTH_EN[+m1]} ${d1} ~ ${MONTH_EN[+m2]} ${d2}`);
  s = s.replace(/(\d{1,2})월\s*(\d{1,2})일\s*~\s*(\d{1,2})일/g, (_m, m1, d1, d2) => `${MONTH_EN[+m1]} ${d1}~${d2}`);
  s = s.replace(/(\d{1,2})월\s*(\d{1,2})일/g, (_m, m1, d1) => `${MONTH_EN[+m1]} ${d1}`);
  s = s.replace(/(\d+)\s*박/g, (_m, n) => `${n} night${+n > 1 ? "s" : ""}`);
  s = s.replace(/(\d+)\s*인/g, (_m, n) => `${n} person${+n > 1 ? "s" : ""}`);
  const dict: [RegExp, string][] = [
    [/조식/g, "Breakfast"], [/중식|점심/g, "Lunch"], [/석식|저녁/g, "Dinner"],
    [/오션디럭스/g, "Ocean Deluxe"], [/디럭스/g, "Deluxe"], [/프리미어/g, "Premier"],
    [/오션뷰/g, "Ocean View"], [/풀사이드/g, "Poolside"], [/풀억세스(룸)?/g, "Pool Access"], [/마운틴/g, "Mountain"], [/스위트/g, "Suite"],
    [/레이트\s*체크아웃/g, "Late check-out"], [/얼리\s*체크인/g, "Early check-in"],
    [/추가/g, "extra"], [/객실|룸/g, "Room"],
  ];
  dict.forEach(([re, en]) => { s = s.replace(re, en); });
  // "15 nights Breakfast 1 person extra" → "Breakfast for 1 person × 15 nights"
  s = s.replace(/(\d+ nights?)\s+Breakfast\s+(\d+ persons?)\s+extra/g, "Breakfast for $2 × $1");
  s = s.replace(/\s*\/\s*/g, " · ").replace(/\s{2,}/g, " ").trim();
  return s;
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
  const [srModal, setSrModal] = useState(false);
  const [srSel, setSrSel] = useState<string[]>([]);
  const SR_PRESETS: { key: string; ko: string; en: string }[] = [
    { key: "tile",    ko: "타일룸",        en: "a tiled-floor room" },
    { key: "twin",    ko: "트윈베드",      en: "twin beds" },
    { key: "king",    ko: "킹사이즈 베드", en: "a king-size bed" },
    { key: "extra",   ko: "엑스트라 베드", en: "an extra bed" },
    { key: "high",    ko: "고층",          en: "a high floor" },
    { key: "low",     ko: "저층",          en: "a low floor" },
    { key: "crib",    ko: "아기 침대",     en: "a baby crib" },
    { key: "connect", ko: "커넥팅 룸",     en: "connecting rooms" },
  ];
  const srText = srSel.length === 0 ? "" : `If possible, we would like to request ${srSel.map(k => SR_PRESETS.find(p2 => p2.key === k)?.en).filter(Boolean).join(", ").replace(/, ([^,]*)$/, " and $1")}.`;
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<InvRow | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editNo, setEditNo] = useState<string>("");
  const [guestView, setGuestView] = useState(false);
  const [emailTo, setEmailTo] = useState("");
  // 손님 인보이스(스냅샷) 참고 내역 — 예약 선택 시 로드
  interface RefInfo { items: { label: string; price: number }[]; additions: { name: string; amount: number }[]; discounts: { name: string; amount: number }[]; special: string; lateCheckout: string }
  const [refInfo, setRefInfo] = useState<RefInfo | null>(null);
  const [sending, setSending] = useState(false);
  const [emailModal, setEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailCc, setEmailCc] = useState("");
  const [attachImg, setAttachImg] = useState<string>(""); // 첨부될 인보이스 PNG 미리보기
  const [emailBody, setEmailBody] = useState("");
  const [savingImg, setSavingImg] = useState(false);

  useEffect(() => {
    try { setEmailTo(localStorage.getItem("resortEmail_" + resort) || ""); } catch {}
  }, [resort]);

  // 제이파크 수신처 자동 입력: rsvn@ + travel@ 두 곳 동시 발송 (저장된 수동 입력이 있으면 그대로)
  useEffect(() => {
    if (!preview || preview.resort !== "jaypark") return;
    let saved = "";
    try { saved = localStorage.getItem("resortEmail_jaypark") || ""; } catch {}
    if (saved && !saved.includes("travel@jparkislandresort.com")) return; // 메이가 직접 저장한 주소 우선 (travel@ 포함 옛 저장값은 무시)
    setEmailTo("rsvn@jparkislandresort.com");
  }, [preview]);

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
      .select("id,reservation_no,booker_name,booker_english,status,checkin_date,checkout_date,accom_type,jp_room_type,cn_room_type,students,extra_guardians,special_request,seg1_type,seg1_checkin,seg1_checkout,seg2_type,seg2_checkin,seg2_checkout")
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
    // 룸 타입 자동 선택 (예약의 한글 룸타입/텍스트 → 리조트 룸 키 매핑)
    const roomKeyFromText = (txt: string): string => {
      if (!txt) return "";
      if (resort === "jaypark") {
        if (/(막탄).*(오션)|(오션).*(막탄)/.test(txt)) return "mactan_suite_ov";
        if (/막탄/.test(txt)) return "mactan_suite";
        if (/(오션.*디럭스|디럭스.*오션)/.test(txt)) return "deluxe_ov";
        if (/(프리미어.*오션|오션.*프리미어)/.test(txt)) return "premier_ov";
        if (/프리미어/.test(txt)) return "premier";
        if (/마운틴/.test(txt)) return "mountain_suite";
        if (/오션\s*스(위|윗)트?/.test(txt)) return "ocean_suite";
        if (/디럭스/.test(txt)) return "deluxe";
        return "";
      }
      if (/풀/.test(txt)) return "poolside";
      if (/오션|디럭스/.test(txt)) return "ocean_deluxe";
      return "";
    };
    const rtRaw = ((resort === "jaypark" ? b.jp_room_type : b.cn_room_type) || "");
    const rk = roomKeyFromText(rtRaw) || roomKeyFromText(String(b.special_request || ""));
    if (rk) setRoomKey(rk); else setRoomKey("");
    // 손님 인보이스 스냅샷 → 참고 내역 + 추가 항목 프리필 (금액은 페소로 직접 입력)
    setRefInfo(null); setCustomItems([]);
    fetch("/api/invoice/snapshot?booking_id=" + id).then(r => r.json()).then(d => {
      const sd = d?.snapshot?.saved_data || {};
      const bl = sd.billing || {};
      const additions = (Array.isArray(bl.additions) ? bl.additions : []).map((x: { name?: string; amount?: number }) => ({ name: String(x.name || "").trim(), amount: Number(x.amount) || 0 })).filter((x: { name: string }) => x.name);
      const discounts = (Array.isArray(bl.discounts) ? bl.discounts : []).map((x: { name?: string; amount?: number }) => ({ name: String(x.name || "").trim(), amount: Number(x.amount) || 0 })).filter((x: { name: string }) => x.name);
      const items2 = (Array.isArray(bl.items) ? bl.items : []).map((x: { label?: string; price?: number }) => ({ label: String(x.label || ""), price: Number(x.price) || 0 }));
      const special = String(b.special_request || "").trim();
      const lateCheckout = sd.lateCheckout === true ? "있음" : (typeof sd.lateCheckout === "string" ? sd.lateCheckout.trim() : "");
      if (items2.length || additions.length || discounts.length || special || lateCheckout) {
        setRefInfo({ items: items2, additions, discounts, special, lateCheckout });
      }
      // 추가 항목(조식·1박 추가 등)은 라벨만 복사 — 리조트 지불 금액(₱)은 직접 입력
      if (additions.length) setCustomItems(additions.map((x: { name: string }) => ({ label: koLabelToEn(x.name), amount: 0 })));
      if (special) setSpecialReq(special);
      // 예약에 룸타입이 없으면 손님 인보이스 항목/추가항목 텍스트에서 룸 추정 (예: "제이파크 막탄스윗 1박 추가")
      if (!rk) {
        const joined = additions.map((x: { name: string }) => x.name).join(" ") + " " + items2.map((x: { label: string }) => x.label).join(" ");
        const rk2 = roomKeyFromText(joined);
        if (rk2) setRoomKey(rk2);
      }
    }).catch(() => {});
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

  function loadForEdit(v: InvRow) {
    setResort(v.resort as Resort);
    setSelBooking("");
    setGuest(v.guest_name || "");
    setResNo(v.reservation_no || "");
    setResStatus(v.res_status || "tentatively");
    setGuestsKr(v.guests_kr || ""); setGuestsEn(v.guests_en || "");
    setPs(v.period_start || ""); setPe(v.period_end || "");
    setExtraP(String(v.extra_person || 0));
    setSpecialReq(v.special_request || "");
    const rk = (v.resort === "jaypark" ? JPARK_ROOMS : CUBENINE_ROOMS).find(r => r.label === v.room_type)?.key || "";
    setRoomKey(rk);
    const custom = (Array.isArray(v.items) ? v.items : []).filter(it =>
      !/nights in a /.test(it.label) && !/^Extra Person/.test(it.label));
    setCustomItems(custom);
    setEditId(v.id); setEditNo(v.invoice_no);
    setPreview(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function generate() {
    if (!guest.trim()) { alert("Reservation Name(영문 이름)을 입력해주세요."); return; }
    if (!ps || !pe || nights <= 0) { alert("체크인/체크아웃 날짜를 확인해주세요."); return; }
    if (!roomKey) { alert("룸 타입을 선택해주세요."); return; }
    if (items.length === 0) { alert("금액 항목이 없습니다. 단가를 확인해주세요."); return; }
    setSaving(true);
    if (editId) {
      const upd = {
        resort, guest_name: guest.trim(), room_type: roomLabel, period_start: ps, period_end: pe, nights,
        unit_price: Number(unit) || 0, extra_person: Number(extraP) || 0, extra_price: isJp ? JPARK_EXTRA_PERSON : 0,
        amount, currency, rate_tier: tier,
        items, guests_kr: guestsKr.trim() || null, guests_en: guestsEn.trim() || null,
        reservation_no: resNo.trim() || null, res_status: resStatus, special_request: specialReq.trim() || null,
      };
      const { data, error } = await supabase.from("resort_invoices").update(upd).eq("id", editId).select().single();
      setSaving(false);
      if (error) { alert("수정 실패: " + error.message); return; }
      setEditId(null); setEditNo("");
      setPreview(data as InvRow);
      loadInvoices();
      return;
    }
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

  // 이메일 작성 화면 열기 — 직원 프로필(직원업무 설정 > 프로필)에 저장한 서명 자동 사용
  async function openEmailModal() {
    if (!preview) return;
    const info = getAdminInfo();
    const staff = info?.name || "Dream Company Staff";
    let signature = `Best regards,\n${staff}\nDream Company (Dream Academy)`;
    try {
      const d = await fetch("/api/admin/staff-accounts?role=korean_admin").then(r => r.json());
      const sid = info?.staffId || "";
      const uname = sid.startsWith("admin-") ? sid : "admin-" + sid; // staffId가 이미 admin- 접두사를 가진 경우 대응
      const row = (d.staff || []).find((x: { username: string }) => x.username === uname);
      if (row?.signature?.trim()) signature = row.signature.trim();
    } catch {}
    setEmailSubject(`[Dream Company] Reservation Request — ${preview.guest_name} (${preview.period_start} ~ ${preview.period_end})`);
    setEmailBody(
`Dear ${preview.resort === "jaypark" ? "Jpark Reservations Team" : "Cube Nine Team"},

Greetings from Dream Company (Dream Academy).
Please find the attached invoice for the reservation below.

Guest: ${preview.guest_name}
Room: ${preview.room_type}
Period: ${preview.period_start} ~ ${preview.period_end} (${preview.nights} nights)
Total: ${num(preview.amount)} ${preview.currency}

Kindly send us the confirmation number for this booking.

${signature}`);
    try {
      const savedCc = localStorage.getItem("resortEmailCc") || "deskor112@gmail.com";
      // britney.na는 항상 참조에 포함 (메이 지시 2026-07-07)
      const withB = savedCc.includes("britney.na@jparkislandresort.com") ? savedCc : savedCc + ", britney.na@jparkislandresort.com";
      setEmailCc(withB);
    } catch { setEmailCc("deskor112@gmail.com, britney.na@jparkislandresort.com"); }
    setAttachImg("");
    setEmailModal(true);
    // 첨부될 인보이스 이미지를 미리 만들어 우측에 보여줌 (발송 시 이 이미지가 그대로 첨부됨)
    setTimeout(async () => { const img = await captureDoc(); if (img) setAttachImg(img); }, 100);
  }

  async function sendEmail() {
    if (!preview) return;
    const to = emailTo.trim();
    if (!to) { alert("받는 이메일 주소를 입력해주세요."); return; }
    setSending(true);
    try {
      // 제이파크 기본 주소 2종(rsvn/travel)은 저장하지 않음 — 박 수 자동 분기가 계속 작동하도록
      const jpDefaults = ["rsvn@jparkislandresort.com", "travel@jparkislandresort.com", "rsvn@jparkislandresort.com, travel@jparkislandresort.com"]; // travel@ 제외됨(2026-07-28) — 과거 저장값 호환용으로만 유지
      if (!(preview.resort === "jaypark" && jpDefaults.includes(to))) {
        try { localStorage.setItem("resortEmail_" + preview.resort, to); } catch {}
      }
      const cc = emailCc.trim();
      try { if (cc) localStorage.setItem("resortEmailCc", cc); } catch {}
      const img = attachImg || await captureDoc();
      const r = await fetch("/api/resort-invoice/email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to, cc: cc || undefined,
          subject: emailSubject.trim() || `[Dream Company] Invoice ${preview.invoice_no}`,
          text: emailBody,
          imageBase64: img, filename: `invoice_${preview.invoice_no}.png`,
        }),
      });
      const d = await r.json();
      if (!r.ok) { alert("발송 실패: " + (d.error || r.status)); return; }
      setEmailModal(false);
      alert("이메일을 보냈습니다. ✅");
    } finally { setSending(false); }
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
        <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 6 }}>{RESORT_LABEL[resort]} 포함 예약 {bookings.length}건 — 선택하면 이름·기간·투숙객 명단·추가항목·요청사항 자동 입력</div>
        {refInfo && (
          <div style={{ marginTop: 10, padding: "11px 14px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 9, fontSize: 12.5 }}>
            <div style={{ fontWeight: 800, color: "#1e40af", marginBottom: 6 }}>📋 손님 인보이스 내역 (참고 — 금액은 손님 청구 원화)</div>
            {refInfo.items.map((it, i) => (
              <div key={"i" + i} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0" }}><span>{it.label}</span><span>{it.price.toLocaleString()}원</span></div>
            ))}
            {refInfo.discounts.map((it, i) => (
              <div key={"d" + i} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", color: "#dc2626" }}><span>↓ {it.name}</span><span>-{it.amount.toLocaleString()}원</span></div>
            ))}
            {refInfo.additions.map((it, i) => (
              <div key={"a" + i} style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", color: "#15803d", fontWeight: 700 }}><span>↑ {it.name}</span><span>+{it.amount.toLocaleString()}원</span></div>
            ))}
            {refInfo.lateCheckout && <div style={{ padding: "1px 0", color: "#b45309", fontWeight: 700 }}>레이트 체크아웃: {refInfo.lateCheckout}</div>}
            {refInfo.special && <div style={{ padding: "1px 0", color: "#b45309" }}>요청사항: {refInfo.special}</div>}
            {refInfo.additions.length > 0 && <div style={{ marginTop: 6, fontSize: 11, color: "#64748b" }}>↑ 추가 항목이 아래 "추가 항목" 줄에 자동으로 들어갔어요 — 리조트에 지불할 금액({currency === "PHP" ? "₱" : "₩"})만 입력하세요</div>}
          </div>
        )}
      </div>

      <div className="card no-print">
        <h2>2. 인보이스 내용 <span style={{ fontWeight: 500, fontSize: 11.5, color: "#94a3b8" }}>— 인보이스의 Reservation Number는 리조트가 주는 컨펌넘버 자리입니다 (발송 시 비워두고, 회신 오면 결제내역에서 입력)</span></h2>
        <div className="fr">
          <div><span className="fl">Reservation Name (영문)</span><input className="fi" value={guest} onChange={e => setGuest(e.target.value)} placeholder="JIN HUI SU" /></div>
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
          <div>
            <span className="fl">Special Requests (영문) <button className="rtab" style={{ padding: "3px 10px", fontSize: 11, marginLeft: 6 }} onClick={() => { setSrSel([]); setSrModal(true); }}>📋 자주 쓰는 요청 선택</button></span>
            <input className="fi" value={specialReq} onChange={e => setSpecialReq(e.target.value)} placeholder="If possible, we would like to request a room with twin beds" />
          </div>
          {srModal && (
            <div onClick={() => setSrModal(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 18 }}>
              <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 460, padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>📋 자주 쓰는 요청 선택</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 12 }}>여러 개 선택하면 영문 한 문장으로 합쳐져요</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
                  {SR_PRESETS.map(p2 => {
                    const on = srSel.includes(p2.key);
                    return <button key={p2.key} onClick={() => setSrSel(v => on ? v.filter(x => x !== p2.key) : [...v, p2.key])}
                      style={{ padding: "8px 14px", borderRadius: 9, fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: on ? "1.5px solid #7c3aed" : "1.5px solid #e2e8f0", background: on ? "#f5f3ff" : "#fff", color: on ? "#6d28d9" : "#475569" }}>{p2.ko}</button>;
                  })}
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, padding: "10px 12px", fontSize: 12.5, color: srText ? "#1a1a2e" : "#94a3b8", minHeight: 42, marginBottom: 14 }}>
                  {srText || "선택하면 영문 문장 미리보기가 여기 표시돼요"}
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button className="rtab" onClick={() => setSrModal(false)}>취소</button>
                  <button className="rtab" disabled={!srText} style={{ background: "#7c3aed", borderColor: "#7c3aed", color: "#fff", opacity: srText ? 1 : 0.5 }} onClick={() => { setSpecialReq(srText); setSrModal(false); }}>적용</button>
                </div>
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 6 }}>
          <div style={{ fontSize: 15, fontWeight: 900 }}>Total: <span style={{ color: "#7c3aed" }}>{num(amount)} {currency}</span></div>
          {editId && <span style={{ fontSize: 12, fontWeight: 800, color: "#b45309", background: "#fef3c7", borderRadius: 8, padding: "5px 12px" }}>✏️ {editNo} 수정 중</span>}
          {editId && <button className="rtab" onClick={() => { setEditId(null); setEditNo(""); }}>수정 취소</button>}
          <button className="gen" disabled={saving} onClick={generate}>{saving ? "저장 중..." : (editId ? "💾 수정 저장" : "🧾 인보이스 생성")}</button>
        </div>
      </div>

      {preview && (
        <div className="card" style={{ background: "#f8fafc" }}>
          <div className="no-print" style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>{preview.resort === "jaypark" ? (preview.nights < 7 ? "단기(7박 미만) → rsvn@" : "장기(7박~) → travel@") : ""}</span>
            <input className="fi" style={{ maxWidth: 260 }} value={emailTo} onChange={e => setEmailTo(e.target.value)} placeholder="받는 이메일 (리조트)" />
            <button className="rtab" onClick={openEmailModal}>📧 이메일 보내기</button>
            <button className="rtab" disabled={savingImg} onClick={saveImage}>{savingImg ? "저장 중..." : "📷 이미지 저장"}</button>
            <button className="rtab" onClick={() => window.print()}>🖨️ 인쇄</button>
            <button className="rtab" style={guestView ? { background: "#0f766e", color: "#fff" } : {}} onClick={() => setGuestView(v => !v)}>{guestView ? "👤 손님용 ✓" : "👤 손님용 인보이스"}</button>
            <button className="rtab" style={{ color: "#b45309" }} onClick={() => preview && loadForEdit(preview)}>✏️ 수정</button>
            <button className="rtab" onClick={() => setPreview(null)}>닫기</button>
          </div>
          <ResortInvoiceDoc inv={preview} guestMode={guestView} />
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
                <td><button onClick={() => setPreview(v)} style={{ background: "none", border: "none", padding: 0, fontWeight: 700, color: "#1a6fc4", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", textDecoration: "underline" }}>{v.invoice_no}</button></td>
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
                  <button className="rtab" style={{ padding: "4px 10px", fontSize: 11, marginRight: 4, color: "#b45309" }} onClick={() => loadForEdit(v)}>✏️ 수정</button>
                  <button className="rtab" style={{ padding: "4px 10px", fontSize: 11, color: "#dc2626" }} onClick={() => removeInvoice(v.id)}>삭제</button>
                </td>
              </tr>
            ))}
          </tbody></table>
        )}
      </div>
    </div>
    {emailModal && preview && (
      <div style={{ position: "fixed", inset: 0, background: "#f1f5f9", zIndex: 200, overflow: "auto" }}>
        <div style={{ position: "sticky", top: 0, zIndex: 5, background: "#1a1a2e", color: "#fff", padding: "12px 22px", display: "flex", alignItems: "center", gap: 12 }}>
          <button onClick={() => !sending && setEmailModal(false)} style={{ background: "rgba(255,255,255,0.15)", color: "#fff", border: "none", borderRadius: 7, padding: "6px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>← 돌아가기</button>
          <div style={{ fontSize: 15, fontWeight: 800, flex: 1 }}>📧 이메일 작성 — {RESORT_LABEL[preview.resort as Resort]} · {preview.invoice_no}</div>
          <button className="gen" style={{ padding: "9px 26px" }} disabled={sending} onClick={sendEmail}>{sending ? "발송 중..." : "📨 보내기"}</button>
        </div>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "22px 18px 60px", display: "flex", gap: 18, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 420px", minWidth: 340, background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <div style={{ marginBottom: 12 }}>
              <span className="fl">받는 사람 {preview.resort === "jaypark" && <span style={{ color: "#94a3b8", fontWeight: 500 }}>({preview.nights < 7 ? "단기 7박 미만 → rsvn@" : "장기 7박~ → travel@"})</span>}</span>
              <input className="fi" value={emailTo} onChange={e => setEmailTo(e.target.value)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="fl">참조 (CC) — 항상 내 메일이 기본으로 들어갑니다</span>
              <input className="fi" value={emailCc} onChange={e => setEmailCc(e.target.value)} placeholder="deskor112@gmail.com" />
            </div>
            <div style={{ marginBottom: 12 }}>
              <span className="fl">제목</span>
              <input className="fi" value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
            </div>
            <div>
              <span className="fl">본문</span>
              <textarea className="fi" value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={16} style={{ resize: "vertical", lineHeight: 1.5 }} />
            </div>
          </div>
          <div style={{ flex: "1 1 340px", minWidth: 300, background: "#fff", borderRadius: 12, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>📎 첨부 파일 <span style={{ fontWeight: 500, color: "#16a34a" }}>1개</span></div>
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 9, padding: 10, background: "#f8fafc" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1a6fc4", marginBottom: 8 }}>🖼 invoice_{preview.invoice_no}.png</div>
              {attachImg
                ? <img src={attachImg} alt="첨부 인보이스" style={{ width: "100%", borderRadius: 6, border: "1px solid #e5e7eb" }} />
                : <div style={{ padding: 30, textAlign: "center", color: "#94a3b8", fontSize: 12.5 }}>첨부 이미지 생성 중...</div>}
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 8 }}>이 이미지가 메일에 그대로 첨부됩니다.</div>
          </div>
        </div>
      </div>
    )}
  </>);
}
