import {NextResponse} from 'next/server';
import {portalDb} from '@/lib/portalAuth';
import {requireExpenseOwner,ExpenseHttpError,expenseErrorResponse} from '@/lib/expenses/auth';
import {CLAIM_FIELDS,ensureDatabase,publicClaim} from '@/lib/expenses/store';
import {buildExpenseReport} from '@/lib/expenses/report';

export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
const DAY=/^\d{4}-\d{2}-\d{2}$/;
function manilaToday(){const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const value=(type:string)=>parts.find(p=>p.type===type)?.value||'';return value('year')+'-'+value('month')+'-'+value('day');}
function parseDay(value:string|null,fallback:string){const day=value||fallback;if(!DAY.test(day)||Number.isNaN(Date.parse(day+'T00:00:00Z'))||new Date(day+'T00:00:00Z').toISOString().slice(0,10)!==day)throw new ExpenseHttpError(400,'날짜 형식을 확인하세요. / Check the date format.');return day;}
function daysBetween(from:string,to:string){return Math.floor((Date.parse(to+'T00:00:00Z')-Date.parse(from+'T00:00:00Z'))/86400000);}
async function fetchBounded(query:any){const rows:any[]=[];for(let offset=0;offset<50000;offset+=1000){const result=await query.range(offset,offset+999);ensureDatabase(result.error);const chunk=result.data||[];rows.push(...chunk);if(chunk.length<1000)return rows;}throw new ExpenseHttpError(413,'조회 범위의 거래가 50,000건을 초과합니다. 기간을 줄여주세요. / Too many rows; shorten the date range.');}
export async function GET(req:Request){
 try{
  await requireExpenseOwner(req);
  const url=new URL(req.url),today=manilaToday(),month=today.slice(0,7),from=parseDay(url.searchParams.get('from'),month+'-01'),to=parseDay(url.searchParams.get('to'),today);
  if(from>to||daysBetween(from,to)>366)throw new ExpenseHttpError(400,'조회 기간은 최대 366일입니다. / Date range is limited to 366 days.');
  const db=portalDb();
  const [ledgerRows,claimRows,cfg]=await Promise.all([
   fetchBounded(db.from('may_ledger').select('id,entry_date,book,type,division,amount,currency,source').eq('book','회사').gte('entry_date',from).lte('entry_date',to).order('entry_date',{ascending:true}).order('id',{ascending:true})),
   fetchBounded(db.from('expense_claims').select(CLAIM_FIELDS).eq('status','approved').gte('entry_date',from).lte('entry_date',to).order('entry_date',{ascending:true}).order('id',{ascending:true})),
   db.from('may_ledger_config').select('krw_per_php').eq('id','settings').maybeSingle()
  ]);
  ensureDatabase(cfg.error); const fx=Number(cfg.data?.krw_per_php??23);
  const report=buildExpenseReport(ledgerRows,claimRows.map((x:any)=>publicClaim(x)),fx);
  return NextResponse.json({from,to,krw_per_php:fx,report},{headers:noStore});
 }catch(error){return expenseErrorResponse(error);}
}
