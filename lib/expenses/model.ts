export type BusinessUnit = 'academy' | 'dreamhouse' | 'shared';
export type ExpenseKind = 'operating_expense' | 'operating_funding' | 'internal_transfer' | 'staff_advance' | 'business_advance' | 'customer_collection' | 'student_passthrough' | 'mori_settlement' | 'loan_principal';
export type ExpenseCurrency = 'PHP' | 'KRW';
export type HouseScope = 'none' | 'single' | 'multiple' | 'common' | 'unconfirmed';
export type ReviewFlag = 'amount_conflict' | 'mixed_amount' | 'classification_uncertain' | 'house_unconfirmed' | 'missing_receipt' | 'possible_duplicate';
export type ClaimStatus = 'submitted' | 'approved' | 'rejected';
export interface StaffIdentity { id: string; username: string; name: string; role: string }
export interface HouseOption { id: string; label: string }
export interface HouseAllocation { house_id: string; amount: string }
export interface ExpenseInput {
  idempotency_key: string; entry_date: string; applicable_period: string; unit: BusinessUnit;
  kind: ExpenseKind; direction: 'in' | 'out'; category_id: string | null;
  merchant: string; memo: string; amount: string; currency: ExpenseCurrency;
  house_scope: HouseScope; house_ids: string[]; house_note: string; allocations: HouseAllocation[];
  receipt_note: string; review_flags: ReviewFlag[]; replaces_claim_id?: string | null;
}
export interface ReceiptMeta { object_key: string; mime: string; bytes: number; sha256: string }
export interface ExpenseClaim extends ExpenseInput {
  id: string; submitted_by: string; staff_name: string; staff_username: string;
  status: ClaimStatus; created_at: string; reviewed_at: string | null; review_note: string;
  receipt_count: number; ledger_entry_id: string | null; reporting_amount_php: string | null;
}
export interface ExpenseAccess { staff: StaffIdentity; canSubmit: boolean; canReview: boolean }
export interface CategoryItem {
  id: string; groupId: string; labelKo: string; labelEn: string; aliases: string[];
  guideKo: string; guideEn: string; exampleKo: string; exampleEn: string;
  avoidKo?: string; avoidEn?: string;
}
export interface CategoryGroup { id: string; labelKo: string; labelEn: string; items: CategoryItem[] }
export const UNIT_LABELS: Record<BusinessUnit, {ko:string;en:string}> = {
  academy:{ko:'아카데미',en:'Academy'},dreamhouse:{ko:'드림하우스',en:'DreamHouse'},shared:{ko:'사업장 공통·미배분',en:'Shared / unallocated'}
};
export const KIND_OPTIONS: {id: ExpenseKind;ko:string;en:string;guideKo:string;guideEn:string;direction:'in'|'out'}[] = [
  {id:'operating_expense',ko:'실제 운영비',en:'Actual operating expense',guideKo:'실제 사용한 비용. 전달한 예산·가불과 구분합니다.',guideEn:'Actual goods or services used, not money handed over in advance.',direction:'out'},
  {id:'operating_funding',ko:'운영자금 입금',en:'Operating funds received',guideKo:'대표가 보낸 운영자금·Extra Money In은 매출로 자동 처리하지 않습니다.',guideEn:'Funds from the owner / Extra Money In are not automatically sales.',direction:'in'},
  {id:'internal_transfer',ko:'사업장 간 자금이동',en:'Internal funds transfer',guideKo:'아카데미에서 드림하우스로 예산 전달. 최종 사용 전에는 비용이 아닙니다.',guideEn:'Money handed from Academy to DreamHouse is not an expense until actually spent.',direction:'out'},
  {id:'staff_advance',ko:'직원 가불·반환',en:'Staff cash advance / return',guideKo:'C.A. 지급·반환은 급여 비용과 별도. 정규 급여와 중복 계산하지 않습니다.',guideEn:'Keep C.A. and repayments separate from salary, without counting both as expense.',direction:'out'},
  {id:'business_advance',ko:'업무 선급금·정산 전 전달',en:'Business advance / return',guideKo:'필드트립·교구 구매 전 자금 전달은 선급금. 영수증 정산 때 실제 비용을 기록합니다.',guideEn:'Funds handed over before a trip or purchase are advances; record actual cost once supported.',direction:'out'},
  {id:'customer_collection',ko:'수업료·튜터비 수납',en:'Tuition / tutor fee collected',guideKo:'수납과 튜터 급여 지급은 별도. 기존 청구·수납과 매출 중복 여부를 대표가 확인합니다.',guideEn:'Fee collection is separate from tutor pay; the owner checks existing invoices before revenue recognition.',direction:'in'},
  {id:'student_passthrough',ko:'학생 대행금 수납·납부',en:'Student funds collected / paid',guideKo:'SSP·비자 대행금은 수납·전달·납부를 추적합니다. 회사 매출·비용으로 자동 처리하지 않습니다.',guideEn:'Track SSP / visa funds and payments without automatically treating them as company sales or expense.',direction:'in'},
  {id:'mori_settlement',ko:'모리 식대 지급·정산',en:'Mori meal payable settlement',guideKo:'이미 발생한 모리 식대의 지급입니다. 기존 발생 식대를 다시 비용으로 더하지 않습니다.',guideEn:'Payment of a Mori meal payable, not a second meal expense.',direction:'out'},
  {id:'loan_principal',ko:'대출원금 상환',en:'Loan principal repayment',guideKo:'원금은 비용과 구분. 이자와 합쳐진 금액은 확인 전 임의 분할하지 않습니다.',guideEn:'Principal is not an operating expense. Do not guess the interest split.',direction:'out'}
];
