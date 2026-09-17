'use client';
import {useEffect,useRef,useState,Suspense} from 'react';
import {useSearchParams} from 'next/navigation';
import {buildGuestDetails} from '@/lib/guestDetailsPrint';

type DocumentKind='kr'|'en'|'checklist'|'medicine'|'pickup';
const labels:Record<DocumentKind,string>={kr:'체크인디테일 (KR)',en:'체크인디테일 (EN)',checklist:'체크인체크리스트',medicine:'상비약 안내서',pickup:'공항픽업피켓'};
export default function Page(){return <Suspense><PrintSet/></Suspense>;}
function PrintSet(){
  const params=useSearchParams(),ids=(params.get('bookings')||'').split(',').filter(Boolean);
  const [selected,setSelected]=useState<DocumentKind[]>(['kr','checklist','medicine','pickup']);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState(false),[progress,setProgress]=useState('');
  const output=useRef<HTMLDivElement>(null),frame=useRef<HTMLIFrameElement>(null),run=useRef(0);
  useEffect(()=>()=>{run.current++;},[]);
  async function source(path:string,selector:string){
    const f=frame.current!;f.src=path;
    const start=Date.now();
    while(Date.now()-start<30000){
      await new Promise(r=>setTimeout(r,150));
      const doc=f.contentDocument;
      if(doc?.location.href!==new URL(path,window.location.origin).href)continue;
      const nodes=Array.from(doc.querySelectorAll<HTMLElement>(selector));
      if(!nodes.length)continue;
      // Wait for the original page's fonts and linked styles before cloning.
      await doc.fonts.ready;
      return {nodes,styles:Array.from(doc.querySelectorAll('style,link[rel="stylesheet"]')).map(n=>n.cloneNode(true))};
    }
    throw Error('서류를 불러오지 못했습니다. 로그인 상태를 확인하고 다시 준비해주세요.');
  }
  async function prepare(){
    if(!ids.length||!selected.length)return;
    const token=++run.current;setBusy(true);setReady(false);setError('');output.current!.replaceChildren();
    try{
      for(const id of ids){
        const r=await fetch('/api/admin/checkin-preparation?bookingId='+encodeURIComponent(id)),data=await r.json();if(!r.ok)throw Error(data.error);
        const b=data.booking,d=data.detail||{};
        for(const kind of selected){
          if(token!==run.current)return;setProgress(`${b.booker_name} · ${labels[kind]} 준비 중`);
          let content:Awaited<ReturnType<typeof source>>;
          if(kind==='kr'||kind==='en'){
            const parse=(v:string,fallback:unknown)=>{try{return JSON.parse(v)||fallback;}catch{return fallback;}};
            const beds=parse(d.bed_setting,{room1:'',room2:'',room3:''}),sims=parse(d.usim_request,[]);
            const snapResponse=await fetch('/api/invoice/snapshot?booking_id='+encodeURIComponent(id));if(!snapResponse.ok&&snapResponse.status!==404)throw Error('정산 정보를 불러오지 못했습니다.');const snap=(await snapResponse.json()).snapshot||{};const saved=typeof snap.saved_data==='string'?parse(snap.saved_data,{}):snap.saved_data;
            const html=buildGuestDetails(kind,b,d,beds,sims,saved?.billing?.locals||[],b.flight_images||[]);
            const doc=new DOMParser().parseFromString(html,'text/html');doc.querySelectorAll('script').forEach(n=>n.remove());
            content={nodes:Array.from(doc.body.children) as HTMLElement[],styles:Array.from(doc.querySelectorAll('style'))};
          }else content=await source((kind==='checklist'?'/dreamhouse-checklist':kind==='medicine'?'/admin/med-form':'/admin/checkin-card')+'?bookingId='+encodeURIComponent(id),kind==='checklist'?'#dreamhouse-print-sheet[data-booking-ready="true"]':kind==='medicine'?'.page':'#pickup-print-sheet');
          if(token!==run.current)return;
          const host=document.createElement('section');host.className='print-document '+(kind==='pickup'?'landscape':'portrait');host.setAttribute('aria-label',`${b.booker_name} ${labels[kind]}`);
          const shadow=host.attachShadow({mode:'open'});content.styles.forEach(n=>shadow.appendChild(n.cloneNode(true)));
          content.nodes.forEach(n=>shadow.appendChild(n.cloneNode(true)));
          // Preserve edited input values in the existing checklist's print spans.
          const css=document.createElement('style');css.textContent=':host{display:block;background:white;color:black} #pickup-print-sheet{min-height:180mm!important;width:277mm;margin:auto;padding:10mm!important;box-sizing:border-box} .page{margin:0!important;box-shadow:none!important} #cdwrap{margin:10mm!important} #dreamhouse-print-sheet{padding:10mm!important} @media print{:host{display:block} .page:last-child{break-after:auto!important;page-break-after:auto!important}}';shadow.appendChild(css);
          output.current!.appendChild(host);
          const sign=shadow.querySelector<HTMLElement>('#pickup-print-sheet');if(sign){sign.style.zoom=String(Math.min(1,720/sign.scrollHeight));}
          const sheet=shadow.querySelector<HTMLElement>('#cdsheet'),wrap=shadow.querySelector<HTMLElement>('#cdwrap');if(sheet&&wrap){const maxH=277/25.4*96;const height=sheet.scrollHeight;if(height>maxH){sheet.style.transformOrigin='top left';sheet.style.transform='scale('+maxH/height+')';wrap.style.height=maxH+'px';}}
          await Promise.all(Array.from(shadow.querySelectorAll('link')).map(link=>new Promise<void>(resolve=>{if(link.sheet)return resolve();link.onload=()=>resolve();link.onerror=()=>resolve();setTimeout(resolve,5000);})));
          await Promise.all(Array.from(shadow.querySelectorAll('img')).map(img=>img.decode().catch(()=>{throw Error('서류 사진을 불러오지 못했습니다. 다시 준비해주세요.');})));
        }
      }
      setReady(true);setProgress('서류 준비 완료 · 아래 내용을 확인한 뒤 인쇄하세요.');
    }catch(e){setError(e instanceof Error?e.message:'출력 준비에 실패했습니다.');}
    finally{setBusy(false);}
  }
  return <main><style>{`
    .print-controls{padding:20px;background:white;border:1px solid #dbe3ee;margin:20px;position:sticky;top:0;z-index:2;line-height:1.8}.print-controls h1{font-size:22px}.print-controls label{display:inline-flex;gap:6px;margin:10px 18px 10px 0}.print-controls button{padding:10px 18px;margin-right:8px;border:1px solid #bdc9dd;border-radius:8px;cursor:pointer}.print-controls button:disabled{opacity:.5}.print-document{background:white;margin:20px auto;padding:10mm;width:210mm;box-sizing:border-box;box-shadow:0 1px 8px #bbc3ce}.print-document.landscape{width:297mm}.print-source{position:fixed;left:-10000px;width:1100px;height:900px;border:0}
    @page{size:A4 portrait;margin:0}@page checkinPortrait{size:A4 portrait;margin:0}@page checkinLandscape{size:A4 landscape;margin:0}
    @media print{#checkin-set-output{width:100%}.print-controls,.print-source{display:none!important}.print-document{margin:0;padding:0;width:auto!important;box-shadow:none;break-before:page;page:checkinPortrait}.print-document:first-child{break-before:auto}.print-document.landscape{page:checkinLandscape}}
    `}</style><section className="print-controls"><h1>체크인 서류 세트 출력</h1><p>선택한 예약 {ids.length}팀 · 기존 양식을 그대로 불러옵니다. 인쇄는 전달·수령 완료로 기록되지 않습니다.</p>
      {(Object.keys(labels) as DocumentKind[]).map(k=><label key={k}><input type="checkbox" checked={selected.includes(k)} disabled={busy} onChange={e=>{setSelected(e.target.checked?[...selected,k]:selected.filter(x=>x!==k));setReady(false);}}/>{labels[k]}</label>)}<div><button disabled={busy||!selected.length||!ids.length} onClick={()=>void prepare()}>{busy?'준비 중…':'선택한 서류 준비'}</button><button disabled={!ready||busy} onClick={()=>window.print()}>세트 인쇄 / PDF 저장</button></div><p role="status">{progress}</p>{error&&<p role="alert" style={{color:'#b42318'}}>{error}</p>}</section><div id="checkin-set-output" ref={output}/><iframe className="print-source" ref={frame} title="기존 서류 불러오기"/></main>;
}
