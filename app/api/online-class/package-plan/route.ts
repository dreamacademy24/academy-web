import {NextResponse} from 'next/server';
import {packageRead,packageSave} from '@/lib/onlinePackageServer';
const failure=(e:unknown)=>{const error=e instanceof Error?e.message:'처리하지 못했습니다.';return NextResponse.json({error},{status:error.includes('로그인')?401:error.includes('본인')?403:409});};
export async function GET(req:Request){try{return NextResponse.json(await packageRead(req),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
export async function POST(req:Request){try{const origin=req.headers.get('origin');if(origin&&new URL(origin).host!==(req.headers.get('host')||new URL(req.url).host))return NextResponse.json({error:'현재 사이트에서 다시 시도해주세요.'},{status:403});return NextResponse.json(await packageSave(req,await req.json()),{headers:{'Cache-Control':'no-store'}});}catch(e){return failure(e);}}
