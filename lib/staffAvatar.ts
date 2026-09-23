import catalog from '@/public/staff-avatar-catalog.json';
export const avatarEmojis = ['😀','😊','😎','🐱','🐶','🐻','🐰','🦊','🐼','🦁','🐯','🐨','🦄','🌸','🌻','⭐','🍀','🌈','🎃','👻','🦇','🧙','🧛','🧟','🐈‍⬛','🍬','🍭','🕸️','🕷️','🌙','💜','💎','🎀','🍓','🍒','🍑','🥑','🐧','🐥','🐬','🦋','🐢','🦉','🤖','👽','🔥','⚡','☀️'];
export function validAvatar(value:unknown):value is Record<string,string>{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>,keys=[...Object.keys(catalog),'mode','initial','emoji','thumbnail'];
 return Object.keys(v).every(k=>keys.includes(k))&&['initial','emoji','character'].includes(String(v.mode))&&
 typeof v.initial==='string'&&/^[A-Z0-9가-힣]{1,2}$/.test(v.initial)&&typeof v.emoji==='string'&&avatarEmojis.includes(v.emoji)&&
 Object.entries(catalog).every(([key,entry])=>typeof v[key]==='string'&&Object.hasOwn(entry.items,v[key] as string))&&
 (v.thumbnail===undefined||(typeof v.thumbnail==='string'&&v.thumbnail.length<100000&&/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(v.thumbnail)));
}
