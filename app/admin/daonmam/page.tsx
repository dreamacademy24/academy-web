import { createClient } from '@supabase/supabase-js';

type Bk = {
  id: string; reservation_no: string | null; booker_name: string | null;
  accom_type: string | null; accom_weeks: number | null;
  checkin_date: string | null; checkout_date: string | null;
  adults: number | null; children: number | null;
  status: string | null; payment_status: string | null; paid_amount: number | null;
  created_at: string | null;
};

async function getRows(): Promise<Bk[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const { data, error } = await supabase
    .from('bookings')
    .select('id,reservation_no,booker_name,accom_type,accom_weeks,checkin_date,checkout_date,adults,children,status,payment_status,paid_amount,created_at')
    .eq('agency', '다온맘')
    .order('created_at', { ascending: false });
  if (error) { console.error('[daonmam-status]', error); return []; }
  return (data as Bk[]) || [];
}

function shortNo(no: string | null) { return no ? no.split('-').pop() : '-'; }
function mask(name: string | null) {
  const n = (name || '').trim();
  if (n.length <= 1) return n || '-';
  return n[0] + '*' + n.slice(2);
}
function payLabel(b: Bk) {
  if (b.payment_status === 'paid') return { t: '결제 완료', c: '#166534', bg: '#dcfce7' };
  if ((b.paid_amount || 0) > 0) return { t: '예약금 확인', c: '#92400e', bg: '#fef3c7' };
  return { t: '입금 대기', c: '#991b1b', bg: '#fee2e2' };
}

export default async function DaonmamStatusPage() {
  const rows = await getRows();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayCnt = rows.filter(r => r.created_at && new Date(r.created_at) >= today).length;
  const paidCnt = rows.filter(r => (r.paid_amount || 0) > 0).length;
  return (
    <div style={{ fontFamily: "'Noto Sans KR',sans-serif", background: '#faf6ef', minHeight: '100vh', padding: '30px 16px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span style={{ background: '#1f2937', color: '#fde68a', borderRadius: 999, padding: '6px 16px', fontSize: 12, fontWeight: 800 }}>다온맘 X 드림아카데미 공동구매</span>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: '12px 0 4px', color: '#1f2937' }}>공구 예약 현황</h1>
          <p style={{ fontSize: 13, color: '#8a7c5e' }}>실시간 접수 현황이에요 · 개인정보 보호를 위해 이름은 일부 가려져 있어요</p>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
          {[['총 접수', rows.length + '건'], ['오늘 접수', todayCnt + '건'], ['예약금 확인', paidCnt + '건']].map(([k, v]) => (
            <div key={k} style={{ background: '#fff', border: '1px solid #eee4cf', borderRadius: 12, padding: '12px 22px', textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: '#8a7c5e', fontWeight: 700 }}>{k}</div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#1f2937' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#fff', border: '1px solid #eee4cf', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: '#f7efdc', color: '#6b5b3e' }}>
              {['번호', '예약자', '숙소', '기간', '체크인', '인원', '결제', '접수일'].map(h => <th key={h} style={{ padding: '10px 8px', fontWeight: 800 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#a89a78' }}>아직 접수된 예약이 없어요</td></tr>
              ) : rows.map(b => { const p = payLabel(b); return (
                <tr key={b.id} style={{ borderTop: '1px solid #f5edd9', textAlign: 'center' }}>
                  <td style={{ padding: '9px 6px', fontWeight: 700, color: '#8a6414' }}>{shortNo(b.reservation_no)}</td>
                  <td style={{ padding: '9px 6px', fontWeight: 700 }}>{mask(b.booker_name)}</td>
                  <td style={{ padding: '9px 6px' }}>{b.accom_type || '-'}</td>
                  <td style={{ padding: '9px 6px' }}>{b.accom_weeks ? b.accom_weeks + '주' : '-'}</td>
                  <td style={{ padding: '9px 6px' }}>{b.checkin_date || '-'}</td>
                  <td style={{ padding: '9px 6px' }}>{(b.adults || 0) + (b.children || 0)}명</td>
                  <td style={{ padding: '9px 6px' }}><span style={{ background: p.bg, color: p.c, borderRadius: 8, padding: '2px 8px', fontSize: 11.5, fontWeight: 800 }}>{p.t}</span></td>
                  <td style={{ padding: '9px 6px', color: '#a89a78', fontSize: 12 }}>{(b.created_at || '').slice(5, 10)}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
        <p style={{ textAlign: 'center', fontSize: 12, color: '#a89a78', marginTop: 16 }}>새로고침하면 최신 현황으로 갱신돼요 · 문의 pf.kakao.com/_Yuhxhn</p>
      </div>
    </div>
  );
}

export const revalidate = 30;
export const dynamic = 'force-dynamic';
