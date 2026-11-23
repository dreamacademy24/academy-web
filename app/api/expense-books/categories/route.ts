import {NextResponse} from 'next/server';
import {portalDb} from '@/lib/portalAuth';
import {requireExpenseAccess,expenseErrorResponse,ExpenseHttpError} from '@/lib/expenses/auth';
import {bookAccess} from '@/lib/expenses/books';
import {isUuid} from '@/lib/expenses/validation';
import {ensureDatabase} from '@/lib/expenses/store';
export const runtime='nodejs';
export async function POST(req:Request){try{const a=await requireExpenseAccess(req),rights=bookAccess(a.staff),b=await req.json();if(!rights.canManage||!rights.units.includes(b.unit))throw new ExpenseHttpError(403,'항목 변경은 아비 또는 대표만 가능합니다.');
 if(typeof b.label!=='string'||!b.label.trim()||b.label.length>100||typeof b.label_en!=='string'||b.label_en.length>100)throw new ExpenseHttpError(400,'항목명을 확인하세요.');
 const db=portalDb();let parent_id:string|null=null;
 if(b.parent_id){if(!isUuid(b.parent_id))throw new ExpenseHttpError(400,'대분류를 선택하세요.');const p=await db.from('expense_book_categories').select('id,parent_id').eq('id',b.parent_id).eq('unit',b.unit).maybeSingle();ensureDatabase(p.error);if(!p.data||p.data.parent_id)throw new ExpenseHttpError(400,'대분류를 확인하세요.');parent_id=b.parent_id;}
 const values={label:b.label.trim(),label_en:b.label_en.trim(),active:b.active!==false,updated_by:a.staff.id,updated_at:new Date().toISOString()};
 let result;if(b.id){if(!isUuid(b.id))throw new ExpenseHttpError(400,'항목 번호를 확인하세요.');result=await db.from('expense_book_categories').update(values).eq('id',b.id).eq('unit',b.unit).select('id');}else result=await db.from('expense_book_categories').insert({...values,unit:b.unit,parent_id}).select('id');
 if(result.error?.code==='23505')throw new ExpenseHttpError(409,'같은 이름의 항목이 있습니다. 사용 중지된 항목도 확인하세요.');ensureDatabase(result.error);if(!result.data?.length)throw new ExpenseHttpError(404,'항목을 찾을 수 없습니다.');return NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return expenseErrorResponse(e);}}
