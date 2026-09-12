import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
export type SourceSnapshot={bookingId:string;index:number;students:unknown;student:{id:string;booking_id:string|null;name_kr:string;name_en:string|null};};
function canonical(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object')return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
 return JSON.stringify(value??null);
}
export function sourceDigest(source:SourceSnapshot){return createHash('sha256').update(canonical(source)).digest('hex');}
export function issueConfirmation(source:SourceSnapshot,actorId:string,key:string,now=Date.now()){
 if(!key)throw new Error('Confirmation signing key unavailable');
 const payload=Buffer.from(JSON.stringify({digest:sourceDigest(source),actorId,expires:now+15*60*1000})).toString('base64url');
 return payload+'.'+createHmac('sha256',key).update('care-confirm-v1:'+payload).digest('base64url');
}
export function verifyConfirmation(token:string,source:SourceSnapshot,actorId:string,key:string,now=Date.now()){
 try{
  if(!key||token.length>2000)return false;
  const parts=token.split('.');if(parts.length!==2)return false;
  const [payload,signature]=parts;const expected=Buffer.from(createHmac('sha256',key).update('care-confirm-v1:'+payload).digest('base64url'));const actual=Buffer.from(signature);
  if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return false;
  const claim=JSON.parse(Buffer.from(payload,'base64url').toString());
  return claim.actorId===actorId&&Number.isFinite(claim.expires)&&claim.expires>now&&claim.digest===sourceDigest(source);
 }catch{return false;}
}
export function validVisitDates(start:unknown,end:unknown){
 const valid=(s:unknown):s is string=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 return valid(start)&&valid(end)&&end>=start;
}
