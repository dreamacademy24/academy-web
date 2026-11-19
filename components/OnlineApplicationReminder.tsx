'use client';
import { useEffect, useRef, useState } from 'react';
import { portalFetch } from '@/lib/portalFetch';

export default function OnlineApplicationReminder({ bookingId, href, blocked = false, onPending }: { bookingId: string; href: string; blocked?: boolean; onPending: (count: number) => void }) {
  const [pending, setPending] = useState<Array<{ bookingId: string; student: string; checkin: string }>>([]);
  const [dismissed, setDismissed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let alive = true, generation = 0;
    const refresh = async () => {
      const run = ++generation;
      try {
        const response = await portalFetch('/api/portal/online-class/reminder?booking_id=' + encodeURIComponent(bookingId), { cache: 'no-store' });
        if (!response.ok) throw Error('조회 실패');
        const data = await response.json();
        if (alive && run === generation) setPending(data.pending || []);
      } catch { if (alive && run === generation) setPending([]); }
    };
    setDismissed(false);
    void refresh();
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    return () => { alive = false; window.removeEventListener('focus', refresh); window.removeEventListener('pageshow', refresh); };
  }, [bookingId]);
  useEffect(() => {
    if (pending.length && !dismissed && !blocked) { if (!dialog.current?.open) dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [pending, dismissed, blocked]);
  useEffect(() => { onPending(pending.length); }, [pending, onPending]);
  if (!pending.length) return null;
  const close = () => { setDismissed(true); dialog.current?.close(); };
  return <>
    <dialog ref={dialog} aria-labelledby="online-reminder-title" onCancel={close} style={{ width: 'min(440px, calc(100vw - 32px))', maxHeight: '85dvh', overflowY: 'auto', margin: 'auto', padding: 26, border: 'none', borderRadius: 20, color: '#243047', boxShadow: '0 16px 60px #0003' }}>
      <h2 id="online-reminder-title" style={{ fontSize: 22, lineHeight: 1.5, margin: '0 0 12px' }}>화상영어가 오픈되었습니다.<br />신청하세요!</h2>
      <p style={{ lineHeight: 1.7 }}>체크인 2개월 전부터 신청할 수 있어요. 아래 학생의 화상영어 신청을 아직 받지 못했어요.</p>
      <ul style={{ paddingLeft: 20, lineHeight: 1.8 }}>{pending.map(p => <li key={p.bookingId + ':' + p.student}><strong>{p.student}</strong> · 체크인 {p.checkin}</li>)}</ul>
      <p style={{ fontSize: 14, color: '#64748b', lineHeight: 1.6 }}>신청 후 선생님과 수업 일정을 확인해 안내드릴게요.</p>
      <a href={href} style={{ display: 'block', textAlign: 'center', padding: 14, borderRadius: 10, background: '#4b6cc1', color: 'white', textDecoration: 'none', fontWeight: 700 }}>화상영어 신청하기</a>
      <button onClick={close} style={{ width: '100%', marginTop: 10, padding: 12, background: 'white', border: '1px solid #dbe1eb', borderRadius: 10, cursor: 'pointer' }}>나중에 신청할게요</button>
      <style>{'dialog::backdrop { background: rgba(15,23,42,.48); }'}</style>
    </dialog>
  </>;
}
