import type {StaffIdentity} from './model';
// Same owner as the existing private ledger, never a client-side role or shared password.
export const LEDGER_OWNER_ID = '34ebbb26-9142-4a34-b35f-4fcc4426e27c';
export function canSubmitExpense(staff:StaffIdentity|null|undefined):boolean { return !!staff && staff.role==='local_teacher' && ['admin-abby','admin-bella'].includes(staff.username); }
export function canReviewExpenses(staff:StaffIdentity|null|undefined):boolean { return !!staff && staff.role==='korean_admin' && staff.id===LEDGER_OWNER_ID; }
