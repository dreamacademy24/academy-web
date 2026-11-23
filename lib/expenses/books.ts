import type {StaffIdentity} from './model';
import {canReviewExpenses,canSubmitExpense} from './permissions';
export const BOOKS=[{id:'dreamhouse',ko:'드림하우스',en:'Dream House',icon:'⌂'},{id:'academy',ko:'드림아카데미',en:'Dream Academy',icon:'▤'},{id:'restaurant88',ko:'88식당',en:'88 Restaurant',icon:'♧'}] as const;
export type BookId=typeof BOOKS[number]['id'];
export function bookAccess(staff:StaffIdentity){const owner=canReviewExpenses(staff),abby=canSubmitExpense(staff)&&staff.username==='admin-abby',bella=canSubmitExpense(staff)&&staff.username==='admin-bella';return {units:(owner||abby?BOOKS.map(b=>b.id):bella?['dreamhouse']:[]) as BookId[],canApprove:owner||abby,canManage:owner||abby,owner};}
export type BookCategory={id:string;unit:BookId;parent_id:string|null;label:string;label_en:string;active:boolean;sort_order:number};
export type BookEntry={id:string;unit:BookId;entry_date:string;direction:'in'|'out';house_no:string;group_label:string;category_label:string;amount:number;memo:string;received_by:string;staff_name:string;status:'submitted'|'approved'|'rejected';review_note:string;receipt_count:number;receipt_note:string;created_at:string};
export function bookToday(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
