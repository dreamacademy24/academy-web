'use client';
import { portalFetch } from '@/lib/portalFetch';
import { useEffect, useState } from 'react';
import { HOTEL_PICKUP_MARKER, isHotelPickup } from '@/lib/checkinPickup';
type Pickup = { id: string; request_date: string; request_time: string | null; location: string; destination: string; notes: string | null };
export default function CheckinPickup({ bookingId, checkinDate, arrivalDate, token, guest = false }: { bookingId: string; checkinDate: string; arrivalDate: string; token?: string; guest?: boolean }) {
  const [row, setRow] = useState<Pickup | null>(null), [loading, setLoading] = useState(true), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState(''), [multiple, setMultiple] = useState(false);
  const [date, setDate] = useState(''), [time, setTime] = useState(''), [location, setLocation] = useState(''), [destination, setDestination] = useState(''), [note, setNote] = useState('');
  useEffect(() => { const controller = new AbortController();
    portalFetch(`/api/admin/checkin-pickup?bookingId=${encodeURIComponent(bookingId)}${token ? "&token="+encodeURIComponent(token) : ""}`, { signal: controller.signal }).then(async r => { const data = await r.json(); if (!r.ok) throw Error(data.error); setMultiple(data.pickups.length > 1); setRow(data.pickups[0] || null); }).catch(e => { if (e.name !== 'AbortError') setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [bookingId, token]);
  const hotel = isHotelPickup(row?.notes);
  function edit() { setDate(row?.request_date || checkinDate); setTime(hotel ? row?.request_time?.slice(0,5) || '' : ''); setLocation(hotel ? row?.location || '' : ''); setDestination(row?.destination || ''); setNote((row?.notes || '').replaceAll(HOTEL_PICKUP_MARKER, '').trim()); setEditing(true); setMessage(''); }
  async function save() { setBusy(true); setError(''); try {
    const r = await portalFetch('/api/admin/checkin-pickup', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookingId, token, id: row?.id || null, date, time, location, destination, note }) });
    const data = await r.json(); if (!r.ok) throw Error(data.error);
    const verified = await portalFetch(`/api/admin/checkin-pickup?bookingId=${encodeURIComponent(bookingId)}${token ? "&token="+encodeURIComponent(token) : ""}`); const saved = await verified.json(); if (!verified.ok) throw Error(saved.error); setRow(saved.pickups[0]); setEditing(false); setMessage('저장했습니다. 차량 스케줄에도 같은 픽업 장소·날짜·시간으로 표시됩니다.');
  } catch(e) { setError(e instanceof Error ? e.message : '저장에 실패했습니다.'); } finally { setBusy(false); } }
  return <section className="sec actual-pickup" style={{background:"white",padding:18,border:"1px solid #dbe4ef",borderRadius:12,margin:"16px 0"}}><style>{`.actual-pickup .fi{display:block;width:100%;box-sizing:border-box;padding:12px;border:1px solid #dbe4ef;border-radius:8px;font:inherit;margin-top:6px}.actual-pickup .btn{min-height:44px;padding:10px 16px;border:1px solid #cbd5e1;border-radius:8px;cursor:pointer}.actual-pickup label{font-size:14px}.actual-pickup input[type=checkbox]{width:20px;height:20px;vertical-align:middle}`}</style><h2 style={{fontSize:18}}>공항 외 픽업 요청</h2>
    <p style={{color:'#64748b',fontSize:13,lineHeight:1.7}}>항공 도착 정보와 별도로, 체크인 당일 다른 숙소에서 픽업하는 약속을 기록합니다. 시간은 필리핀 현지 시간입니다.</p>
    {arrivalDate && checkinDate && arrivalDate !== checkinDate && <p style={{padding:12,background:'#fff7df',borderRadius:8}}>항공 도착 {arrivalDate} / 체크인 {checkinDate} — 먼저 머무는 숙소와 실제 픽업 약속을 확인해주세요.</p>}
    {loading ? <p>픽업 내역 확인 중…</p> : <>
      {!editing && <><p><strong>{hotel ? '공항 외 픽업 요청 등록됨' : '공항 외 픽업 요청 없음'}</strong></p>{hotel && <><p>{row?.request_date} · {row?.request_time?.slice(0,5) || '시간 미정'}</p><p>{row?.location} → {row?.destination}</p><p style={{whiteSpace:'pre-wrap'}}>{row?.notes?.replaceAll(HOTEL_PICKUP_MARKER,'').trim()}</p></>}
        {multiple ? <p role="alert">픽업이 여러 건입니다. <a href="/admin/pickups">픽업 관리</a>에서 먼저 확인해주세요.</p> : <><label style={{display:"block",padding:12}}><input type="checkbox" checked={hotel || editing} onChange={edit} disabled={!!error}/> 공항 외 픽업 요청 · 등록/수정</label><button type="button" className="btn btn-blue" onClick={edit} disabled={!!error}>{hotel ? '픽업 약속 수정' : '숙소 픽업 약속 등록'}</button></>}</>}
      {editing && <div><p>저장하면 기존 기본 픽업을 아래 숙소 픽업 약속으로 변경합니다. 항공권 정보는 유지됩니다.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(220px,100%),1fr))',gap:12}}>
          <label>픽업 장소 · 호텔명<input className="fi" value={location} onChange={e=>setLocation(e.target.value)} placeholder="예: 라온스퀘어 로비" maxLength={200}/></label>
          <label>도착 숙소<input className="fi" value={destination} onChange={e=>setDestination(e.target.value)} placeholder="예: 제이파크 / 드림하우스 B17L8" maxLength={200}/></label>
          <label>실제 픽업 날짜<input className="fi" type="date" value={date} onChange={e=>setDate(e.target.value)}/></label>
          <label>약속한 픽업 시간 · 미정이면 비워두기<input className="fi" type="time" value={time} onChange={e=>setTime(e.target.value)}/></label>
        </div><label style={{display:'block',marginTop:12}}>확인 메모 · 카카오 대화 날짜 / 만나는 위치<textarea className="fi" rows={3} value={note} onChange={e=>setNote(e.target.value)} maxLength={2000}/></label>
        <div style={{display:'flex',gap:8,marginTop:12}}><button type="button" className="btn btn-blue" disabled={busy || !date || !location.trim() || !destination.trim()} onClick={save}>{busy ? '저장 중…' : '픽업 약속 저장'}</button><button type="button" className="btn btn-gray" disabled={busy} onClick={()=>setEditing(false)}>닫기</button></div>
      </div>}
    </>}
    {error && <p role="alert" style={{color:'#b91c1c'}}>{error}</p>}{message && <p role="status" style={{color:'#166534'}}>{message}</p>}
  </section>;
}
