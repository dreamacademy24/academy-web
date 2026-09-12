'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {openStaffSignIn} from '@/lib/staffSessionClient';
import styles from './StaffNoticeBoard.module.css';

type Notice={id:string;title:string;text:string;date:string;done:boolean;require_read:boolean;files:{name?:string;url?:string;data?:string}[]};
function safeLink(value:unknown){
  if(typeof value!=='string')return null;
  try{const url=new URL(value,'https://www.dreamacademyph.com');return url.protocol==='https:'?url.href:null;}catch{return null;}
}
function documentFor(body:string){
  const plain=!/<\/?[a-z][\s\S]*>/i.test(body);
  const content=plain?body.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n','<br>'):body;
  // The sandbox has no scripts, forms, same-origin privilege or top-navigation permission.
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{margin:0;padding:8px 16px 24px;font:15px/1.8 Arial,sans-serif;color:#334155;overflow-wrap:anywhere}h1,h2,h3{color:#172554;line-height:1.4}img{max-width:100%;height:auto}a{color:#2454a6}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #dde3ec;padding:8px}p{margin:0 0 16px}</style></head><body>${content}</body></html>`;
}

export default function StaffNoticeBoard(){
  const [notices,setNotices]=useState<Notice[]>([]);
  const [status,setStatus]=useState<'loading'|'ready'|'error'|'signin'>('loading');
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const load=useCallback(async()=>{
    setStatus('loading');
    try{
      const response=await fetch('/api/staff/notices',{credentials:'same-origin',cache:'no-store'});
      if(response.status===401){setStatus('signin');return;}
      if(!response.ok)throw new Error();
      const data=await response.json();
      setNotices(data.notices);setStatus('ready');
    }catch{setStatus('error');}
  },[]);
  useEffect(()=>{void load();},[load]);
  const active=notices.find(n=>n.id===selected);
  const visible=notices.filter(n=>(n.title+' '+n.text.replace(/<[^>]*>/g,' ')).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  const srcDoc=useMemo(()=>active?documentFor(active.text||''):'',[active]);
  return <section className={styles.board} aria-label="Staff announcements">
    <header className={styles.header}><div><h1>Announcements</h1><p>공지사항</p></div><button onClick={()=>void load()} disabled={status==='loading'}>↻ Refresh</button></header>
    {status==='loading'&&<p role="status">Loading announcements…</p>}
    {status==='signin'&&<div role="status"><p>Please sign in to view staff announcements.</p><button onClick={openStaffSignIn}>Sign in and return</button></div>}
    {status==='error'&&<div role="alert"><p>Could not load announcements. Please try again.</p><button onClick={()=>void load()}>Retry</button></div>}
    {status==='ready'&&(active?<article className={styles.detail}>
      <button onClick={()=>setSelected(null)}>← All announcements</button>
      <h2>{active.title||'Announcement'}</h2><p className={styles.date}>{active.date?.slice(0,10)}{active.done?' · Archived':''}</p>
      <iframe title={active.title||'Announcement content'} sandbox="allow-popups allow-popups-to-escape-sandbox" referrerPolicy="no-referrer" srcDoc={srcDoc} className={styles.body}/>
      {Array.isArray(active.files)&&active.files.length>0&&<ul className={styles.files}>{active.files.map((file,index)=>{const href=safeLink(file.url);const inline=typeof file.data==='string'&&/^data:image\/(?:png|jpeg|gif|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(file.data)&&file.data.length<1024*1024?file.data:null;return href?<li key={index}><a href={href} target="_blank" rel="noopener noreferrer">📎 {file.name||'Attachment'}</a></li>:inline?<li key={index}>{/* Stored notice screenshots should display without an image proxy. */}<img src={inline} alt={file.name||'Announcement image'} loading="lazy" style={{maxWidth:'100%',height:'auto'}}/></li>:null;})}</ul>}
    </article>:<>
      <div className={styles.toolbar}><label>Search announcements<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Title or keyword"/></label><span>{visible.length} announcements</span></div>
      <div className={styles.list}>{visible.map(notice=><button key={notice.id} className={styles.row} onClick={()=>setSelected(notice.id)}><span className={styles.date}>{notice.date?.slice(0,10)||'Notice'}</span><span className={styles.title}>{notice.title||'Announcement'}{notice.require_read&&<small>Important</small>}{notice.done&&<small>Archived</small>}</span><span aria-hidden="true">→</span></button>)}</div>
      {!visible.length&&<p className={styles.empty}>{query?'No matching announcements.':'No announcements yet.'}</p>}
    </>)}
  </section>;
}
