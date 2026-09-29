import { EARNINGS, DEDUCTIONS, minutes, type TimeDay } from './hrPayroll'
export type PayRule={id:string;name:string;name_ko:string;kind:'earning'|'deduction';method:'basic'|'fixed'|'monthly'|'days'|'hours'|'overtime'|'percent_basic';amount:number;multiplier:number;schedule:'both'|'5'|'20';active:boolean}
export type PayPolicy={daily_hours:number;overtime_min_minutes:number;monthly_workdays:number;submission_end_second:number}
export const DEFAULT_POLICY:PayPolicy={daily_hours:8,overtime_min_minutes:30,monthly_workdays:26,submission_end_second:2}
const names:Record<string,[string,string]>={basic:['Basic pay','기본급'],position:['Position allowance','직책 수당'],overtime:['Overtime','연장근무'],weekend:['Weekend pay','주말 근무'],holiday:['Holiday pay','휴일 근무'],transport:['Transport','교통 수당'],tutorial:['Tutorial','튜토리얼 수당'],load:['Load allowance','통신 수당'],other:['Other earnings','기타 지급'],sss:['SSS','SSS'],philhealth:['PhilHealth','PhilHealth'],pagibig:['Pag-IBIG','Pag-IBIG'],cash_advance:['Cash advance','가불 상환'],late:['Late deduction','지각 공제'],undertime:['Undertime deduction','미근무 공제'],tax:['Tax','세금'],other_deduction:['Other deductions','기타 공제']}
export function defaultRules():PayRule[]{return [...EARNINGS,...DEDUCTIONS].map(id=>({id,name:names[id][0],name_ko:names[id][1],kind:(DEDUCTIONS as readonly string[]).includes(id)?'deduction':'earning',method:id==='basic'?'basic':'fixed',amount:0,multiplier:1,schedule:'both',active:true}))}
export function validateRules(input:unknown):PayRule[]{
 if(!Array.isArray(input)||input.length<1||input.length>60)throw Error('Check items: 1–60 items are allowed.')
 const seen=new Set<string>();const out=input.map(r=>{
  if(!r||typeof r.id!=='string'||!/^[a-z][a-z0-9_-]{0,70}$/.test(r.id)||['__proto__','constructor','prototype'].includes(r.id)||seen.has(r.id))throw Error('Invalid item ID')
  seen.add(r.id)
  if(typeof r.name!=='string'||!r.name.trim()||r.name.length>100||typeof r.name_ko!=='string'||r.name_ko.length>100||!['earning','deduction'].includes(r.kind)||!['basic','fixed','monthly','days','hours','overtime','percent_basic'].includes(r.method)||!['both','5','20'].includes(r.schedule)||typeof r.active!=='boolean')throw Error('Check item names and calculation methods')
  if(!Number.isFinite(r.amount)||r.amount<0||r.amount>10000000||!Number.isFinite(r.multiplier)||r.multiplier<0||r.multiplier>10)throw Error('Check rates and multipliers')
  if((r.id==='basic'&&(r.kind!=='earning'||r.method!=='basic'||!r.active))||(r.id!=='basic'&&r.method==='basic'))throw Error('Basic pay must remain an active earning item')
  return {id:r.id,name:r.name.trim(),name_ko:r.name_ko.trim(),kind:r.kind,method:r.method,amount:r.amount,multiplier:r.multiplier,schedule:r.schedule,active:r.active} as PayRule
 });if(!seen.has('basic'))throw Error('Basic pay is required');return out
}
export function validatePolicy(p:any):PayPolicy{if(!p||!Number.isFinite(p.daily_hours)||p.daily_hours<1||p.daily_hours>16||!Number.isInteger(p.overtime_min_minutes)||p.overtime_min_minutes<0||p.overtime_min_minutes>240||!Number.isFinite(p.monthly_workdays)||p.monthly_workdays<1||p.monthly_workdays>31||!Number.isInteger(p.submission_end_second)||p.submission_end_second<1||p.submission_end_second>4)throw Error('Check payroll policy values');return {daily_hours:p.daily_hours,overtime_min_minutes:p.overtime_min_minutes,monthly_workdays:p.monthly_workdays,submission_end_second:p.submission_end_second}}
export function cleanValues(input:unknown,rules:PayRule[]):Record<string,number>{if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid employee amounts');const entries=Object.entries(input);if(entries.length>60)throw Error('Too many amounts');return Object.fromEntries(entries.map(([key,value])=>{if(key==='basic'||!rules.some(r=>r.id===key)||typeof value!=='number'||!Number.isFinite(value)||value<0||value>10000000)throw Error('Check employee rates');return [key,value]}))}
export function ruleAmounts(input:unknown,rules:PayRule[]):Record<string,number>{if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid amounts');const obj=input as Record<string,number>;if(Object.keys(obj).some(k=>!rules.some(r=>r.id===k)))throw Error('Invalid payroll item');return Object.fromEntries(rules.map(r=>{const value=obj[r.id]??0;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>10000000)throw Error('Check amounts');return [r.id,Math.round(value*100)/100]}))}
export function calculatePay(rules:PayRule[],policy:PayPolicy,emp:any,days:TimeDay[],payDay:number){
 const rate=Number(emp.basic_salary);if(emp.basic_salary==null||emp.basic_salary===''||!Number.isFinite(rate)||rate<0||!['Monthly','Daily'].includes(emp.salary_type))throw Error('Check employee basic salary and pay basis first')
 let regular=0,ot=0,worked=0,total=0;for(const d of days){if(d.kind!=='work'||!d.in||!d.out)continue;const hours=(minutes(d.out)-minutes(d.in)-d.break_minutes)/60;if(hours<=0)throw Error('Check approved timecard');worked++;total+=hours;regular+=Math.min(hours,policy.daily_hours);const excess=Math.max(0,hours-policy.daily_hours);if(excess*60+1e-8>=policy.overtime_min_minutes)ot+=excess}
 const basicRule=rules.find(r=>r.id==='basic')!;const rawBase=emp.salary_type==='Monthly'?rate/2:rate*regular/policy.daily_hours
 const base=basicRule.active&&(basicRule.schedule==='both'||basicRule.schedule===String(payDay))?Math.round(rawBase*basicRule.multiplier*100)/100:0
 const hourly=emp.salary_type==='Monthly'?rate/policy.monthly_workdays/policy.daily_hours:rate/policy.daily_hours
 const values=emp.payroll_values||{},details:any[]=[];const amounts=Object.fromEntries(rules.map(r=>{
  const eligible=r.active&&(r.schedule==='both'||r.schedule===String(payDay));const has=Object.prototype.hasOwnProperty.call(values,r.id);const value=has?Number(values[r.id]):r.amount
  let quantity=1,unit=value,source=has?'employee':'company'
  if(r.method==='basic'){quantity=emp.salary_type==='Monthly'?0.5:regular/policy.daily_hours;unit=rate;source='basic_salary'}
  if(r.method==='monthly')quantity=r.schedule==='both'?0.5:1
  if(r.method==='days')quantity=worked
  if(r.method==='hours')quantity=total
  if(r.method==='overtime'){quantity=ot;unit=has||r.amount>0?value:hourly;source=has?'employee':r.amount>0?'company':'basic_salary_hourly'}
  if(r.method==='percent_basic'){quantity=base;unit=value/100}
  const amount=eligible?Math.round(quantity*unit*r.multiplier*100)/100:0
  if(!Number.isFinite(amount)||amount<0||amount>10000000)throw Error('Check calculated amount: '+r.name)
  details.push({id:r.id,quantity,rate:unit,multiplier:r.multiplier,source,eligible,amount});return [r.id,amount]
 }));return {amounts,calculation:{worked_days:worked,regular_hours:regular,overtime_hours:ot,total_hours:total,basic_salary:rate,salary_type:emp.salary_type,policy,details}}
}

