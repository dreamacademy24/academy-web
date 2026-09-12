import type {portalDb} from '@/lib/portalAuth';

export type CareSelection={bookingId:string;sourceIndex:number;sourceId:string|null};
export class SelectionError extends Error{constructor(message:string,public status:number){super(message);}}
export function readCareSelection(url:string):CareSelection|null{
  const params=new URL(url).searchParams;
  if(!params.has('bookingId')&&!params.has('sourceIndex')&&!params.has('sourceId'))return null;
  const bookingId=params.get('bookingId')||'',index=params.get('sourceIndex')||'',sourceId=params.get('sourceId');
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingId)||!/^\d{1,4}$/.test(index)||Number(index)>999||(sourceId&&sourceId.length>100))throw new SelectionError('학생 목록에서 다시 선택해주세요.',400);
  return {bookingId,sourceIndex:Number(index),sourceId};
}
type SelectedRoster={isAdmin:boolean;visits:{id:string;learner_id:string}[];pendingStudents?:{id:string}[];[key:string]:unknown};
const value=(item:Record<string,unknown>,keys:string[])=>keys.map(key=>item[key]).find(v=>typeof v==='string'&&v.trim()) as string|undefined;
export async function selectCareStudent(db:ReturnType<typeof portalDb>,roster:SelectedRoster,selection:CareSelection|null){
  if(!selection)return roster;
  if(!roster.isAdmin)throw new SelectionError('Access denied.',403);
  const {data:booking,error}=await db.from('bookings').select('id,students,academy_start,academy_end').eq('id',selection.bookingId).maybeSingle();
  if(error)throw error;
  if(!booking)throw new SelectionError('선택한 학생의 예약을 찾을 수 없습니다. 목록을 새로고침해주세요.',404);
  let entries=booking.students;
  try{if(typeof entries==='string')entries=JSON.parse(entries);}catch{throw new SelectionError('학생 자료를 확인해주세요.',409);}
  const entry=Array.isArray(entries)?entries[selection.sourceIndex]:null;
  if(!entry||typeof entry!=='object'||Array.isArray(entry))throw new SelectionError('학생 목록이 변경되었습니다. 다시 선택해주세요.',409);
  const id=value(entry,['id','student_id'])?.trim()||null;
  if((entry.id&&entry.student_id&&entry.id!==entry.student_id)||(selection.sourceId&&selection.sourceId!==id))throw new SelectionError('학생 정보가 변경되었습니다. 목록에서 다시 선택해주세요.',409);
  const {data:link,error:linkError}=await db.from('care_links').select('learner_id,visit_id,legacy_student_id').eq('booking_id',selection.bookingId).eq('source_index',selection.sourceIndex).maybeSingle();
  if(linkError)throw linkError;
  if(link&&(!id||link.legacy_student_id!==id))throw new SelectionError('학생 번호가 기존 방문과 다릅니다. 원본 정보를 확인해주세요.',409);
  const name=value(entry,['korName','name_kr','koreanName','name','engName','name_en'])?.trim()||'이름 미등록';
  const visits=link?roster.visits.filter(v=>v.learner_id===link.learner_id):[];
  if(link&&!visits.some(v=>v.id===link.visit_id))throw new SelectionError('방문 정보를 다시 불러와주세요.',409);
  return {...roster,sourceCount:1,visits,pendingStudents:link?[]:[{id:`${selection.bookingId}:${selection.sourceIndex}`,name_kr:name,name_en:value(entry,['engName','name_en'])||null,start_date:booking.academy_start,end_date:booking.academy_end,reason:'방문 정보 확인 필요'}],selection:{bookingId:selection.bookingId,sourceIndex:selection.sourceIndex,name,visitId:link?.visit_id||null}};
}
