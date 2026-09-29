export type TimeDay = { date:string; in:string; out:string; break_minutes:number; kind:'work'|'leave'|'off'|'absent'; note:string }
export const EARNINGS = ['basic','position','overtime','weekend','holiday','transport','tutorial','load','other'] as const
export const DEDUCTIONS = ['sss','philhealth','pagibig','cash_advance','late','undertime','tax','other_deduction'] as const
export type PayAmounts = Record<string,number>
export function payrollPeriod(month:string, day:number) {
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||!['5','20'].includes(String(day))) throw Error('Invalid payroll period')
 const [y,m]=month.split('-').map(Number); if(y<2020||y>2100)throw Error('Invalid year')
 const iso=(d:Date)=>d.toISOString().slice(0,10)
 const start=day===20?new Date(Date.UTC(y,m-1,1)):new Date(Date.UTC(y,m-2,16))
 const end=day===20?new Date(Date.UTC(y,m-1,15)):new Date(Date.UTC(y,m-1,0))
 const dates:string[]=[];for(let d=new Date(start);d<=end;d.setUTCDate(d.getUTCDate()+1))dates.push(iso(d))
 return {pay_date:`${month}-${String(day).padStart(2,'0')}`,start:iso(start),end:iso(end),dates,submit_start:day===20?`${month}-16`:`${month}-01`,submit_end:day===20?`${month}-17`:null}
}
export function validateDays(value:unknown,dates:string[],complete=false):TimeDay[]{
 if(!Array.isArray(value)||value.length!==dates.length)throw Error('Check every date / 모든 날짜를 확인해주세요.')
 return dates.map((date,i)=>{const d=value[i]; if(!d||d.date!==date||!['work','leave','off','absent'].includes(d.kind)||typeof d.note!=='string'||d.note.length>500)throw Error('Invalid timecard row')
  const time=(s:unknown)=>typeof s==='string'&&(s===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(s))
  if(!time(d.in)||!time(d.out)||!Number.isInteger(d.break_minutes)||d.break_minutes<0||d.break_minutes>480)throw Error('Invalid time or break')
  if(d.kind!=='work'&&(d.in||d.out||d.break_minutes))throw Error('Clear times for non-working days')
  if(d.in&&d.out&&(minutes(d.out)<=minutes(d.in)||minutes(d.out)-minutes(d.in)<=d.break_minutes))throw Error('Check clock-in, clock-out and break / 출퇴근·휴게시간을 확인해주세요.')
  if(complete&&d.kind==='work'&&(!d.in||!d.out))throw Error('Complete all working-day times before submitting / 근무일 출퇴근 시간을 모두 입력해주세요.')
  return {date,in:d.in,out:d.out,kind:d.kind,break_minutes:d.break_minutes,note:d.note.trim()}
 })
}
export function minutes(time:string){const [h,m]=time.split(':').map(Number);return h*60+m}
export function timeSummary(days:TimeDay[]){return days.reduce((a,d)=>{if(d.kind==='work'&&d.in&&d.out){const n=minutes(d.out)-minutes(d.in)-d.break_minutes;a.days++;a.minutes+=n}return a},{days:0,minutes:0})}
export function cleanAmounts(value:unknown):PayAmounts{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid payroll amounts')
 return Object.fromEntries([...EARNINGS,...DEDUCTIONS].map(k=>{const n=(value as PayAmounts)[k];if(typeof n!=='number'||!Number.isFinite(n)||n<0||n>10000000)throw Error('Check payroll amounts');return [k,Math.round(n*100)/100]}))
}
export function totals(a:PayAmounts,rules?:{id:string;kind:string}[]|null){const cents=(keys:readonly string[])=>keys.reduce((sum,k)=>sum+Math.round((a[k]||0)*100),0);const gross=cents(rules?rules.filter(r=>r.kind==='earning').map(r=>r.id):EARNINGS),deductions=cents(rules?rules.filter(r=>r.kind==='deduction').map(r=>r.id):DEDUCTIONS);return {gross:gross/100,deductions:deductions/100,net:(gross-deductions)/100}}

