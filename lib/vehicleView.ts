import { to24h, type VehMovement } from './vehicleSchedule';
export type VehicleTab = 'all' | 'shuttle' | 'airport' | 'student' | 'extra';
export type VehicleRow = VehMovement & { applicants?: VehMovement[]; mixedDrivers?: boolean };
// Group a shared shuttle run, never delete or deduplicate applications by guest name.
export function groupShuttleRuns(movements: VehMovement[]): VehicleRow[] {
 const rows: VehicleRow[] = [], groups = new Map<string, VehicleRow>();
 const normalized = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();
 for (const m of movements) {
  const activity = m.source === 'fieldtrip_applications';
  if ((!activity && m.source !== 'shuttle_applications') || !m.date || m.sortTime === '99:99' || !m.location || !m.destination) { rows.push({...m}); continue; }
  // Separate activity vehicles and teachers; unassigned students form a pending run.
  const key = JSON.stringify([m.source, m.kind, m.date, m.sortTime, normalized(m.location), normalized(m.destination), ...(activity ? [m.driver_id || '', normalized(m.vehicle_name || ''), normalized(m.teacher_name || '')] : [])]);
  const group = groups.get(key);
  if (!group) { const row = {...m, applicants: [m]}; groups.set(key, row); rows.push(row); }
  else { group.applicants!.push(m); group.num_people += m.num_people; }
 }
 for (const row of groups.values()) {
  row.guest = row.applicants!.map(m => `${m.guest} (${m.num_people}명)`).join(' · ');
  row.mixedDrivers = new Set(row.applicants!.map(m => m.driver_id || m.driver_name || '')).size > 1;
 }
 return rows;
}
export function vehicleCategory(m: VehMovement): VehicleTab {
 if(['pickup','dropoff'].includes(m.kind))return 'airport';
 if(['extra','transfer'].includes(m.kind))return 'extra';
 return ['commute','afterschool','fieldtrip'].includes(m.kind)?'student':'shuttle';
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
export function mergeMovement(m:VehMovement,o?:{driver_id?:string|null;time?:string;note?:string;vehicle_name?:string;teacher_name?:string}):VehMovement {
 return o?{...m,...o,sortTime:o.time!==undefined?to24h(o.time):m.sortTime}:m;
}
type Extra={id:string;booking_id:string;type?:string;date?:string;airline?:string;flight?:string;time?:string;bookings?:{booker_name?:string;house_no?:string;accom_room?:string}|null};
export function checkinMovements(rows:Extra[]):VehMovement[]{
 return rows.map(p=>({id:p.id,booking_id:p.booking_id,date:p.date||'',time:'',sortTime:'99:99',kind:'extra',source:'checkin_details',guest:p.bookings?.booker_name||'예약자 확인',location:p.type==='픽업'?'공항':p.bookings?.house_no||p.bookings?.accom_room||'숙소 확인',destination:p.type==='픽업'?p.bookings?.house_no||p.bookings?.accom_room||'숙소 확인':'공항',num_people:0,flight_info:[p.airline,p.flight,p.time?`항공 ${p.time}`:''].filter(Boolean).join(' · '),note:`체크인 디테일 추가 ${p.type||'픽드랍'} · 별도 신청과 같은 운행인지 원본 대조 필요`,locked:true}));
}

