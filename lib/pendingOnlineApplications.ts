// Approval is separate from teacher assignment and task read/completion state.
export async function pendingOnlineApplications(db:any){
 const c=await db.from('app_settings').select('value').eq('key','oc_confirmed_enrollments').maybeSingle();
 if(c.error)throw c.error;
 const confirmed=new Set(Array.isArray(c.data?.value)?c.data.value:[]);
 const rows:any[]=[];
 for(let offset=0;;offset+=500){
  const r=await db.from('online_enrollments').select('id,student_name,tutor_id,days_of_week,class_time_kr,day_times,start_date,total_sessions,pre_sessions,post_sessions,created_at,tutor:online_tutors(name_display)').eq('enrollment_type','free_package').like('notes','%엄마 앱 신청%').in('status',['active','scheduled']).order('created_at',{ascending:false}).order('id').range(offset,offset+499);
  if(r.error)throw r.error;rows.push(...r.data);if(r.data.length<500)break;
 }
 return rows.filter(e=>!confirmed.has(e.id));
}
