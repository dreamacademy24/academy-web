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
    const {data,error}=await configure(db.from(table).select(table==='bookings'?'id,booker_name,status,accom_type,house_no,accom_room,pickup_place,drop_off,checkin_date,checkout_date,adults,children,flight_in,flight_in_date,flight_in_time,flight_in_airline,flight_in_no,flight_out,flight_out_date,flight_out_time,flight_out_airline,flight_out_no,seg1_type,seg1_checkin,seg1_checkout,seg2_type,seg2_checkin,seg2_checkout':table==='checkin_details'?'id,booking_id,extra_pickups':table==='drivers'?'id,name':table==='fieldtrip_applications'?'id,name,date,room_number,status,cancelled_dates':'*')).range(start,start+499);
    if(error)throw new Error(`${table} 조회 실패`);
    rows.push(...((data||[]) as Record<string,unknown>[]));if(!data||data.length<500)return rows;
   }
  }
  const [pickups,bookings,drivers,shuttles,fieldtrips,scheduleItems,settings,commutes]=await Promise.all([
   // Read requests across dates so an unassigned request cannot disappear behind the date filter.
   read('pickup_requests',q=>q.order('id')),
   read('bookings',q=>q.or(`and(checkout_date.gte.${from},checkin_date.lte.${to}),and(flight_in_date.gte.${from},flight_in_date.lte.${to}),and(flight_out_date.gte.${from},flight_out_date.lte.${to}),and(seg1_checkout.gte.${from},seg1_checkout.lte.${to})`).order('id')),
   read('drivers',q=>q.eq('is_active',true).order('id')),
   read('shuttle_applications',q=>q.gte('tour_date',from).lte('tour_date',to).order('id')),
   read('fieldtrip_applications',q=>q.order('id')),
   read('schedule_items',q=>q.in('type',['afterschool','fieldtrip']).eq('is_deployed',true).gte('date',from).lte('date',to).order('id')),
   read('app_settings',q=>q.gte('key',keyOf(from)).lte('key',keyOf(to)).order('key')),
   read('pickup_schedules',q=>q.gte('day',from).lte('day',to).order('day')),
  ]);
  const checkinRows=await read('checkin_details',q=>q.not('extra_pickups','is',null).order('id'));
  const checkinExtras=(checkinRows||[]).flatMap(row=>{
   let entries=row.extra_pickups;
   if(typeof entries==='string'){try{entries=JSON.parse(entries);}catch{entries=[];}}
   if(!Array.isArray(entries))return [];
   return entries.flatMap((entry,index)=>entry&&typeof entry==='object'&&(entry.date||entry.flight||entry.airline||entry.time)?[{...entry,id:`ck_${row.id}_${index}`,booking_id:row.booking_id}]:[]);
  });
  const extraDates=[...new Set([...pickups.map(p=>p.request_date),...checkinExtras.map(p=>p.date)].filter((d):d is string=>validDate(d)&&(d<from||d>to)))];
  for(let i=0;i<extraDates.length;i+=100){
   const {data,error}=await db.from('app_settings').select('key,value').in('key',extraDates.slice(i,i+100).map(keyOf));
   if(error)throw error;settings.push(...(data||[]));
  }
  const bMap=new Map(bookings.map(b=>[b.id,b]));
  const missing=[...new Set([...pickups,...shuttles,...checkinExtras].map(p=>p.booking_id).filter(id=>typeof id==='string'&&!bMap.has(id)))];
  for(let i=0;i<missing.length;i+=100){
   const {data,error}=await db.from('bookings').select('id,booker_name,house_no,accom_room,status').in('id',missing.slice(i,i+100));
   if(error)throw error;for(const b of data||[])bMap.set(b.id,b);
  }
  const overrides=Object.fromEntries(settings.map(s=>[String(s.key).slice(10),s.value])) as Record<string,{overrides?:Record<string,{driver_id?:unknown;time?:unknown;note?:unknown}>}>;
  // Source-backed assignments are authoritative, including changes made on the original page.
  for(const p of pickups){
   const state=overrides[String(p.request_date)];
   const ov=state?.overrides?.[`pk_${p.id}`];
   if(ov){ov.driver_id=p.driver_id??null;ov.time=p.request_time||'';ov.note=p.notes||'';}
  }
  for(const s of shuttles){const ov=overrides[String(s.tour_date)]?.overrides?.[`sh_${s.id}`];if(ov)ov.driver_id=s.driver_id??null;}
  return reply({pickups:pickups.map(p=>({...p,bookings:bMap.get(p.booking_id)||null})),bookings,
   checkinExtras:checkinExtras.filter(p=>!['cancelled','취소'].includes(String(bMap.get(p.booking_id)?.status||''))).map(p=>({...p,bookings:bMap.get(p.booking_id)||null})),
   drivers:drivers.map(d=>({id:d.id,name:d.name})),shuttles:shuttles.map(s=>({...s,booker_name:bMap.get(s.booking_id)?.booker_name||s.portal_name||''})),
   fieldtrips,scheduleItems,commutes,overrides});
 }catch{return reply({error:'일부 원본 자료를 불러오지 못했습니다. 새로고침해주세요. 빈 일정으로 처리하지 않았습니다.'},503);}
}
export async function POST(req:Request){
 try{
  const staff=await getStaffIdentity(req);
  if(staff?.role!=='korean_admin')return reply({error:'관리자 로그인이 필요합니다.'},403);
  const body=await req.json();
  if(!validDate(body.date)||!body.state||typeof body.state!=='object')return reply({error:'저장할 날짜와 내용을 확인해주세요.'},400);
  const db=portalDb();
  // The compact editor saves one row against the current server state, not a stale full-day snapshot.
  if(body.onlyId){
   const id=body.onlyId;
   if(typeof id!=='string'||!/^(pk|sh|ck|cm|bk|mn|as|ft)_/.test(id))return reply({error:'일정 정보를 확인해주세요.'},400);
   const value=body.state.overrides?.[id];
   if(!value||typeof value.time!=='string'||value.time.length>60||typeof value.note!=='string'||value.note.length>10000)return reply({error:'시간과 메모를 확인해주세요.'},400);
   if ((value.vehicle_name!==undefined && (typeof value.vehicle_name!=='string'||value.vehicle_name.length>100)) || (value.teacher_name!==undefined && (typeof value.teacher_name!=='string'||value.teacher_name.length>200))) return reply({error:'차량명과 담당 티쳐를 확인해주세요.'},400);
   const time=value.time.trim();
   if(time&&!/^([01]?\d|2[0-3]):[0-5]\d(?:\s*[~–-]\s*(?:([01]?\d|2[0-3]):)?[0-5]\d)?\s*(?:AM|PM)?$/i.test(time))return reply({error:'시간은 14:30 또는 14:30–14:40 형식으로 입력해주세요.'},400);
   const driver=value.driver_id||null;
   if(driver&&(typeof driver!=='string'||! /^[0-9a-f-]{36}$/i.test(driver)))return reply({error:'기사를 확인해주세요.'},400);
   const {data:existing,error:readError}=await db.from('app_settings').select('value').eq('key',keyOf(body.date)).maybeSingle();
   if(readError)throw readError;
   const state={...(existing?.value||{}),overrides:{...(existing?.value?.overrides||{}),[id]:{driver_id:driver,time,note:value.note,vehicle_name:value.vehicle_name?.trim()||'',teacher_name:value.teacher_name?.trim()||''}},updated_by:staff.name,updated_at:new Date().toISOString()};
   const table=id.startsWith('pk_')?'pickup_requests':id.startsWith('sh_')?'shuttle_applications':null;
   if(table){
    const fields=table==='pickup_requests'?{driver_id:driver,request_time:time||null,notes:value.note}:{driver_id:driver};
    const {data,error}=await db.from(table).update(fields).eq('id',id.slice(3)).eq(table==='pickup_requests'?'request_date':'tour_date',body.date).select('id');
    if(error)throw error;if(!data?.length)return reply({error:'원본 일정이 변경되었습니다. 새로고침 후 확인해주세요.'},409);
   }
   const {error}=await db.from('app_settings').upsert({key:keyOf(body.date),value:state,updated_at:state.updated_at},{onConflict:'key'});
   if(error)throw error;
   return reply({ok:true,state});
  }
  const raw=body.state.confirmed;
  const confirmed=typeof raw==='boolean'?raw:{academy:raw?.academy===true,shuttle:raw?.shuttle===true,airport:raw?.airport===true};
  const overrides=body.state.overrides||{};
  if(typeof overrides!=='object'||Array.isArray(overrides)||Object.keys(overrides).length>2000)return reply({error:'배정 내용을 확인해주세요.'},400);
  const state={confirmed,overrides,manual:Array.isArray(body.state.manual)?body.state.manual:[],updated_by:staff.name,updated_at:new Date().toISOString()};
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

