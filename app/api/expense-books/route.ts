import {NextResponse} from 'next/server';
import {randomUUID,createHash} from 'node:crypto';
import {portalDb} from '@/lib/portalAuth';
import {requireExpenseAccess,expenseErrorResponse,ExpenseHttpError} from '@/lib/expenses/auth';
import {bookAccess,BOOKS} from '@/lib/expenses/books';
import {isUuid,moneyToMinor} from '@/lib/expenses/validation';
import {EXPENSE_HOUSES} from '@/lib/expenses/houses';
import {ensureDatabase,receiptMime,RECEIPT_BUCKET,cleanupReceipts} from '@/lib/expenses/store';
import type {ReceiptMeta} from '@/lib/expenses/model';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'no-store'};
const fields='id,unit,entry_date,direction,house_no,group_label,category_label,amount,memo,received_by,staff_name,status,review_note,receipt_note,created_at,receipts';
function date(v:unknown){if(typeof v!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(v)||Number.isNaN(Date.parse(v+'T00:00:00Z'))||new Date(v+'T00:00:00Z').toISOString().slice(0,10)!==v)throw new ExpenseHttpError(400,'올바른 날짜를 선택해 주세요. / Select a valid date.');return v;}
function text(v:unknown,max=1000){if(v==null)return '';if(typeof v!=='string'||v.length>max)throw new ExpenseHttpError(400,'입력 내용을 확인해 주세요.');return v.trim();}
async function access(req:Request,unit:unknown){const a=await requireExpenseAccess(req),rights=bookAccess(a.staff);if(typeof unit!=='string'||!rights.units.includes(unit as never))throw new ExpenseHttpError(403,'이 사업장에는 접근할 수 없습니다. / No access to this business.');return {...a,...rights,unit};}
function publicRow(row:Record<string,unknown>){const {receipts,...rest}=row;return {...rest,receipt_count:Array.isArray(receipts)?receipts.length:0};}
export async function GET(req:Request){try{const url=new URL(req.url),unit=url.searchParams.get('unit');
 if(!unit){const a=await requireExpenseAccess(req),rights=bookAccess(a.staff);return NextResponse.json({...rights,name:a.staff.name,books:BOOKS.filter(b=>rights.units.includes(b.id)),houses:EXPENSE_HOUSES},{headers});}
 const a=await access(req,unit),db=portalDb(),receipt=url.searchParams.get('receipt');
 if(receipt){if(!isUuid(receipt))throw new ExpenseHttpError(400,'잘못된 기록 번호입니다.');const r=await db.from('expense_book_entries').select('receipts').eq('unit',unit).eq('id',receipt).maybeSingle();ensureDatabase(r.error);if(!r.data)throw new ExpenseHttpError(404,'기록을 찾지 못했습니다.');const paths=(r.data.receipts as ReceiptMeta[]).map(r=>r.object_key);if(!paths.length)return NextResponse.json({urls:[]},{headers});const signed=await db.storage.from(RECEIPT_BUCKET).createSignedUrls(paths,60);ensureDatabase(signed.error);if(signed.data?.some(x=>x.error))throw new ExpenseHttpError(503,'사진을 불러오지 못했습니다.');return NextResponse.json({urls:signed.data?.map(x=>x.signedUrl)||[]},{headers});}
 const from=date(url.searchParams.get('from')),to=date(url.searchParams.get('to'));if(from>to)throw new ExpenseHttpError(400,'조회 기간을 확인하세요.');
 const offset=Number(url.searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>100000)throw new ExpenseHttpError(400,'페이지를 확인하세요.');
 const status=url.searchParams.get('status');if(status&&!['submitted','approved','rejected'].includes(status))throw new ExpenseHttpError(400,'상태를 확인하세요.');
 let q=db.from('expense_book_entries').select(fields).eq('unit',unit).gte('entry_date',from).lte('entry_date',to).order('entry_date',{ascending:false}).order('created_at',{ascending:false}).order('id');if(status)q=q.eq('status',status);
 const [rows,cats,totals]=await Promise.all([q.range(offset,offset+50),db.from('expense_book_categories').select('*').eq('unit',unit).order('sort_order').order('label'),db.rpc('expense_book_totals',{p_unit:unit,p_from:from,p_to:to})]);[rows.error,cats.error,totals.error].forEach(ensureDatabase);
 return NextResponse.json({items:(rows.data||[]).slice(0,50).map(publicRow),hasMore:(rows.data?.length||0)>50,offset,categories:cats.data,totals:totals.data,canApprove:a.canApprove,canManage:a.canManage},{headers});
 }catch(e){return expenseErrorResponse(e);}}
