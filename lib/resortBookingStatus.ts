import {supabase} from '@/lib/supabase';
export function isCancelledResortStatus(status:unknown){return /취소|cancelled|canceled/i.test(String(status||''));}
type LinkedInvoice={booking_id?:string|null;reservation_no?:string|null;status?:string|null;res_status?:string|null};
export function visibleResortInvoice(row:LinkedInvoice,bookings:{id:string;reservation_no?:string|null;status?:string|null}[]){
 if(isCancelledResortStatus(row.status)||isCancelledResortStatus(row.res_status))return false;
 const booking=row.booking_id?bookings.find(b=>b.id===row.booking_id):row.reservation_no?bookings.find(b=>b.reservation_no===row.reservation_no):undefined;
 return !booking||!isCancelledResortStatus(booking.status);
}
async function readAll(table:string,select:string){const rows:any[]=[];for(let offset=0;;offset+=500){const r=await supabase.from(table).select(select).order('id').range(offset,offset+499);if(r.error)throw Error('취소 예약 확인에 실패했습니다. 새로고침 후 다시 시도해주세요.');rows.push(...r.data);if(r.data.length<500)return rows;}}
export async function loadActiveResortInvoices(){const [rows,bookings]=await Promise.all([readAll('resort_invoices','*'),readAll('bookings','id,reservation_no,status')]);return rows.filter(r=>visibleResortInvoice(r,bookings));}
export async function assertActiveResortBooking(row:LinkedInvoice){
 if(isCancelledResortStatus(row.status)||isCancelledResortStatus(row.res_status))throw Error('취소된 예약의 인보이스는 처리할 수 없습니다.');
 if(!row.booking_id&&!row.reservation_no)return;
 let q=supabase.from('bookings').select('status');q=row.booking_id?q.eq('id',row.booking_id):q.eq('reservation_no',row.reservation_no!);
 const r=await q.maybeSingle();if(r.error)throw Error('예약 상태 확인에 실패했습니다.');if(r.data&&isCancelledResortStatus(r.data.status))throw Error('취소된 예약입니다. 리조트 인보이스·결제 목록에서 제외됩니다.');
}
