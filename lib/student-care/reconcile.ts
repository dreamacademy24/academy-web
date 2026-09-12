/** Read-only reconciliation. A candidate is never permission to merge people. */
export type LegacyStudent = {id:string;booking_id:string|null;name_kr:string;name_en?:string|null};
export type BookingInput = {id:string;students:unknown};
export type ReviewStatus = 'id_candidate'|'name_review'|'unmatched'|'conflict'|'placeholder';
export type ReviewItem = {
  sourceKey:string;bookingId:string;sourceIndex:number;sourceId:string|null;
  status:ReviewStatus;candidateIds:string[];reasons:string[];
};
export type Reconciliation = {items:ReviewItem[];issues:{bookingId:string;reason:string}[]};
const record=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const text=(v:unknown)=>typeof v==='string'?v.trim():'';
const first=(r:Record<string,unknown>,keys:string[])=>keys.map(k=>text(r[k])).find(Boolean)||'';
const normalized=(v:string)=>v.normalize('NFC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en-US');

export function reconcileStudents(bookings:BookingInput[],students:LegacyStudent[]):Reconciliation {
  const result:Reconciliation={items:[],issues:[]};
  const byId=new Map<string,LegacyStudent[]>();
  for(const student of students)byId.set(student.id,[...(byId.get(student.id)||[]),student]);
  const bookingIds=new Set<string>();
  for(const booking of bookings){
    if(bookingIds.has(booking.id)){result.issues.push({bookingId:booking.id,reason:'duplicate_booking_input'});continue;}
    bookingIds.add(booking.id);
    let payload=booking.students;
    if(typeof payload==='string'){
      try{payload=JSON.parse(payload);}catch{result.issues.push({bookingId:booking.id,reason:'invalid_json'});continue;}
    }
    if(!Array.isArray(payload)){result.issues.push({bookingId:booking.id,reason:'not_an_array'});continue;}
    payload.forEach((value,sourceIndex)=>{
      if(!record(value)){result.issues.push({bookingId:booking.id,reason:`invalid_entry:${sourceIndex}`});return;}
      const name=first(value,['korName','name_kr','koreanName','name']);
      const english=first(value,['engName','name_en']);
      const sourceId=first(value,['id','student_id'])||null;
      const item:ReviewItem={sourceKey:`${booking.id}:${sourceIndex}`,bookingId:booking.id,sourceIndex,sourceId,status:'unmatched',candidateIds:[],reasons:[]};
      result.items.push(item);
      if((!name||name==='-')&&(!english||english==='-')){item.status='placeholder';item.reasons.push('no_student_name');return;}
      if(text(value.id)&&text(value.student_id)&&text(value.id)!==text(value.student_id)){
        item.status='conflict';item.reasons.push('conflicting_source_ids');return;
      }
      const direct=sourceId?byId.get(sourceId)||[]:[];
      if(direct.length){
        item.candidateIds=direct.map(s=>s.id);
        if(direct.length!==1||direct[0].booking_id!==booking.id){item.status='conflict';item.reasons.push('id_not_unique_or_wrong_booking');return;}
        const row=direct[0];
        if((name&&name!=='-'&&normalized(name)!==normalized(row.name_kr))||(english&&row.name_en&&normalized(english)!==normalized(row.name_en))){
          item.status='conflict';item.reasons.push('id_name_disagreement');return;
        }
        item.status='id_candidate';item.reasons.push('same_booking_and_id');return;
      }
      if(sourceId)item.reasons.push('source_id_not_found');
      const candidates=students.filter(s=>s.booking_id===booking.id&&((name&&name!=='-'&&normalized(s.name_kr)===normalized(name))||(!name&&english&&s.name_en&&normalized(s.name_en)===normalized(english))));
      item.candidateIds=candidates.map(s=>s.id);
      if(candidates.length){item.status='name_review';item.reasons.push(candidates.length===1?'name_only_requires_review':'ambiguous_name');}
      else item.reasons.push('no_candidate_in_booking');
    });
  }
  // Two source entries targeting one row must not silently collapse siblings or duplicates.
  const claims=new Map<string,ReviewItem[]>();
  for(const item of result.items)if(item.status==='id_candidate'){
    const id=item.candidateIds[0];claims.set(id,[...(claims.get(id)||[]),item]);
  }
  for(const entries of claims.values())if(entries.length>1)for(const item of entries){item.status='conflict';item.reasons.push('repeated_id_claim');}
  return result;
}
