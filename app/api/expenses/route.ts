import {NextResponse} from 'next/server';
import {createHash,randomUUID} from 'node:crypto';
import {portalDb} from '@/lib/portalAuth';
import {requireExpenseAccess,ExpenseHttpError,expenseErrorResponse} from '@/lib/expenses/auth';
import {normalizeExpenseInput,ExpenseValidationError,isUuid,legacyDivision,reportingPhpMinor} from '@/lib/expenses/validation';
import {getCategory} from '@/lib/expenses/catalogue';
import {EXPENSE_HOUSES} from '@/lib/expenses/houses';
import {CLAIM_FIELDS,publicClaim,receiptMime,RECEIPT_BUCKET,cleanupReceipts,ensureDatabase} from '@/lib/expenses/store';
import type {ReceiptMeta,ExpenseCurrency} from '@/lib/expenses/model';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const noStore={'Cache-Control':'no-store'};
export async function GET(req:Request) {
 try {
  const access=await requireExpenseAccess(req),db=portalDb(),url=new URL(req.url);
  const candidateId=url.searchParams.get('candidate_for');
  if(candidateId){
   if(!access.canReview)throw new ExpenseHttpError(403,'기존 원장은 대표만 조회할 수 있습니다.');
   if(!isUuid(candidateId))throw new ExpenseHttpError(400,'제출 번호를 확인하세요.');
   const found=await db.from('expense_claims').select('id,entry_date,amount,currency,kind').eq('id',candidateId).maybeSingle();ensureDatabase(found.error);
   if(!found.data)throw new ExpenseHttpError(404,'제출 건을 찾을 수 없습니다.');
   const c=found.data;if(!['operating_expense','mori_settlement'].includes(c.kind))return NextResponse.json({candidates:[]},{headers:noStore});
   const cfg=await db.from('may_ledger_config').select('krw_per_php').eq('id','settings').maybeSingle();ensureDatabase(cfg.error);
   const phpMinor=reportingPhpMinor(String(c.amount),c.currency as ExpenseCurrency,Number(cfg.data?.krw_per_php??23));
   const candidates=await db.from('may_ledger').select('id,entry_date,division,detail,amount,currency,source').eq('book','회사').eq('type','expense').eq('entry_date',c.entry_date).limit(1000);ensureDatabase(candidates.error);
   const matches=(candidates.data||[]).filter(m=>((m.currency===c.currency&&Number(m.amount)===Number(c.amount))||(m.currency==='PHP'&&Math.round(Number(m.amount)*100)===phpMinor))&&(c.kind==='mori_settlement'?m.division==='모리'&&!['mori_accrue','auto_meal'].includes(m.source||'')&&!/^mori_lunch/.test(m.id):m.division!=='모리')).map(m=>({id:m.id,entry_date:m.entry_date,division:m.division,detail:m.detail,amount:String(m.amount),currency:m.currency}));
   return NextResponse.json({candidates:matches},{headers:noStore});
  }
  const review=url.searchParams.get('scope')==='review';if(review&&!access.canReview)throw new ExpenseHttpError(403,'검토·전체 내역은 대표 전용입니다.');
  const offset=Number(url.searchParams.get('offset')||0);if(!Number.isInteger(offset)||offset<0||offset>100000)throw new ExpenseHttpError(400,'페이지 번호를 확인하세요.');
  const status=url.searchParams.get('status');if(status&&!['submitted','approved','rejected'].includes(status))throw new ExpenseHttpError(400,'검토 상태를 확인하세요.');
  let query=db.from('expense_claims').select(CLAIM_FIELDS).order('created_at',{ascending:false}).order('id',{ascending:false});
  if(!review)query=query.eq('submitted_by',access.staff.id);if(status)query=query.eq('status',status);
  const listed=await query.range(offset,offset+100);ensureDatabase(listed.error);
  const rows=listed.data||[];
  return NextResponse.json({...access,houses:EXPENSE_HOUSES,items:rows.slice(0,100).map(r=>publicClaim(r as unknown as Record<string,unknown>)),offset,hasMore:rows.length>100},{headers:noStore});
 }catch(error){return expenseErrorResponse(error);}
}
export async function POST(req:Request) {
 const uploaded:ReceiptMeta[]=[];let committed=false;
 try {
  const access=await requireExpenseAccess(req);if(!access.canSubmit)throw new ExpenseHttpError(403,'입력은 아비·벨라 계정만 가능합니다. / Only Abby and Bella may submit.');
  if(Number(req.headers.get('content-length')||0)>4*1024*1024)throw new ExpenseHttpError(413,'첨부 파일 크기를 줄여주세요.');
  let payload:unknown;let files:File[]=[];
  if(req.headers.get('content-type')?.includes('multipart/form-data')){
   const form=await req.formData(),raw=form.get('payload');if(typeof raw!=='string'||raw.length>32000)throw new ExpenseHttpError(400,'입력 내용을 확인하세요.');
   try{payload=JSON.parse(raw);}catch{throw new ExpenseHttpError(400,'입력 형식이 올바르지 않습니다.');}
   const fileEntries=form.getAll('receipts');if(fileEntries.some(v=>!(v instanceof File)))throw new ExpenseHttpError(400,'영수증 파일을 확인하세요.');files=fileEntries as File[];
  }else{try{payload=await req.json();}catch{throw new ExpenseHttpError(400,'입력 형식이 올바르지 않습니다.');}}
  if(files.length>2||files.some(f=>f.size<=0||f.size>1572864)||files.reduce((s,f)=>s+f.size,0)>3145728)throw new ExpenseHttpError(413,'영수증은 1.5MB 이하 두 장까지 첨부하세요.');
  const input=normalizeExpenseInput(payload,files.length),db=portalDb();
  const prepared=await Promise.all(files.map(async f=>{const bytes=new Uint8Array(await f.arrayBuffer()),mime=receiptMime(bytes);if(!mime)throw new ExpenseHttpError(400,'JPG·PNG·WEBP 사진만 첨부할 수 있습니다.');return{bytes,mime,sha256:createHash('sha256').update(bytes).digest('hex')};}));
  const fingerprint=createHash('sha256').update(JSON.stringify({input,receipts:prepared.map(r=>({sha256:r.sha256,mime:r.mime})).sort((a,b)=>a.sha256.localeCompare(b.sha256))})).digest('hex');
  const prior=await db.from('expense_claims').select(CLAIM_FIELDS+',payload_sha256').eq('submitted_by',access.staff.id).eq('idempotency_key',input.idempotency_key).maybeSingle();ensureDatabase(prior.error);
  const priorRow=prior.data as unknown as (Record<string,unknown>&{payload_sha256:string})|null;
  if(priorRow){if(priorRow.payload_sha256!==fingerprint)throw new ExpenseHttpError(409,'이미 저장된 제출입니다. 자기 내역을 확인한 뒤 새 창으로 입력하세요. / This submission key already has different content.');return NextResponse.json({item:publicClaim(priorRow)},{headers:noStore});}
  if(input.replaces_claim_id){const replaced=await db.from('expense_claims').select('id,submitted_by,status').eq('id',input.replaces_claim_id).maybeSingle();ensureDatabase(replaced.error);if(!replaced.data||replaced.data.submitted_by!==access.staff.id||replaced.data.status!=='rejected')throw new ExpenseHttpError(400,'본인의 반려된 제출만 수정 원본으로 연결할 수 있습니다.');}
  const id=randomUUID();
  for(const p of prepared){const ext=p.mime==='image/jpeg'?'jpg':p.mime==='image/png'?'png':'webp';const key=access.staff.id+'/'+id+'/'+randomUUID()+'.'+ext;const put=await db.storage.from(RECEIPT_BUCKET).upload(key,p.bytes,{contentType:p.mime,upsert:false});ensureDatabase(put.error);uploaded.push({object_key:key,mime:p.mime,bytes:p.bytes.length,sha256:p.sha256});}
  for(const p of prepared){const duplicates=await db.from('expense_claims').select('id').neq('status','rejected').contains('receipts',[{sha256:p.sha256}]).limit(1);ensureDatabase(duplicates.error);if(duplicates.data?.length&&!input.review_flags.includes('possible_duplicate'))input.review_flags.push('possible_duplicate');}
  const category=getCategory(input.category_id);
  const row={...input,id,payload_sha256:fingerprint,submitted_by:access.staff.id,staff_name:access.staff.name,staff_username:access.staff.username,category_label:category?.labelKo||'',legacy_division:input.kind==='operating_expense'?legacyDivision(input.unit,input.category_id):'',house_snapshot:input.house_ids.map(h=>EXPENSE_HOUSES.find(v=>v.id===h)),receipts:uploaded};
  const saved=await db.from('expense_claims').insert(row).select(CLAIM_FIELDS).single();
  if(saved.error){
   if(saved.error.code==='23505'){const concurrent=await db.from('expense_claims').select(CLAIM_FIELDS+',payload_sha256').eq('submitted_by',access.staff.id).eq('idempotency_key',input.idempotency_key).maybeSingle();if((concurrent.data as unknown as {payload_sha256?:string}|null)?.payload_sha256===fingerprint){await cleanupReceipts(uploaded);uploaded.length=0;return NextResponse.json({item:publicClaim(concurrent.data as unknown as Record<string,unknown>)},{headers:noStore});}throw new ExpenseHttpError(409,'중복 제출 키입니다. 기존 입력 건을 확인하세요.');}
   ensureDatabase(saved.error);
  }
  committed=true;return NextResponse.json({item:publicClaim(saved.data as unknown as Record<string,unknown>)},{status:201,headers:noStore});
 }catch(error){if(!committed&&uploaded.length)await cleanupReceipts(uploaded);if(error instanceof ExpenseValidationError)return expenseErrorResponse(new ExpenseHttpError(400,error.message));return expenseErrorResponse(error);}
}
