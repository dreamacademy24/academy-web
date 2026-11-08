import {NextResponse} from 'next/server';
import {portalDb} from '@/lib/portalAuth';
import {requireExpenseOwner,ExpenseHttpError,expenseErrorResponse} from '@/lib/expenses/auth';
import {isUuid} from '@/lib/expenses/validation';
import {publicClaim} from '@/lib/expenses/store';
export const runtime='nodejs';
export async function POST(req:Request) {
 try {
  const access=await requireExpenseOwner(req),body=await req.json().catch(()=>null);
  if(!body||!isUuid(body.id)||!['approve','reject'].includes(body.action)||typeof body.review_note!=='string'||body.review_note.length>2000)throw new ExpenseHttpError(400,'검토 내용을 확인하세요.');
  const flags=body.confirm_review_flags===true,distinct=body.confirm_distinct_transaction===true;
  const linked=body.link_existing_ledger_id==null||body.link_existing_ledger_id===''?null:body.link_existing_ledger_id;
  if(linked!==null&&(typeof linked!=='string'||linked.length>200))throw new ExpenseHttpError(400,'연결할 원장 번호를 확인하세요.');
  const result=await portalDb().rpc('review_expense_claim',{p_claim_id:body.id,p_reviewer_id:access.staff.id,p_action:body.action,p_review_note:body.review_note.trim(),p_confirm_review_flags:flags,p_link_ledger_id:linked,p_confirm_distinct_transaction:distinct});
  if(result.error){
   const msg=result.error.message||'';
   if(msg.includes('POSSIBLE_DUPLICATE'))throw new ExpenseHttpError(409,'같은 날짜·금액의 기존 거래가 있습니다. 기존 원장에 연결하거나, 별개 거래임을 확인하고 사유를 적어주세요.');
   if(msg.includes('REVIEW_FLAGS_REQUIRE_CONFIRMATION'))throw new ExpenseHttpError(409,'확인 필요 사유를 검토한 뒤 확인 체크와 검토 의견을 남겨주세요.');
   if(msg.includes('LINKED_LEDGER_MISMATCH'))throw new ExpenseHttpError(409,'기존 원장의 날짜·금액·통화·분류가 다릅니다. 같은 거래인지 확인하세요.');
   if(msg.includes('LEDGER_ALREADY_LINKED'))throw new ExpenseHttpError(409,'이미 다른 제출 건과 연결된 원장입니다. 중복 여부를 확인하세요.');
   if(msg.includes('CLAIM_ALREADY_REVIEWED'))throw new ExpenseHttpError(409,'이미 검토된 제출입니다. 새로고침하세요.');
   if(msg.includes('REVIEW_NOTE_REQUIRED')||msg.includes('INVALID_REVIEW'))throw new ExpenseHttpError(400,'검토 의견을 적어주세요.');
   throw new ExpenseHttpError(503,'승인 저장소 설정·연결을 확인해야 합니다. / Review service unavailable.');
  }
  return NextResponse.json({item:publicClaim(result.data as Record<string,unknown>)},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return expenseErrorResponse(error);}
}
