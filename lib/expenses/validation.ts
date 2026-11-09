import type {ExpenseInput,ExpenseCurrency,ReviewFlag,BusinessUnit,ExpenseKind,HouseScope} from './model';
import {KIND_OPTIONS} from './model';
import {getCategory} from './catalogue';
import {EXPENSE_HOUSES} from './houses';
export class ExpenseValidationError extends Error {}
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(value:unknown):value is string{return typeof value==='string'&&UUID.test(value);}
export function moneyToMinor(value:unknown,currency:ExpenseCurrency):number {
 if(typeof value!=='string'&&typeof value!=='number')throw new ExpenseValidationError('금액을 입력하세요. / Enter an amount.');
 const raw=String(value).trim();if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw))throw new ExpenseValidationError('금액 형식이 올바르지 않습니다. / Invalid amount.');
 const [whole,fraction='']=raw.replaceAll(',','').split('.');
 if(currency==='KRW'&&Number(fraction)!==0)throw new ExpenseValidationError('원화는 정수로 입력하세요. / KRW requires a whole amount.');
 const minor=currency==='KRW'?Number(whole):Number(whole)*100+Number(fraction.padEnd(2,'0'));
 if(!Number.isSafeInteger(minor)||minor<=0||minor>99999999999)throw new ExpenseValidationError('금액 범위를 확인하세요. / Amount is out of range.');
 return minor;
}
export function minorToMoney(minor:number,currency:ExpenseCurrency):string {return currency==='KRW'?String(minor):(minor/100).toFixed(2);}
function text(value:unknown,name:string,max:number,required=false):string {if(value==null&&!required)return '';if(typeof value!=='string')throw new ExpenseValidationError(name+' 형식을 확인하세요.');const s=value.trim();if(s.length>max||(required&&!s))throw new ExpenseValidationError(name+'을 확인하세요.');return s;}
function oneOf<T extends string>(v:unknown,values:readonly T[],name:string):T {if(typeof v!=='string'||!values.includes(v as T))throw new ExpenseValidationError(name+'을 확인하세요.');return v as T;}
const FLAG_VALUES:ReviewFlag[]=['amount_conflict','mixed_amount','classification_uncertain','house_unconfirmed','missing_receipt','possible_duplicate'];
export function normalizeExpenseInput(value:unknown,receiptCount:number):ExpenseInput {
 if(!value||typeof value!=='object'||Array.isArray(value))throw new ExpenseValidationError('입력 내용을 확인하세요.');
 const b=value as Record<string,unknown>;
 for(const key of ['submitted_by','staff_name','staff_username','status','reviewed_by','ledger_entry_id','reporting_amount_php'])if(key in b)throw new ExpenseValidationError('서버 관리 필드는 입력할 수 없습니다.');
 if(!isUuid(b.idempotency_key))throw new ExpenseValidationError('제출 키가 올바르지 않습니다. 창을 다시 열어주세요.');
 const entry_date=text(b.entry_date,'거래일',10,true);
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(entry_date)||Number.isNaN(Date.parse(entry_date+'T00:00:00Z'))||new Date(entry_date+'T00:00:00Z').toISOString().slice(0,10)!==entry_date)throw new ExpenseValidationError('올바른 거래일을 입력하세요.');
 const unit=oneOf<BusinessUnit>(b.unit,['academy','dreamhouse','shared'],'사업장');
 const kind=oneOf<ExpenseKind>(b.kind,KIND_OPTIONS.map(k=>k.id),'거래유형');
 const direction=oneOf(b.direction,['in','out'] as const,'입출금');
 if((kind==='operating_expense'||kind==='mori_settlement'||kind==='loan_principal')&&direction!=='out')throw new ExpenseValidationError('이 거래유형은 출금만 가능합니다.');
 const currency=oneOf<ExpenseCurrency>(b.currency,['PHP','KRW'],'통화');
 const amountMinor=moneyToMinor(b.amount,currency),amount=minorToMoney(amountMinor,currency);
 const category_id=kind==='operating_expense'?text(b.category_id,'세부항목',100,true):null;
 const category=getCategory(category_id);if(kind==='operating_expense'&&!category)throw new ExpenseValidationError('목록에서 세부항목을 선택하세요.');
 const memo=text(b.memo,'사용 목적',2000,true);if(memo.length<(category?.groupId==='other'?6:2))throw new ExpenseValidationError('사용 목적을 구체적으로 적어주세요.');
 const merchant=text(b.merchant,'사용처·수취인',160),applicable_period=text(b.applicable_period,'해당 월·기간',80);
 if(category?.groupId==='occupancy'&&['occupancy.academy_rent','occupancy.house_rent','occupancy.management_dues'].includes(category.id)&&!applicable_period)throw new ExpenseValidationError('지급일과 별도로 해당 임대월·관리비 기간을 적어주세요.');
 const receipt_note=text(b.receipt_note,'영수증 없는 사유',800);if(!Number.isInteger(receiptCount)||receiptCount<0||receiptCount>2)throw new ExpenseValidationError('영수증은 두 장까지 첨부하세요.');if(!receiptCount&&receipt_note.length<3)throw new ExpenseValidationError('영수증이 없으면 사유를 적어주세요.');
 if(b.review_flags!=null&&(!Array.isArray(b.review_flags)||b.review_flags.some(v=>!FLAG_VALUES.includes(v as ReviewFlag))))throw new ExpenseValidationError('확인 필요 항목을 확인하세요.');
 const flags=new Set<ReviewFlag>((b.review_flags||[]) as ReviewFlag[]);if(!receiptCount)flags.add('missing_receipt');if(category?.id==='equipment.work_equipment'||category?.groupId==='other')flags.add('classification_uncertain');
 const house_scope=oneOf<HouseScope>(b.house_scope,['none','single','multiple','common','unconfirmed'],'하우스 귀속');
 if(!Array.isArray(b.house_ids)||b.house_ids.some(v=>typeof v!=='string'))throw new ExpenseValidationError('하우스 목록을 확인하세요.');
 const ids=b.house_ids.map(v=>EXPENSE_HOUSES.find(h=>h.id.toLowerCase()===String(v).toLowerCase())?.id);
 if(ids.some(v=>!v)||new Set(ids).size!==ids.length)throw new ExpenseValidationError('등록된 하우스를 중복 없이 선택하세요.');
 const house_ids=ids as string[],house_note=text(b.house_note,'하우스 귀속 메모',500);
 if(!Array.isArray(b.allocations))throw new ExpenseValidationError('하우스별 배분을 확인하세요.');
 const allocations=b.allocations.map(v=>{if(!v||typeof v!=='object')throw new ExpenseValidationError('배분 형식을 확인하세요.');const a=v as Record<string,unknown>;const house_id=EXPENSE_HOUSES.find(h=>h.id.toLowerCase()===String(a.house_id).toLowerCase())?.id;if(!house_id||!house_ids.includes(house_id))throw new ExpenseValidationError('선택된 하우스에만 배분할 수 있습니다.');return{house_id,amount:minorToMoney(moneyToMinor(a.amount,currency),currency)};});
 if(unit==='dreamhouse'){
  if(house_scope==='none')throw new ExpenseValidationError('하우스 번호·공통·확인 필요 중 하나를 선택하세요.');
  if(house_scope==='single'&&house_ids.length!==1)throw new ExpenseValidationError('하우스 한 곳을 선택하세요.');
  if(house_scope==='multiple'&&house_ids.length<2)throw new ExpenseValidationError('두 곳 이상의 하우스를 선택하세요.');
  if(['common','unconfirmed'].includes(house_scope)&&(house_ids.length||allocations.length))throw new ExpenseValidationError('공통·확인 필요 거래를 특정 하우스에 임의 배분하지 마세요.');
  if(['common','unconfirmed'].includes(house_scope)&&house_note.length<3)throw new ExpenseValidationError('공통 또는 미확정 귀속 사유를 적어주세요.');
  if(house_scope==='unconfirmed')flags.add('house_unconfirmed');
 }else if(house_scope!=='none'||house_ids.length||allocations.length)throw new ExpenseValidationError('하우스 귀속은 드림하우스 거래에서만 선택하세요.');
 if(allocations.length){if(house_scope!=='multiple'||new Set(allocations.map(a=>a.house_id)).size!==allocations.length||allocations.length!==house_ids.length||allocations.reduce((s,a)=>s+moneyToMinor(a.amount,currency),0)!==amountMinor)throw new ExpenseValidationError('확인된 하우스별 금액의 합계가 원금과 같아야 합니다. 미확정이면 배분 칸을 비워두세요.');}
 if(b.replaces_claim_id!=null&&!isUuid(b.replaces_claim_id))throw new ExpenseValidationError('수정 원본을 확인하세요.');
 return{idempotency_key:b.idempotency_key,entry_date,applicable_period,unit,kind,direction,category_id,merchant,memo,amount,currency,house_scope,house_ids,house_note,allocations,receipt_note,review_flags:[...flags].sort(),replaces_claim_id:(b.replaces_claim_id as string|null)||null};
}
export function reportingPhpMinor(amount:string,currency:ExpenseCurrency,krwPerPhp:number):number {const n=moneyToMinor(amount,currency);if(!Number.isFinite(krwPerPhp)||krwPerPhp<=0)throw new ExpenseValidationError('환율을 확인하세요.');const result=currency==='PHP'?n:Math.round(n/krwPerPhp*100);if(!Number.isSafeInteger(result)||result<=0)throw new ExpenseValidationError('환산 금액을 확인하세요.');return result;}
export function legacyDivision(unit:BusinessUnit,categoryId:string|null):string {if(unit==='dreamhouse')return '드림하우스';const group=getCategory(categoryId)?.groupId;return group==='payroll'?'인건비':group==='education'?'재료비':group==='equipment'?'비품':'기타';}
