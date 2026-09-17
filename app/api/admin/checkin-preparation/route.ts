import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
export async function GET(req:Request){
  try{
    const staff=await getStaffIdentity(req);
    if(!staff)return NextResponse.json({error:'직원 로그인이 필요합니다.'},{status:401});
    if(staff.role!=='korean_admin')return NextResponse.json({error:'접근 권한이 없습니다.'},{status:403});
    const id=new URL(req.url).searchParams.get('bookingId');
    if(!id||!/^[a-f0-9-]{36}$/i.test(id))return NextResponse.json({error:'예약을 선택해주세요.'},{status:400});
    const db=portalDb();
    const [booking,detail]=await Promise.all([db.from('bookings').select('*').eq('id',id).maybeSingle(),db.from('checkin_details').select('*').eq('booking_id',id).maybeSingle()]);
    if(booking.error||detail.error)throw Error('load');
    if(!booking.data)return NextResponse.json({error:'예약을 찾을 수 없습니다.'},{status:404});
    const students=await db.from("students").select("name_kr,name_en,age").eq("booking_id",id);if(students.error)throw students.error;
    return NextResponse.json({booking:booking.data,detail:detail.data,students:students.data},{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'예약을 불러오지 못했습니다. 다시 시도해주세요.'},{status:503});}
}
