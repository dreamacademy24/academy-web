import {NextResponse} from 'next/server';
import {getStaffIdentity} from '@/lib/portalAuth';
import {canReviewExpenses,canSubmitExpense} from './permissions';
import type {ExpenseAccess} from './model';
export class ExpenseHttpError extends Error { constructor(public status:number,message:string){super(message);} }
export function verifyExpenseOrigin(req:Request) {
 const origin=req.headers.get('origin');
 if((origin&&origin!==new URL(req.url).origin)||req.headers.get('sec-fetch-site')==='cross-site') throw new ExpenseHttpError(403,'다른 사이트에서 요청할 수 없습니다. / Cross-site request denied.');
}
export async function requireExpenseAccess(req:Request):Promise<ExpenseAccess> {
 verifyExpenseOrigin(req);
 let staff;try{staff=await getStaffIdentity(req);}catch{throw new ExpenseHttpError(503,'계정 확인에 실패했습니다. 잠시 후 다시 시도하세요.');}
 if(!staff)throw new ExpenseHttpError(401,'직원 허브에서 다시 로그인하세요. / Please sign in at Staff Hub.');
 const canSubmit=canSubmitExpense(staff),canReview=canReviewExpenses(staff);
 if(!canSubmit&&!canReview)throw new ExpenseHttpError(403,'이 계정에는 지출 입력·원장 조회 권한이 없습니다. / This account has no expense access.');
 return{staff,canSubmit,canReview};
}
export async function requireExpenseOwner(req:Request) {const access=await requireExpenseAccess(req);if(!access.canReview)throw new ExpenseHttpError(403,'전체 원장·검토는 대표 전용입니다. / Owner access only.');return access;}
export function expenseErrorResponse(error:unknown) {const status=error instanceof ExpenseHttpError?error.status:503;const message=error instanceof ExpenseHttpError?error.message:'지출 저장소 연결을 확인해야 합니다. 잠시 후 다시 시도하세요. / Expense service unavailable.';return NextResponse.json({error:message,message},{status,headers:{'Cache-Control':'no-store'}});}
