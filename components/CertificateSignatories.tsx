'use client';
import {useEffect,useState} from 'react';
import {findRegisteredSignatory,resolveRegisteredSignatory,validateSignatoryDirectory,type RegisteredSignatory,type CertificateSignatory} from '@/lib/certificateSignatories';
import type {CertificateLanguage} from '@/lib/certificates';
export default function CertificateSignatories({language,uiLanguage,signers,onChange,directory,directoryVersion,onSave,busy}:{language:CertificateLanguage;uiLanguage:CertificateLanguage;signers:CertificateSignatory[];onChange:(s:CertificateSignatory[])=>void;directory:RegisteredSignatory[];directoryVersion:number;onSave:(r:RegisteredSignatory[])=>Promise<void>;busy:boolean}){
 const en=uiLanguage==='en',tx=(ko:string,english:string)=>en?english:ko;
 const [draft,setDraft]=useState(directory),[registryDirty,setRegistryDirty]=useState(false),[error,setError]=useState('');
 useEffect(()=>{setDraft(directory);setRegistryDirty(false);},[directory]);
 function update(id:string,key:keyof RegisteredSignatory,value:string|boolean){setDraft(rows=>rows.map(r=>r.id===id?{...r,[key]:value}:r));setRegistryDirty(true);setError('');}
 function choose(index:number,id:string,variant:'primary'|'alternate'='primary'){
  const person=directory.find(r=>r.id===id&&r.active);if(!person)return;
  if(signers.some((s,i)=>i!==index&&findRegisteredSignatory(s,directory)?.id===id)){setError(tx('같은 사람을 두 번 선택할 수 없습니다.','Choose each person once.'));return;}
  setError('');onChange(signers.map((s,i)=>i===index?resolveRegisteredSignatory(person,language,variant):s));
 }
 const available=directory.filter(r=>r.active);
 return <section className="cert-panel"><h2>{tx('서명 담당자 선택','Select signatories')}</h2><p>{tx('서명할 담당자를 1명 또는 2명 선택하세요. 선택한 이름·직책이 문서에 들어갑니다.','Choose one or two signatories. Their names and positions appear on the letter.')}</p>
 {error&&<p role="alert" className="cert-error">{error}</p>}
 {signers.map((signer,index)=>{const person=findRegisteredSignatory(signer,directory);return <div key={index} style={{border:'1px solid #e0e7eb',borderRadius:9,padding:12,marginBottom:10}}>
  <label>{tx('서명 담당자','Signatory')} {index+1}<select value={person?.id||''} disabled={busy} onChange={e=>choose(index,e.target.value)}><option value="" disabled>{tx('기존 문서의 서명자','Signatory from saved letter')}</option>{person&&!person.active&&<option value={person.id}>{person.label} ({tx('사용 중지','inactive')})</option>}{available.map(r=><option key={r.id} value={r.id}>{r.label} · {language==='ko'?r.positionKo:r.positionEn}</option>)}</select></label>
  {language==='en'&&person?.alternateEn&&<label>{tx('영문 이름 표기','English display name')}<select value={signer.name===person.alternateEn?'alternate':'primary'} onChange={e=>choose(index,person.id,e.target.value as 'primary'|'alternate')}><option value="primary">{person.nameEn}</option><option value="alternate">{person.alternateEn}</option></select></label>}
  <p><strong>{signer.name}</strong><br/>{signer.position}</p>{person?.note&&<p>{person.note}</p>}
  <div className="cert-tools">{person?.active&&<button type="button" disabled={busy} onClick={()=>choose(index,person.id,signer.nameVariant||'primary')}>{tx('등록된 최신 정보 적용','Apply current registered details')}</button>}{signers.length>1&&<button type="button" disabled={busy} onClick={()=>onChange(signers.filter((_,i)=>i!==index))}>{tx('서명란 빼기','Remove slot')}</button>}</div>
 </div>})}
 {signers.length<2&&<button type="button" disabled={busy||!available.some(r=>!signers.some(s=>findRegisteredSignatory(s,directory)?.id===r.id))} onClick={()=>{const r=available.find(r=>!signers.some(s=>findRegisteredSignatory(s,directory)?.id===r.id));if(r)onChange([...signers,resolveRegisteredSignatory(r,language)]);}}>{tx('서명란 추가','Add a signatory')}</button>}
 <details style={{marginTop:16}}><summary>{tx('담당자 이름·직책 등록 및 수정','Register or edit names and positions')} · v{directoryVersion}</summary><p>{tx('등록명단 변경은 기존 발급본을 바꾸지 않습니다. 현재 문서에는 담당자를 다시 선택하거나 최신 정보 적용을 눌러 반영하세요.','Changes do not alter saved letters. Select a person again or apply current registered details to update this letter.')}</p>
 {draft.map(r=><div key={r.id} style={{padding:12,border:'1px solid #e0e7eb',borderRadius:8,margin:'12px 0'}}>
  {(['label','nameKo','nameEn','alternateEn','positionKo','positionEn','note'] as const).map((key,i)=><label key={key}>{tx(['목록 표시명','한글 이름','영문 이름','영문 별칭 또는 다른 표기','한글 직책','영문 직책','확인 사항'][i],['List label','Korean name','English name','Alternate English name','Korean position','English position','Notes'][i])}<input maxLength={key==='note'?300:100} value={r[key]} onChange={e=>update(r.id,key,e.target.value)}/></label>)}
  <label className="cert-check"><input type="checkbox" checked={r.active} onChange={e=>update(r.id,'active',e.target.checked)}/>{tx('새 문서에서 선택 가능','Available for new letters')}</label>
 </div>)}
 <div className="cert-tools"><button type="button" disabled={busy||draft.length>=30} onClick={()=>{setDraft(d=>[...d,{id:crypto.randomUUID(),label:'',nameKo:'',nameEn:'',alternateEn:'',positionKo:'',positionEn:'',note:'',active:true}]);setRegistryDirty(true);}}>{tx('담당자 등록 추가','Add a person')}</button><button type="button" className="primary" disabled={busy||!registryDirty} onClick={async()=>{const invalid=validateSignatoryDirectory(draft);if(invalid){setError(invalid);return;}await onSave(draft);}}>{tx('등록명단 새 버전 저장','Save directory revision')}</button></div>
 </details></section>;
}
