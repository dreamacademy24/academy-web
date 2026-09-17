import {NextResponse} from 'next/server';
import {getStaffIdentity,portalDb} from '@/lib/portalAuth';
import {checkinSummary,dreamhouseStay} from '@/lib/dreamhouseCheckinSummary';
export const dynamic='force-dynamic';
const columns='id,booker_name,booker_english,reservation_no,house_no,accom_room,accom_type,booking_type,checkin_date,checkout_date,seg1_type,seg1_checkin,seg1_checkout,seg2_type,seg2_checkin,seg2_checkout';
export async function GET(req:Request){try{
  const staff=await getStaffIdentity(req);
  if(!staff)return NextResponse.json({error:'Please sign in with your staff account.'},{status:401});
  if(staff.role!=='korean_admin')return NextResponse.json({error:'Staff workspace access is required.'},{status:403});
  const db=portalDb(),id=new URL(req.url).searchParams.get('bookingId');
  if(id){
    if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Invalid reservation.'},{status:400});
    const [b,d]=await Promise.all([db.from('bookings').select(columns).eq('id',id).not('status','ilike','%취소%').maybeSingle(),db.from('checkin_details').select('checkin_date,bed_setting,guest_names_en').eq('booking_id',id).maybeSingle()]);
    if(b.error||d.error)throw Error('Lookup failed');
    if(!b.data||!dreamhouseStay(b.data))return NextResponse.json({error:'Dream House reservation not found.'},{status:404});
    return NextResponse.json({summary:checkinSummary(b.data,d.data),hasDetail:!!d.data},{headers:{'Cache-Control':'no-store'}});
  }
  const today=new Date(Date.now()+8*3600000).toISOString().slice(0,10);
  const rows=await db.from('bookings').select(columns).not('status','ilike','%취소%').gte('checkout_date',today).order('checkin_date').limit(1000);
  if(rows.error)throw rows.error;
  const bookings=(rows.data||[]).filter(b=>{const stay=dreamhouseStay(b);return stay&&stay.end>=today;}).map(b=>({id:b.id,name:b.booker_english||b.booker_name||b.reservation_no,date:dreamhouseStay(b)!.date,house:b.house_no||b.accom_room||'',reservation:b.reservation_no||''}));
  return NextResponse.json({bookings},{headers:{'Cache-Control':'no-store'}});
}catch{return NextResponse.json({error:'Could not load check-in details. Please try again.'},{status:503});}}
