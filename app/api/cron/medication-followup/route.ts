import {NextResponse} from 'next/server';
import {portalDb} from '@/lib/portalAuth';
export async function GET(req:Request){
 if(!process.env.CRON_SECRET||req.headers.get('authorization')!==`Bearer ${process.env.CRON_SECRET}`)return NextResponse.json({error:'Unauthorized'},{status:401});
 const {error}=await portalDb().rpc('sync_medication_followups');
 return NextResponse.json(error?{error:'Follow-up sync failed'}:{ok:true},{status:error?503:200});
}
