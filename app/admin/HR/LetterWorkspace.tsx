'use client'
import {useState} from 'react'
import {COMPANY_EN} from '@/lib/hrFields'
type Letter={company:string;language:'ko'|'en';number:string;date:string;title:string;to:string;from:string;body:string;prepared:string;approver:string;attachments:string}
const dateToday=()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Manila'})
function example(company:string,language:'ko'|'en',kind:string):Letter {
 const ko=language==='ko'
 return {company,language,number:'',date:dateToday(),title:kind==='records'?(ko?'직원 인적사항 등록 및 신분 확인 서류 제출 안내':'Employee Personal Information Registration and Identity Documents'):kind==='meeting'?(ko?'직원 회의 안내':'Staff Meeting Notice'):kind==='training'?(ko?'직원 교육 안내':'Staff Training Notice'):'',to:ko?'전 직원':'All employees',from:ko?'드림컴퍼니 인사팀':'Dream Company – Human Resources Department',body:kind==='records'?(ko?'직원 인사기록을 정비하기 위해 아래 서류의 작성 및 제출을 요청드립니다.\n\n제출 서류\n1. 인사기록카드의 필수 항목을 작성해 주세요.\n2. 유효한 정부발행 신분증 앞·뒷면 사본을 준비해 주세요.\n3. 서명 제출 여부와 방법은 담당 매니저의 안내를 확인해 주세요.\n\n제출 안내\n제출 기한: [날짜와 시간 입력]\n제출처: [담당 매니저와 제출 방법 입력]\n문의: [담당자와 연락처 입력]\n\n개인정보 처리 안내는 회사에서 확인한 내용을 기재해 주세요.':'Please complete and submit the documents below to update your personnel record.\n\nDocuments to submit\n1. Complete the required fields of the Personnel Record Card.\n2. Prepare copies of the front and back of a valid government-issued ID.\n3. Follow your manager’s instructions regarding signature requirements.\n\nSubmission details\nDeadline: [Enter date and time]\nSubmit to: [Enter manager and submission method]\nQuestions: [Enter contact person and details]\n\nInsert the company-approved privacy notice here.') :kind==='meeting'||kind==='training'?(ko?'목적: [내용 입력]\n일시: [날짜와 시간 입력]\n장소: [장소 입력]\n대상: [참석 대상 입력]\n준비 사항: [내용 입력]\n문의: [담당자 입력]':'Purpose: [Enter purpose]\nDate and time: [Enter date and time]\nVenue: [Enter venue]\nParticipants: [Enter participants]\nPreparation: [Enter details]\nContact: [Enter contact person]'):'',prepared:'',approver:'',attachments:''}
}
const translatedKeys=['title','to','from','body','prepared','approver','attachments'] as const
export default function LetterWorkspace({companies,language,onDirty,request}:{companies:string[];language:'ko'|'en';onDirty:(v:boolean)=>void;request:(url:string,init?:RequestInit)=>Promise<any>}) {
 const t=(ko:string,en:string)=>language==='ko'?ko:en
 const [letter,setLetter]=useState<Letter>(()=>example(companies[0]||'','en','records'))
 const [korean,setKorean]=useState<Letter>(()=>example(companies[0]||'','ko','records'))
 const [view,setView]=useState<'ko'|'en'>(language)
 const [englishReady,setEnglishReady]=useState(true),[koreanReady,setKoreanReady]=useState(true)
 const [kind,setKind]=useState('records'),[changed,setChanged]=useState(false),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 const shown=view==='ko'?korean:letter
 const update=(key:keyof Letter,value:string)=>{
  const apply=(old:Letter)=>({...old,[key]:value})
  if(translatedKeys.includes(key as typeof translatedKeys[number])){
   if(view==='ko'){setKorean(apply);setEnglishReady(false)}else{setLetter(apply);setKoreanReady(false)}
  }else{setLetter(apply);setKorean(apply)}
  setChanged(true);onDirty(true);setMessage('')
 }
 async function translate(target:'en'|'ko'){
  setBusy(true);setMessage('')
  try{const source=target==='en'?korean:letter;const data=await request('/api/hr/translate',{method:'POST',body:JSON.stringify({company:letter.company,target,fields:Object.fromEntries(translatedKeys.map(k=>[k,source[k]]))})});const next={...source,...data.fields,language:target};if(target==='en'){setLetter(next);setEnglishReady(true)}else{setKorean(next);setKoreanReady(true)}setChanged(true);onDirty(true);setMessage(t('번역되었습니다. 이름·날짜·금액과 내용을 확인해 주세요.','Translation ready. Review names, dates, amounts and wording.'));return true}catch(e){setMessage(e instanceof Error?e.message:t('번역 실패 — 초안은 유지됩니다.','Translation failed — your draft is preserved.'));return false}finally{setBusy(false)}
 }
 async function switchView(next:'en'|'ko'){
  if(next===view)return
  if((next==='en'&&!englishReady)||(next==='ko'&&!koreanReady)){if(!await translate(next))return}
  setView(next)
 }
 function loadTemplate(next:string){if(changed&&!confirm(t('작성 중인 내용을 새 양식으로 바꿀까요?','Replace your draft with this template?')))return;setKind(next);setLetter(example(letter.company,'en',next));setKorean(example(letter.company,'ko',next));setEnglishReady(true);setKoreanReady(true);setChanged(false);onDirty(false);setMessage('')}
 function download(){const blob=new Blob([JSON.stringify({format:'dream-hr-letter-v2',letter,korean,englishReady,koreanReady,kind},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`Dream-HR-draft-${letter.date}.json`;a.click();URL.revokeObjectURL(url);setChanged(false);onDirty(false);setMessage(t('영어 원본과 한국어 번역을 초안 파일에 함께 저장했습니다.','English original and Korean translation saved together in the draft file.'))}
 async function importDraft(file?:File){if(!file)return;try{
  if(file.size>400000)throw Error();const data=JSON.parse(await file.text());const keys=Object.keys(letter) as (keyof Letter)[]
  const valid=(v:Letter)=>v&&keys.every(k=>typeof v[k]==='string'&&v[k].length<=40000)&&companies.includes(v.company)&&['ko','en'].includes(v.language)&&/^\d{4}-\d{2}-\d{2}$/.test(v.date)
  if(!['dream-hr-letter-v1','dream-hr-letter-v2'].includes(data.format)||!valid(data.letter)||(data.format==='dream-hr-letter-v2'&&(!valid(data.korean)||data.letter.language!=='en'||data.korean.language!=='ko'||data.letter.company!==data.korean.company)))throw Error()
  if(changed&&!confirm(t('현재 작성 중인 내용을 바꿀까요?','Replace your current draft?')))return
  if(data.format==='dream-hr-letter-v2'){setLetter(data.letter);setKorean(data.korean);setEnglishReady(data.englishReady===true);setKoreanReady(data.koreanReady===true);setView(data.englishReady===false?'ko':data.koreanReady===false?'en':language)}
  else if(data.letter.language==='ko'){setKorean(data.letter);setLetter({...data.letter,language:'en'});setEnglishReady(false);setKoreanReady(true);setView('ko')}
  else{setLetter(data.letter);setKorean({...data.letter,language:'ko'});setEnglishReady(true);setKoreanReady(false);setView('en')}
  setKind(['records','meeting','training','blank'].includes(data.kind)?data.kind:'blank');setChanged(false);onDirty(false);setMessage(t('초안을 불러왔습니다.','Draft opened.'))
 }catch{setMessage(t('초안 형식이나 회사 접근 권한을 확인해 주세요.','Check draft format and company access.'))}}
 function print(){if(!englishReady){setMessage(t('한국어 수정 내용을 먼저 영어 원본에 반영해 주세요.','Update the English original before printing.'));return}if(!letter.title.trim()||!letter.to.trim()||!letter.body.trim()){setMessage(t('제목, 수신, 본문을 입력해 주세요.','Enter subject, recipient and body.'));return}window.print()}
 const fields:[keyof Letter,string,string][]=[['number','문서번호','Document number'],['date','발행일','Issue date'],['title','제목','Subject'],['to','수신','To'],['from','발신','From'],['prepared','작성 담당자 / 직책','Prepared by / title'],['approver','승인 담당자 / 직책','Approver / title'],['attachments','붙임 목록','Attachments']]
 return <section className="hr-letters"><div className="hr-page-heading hr-no-print"><div><p className="hr-eyebrow">DOCUMENT STUDIO</p><h1>{t('공문 작성','Official letters')}</h1><p>{t('영어 원본 · 한국어 번역 보기 — 인쇄와 PDF는 영어로 출력됩니다.','English original · Korean translation view — printing and PDF use English.')}</p></div><div className="hr-inline"><button className="hr-btn" disabled={busy} onClick={download}>{t('초안 다운로드','Download draft')}</button><label className="hr-btn">{t('초안 불러오기','Open draft')}<input type="file" accept=".json" disabled={busy} style={{display:'none'}} onChange={e=>{void importDraft(e.target.files?.[0]);e.target.value=''}}/></label><button className="hr-btn primary" disabled={busy||!englishReady} onClick={print}>{t('영어 인쇄 / PDF 저장','Print English / Save PDF')}</button></div></div>
 {message&&<div className="hr-success hr-no-print" role="status">{message}</div>}
 <div className="hr-card hr-no-print"><div className="hr-inline"><button className={'hr-btn'+(view==='ko'?' primary':'')} disabled={busy} onClick={()=>void switchView('ko')}>한국어 번역 보기</button><button className={'hr-btn'+(view==='en'?' primary':'')} disabled={busy} onClick={()=>void switchView('en')}>English original</button>{!englishReady&&<button className="hr-btn primary" disabled={busy} onClick={()=>void translate('en')}>{busy?t('번역 중…','Translating…'):t('수정 내용을 영어 원본에 반영','Update English original')}</button>}</div><p className="hr-help">{t('대표님은 한국어 번역, 현지 직원은 영어 원본이 먼저 열립니다. 한국어 내용을 수정하면 영어 반영 후 출력할 수 있습니다. 직접 작성한 내용의 번역은 AI 번역 서비스를 이용합니다.','English opens by default for local staff. Korean is a translation view. Update the English original after Korean edits before printing. Custom-text translation uses an AI translation service.')}</p></div>
 <div className="hr-letter-layout"><fieldset className="hr-card hr-no-print" disabled={busy} style={{minWidth:0}}><h2>{t('공문 내용','Letter details')}</h2><p className="hr-help">{t('초안은 서버에 자동 저장되지 않습니다. 작업 후 초안 파일을 보관해 주세요.','Drafts are not saved automatically to the server. Download a draft to keep your work.')}</p><label>{t('템플릿','Template')}<select value={kind} onChange={e=>loadTemplate(e.target.value)}><option value="records">{t('직원 인적사항 제출 안내','Personnel records request')}</option><option value="meeting">{t('직원 회의 안내','Staff meeting')}</option><option value="training">{t('교육 안내','Training notice')}</option><option value="blank">{t('일반 공문','General letter')}</option></select></label><label>{t('발행 회사','Issuing company')}<select value={shown.company} onChange={e=>update('company',e.target.value)}>{companies.map(c=><option key={c} value={c}>{language==='ko'?c:COMPANY_EN[c]||c}</option>)}</select></label>{fields.map(([key,k,e])=><label key={key}>{t(k,e)}<input type={key==='date'?'date':'text'} maxLength={500} value={shown[key]} onChange={ev=>update(key,ev.target.value)}/></label>)}<label>{t('본문','Body')}<textarea rows={18} maxLength={20000} value={shown.body} onChange={e=>update('body',e.target.value)}/></label><p className="hr-help">{t('이름 입력만으로 승인되거나 발송되지 않습니다.','Adding names does not approve or send the letter.')}</p></fieldset>
 <div className="hr-no-print"><LetterPaper letter={shown}/></div></div><div className="hr-letter-print-only">{englishReady?<LetterPaper letter={letter}/>:<p>Update the English original before printing. / 영어 원본 반영 후 출력해주세요.</p>}</div></section>
}
function LetterPaper({letter}:{letter:Letter}){
 const ko=letter.language==='ko'
 const date=/^\d{4}-\d{2}-\d{2}$/.test(letter.date)?new Date(letter.date+'T12:00:00').toLocaleDateString(ko?'ko-KR':'en-US',{year:'numeric',month:'long',day:'numeric',weekday:'long'}):''
 return <article className="hr-letter-paper" lang={letter.language}><header><strong>DREAM COMPANY</strong><b>{COMPANY_EN[letter.company]||letter.company}</b><span>Lapu-Lapu City (Mactan), Cebu, Philippines</span></header><div className="hr-letter-meta"><span>{ko?'문서번호':'Doc. No.'}: {letter.number||'________________'}</span><span>{date}</span></div><h1>{letter.title||(ko?'공문 제목':'Letter subject')}</h1><dl><div><dt>{ko?'수신':'To'}</dt><dd>{letter.to}</dd></div><div><dt>{ko?'발신':'From'}</dt><dd>{letter.from}</dd></div></dl><div className="hr-letter-body">{letter.body}</div>{letter.attachments&&<p className="hr-letter-attachments">{ko?'붙임':'Attachments'}: {letter.attachments}</p>}<footer><div><b>{ko?'발신 / 담당':'Prepared by'}</b><div className="hr-signature-line"/><p>{letter.prepared}</p></div><div><b>{ko?'승인':'Approved by'}</b><div className="hr-signature-line"/><p>{letter.approver}</p></div></footer></article>
}
