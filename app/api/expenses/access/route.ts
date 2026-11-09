import {NextResponse} from 'next/server';
import {requireExpenseAccess,expenseErrorResponse} from '@/lib/expenses/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
/** Small, no-store navigation metadata. No ledger rows, claims or receipts are returned. */
export async function GET(req:Request){
 try{
  const access=await requireExpenseAccess(req);
  return NextResponse.json({username:access.staff.username,canSubmit:access.canSubmit,canReview:access.canReview},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return expenseErrorResponse(error);}
}
