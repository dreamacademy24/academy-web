import {NextResponse} from 'next/server';
import {portalDb,getStaffIdentity} from '@/lib/portalAuth';
import {pendingOnlineApplications} from '@/lib/pendingOnlineApplications';
export const dynamic='force-dynamic';
export async function GET(req:Request){
 const headers={'Cache-Control':'private, no-store','Vary':'Cookie'};
 if(!await getStaffIdentity(req))return NextResponse.json({error:'직원 로그인이 필요합니다.'},{status:401,headers});
 try{return NextResponse.json({applications:await pendingOnlineApplications(portalDb())},{headers});}
 catch{return NextResponse.json({error:'신청 목록을 불러오지 못했습니다.'},{status:503,headers});}
}
