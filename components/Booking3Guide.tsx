'use client';
import { useEffect, useRef } from 'react';
import OnlineClassRules from './OnlineClassRules';

export default function Booking3Guide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) { dialog.showModal(); dialog.scrollTop = 0; }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return <dialog ref={ref} onCancel={onClose} onClose={onClose} aria-labelledby="booking3-guide-title" style={{ width: 'min(94vw, 900px)', maxHeight: '92dvh', padding: 0, border: 0, borderRadius: 20, margin: 'auto', color: '#1e293b', background: '#f8f5ea' }}>
    <div style={{ position: 'sticky', top: 0, background: '#fff', padding: '16px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid #e2e8f0', zIndex: 1 }}>
      <strong id="booking3-guide-title">화상영어 수업 안내</strong><button type="button" autoFocus onClick={onClose} style={{ padding: '10px 18px', border: 0, borderRadius: 9, background: '#1e293b', color: '#fff', cursor: 'pointer', font: 'inherit' }}>확인 · 닫기</button>
    </div>
    <div style={{ margin: '20px', padding: '22px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12 }}><OnlineClassRules /></div>
    <img src="/booking3/class-guide-20260902.png" alt="2026년 9월 2일 화상영어 수업 안내. 현지 정전으로 취소되면 회차 차감 없이 보강합니다. 수업 당일 개별 연락은 없으며 수업 5분 전 접속해주세요. 취소·시간 변경은 앱에서 4일 전까지 신청하세요. 선생님은 시간과 레벨에 맞춰 배정됩니다." style={{ display: 'block', width: '100%', height: 'auto' }} />
    <div style={{ padding: 20, textAlign: 'center' }}><a href="/booking3/class-guide-20260902.png" target="_blank" rel="noopener noreferrer">원본 크게 보기 · 저장</a></div>
  </dialog>;
}
