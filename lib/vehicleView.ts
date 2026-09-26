import { to24h, type VehMovement } from './vehicleSchedule';
export type VehicleTab = 'all' | 'shuttle' | 'airport' | 'student' | 'extra';
export function vehicleCategory(m: VehMovement): VehicleTab {
 if(['pickup','dropoff'].includes(m.kind))return 'airport';
 if(['extra','transfer'].includes(m.kind))return 'extra';
 return m.kind==='commute'?'student':'shuttle';
}
export function needsDispatch(m: VehMovement): boolean {
 if(['cancelled','취소','completed','done','완료'].includes(m.request_status||''))return false;
 return !m.date||!m.time||m.sortTime==='99:99'||(!m.driver_id&&!m.driver_name);
}
export function movementTime(m: VehMovement): string {
 if(!m.time)return '시간 미정';
 if(m.sortTime==='99:99')return m.time;
 const [h,min]=to24h(m.time).split(':').map(Number);
 if(!Number.isFinite(h)||h>23||min>59)return m.time;
 const range=m.time.match(/^\s*\d{1,2}:\d{2}\s*[~–-]\s*(?:(\d{1,2}):)?(\d{2})/);
 if(range){
  let endHour=range[1]?Number(range[1]):h;
  if(/pm/i.test(m.time)&&endHour<12)endHour+=12;
  if(/am/i.test(m.time)&&endHour===12)endHour=0;
  const endPeriod=(endHour<12)!==(h<12)?`${endHour<12?'오전':'오후'} `:'';
  return `${h<12?'오전':'오후'} ${h%12||12}:${String(min).padStart(2,'0')}–${endPeriod}${endHour%12||12}:${range[2]}`;
 }
 return `${h<12?'오전':'오후'} ${h%12||12}:${String(min).padStart(2,'0')}`;
}
export function mergeMovement(m:VehMovement,o?:{driver_id?:string|null;time?:string;note?:string}):VehMovement {
 return o?{...m,...o,sortTime:o.time!==undefined?to24h(o.time):m.sortTime}:m;
}
type Extra={id:string;booking_id:string;type?:string;date?:string;airline?:string;flight?:string;time?:string;bookings?:{booker_name?:string;house_no?:string;accom_room?:string}|null};
export function checkinMovements(rows:Extra[]):VehMovement[]{
 return rows.map(p=>({id:p.id,booking_id:p.booking_id,date:p.date||'',time:'',sortTime:'99:99',kind:'extra',source:'checkin_details',guest:p.bookings?.booker_name||'예약자 확인',location:p.type==='픽업'?'공항':p.bookings?.house_no||p.bookings?.accom_room||'숙소 확인',destination:p.type==='픽업'?p.bookings?.house_no||p.bookings?.accom_room||'숙소 확인':'공항',num_people:0,flight_info:[p.airline,p.flight,p.time?`항공 ${p.time}`:''].filter(Boolean).join(' · '),note:`체크인 디테일 추가 ${p.type||'픽드랍'} · 별도 신청과 같은 운행인지 원본 대조 필요`,locked:true}));
}

