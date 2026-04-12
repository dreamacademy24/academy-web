"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAdminAuthed } from "@/lib/adminAuth";

interface Booking {
  id: string; booker_name: string; check_in: string; check_out: string;
  booking_type: string; pickup_place: string; drop_place: string;
  flight_in_airline: string; flight_in_date: string; flight_in_time: string;
  flight_out_airline: string; flight_out_date: string; flight_out_time: string;
  num_adults: number; num_children: number; special_request: string;
}

interface Detail {
  id: string; booking_id: string;
  bed_setting: { master_2f: number; small_2f: number; floor_1f: number };
  usim: { sim: number; load: number };
  all_guests: string;
  additional_pickups: { date: string; flight: string }[];
  shuttles: { date: string; place: string; people: number }[];
  extra_arrivals: string[];
  etc_notes: string;
}

function fDate(d: string | null) {
  if (!d) return "-";
  const dt = new Date(d + "T00:00:00");
  return `${dt.getFullYear()}.${String(dt.getMonth()+1).padStart(2,"0")}.${String(dt.getDate()).padStart(2,"0")}`;
}

export default function CheckinDetailsPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const loadBookings = useCallback(async () => {
    const res = await fetch("/api/admin/checkin-details");
    if (res.ok) { const d = await res.json(); setBookings(d.bookings || []); }
  }, []);

  useEffect(() => { if (isAdminAuthed()) setAuthed(true); else window.location.href = "/login"; }, []);
  useEffect(() => { if (authed) loadBookings(); }, [authed, loadBookings]);

  async function selectBooking(id: string) {
    setSelId(id);
    setMsg("");
    const b = bookings.find(x => x.id === id) || null;
    setBooking(b);
    const res = await fetch(`/api/admin/checkin-details?booking_id=${id}`);
    if (res.ok) {
      const d = await res.json();
      const dt = d.detail;
      setDetail({
        ...dt,
        bed_setting: dt.bed_setting || { master_2f: 0, small_2f: 0, floor_1f: 0 },
        usim: dt.usim || { sim: 0, load: 0 },
        additional_pickups: dt.additional_pickups || [],
        shuttles: dt.shuttles || [],
        extra_arrivals: dt.extra_arrivals || ["", ""],
      });
    }
  }

  async function save() {
    if (!detail || !selId) return;
    setSaving(true); setMsg("");
    const res = await fetch("/api/admin/checkin-details", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        booking_id: selId,
        bed_setting: detail.bed_setting,
        usim: detail.usim,
        all_guests: detail.all_guests,
        additional_pickups: detail.additional_pickups,
        shuttles: detail.shuttles,
        extra_arrivals: detail.extra_arrivals,
        etc_notes: detail.etc_notes,
      }),
    });
    setSaving(false);
    if (res.ok) setMsg("저장 완료"); else setMsg("저장 실패");
  }

  function updateBed(key: string, val: number) {
    if (!detail) return;
    setDetail({ ...detail, bed_setting: { ...detail.bed_setting, [key]: val } });
  }
  function updateUsim(key: string, val: number) {
    if (!detail) return;
    setDetail({ ...detail, usim: { ...detail.usim, [key]: val } });
  }
  function addPickup() {
    if (!detail) return;
    setDetail({ ...detail, additional_pickups: [...detail.additional_pickups, { date: "", flight: "" }] });
  }
  function removePickup(i: number) {
    if (!detail) return;
    setDetail({ ...detail, additional_pickups: detail.additional_pickups.filter((_, idx) => idx !== i) });
  }
  function updatePickup(i: number, key: string, val: string) {
    if (!detail) return;
    const arr = [...detail.additional_pickups];
    arr[i] = { ...arr[i], [key]: val };
    setDetail({ ...detail, additional_pickups: arr });
  }
  function addShuttle() {
    if (!detail) return;
    setDetail({ ...detail, shuttles: [...detail.shuttles, { date: "", place: "", people: 0 }] });
  }
  function removeShuttle(i: number) {
    if (!detail) return;
    setDetail({ ...detail, shuttles: detail.shuttles.filter((_, idx) => idx !== i) });
  }
  function updateShuttle(i: number, key: string, val: string | number) {
    if (!detail) return;
    const arr = [...detail.shuttles];
    arr[i] = { ...arr[i], [key]: val };
    setDetail({ ...detail, shuttles: arr });
  }
  function updateExtra(i: number, val: string) {
    if (!detail) return;
    const arr = [...detail.extra_arrivals];
    arr[i] = val;
    setDetail({ ...detail, extra_arrivals: arr });
  }

  if (!authed) return null;

  return (<>
    <style>{`
*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e}
.ci-w{max-width:900px;margin:0 auto;padding:32px 20px}
.ci-top{display:flex;align-items:center;gap:12px;margin-bottom:24px}
.ci-back{background:none;border:none;font-size:22px;cursor:pointer;padding:4px 8px;border-radius:8px}.ci-back:hover{background:#e2e8f0}
.ci-top h1{font-size:22px;font-weight:800;flex:1}
.sel-row{margin-bottom:24px}
.sel-row select{width:100%;padding:12px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff}
.sel-row select:focus{border-color:#1a6fc4}
.sec{background:#fff;border-radius:14px;padding:20px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,0.05)}
.sec h2{font-size:15px;font-weight:800;margin-bottom:12px;color:#1a6fc4;border-bottom:2px solid #e2e8f0;padding-bottom:8px}
.row{display:flex;gap:8px;margin-bottom:10px;align-items:center;flex-wrap:wrap}
.row .lbl{font-size:13px;font-weight:700;color:#475569;min-width:80px}
.row .val{font-size:13px;color:#1a1a2e}
.inp{padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;flex:1;min-width:80px}.inp:focus{border-color:#1a6fc4}
.inp-sm{width:60px;flex:none;text-align:center}
.area{width:100%;padding:10px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-family:inherit;outline:none;resize:vertical;min-height:60px}.area:focus{border-color:#1a6fc4}
.btn{padding:10px 20px;border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;transition:background 150ms}
.btn-blue{background:#1a6fc4;color:#fff}.btn-blue:hover{background:#0d3d7a}
.btn-sm{padding:6px 12px;font-size:12px}
.btn-gray{background:#f1f5f9;color:#475569}.btn-gray:hover{background:#e2e8f0}
.btn-red{background:#fef2f2;color:#dc2626;padding:4px 10px;font-size:11px}.btn-red:hover{background:#fecaca}
.btn-green{background:#dcfce7;color:#166534}.btn-green:hover{background:#bbf7d0}
.list-item{display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap}
.foot{display:flex;gap:12px;align-items:center;margin-top:20px}
.msg{font-size:13px;font-weight:600}
.msg-ok{color:#166534}.msg-err{color:#dc2626}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px}
@media print{
body{background:#fff!important}
.ci-top,.sel-row,.foot,.ci-back,.btn{display:none!important}
.ci-w{padding:0;max-width:100%}
.sec{box-shadow:none;border:1px solid #ddd;break-inside:avoid}
.print-header{display:block!important;text-align:center;margin-bottom:20px}
.print-header h1{font-size:20px;font-weight:800}
.print-header p{font-size:12px;color:#666}
}
.print-header{display:none}
@media(max-width:600px){.ci-w{padding:20px 12px}.row{flex-direction:column;align-items:stretch}}
    `}</style>
    <div className="ci-w">
      <div className="ci-top">
        <button className="ci-back" onClick={() => router.push("/admin/hub")}>←</button>
        <h1>체크인 디테일</h1>
        {detail && <button className="btn btn-gray" onClick={() => window.print()}>PDF 출력</button>}
      </div>

      <div className="sel-row">
        <select value={selId || ""} onChange={e => { if (e.target.value) selectBooking(e.target.value); }}>
          <option value="">예약을 선택하세요 (확정 예약만)</option>
          {bookings.map(b => (
            <option key={b.id} value={b.id}>
              {fDate(b.check_in)} ~ {fDate(b.check_out)} | {b.booker_name} | {b.booking_type}
            </option>
          ))}
        </select>
      </div>

      {!detail && <div className="empty">예약을 선택하면 체크인 디테일이 자동 생성됩니다</div>}

      {detail && booking && (<>
        <div className="print-header">
          <h1>DREAM HOUSE Philippines</h1>
          <p>Check-in Detail</p>
        </div>

        <div className="sec">
          <h2>GUEST DETAILS</h2>
          <div className="row"><span className="lbl">이름</span><span className="val">{booking.booker_name}</span></div>
          <div className="row"><span className="lbl">체크인</span><span className="val">{fDate(booking.check_in)}</span></div>
          <div className="row"><span className="lbl">체크아웃</span><span className="val">{fDate(booking.check_out)}</span></div>
          <div className="row"><span className="lbl">인원</span><span className="val">성인 {booking.num_adults || 0}명 + 아이 {booking.num_children || 0}명</span></div>
        </div>

        <div className="sec">
          <h2>PICK UP</h2>
          <div className="row"><span className="lbl">항공편</span><span className="val">{booking.flight_in_airline || "-"}</span></div>
          <div className="row"><span className="lbl">날짜</span><span className="val">{fDate(booking.flight_in_date)}</span></div>
          <div className="row"><span className="lbl">시간</span><span className="val">{booking.flight_in_time || "-"}</span></div>
          <div className="row"><span className="lbl">장소</span><span className="val">{booking.pickup_place || "-"}</span></div>
        </div>

        <div className="sec">
          <h2>DROP</h2>
          <div className="row"><span className="lbl">항공편</span><span className="val">{booking.flight_out_airline || "-"}</span></div>
          <div className="row"><span className="lbl">날짜</span><span className="val">{fDate(booking.flight_out_date)}</span></div>
          <div className="row"><span className="lbl">시간</span><span className="val">{booking.flight_out_time || "-"}</span></div>
          <div className="row"><span className="lbl">장소</span><span className="val">{booking.drop_place || "-"}</span></div>
        </div>

        <div className="sec">
          <h2>BED SETTING</h2>
          <div className="row">
            <span className="lbl">2F Master</span>
            <input className="inp inp-sm" type="number" min={0} value={detail.bed_setting.master_2f}
              onChange={e => updateBed("master_2f", parseInt(e.target.value) || 0)} />
            <span className="lbl">2F Small</span>
            <input className="inp inp-sm" type="number" min={0} value={detail.bed_setting.small_2f}
              onChange={e => updateBed("small_2f", parseInt(e.target.value) || 0)} />
            <span className="lbl">1F</span>
            <input className="inp inp-sm" type="number" min={0} value={detail.bed_setting.floor_1f}
              onChange={e => updateBed("floor_1f", parseInt(e.target.value) || 0)} />
          </div>
        </div>

        <div className="sec">
          <h2>USIM</h2>
          <div className="row">
            <span className="lbl">SIM</span>
            <input className="inp inp-sm" type="number" min={0} value={detail.usim.sim}
              onChange={e => updateUsim("sim", parseInt(e.target.value) || 0)} />
            <span className="lbl">LOAD</span>
            <input className="inp inp-sm" type="number" min={0} value={detail.usim.load}
              onChange={e => updateUsim("load", parseInt(e.target.value) || 0)} />
          </div>
        </div>

        <div className="sec">
          <h2>ALL GUEST</h2>
          <textarea className="area" value={detail.all_guests}
            onChange={e => setDetail({ ...detail, all_guests: e.target.value })}
            placeholder="투숙객 전원 이름 (쉼표 구분)" />
        </div>

        <div className="sec">
          <h2>추가 픽업</h2>
          {detail.additional_pickups.map((p, i) => (
            <div key={i} className="list-item">
              <input className="inp" placeholder="날짜 (예: 8/15)" value={p.date}
                onChange={e => updatePickup(i, "date", e.target.value)} />
              <input className="inp" placeholder="항공편" value={p.flight}
                onChange={e => updatePickup(i, "flight", e.target.value)} />
              <button className="btn-red" onClick={() => removePickup(i)}>삭제</button>
            </div>
          ))}
          <button className="btn btn-sm btn-gray" onClick={addPickup}>+ 추가 픽업</button>
        </div>

        <div className="sec">
          <h2>셔틀</h2>
          {detail.shuttles.map((s, i) => (
            <div key={i} className="list-item">
              <input className="inp" placeholder="날짜" value={s.date}
                onChange={e => updateShuttle(i, "date", e.target.value)} />
              <input className="inp" placeholder="장소" value={s.place}
                onChange={e => updateShuttle(i, "place", e.target.value)} />
              <input className="inp inp-sm" type="number" placeholder="인원" value={s.people || ""}
                onChange={e => updateShuttle(i, "people", parseInt(e.target.value) || 0)} />
              <button className="btn-red" onClick={() => removeShuttle(i)}>삭제</button>
            </div>
          ))}
          <button className="btn btn-sm btn-gray" onClick={addShuttle}>+ 셔틀</button>
        </div>

        <div className="sec">
          <h2>추가 입국</h2>
          <div className="row">
            <span className="lbl">추가입국 1</span>
            <input className="inp" value={detail.extra_arrivals[0] || ""}
              onChange={e => updateExtra(0, e.target.value)} placeholder="이름/날짜/항공편" />
          </div>
          <div className="row">
            <span className="lbl">추가입국 2</span>
            <input className="inp" value={detail.extra_arrivals[1] || ""}
              onChange={e => updateExtra(1, e.target.value)} placeholder="이름/날짜/항공편" />
          </div>
        </div>

        <div className="sec">
          <h2>ETC</h2>
          <textarea className="area" value={detail.etc_notes}
            onChange={e => setDetail({ ...detail, etc_notes: e.target.value })}
            placeholder="기타 메모" />
        </div>

        <div className="foot">
          <button className="btn btn-blue" onClick={save} disabled={saving}>
            {saving ? "저장 중..." : "저장"}
          </button>
          <button className="btn btn-green" onClick={() => window.print()}>PDF 출력</button>
          {msg && <span className={`msg ${msg.includes("완료") ? "msg-ok" : "msg-err"}`}>{msg}</span>}
        </div>
      </>)}
    </div>
  </>);
}
