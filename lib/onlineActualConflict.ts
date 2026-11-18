type Slot={enrollment_id:string;scheduled_date:string;scheduled_time_kr:string|null;status:string};
type Candidate={id?:string;days_of_week?:string[];class_time_kr?:string|null;day_times?:Record<string,string>|null;start_date?:string|null;end_date?:string|null;useStoredSessions?:boolean};
const days=['sun','mon','tue','wed','thu','fri','sat'];
const kr=['일','월','화','수','목','금','토'];
const normalize=(t:string|null|undefined)=>{const m=String(t||'').match(/(\d{1,2})[:시](\d{2})/);return m?`${m[1].padStart(2,'0')}:${m[2]}`:''};
export function actualSessionConflict(candidate:Candidate,otherId:string,slots:Slot[]):string|null{
 const mine=slots.filter(s=>s.enrollment_id===candidate.id);
 const useSaved=candidate.useStoredSessions&&mine.length>0;
 for(const s of slots.filter(s=>s.enrollment_id===otherId&&['scheduled','makeup'].includes(s.status))){
  if(candidate.start_date&&s.scheduled_date<candidate.start_date||candidate.end_date&&s.scheduled_date>candidate.end_date)continue;
  const time=normalize(s.scheduled_time_kr);if(!time)continue;
  if(useSaved){if(mine.some(m=>['scheduled','makeup'].includes(m.status)&&m.scheduled_date===s.scheduled_date&&normalize(m.scheduled_time_kr)===time))return `${s.scheduled_date} ${time}`;continue;}
  const index=new Date(s.scheduled_date+'T12:00:00Z').getUTCDay();
  if(!(candidate.days_of_week||[]).some(d=>d.toLowerCase()===days[index]||d===kr[index]))continue;
  const ownTime=normalize(candidate.day_times?.[kr[index]]||candidate.day_times?.[days[index]]||candidate.class_time_kr);
  if(time===ownTime)return `${s.scheduled_date} ${time}`;
 }return null;
}
