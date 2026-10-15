import {projectFileAccess} from '@/lib/staffProjectFiles';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{
 const project=new URL(req.url).searchParams.get('project')||'',{db}=await projectFileAccess(req,project);
 const files=[];
 for(let offset=0;;offset+=500){const r=await db.from('app_settings').select('value').like('key','project-file:%').eq('value->>project_id',project).order('key').range(offset,offset+499);if(r.error)throw r.error;files.push(...r.data.map(r=>r.value));if(r.data.length<500)break;}
 return Response.json({files},{headers:{'Cache-Control':'private, no-store'}});
 }catch(e){const err=e as Error&{status?:number};return Response.json({error:err.message},{status:err.status||503});}}
