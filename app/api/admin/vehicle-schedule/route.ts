import { NextResponse } from 'next/server';
import { getStaffIdentity, portalDb } from '@/lib/portalAuth';
export const dynamic = 'force-dynamic';
const reply=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
const validDate=(d:unknown):d is string=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&!Number.isNaN(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
const keyOf=(d:string)=>`veh_sched:${d}`;
export async function GET(req:Request){
 try{
  const staff=await getStaffIdentity(req);
  if(staff?.role!=='korean_admin')return reply({error:'관리자 로그인이 필요합니다.'},403);
  const url=new URL(req.url),from=url.searchParams.get('from'),to=url.searchParams.get('to');
  if(!validDate(from)||!validDate(to)||to<from||(Date.parse(to)-Date.parse(from))/86400000>31)return reply({error:'조회 기간은 최대 31일입니다.'},400);
  const db=portalDb();
  async function read(table:string,configure:(q:ReturnType<ReturnType<typeof db.from>['select']>)=>ReturnType<ReturnType<typeof db.from>['select']>){
   const rows:Record<string,unknown>[]=[];
   for(let start=0;;start+=500){
    const {data,error}=await configure(db.from(table).select(table==='bookings'?'id,booker_name,status,accom_type,house_no,accom_room,pickup_place,drop_off,checkin_date,checkout_date,adults,children,flight_in,flight_in_date,flight_in_time,flight_in_airline,flight_in_no,flight_out,flight_out_date,flight_out_time,flight_out_airline,flight_out_no,seg1_type,seg1_checkin,seg1_checkout,seg2_type,seg2_checkin,seg2_checkout':table==='drivers'?'id,name':table==='fieldtrip_applications'?'id,name,date,room_number,status,cancelled_dates':'*')).range(start,start+499);
    if(error)throw new Error(`${table} 조회 실패`);
    rows.push(...((data||[]) as Record<string,unknown>[]));if(!data||data.length<500)return rows;
   }
  }
  const [pickups,bookings,drivers,shuttles,fieldtrips,scheduleItems,settings,commutes]=await Promise.all([
   read('pickup_requests',q=>q.gte('request_date',from).lte('request_date',to).order('id')),
   read('bookings',q=>q.or(`and(checkout_date.gte.${from},checkin_date.lte.${to}),and(flight_in_date.gte.${from},flight_in_date.lte.${to}),and(flight_out_date.gte.${from},flight_out_date.lte.${to}),and(seg1_checkout.gte.${from},seg1_checkout.lte.${to})`).order('id')),
   read('drivers',q=>q.eq('is_active',true).order('id')),
   read('shuttle_applications',q=>q.gte('tour_date',from).lte('tour_date',to).order('id')),
   read('fieldtrip_applications',q=>q.order('id')),
   read('schedule_items',q=>q.in('type',['afterschool','fieldtrip']).eq('is_deployed',true).gte('date',from).lte('date',to).order('id')),
   read('app_settings',q=>q.gte('key',keyOf(from)).lte('key',keyOf(to)).order('key')),
   read('pickup_schedules',q=>q.gte('day',from).lte('day',to).order('day')),
  ]);
  const bMap=new Map(bookings.map(b=>[b.id,b]));
  const missing=[...new Set([...pickups,...shuttles].map(p=>p.booking_id).filter(id=>typeof id==='string'&&!bMap.has(id)))];
  for(let i=0;i<missing.length;i+=100){
   const {data,error}=await db.from('bookings').select('id,booker_name,house_no,accom_room').in('id',missing.slice(i,i+100));
   if(error)throw error;for(const b of data||[])bMap.set(b.id,b);
  }
  return reply({pickups:pickups.map(p=>({...p,bookings:bMap.get(p.booking_id)||null})),bookings,
   drivers:drivers.map(d=>({id:d.id,name:d.name})),shuttles:shuttles.map(s=>({...s,booker_name:bMap.get(s.booking_id)?.booker_name||s.portal_name||''})),
   fieldtrips,scheduleItems,commutes,overrides:Object.fromEntries(settings.map(s=>[String(s.key).slice(10),s.value]))});
 }catch{return reply({error:'일부 원본 자료를 불러오지 못했습니다. 새로고침해주세요. 빈 일정으로 처리하지 않았습니다.'},503);}
}
export async function POST(req:Request){
 try{
  const staff=await getStaffIdentity(req);
  if(staff?.role!=='korean_admin')return reply({error:'관리자 로그인이 필요합니다.'},403);
  const body=await req.json();
  if(!validDate(body.date)||!body.state||typeof body.state!=='object')return reply({error:'저장할 날짜와 내용을 확인해주세요.'},400);
  const raw=body.state.confirmed;
  const confirmed=typeof raw==='boolean'?raw:{academy:raw?.academy===true,shuttle:raw?.shuttle===true,airport:raw?.airport===true};
  const overrides=body.state.overrides||{};
  if(typeof overrides!=='object'||Array.isArray(overrides)||Object.keys(overrides).length>2000)return reply({error:'배정 내용을 확인해주세요.'},400);
  const state={confirmed,overrides,manual:Array.isArray(body.state.manual)?body.state.manual:[],updated_by:staff.name,updated_at:new Date().toISOString()};
  const db=portalDb();
  for(const [id,value] of Object.entries(overrides)){
   if(!value||typeof value!=='object')return reply({error:'배정 내용을 확인해주세요.'},400);
   const ov=value as {driver_id?:string|null};
   if(!('driver_id' in ov))continue;
   const table=id.startsWith('pk_')?'pickup_requests':id.startsWith('sh_')?'shuttle_applications':null;
   if(table){const {error}=await db.from(table).update({driver_id:ov.driver_id||null}).eq('id',id.slice(3));if(error)throw error;}
  }
  const {error}=await db.from('app_settings').upsert({key:keyOf(body.date),value:state,updated_at:state.updated_at},{onConflict:'key'});
  if(error)throw error;
  return reply({ok:true,state});
 }catch{return reply({error:'저장을 완료하지 못했습니다. 입력 내용은 유지됩니다. 다시 저장해주세요.'},503);}
}

