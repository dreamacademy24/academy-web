export type ActivityType = 'fieldtrip' | 'afterschool';
export type Block = { id: string; title: string; text: string; width: 1 | 2; height: number };
export type Template = { id: string; title: string; type: ActivityType; blocks: Block[]; source?: string; originalUrl?: string; revision: number };
export type Activity = { id: string; date: string; type: ActivityType; title: string; description: string; blocks?: Block[]; templateId?: string; is_deployed?: boolean };
export function defaultDates(month: string) {
  const [y,m]=month.split('-').map(Number); const result: {date:string;type:ActivityType}[]=[]; let sat=0;
  for(let n=1;n<=new Date(y,m,0).getDate();n++) { const day=new Date(y,m-1,n).getDay(); if(day===6)sat++; if(day===1||day===3||(day===6&&(sat===2||sat===4)))result.push({date:`${month}-${String(n).padStart(2,'0')}`,type:day===6?'fieldtrip':'afterschool'}); }
  return result;
}
export function textBlocks(text: string): Block[] { return [{id:'original',title:'안내 내용',text,width:2,height:180}]; }
export function blockText(blocks: Block[]) { return blocks.map(b=>[b.title,b.text].filter(Boolean).join('\n')).join('\n\n'); }
export function validBlocks(input: unknown): input is Block[] {
 return Array.isArray(input)&&input.length<=60&&input.every(b=>b&&typeof b.id==='string'&&b.id.length<=100&&typeof b.title==='string'&&b.title.length<=160&&typeof b.text==='string'&&b.text.length<=20000&&(b.width===1||b.width===2)&&Number.isInteger(b.height)&&b.height>=80&&b.height<=800)&&new Set(input.map(b=>b.id)).size===input.length;
}
export function validItems(input: unknown, month: string): input is Activity[] {
 return Array.isArray(input)&&input.length<=100&&input.every(i=>i&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i.id)&&['fieldtrip','afterschool'].includes(i.type)&&typeof i.date==='string'&&i.date.startsWith(month+'-')&&/^\d{4}-\d{2}-\d{2}$/.test(i.date)&&Number.isFinite(Date.parse(i.date+'T12:00:00Z'))&&new Date(i.date+'T12:00:00Z').toISOString().slice(0,10)===i.date&&typeof i.title==='string'&&!!i.title.trim()&&i.title.length<=200&&typeof i.description==='string'&&i.description.length<=100000&&(!i.blocks||validBlocks(i.blocks)))&&new Set(input.map(i=>i.id)).size===input.length&&new Set(input.map(i=>i.date+':'+i.type)).size===input.length;
}
