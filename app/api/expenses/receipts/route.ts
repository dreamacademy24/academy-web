import {NextResponse} from 'next/server';
import {portalDb} from '@/lib/portalAuth';
import {requireExpenseAccess,ExpenseHttpError,expenseErrorResponse} from '@/lib/expenses/auth';
import {isUuid} from '@/lib/expenses/validation';
import {RECEIPT_BUCKET,ensureDatabase} from '@/lib/expenses/store';
import type {ReceiptMeta} from '@/lib/expenses/model';
export const runtime='nodejs';
export async function GET(req:Request) {
 try {
  const access=await requireExpenseAccess(req),id=new URL(req.url).searchParams.get('claim_id');if(!isUuid(id))throw new ExpenseHttpError(400,'제출 번호를 확인하세요.');
  const db=portalDb();let query=db.from('expense_claims').select('id,receipts').eq('id',id);if(!access.canReview)query=query.eq('submitted_by',access.staff.id);
  const result=await query.maybeSingle();ensureDatabase(result.error);if(!result.data)throw new ExpenseHttpError(404,'첨부 자료를 찾을 수 없습니다.');
  const receipts=(result.data.receipts||[]) as ReceiptMeta[];if(!receipts.length)return NextResponse.json({urls:[]},{headers:{'Cache-Control':'no-store'}});
  const signed=await db.storage.from(RECEIPT_BUCKET).createSignedUrls(receipts.map(r=>r.object_key),60);ensureDatabase(signed.error);
  if(signed.data?.some(v=>v.error||!v.signedUrl))throw new ExpenseHttpError(503,'첨부 자료를 불러오지 못했습니다.');
  return NextResponse.json({urls:(signed.data||[]).map(v=>v.signedUrl)},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return expenseErrorResponse(error);}
}
