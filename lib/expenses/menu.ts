export type ExpenseMenuScope = 'submit' | 'review';
export type ExpenseMenuAccess = {canSubmit:boolean;canReview:boolean};
/** Navigation visibility only. Expense APIs still enforce the signed staff identity. */
export function maySeeExpenseMenu(scope:ExpenseMenuScope|undefined,access:ExpenseMenuAccess):boolean {
 if(scope==='submit')return access.canSubmit===true;
 if(scope==='review')return access.canReview===true;
 return scope===undefined;
}
