import { commuteDeposit } from '@/lib/commuteDeposit';

export default function CommuteDepositNotice({ total, fullPayment = false }: { total: number; fullPayment?: boolean }) {
  if (!(total > 0)) return null;
  const fmt = (value: number) => value.toLocaleString('ko-KR');
  return <div data-testid="commute-deposit" style={{padding:'10px 12px',margin:'8px 0',background:'#f0fdf4',border:'1px solid #bbf7d0',borderRadius:8,color:'#166534',fontSize:12,lineHeight:1.7,printColorAdjust:'exact'}}>
    <strong>통학형 예약금 · Day-school deposit (30%)</strong><br />
    최종 청구액 {fmt(total)}원 × 30% = <b>{fmt(commuteDeposit(total))}원</b><br />
    할인·추가금 반영 후 원화 금액 기준이며 현지 지불(PHP)은 별도입니다.
    {fullPayment && <div>전액납부 조건이 적용되어 이번 납부액은 아래 전액납부 안내를 따릅니다.</div>}
  </div>;
}
