import { NextResponse } from 'next/server';
import { portalDb, isPortalAdmin } from '@/lib/portalAuth';

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('code');
  if (raw !== null) {
    const code = raw.trim().toLowerCase();
    if (!/^[a-z0-9_-]{3,40}$/.test(code)) return NextResponse.json({ error: '할인코드를 확인해주세요.' }, { status: 400 });
    const { data, error } = await portalDb().from('booking_discount_codes').select('code,amount').eq('code',code).eq('active',true).maybeSingle();
    if(error) return NextResponse.json({error:'코드를 확인하지 못했습니다. 다시 시도해주세요.'},{status:503});
    return NextResponse.json(data || { error:'사용할 수 없는 할인코드입니다.' }, {status:data?200:400,headers:{'Cache-Control':'no-store'}});
  }
  if (!await isPortalAdmin(req)) return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:403});
  const { data, error } = await portalDb().from('booking_discount_codes').select('*').order('created_at',{ascending:false});
  return NextResponse.json(error?{error:'목록을 불러오지 못했습니다.'}:{codes:data},{status:error?503:200,headers:{'Cache-Control':'no-store'}});
}

export async function POST(req: Request) {
  if (!await isPortalAdmin(req)) return NextResponse.json({error:'관리자 로그인이 필요합니다.'},{status:403});
  const origin=req.headers.get('origin');
  if(origin && new URL(origin).host !== new URL(req.url).host) return NextResponse.json({error:'잘못된 요청입니다.'},{status:403});
  try {
    const body=await req.json();
    const code=String(body.code||'').trim().toLowerCase();
    const amount=Number(body.amount);
    if(!/^[a-z0-9_-]{3,40}$/.test(code)||!Number.isSafeInteger(amount)||amount<1||amount>100000000||typeof body.active!=='boolean') return NextResponse.json({error:'코드와 할인 금액을 확인해주세요.'},{status:400});
    const {error}=await portalDb().from('booking_discount_codes').upsert({code,amount,active:body.active},{onConflict:'code'});
    return NextResponse.json(error?{error:'저장하지 못했습니다.'}:{ok:true},{status:error?503:200});
  } catch { return NextResponse.json({error:'입력 내용을 확인해주세요.'},{status:400}); }
}

