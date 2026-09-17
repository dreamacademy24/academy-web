export type CheckinBooking = {id:string;booker_name?:string;booker_english?:string;reservation_no?:string;house_no?:string;accom_room?:string;accom_type?:string;booking_type?:string;checkin_date?:string;checkout_date?:string;seg1_type?:string;seg1_checkin?:string;seg1_checkout?:string;seg2_type?:string;seg2_checkin?:string;seg2_checkout?:string};
export function dreamhouseStay(b:CheckinBooking){
  const isHouse=(value?:string)=>/드림하우스|dream\s*house/i.test(value||'');
  if(isHouse(b.seg1_type))return {date:b.seg1_checkin||b.checkin_date||'',end:b.seg1_checkout||b.checkout_date||''};
  if(isHouse(b.seg2_type))return {date:b.seg2_checkin||b.checkin_date||'',end:b.seg2_checkout||b.checkout_date||''};
  if(isHouse(b.accom_type))return {date:b.checkin_date||'',end:b.checkout_date||''};
  return null;
}
export function checkinSummary(b:CheckinBooking,d:{checkin_date?:string;bed_setting?:string;guest_names_en?:string}|null){
  let beds:Record<string,string>={};try{beds=JSON.parse(d?.bed_setting||'{}')||{};}catch{}
  const english=(v:string)=>String(v).replace(/더블베드/g,'Double bed').replace(/싱글(?:베드)?/g,'Single bed').replace(/사용하지 않음/g,'Not in use').replace(/개/g,'').replace(/인 스테이/g,'guests').replace(/\s+/g,' ').trim();
  const labels:Record<string,string>={room1:'2F Master',room2:'2F Small',room3:'1F'};
  const bedText=Object.keys(labels).filter(key=>typeof beds[key]==='string'&&beds[key].trim()).map(key=>labels[key]+': '+english(beds[key])).join(' / ');
  const stay=dreamhouseStay(b),hasSegment=/드림하우스|dream\s*house/i.test((b.seg1_type||'')+' '+(b.seg2_type||''));
  return {guest:[b.booker_english||b.booker_name||d?.guest_names_en||'',b.reservation_no||''].filter(Boolean).join(' / '),date:(hasSegment?stay?.date:d?.checkin_date||stay?.date)||'',house:b.house_no||b.accom_room||'',beds:bedText};
}