export async function POST(req:Request){const uploaded:ReceiptMeta[]=[];let committed=false;try{
 if(Number(req.headers.get('content-length')||0)>4*1024*1024)throw new ExpenseHttpError(413,'사진 용량을 줄여주세요.');
 const form=await req.formData(),raw=form.get('payload');if(typeof raw!=='string'||raw.length>12000)throw new ExpenseHttpError(400,'내용을 확인하세요.');let b;try{b=JSON.parse(raw)}catch{throw new ExpenseHttpError(400,'내용을 확인하세요.');}
 const a=await access(req,b.unit),db=portalDb();if(!isUuid(b.key))throw new ExpenseHttpError(400,'작성 화면을 다시 열어주세요.');
 const entry_date=date(b.entry_date),direction=b.direction;if(!['in','out'].includes(direction))throw new ExpenseHttpError(400,'입출금을 선택하세요.');
 let amount;try{amount=moneyToMinor(b.amount,'PHP')/100;}catch{throw new ExpenseHttpError(400,'금액을 확인하세요. / Check the amount.');}
 const house_no=a.unit==='dreamhouse'?text(b.house_no,100):'';if(a.unit==='dreamhouse'&&!['common',...EXPENSE_HOUSES.map(h=>h.id)].includes(house_no))throw new ExpenseHttpError(400,'하우스 번호 또는 공통을 선택하세요.');
 const memo=text(b.memo),received_by=text(b.received_by,100),receipt_note=text(b.receipt_note,500);
 let category_id=null,category_label='입금 / Money in',group_label='입금 / Money in';
 if(direction==='out'){if(!isUuid(b.category_id))throw new ExpenseHttpError(400,'지출 항목을 선택하세요.');const c=await db.from('expense_book_categories').select('*').eq('unit',a.unit).eq('id',b.category_id).eq('active',true).maybeSingle();ensureDatabase(c.error);if(!c.data?.parent_id)throw new ExpenseHttpError(400,'사용 가능한 소항목을 선택하세요.');const g=await db.from('expense_book_categories').select('*').eq('id',c.data.parent_id).eq('unit',a.unit).eq('active',true).maybeSingle();ensureDatabase(g.error);if(!g.data)throw new ExpenseHttpError(400,'사용 중지된 항목입니다. 다시 선택하세요.');category_id=c.data.id;category_label=c.data.label;group_label=g.data.label;}
 const files=form.getAll('receipts');if(files.length>2||files.some(f=>!(f instanceof File)||f.size<1||f.size>1572864))throw new ExpenseHttpError(400,'사진은 1.5MB 이하 두 장까지 첨부하세요.');
 if(!files.length&&receipt_note.length<3)throw new ExpenseHttpError(400,'증빙 사진을 첨부하거나 증빙이 없는 사유를 적어주세요.');
 const prepared=await Promise.all((files as File[]).map(async f=>{const bytes=new Uint8Array(await f.arrayBuffer()),mime=receiptMime(bytes);if(!mime)throw new ExpenseHttpError(400,'JPG·PNG·WEBP 사진을 선택하세요.');return {bytes,mime,sha256:createHash('sha256').update(bytes).digest('hex')};}));
 const input={unit:a.unit,entry_date,direction,amount,house_no,category_id,category_label,group_label,memo,received_by,receipt_note};
 const hash=createHash('sha256').update(JSON.stringify({input,photos:prepared.map(p=>p.sha256)})).digest('hex');
 const prior=await db.from('expense_book_entries').select('id,payload_hash').eq('submitted_by',a.staff.id).eq('idempotency_key',b.key).maybeSingle();ensureDatabase(prior.error);if(prior.data){if(prior.data.payload_hash!==hash)throw new ExpenseHttpError(409,'이미 제출된 기록입니다.');return NextResponse.json({id:prior.data.id},{headers});}
 const id=randomUUID();for(const p of prepared){const key=a.staff.id+'/books/'+id+'/'+randomUUID()+'.'+(p.mime==='image/jpeg'?'jpg':p.mime==='image/png'?'png':'webp');const r=await db.storage.from(RECEIPT_BUCKET).upload(key,p.bytes,{contentType:p.mime,upsert:false});ensureDatabase(r.error);uploaded.push({object_key:key,mime:p.mime,bytes:p.bytes.length,sha256:p.sha256});}
 const r=await db.from('expense_book_entries').insert({...input,id,idempotency_key:b.key,payload_hash:hash,submitted_by:a.staff.id,staff_name:a.staff.name,receipts:uploaded});if(r.error?.code==='23505')throw new ExpenseHttpError(409,'이미 제출 중인 기록입니다. 목록을 새로고침해 주세요.');ensureDatabase(r.error);committed=true;return NextResponse.json({id},{status:201,headers});
 }catch(e){if(!committed)await cleanupReceipts(uploaded);return expenseErrorResponse(e);}}
export async function PATCH(req:Request){try{const b=await req.json(),a=await access(req,b.unit);if(!a.canApprove)throw new ExpenseHttpError(403,'아비 또는 대표만 승인할 수 있습니다.');if(!isUuid(b.id)||!['approved','rejected'].includes(b.status))throw new ExpenseHttpError(400,'검토 내용을 확인하세요.');const note=text(b.note);if(b.status==='rejected'&&note.length<3)throw new ExpenseHttpError(400,'반려 사유를 적어주세요.');const r=await portalDb().from('expense_book_entries').update({status:b.status,reviewed_by:a.staff.id,reviewed_at:new Date().toISOString(),review_note:note}).eq('unit',a.unit).eq('id',b.id).eq('status','submitted').select('id');ensureDatabase(r.error);if(!r.data?.length)throw new ExpenseHttpError(409,'이미 검토되었거나 찾을 수 없는 기록입니다. 새로고침하세요.');return NextResponse.json({ok:true},{headers});}catch(e){return expenseErrorResponse(e);}}
