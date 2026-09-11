'use client';
import { useState } from 'react';
import { normalizeGuardians, type GuardianName } from '@/lib/bookingGuardians';

export default function GuardianEditor({ booking, onSaved }: { booking: { id: string; booker_name?: string; booker_english?: string; extra_guardians?: unknown }; onSaved: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [names, setNames] = useState<GuardianName[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const stored = [{ kor: booking.booker_name || '', eng: booking.booker_english || '' }, ...normalizeGuardians(booking.extra_guardians)];
  function open() { setNames(stored.length === 1 ? [...stored, { kor: '', eng: '' }] : stored); setEditing(true); setMessage(''); }
  async function save() {
    setBusy(true); setMessage('');
    try {
      const res = await fetch(`/api/bookings/${booking.id}/guardians`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ booker_name: names[0].kor, booker_english: names[0].eng, extra_guardians: names.slice(1) }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || '저장 실패');
      await onSaved(); setEditing(false); setMessage('보호자 정보를 저장했습니다. 손님 앱의 튜터 신청 화면을 다시 열면 반영됩니다.');
    } catch (e) { setMessage(e instanceof Error ? e.message : '저장 실패. 입력 내용은 유지됩니다.'); }
    finally { setBusy(false); }
  }
  return <section className="sec" aria-label="보호자 등록 및 수정">
    <h2>보호자 등록 · 튜터 신청 대상</h2>
    <p style={{ fontSize: 13, marginBottom: 12 }}>보호자 1은 예약자입니다. 동반 보호자를 추가하면 손님 앱에서 해당 이름으로 튜터를 신청할 수 있습니다.</p>
    {(editing ? names : stored).map((g, i) => <div className="item" key={i} style={{ marginBottom: 8 }}>
      <div className="lbl">보호자 {i + 1}{i === 0 ? ' (예약자)' : ' (동반 보호자)'}</div>
      {editing ? <div className="grid">
        <label>한글 이름<input aria-label={`보호자 ${i + 1} 한글 이름`} className="ed-inp" maxLength={100} value={g.kor} disabled={busy} onChange={e => setNames(a => a.map((v, n) => n === i ? { ...v, kor: e.target.value } : v))} /></label>
        <label>영문 이름<input aria-label={`보호자 ${i + 1} 영문 이름`} className="ed-inp" maxLength={100} value={g.eng} disabled={busy} onChange={e => setNames(a => a.map((v, n) => n === i ? { ...v, eng: e.target.value } : v))} /></label>
        {i > 0 && <button type="button" className="btn btn-sm btn-gray" disabled={busy} onClick={() => setNames(a => a.filter((_, n) => n !== i))}>보호자 {i + 1} 제외</button>}
      </div> : <div className="val">{g.kor || '-'}{g.eng ? ` / ${g.eng}` : ''}</div>}
    </div>)}
    {editing ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button className="btn btn-gray" disabled={busy || names.length >= 21} onClick={() => setNames(a => [...a, { kor: '', eng: '' }])}>+ 동반 보호자 추가</button>
      <button className="btn btn-blue" disabled={busy} onClick={save}>{busy ? '저장 중…' : '보호자 저장'}</button>
      <button className="btn btn-gray" disabled={busy} onClick={() => { setEditing(false); setMessage(''); }}>취소</button>
    </div> : <button className="btn btn-blue" onClick={open}>보호자 등록·수정</button>}
    {message && <p role="status" style={{ marginTop: 10 }}>{message}</p>}
  </section>;
}
