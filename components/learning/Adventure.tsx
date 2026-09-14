'use client';
import Image from 'next/image';
import Player from './Player';
import FinalMission from './FinalMission';
import LearningWorld from './LearningWorld';
import data from '@/lib/learning/tree-house.json';
import Link from 'next/link';
import {useEffect,useState,useRef} from 'react';
import {Icon,InkPad,Recorder,WordArt,useSpeech} from './Tools';
import {type Stroke} from '@/lib/learning/storage';
import {useLearningHref,useLearningStorage} from './LearningContext';
import styles from './Adventure.module.css';

const scenes=[
 {title:'나무집 창문 너머에는?',speaker:'오늘의 이야기',en:'My Tree House',ko:'바비와 미아가 할아버지의 나무집에 놀러 왔어요. 드림이와 함께 이야기를 따라가고, 마지막에는 우리만의 추억책을 만들어요.',action:'이야기 속으로',art:-1},
 {title:'저 위에 집이 있어!',speaker:'Mia · 미아',en:'Look! A house in a tree!',ko:'커다란 나무 위에 작은 집이 있네요. 할아버지는 어디 계실까요?',action:'집을 찾아봐요',art:-1},
 {title:'한 칸씩, 천천히.',speaker:'Dad · 아빠',en:'Let’s climb the ladder. I will help you.',ko:'아빠가 도와주신대요. 사다리를 한 칸씩 눌러 함께 올라가요.',action:'사다리를 올라가요',art:0},
 {title:'안에 누구 계세요?',speaker:'Bobby · 바비',en:'Knock, knock! Grandpa?',ko:'문을 똑똑 두드려 우리가 왔다고 알려줄까요?',action:'문을 두드려요',art:-1},
 {title:'창문 너머의 비밀',speaker:'Grandpa · 할아버지',en:'Come in! Look out the window.',ko:'어서 오렴! 할아버지가 창문을 가리켰어요. 창문을 열어볼까요?',action:'창문을 열어요',art:1},
 {title:'진짜 정글일까?',speaker:'Mia · 미아',en:'A jungle! Is it real?',ko:'초록 잎과 재미있는 원숭이들! 그런데… 할아버지 손에 무엇이 있을까요?',action:'비밀을 찾아봐요',art:1},
 {title:'함께 읽으면 더 즐거워.',speaker:'Grandpa · 할아버지',en:'No. I painted it. Come and read with me.',ko:'정글은 할아버지가 그린 그림이었어요! 이제 옆에 앉아 책을 펼쳐봐요.',action:'책을 펼쳐요',art:2},
 {title:'내 나무집 이야기도 남겨요.',speaker:'Bobby · 바비',en:'I like this little house.',ko:'바비처럼 나무집 이야기를 말하거나 그려보세요. 오늘의 추억이 될 거예요.',action:'이야기 간직하기',art:2},
 {title:'또 놀러 올게요, 할아버지!',speaker:'이야기의 끝',en:'Goodbye, Grandpa!',ko:'책을 제자리에 놓았어요. 아빠와 함께 한 사람씩 천천히 사다리를 내려가요.',action:'드림이와 마지막 미션',art:-1},
];
const guideLines=['안녕! 나는 드림이야! Hello!','우리 함께 이야기를 보며 영어 모험을 떠나자.','잘 듣고, 나처럼 말해 봐! Tree!','단어도 써 보고, 게임으로 배운 걸 확인해 봐!'];
export default function Adventure(){
 const {getAdventure,putAdventure}=useLearningStorage();const learningHref=useLearningHref();
 const [missionOpen,setMissionOpen]=useState(false);
 const guideAudio=useRef<HTMLAudioElement|null>(null);const guideRun=useRef(0);
 const [guideStep,setGuideStep]=useState(-1);const [guideSpeaking,setGuideSpeaking]=useState(false);const [guideError,setGuideError]=useState('');
 function stopGuide(){guideRun.current++;guideAudio.current?.pause();guideAudio.current=null;setGuideSpeaking(false);setGuideStep(-1);}
 function playGuide(step:number,run=++guideRun.current){
  stop();guideAudio.current?.pause();setGuideStep(step);setGuideError('');
  const clip=new Audio(`/learning/tree-house/intro-voice-0${step+1}.wav`);guideAudio.current=clip;
  clip.onplaying=()=>{if(run===guideRun.current)setGuideSpeaking(true);};
  clip.onended=()=>{if(run!==guideRun.current)return;setGuideSpeaking(false);if(step<guideLines.length-1)playGuide(step+1,run);else{setGuideStep(-1);guideAudio.current=null;setScene(1);setTaps(0);setRevealed(false);}};
  const failed=()=>{if(run===guideRun.current){setGuideSpeaking(false);setGuideError('목소리를 불러오지 못했어요. 아래 버튼으로 이야기를 시작할 수 있어요.');}};
  clip.onerror=failed;void clip.play().catch(failed);
 }
 useEffect(()=>()=>{guideRun.current++;guideAudio.current?.pause();},[]);
 const [practice,setPractice]=useState<number|null>(null);const origin=useRef<string>('');
 function openWord(index:number,button:HTMLButtonElement){stop();origin.current=button.getAttribute('aria-label')||button.textContent||'';setPractice(index);window.scrollTo({top:0,behavior:"instant"});}
 function returnToStory(){setPractice(null);requestAnimationFrame(()=>{const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('button'));buttons.find(b=>(b.getAttribute('aria-label')||b.textContent)===origin.current)?.focus();});}
 const [scene,setScene]=useState(0);const [ready,setReady]=useState(false);const [taps,setTaps]=useState(0);const [revealed,setRevealed]=useState(false);const [sentence,setSentence]=useState('');const [ink,setInk]=useState<Stroke[]>([]);const [busy,setBusy]=useState(false);const [savedError,setSavedError]=useState('');const [motion,setMotion]=useState(true);const {speak,stop,speaking,speechError}=useSpeech();const s=scenes[scene];
 useEffect(()=>{let live=true;getAdventure().then(d=>{if(!live)return;if(d){if(Number.isInteger(d.scene)&&d.scene>=0&&d.scene<scenes.length)setScene(d.scene);if(typeof d.sentence==='string')setSentence(d.sentence.slice(0,500));if(Array.isArray(d.ink))setInk(d.ink);if(d.missionOpen===true&&d.scene===8)setMissionOpen(true);}if(matchMedia('(prefers-reduced-motion: reduce)').matches)setMotion(false);setReady(true);}).catch(()=>{if(live){setSavedError('이 기기에서 이전 이야기를 불러오지 못했어요.');setReady(true);}});return()=>{live=false;};},[getAdventure]);
 useEffect(()=>{if(!ready)return;putAdventure({scene,sentence,ink,missionOpen}).then(()=>setSavedError('')).catch(()=>setSavedError('저장 공간을 확인해주세요. 이번 이야기가 기기에 남지 않을 수 있어요.'));},[ready,scene,sentence,ink,missionOpen,putAdventure]);
 function next(){if(busy)return;stopGuide();window.scrollTo({top:0,behavior:"instant"});stop();setTaps(0);setRevealed(false);setScene(n=>Math.min(n+1,8));speak(scenes[Math.min(scene+1,8)].en);}
 function interact(){if(busy||revealed)return;const count=taps+1;setTaps(count);if(scene===2&&count<3){speak('Up!');return;}if(scene===3&&count<3){speak('Knock!');return;}setRevealed(true);speak(({1:'A tree house!',2:'We are here!',3:'Come in!',4:'A jungle!',5:'No. I painted it.',6:'I like this little house.'} as Record<number,string>)[scene]||s.en);}
 if(!ready)return <div className={styles.loading}>나무집으로 가는 길을 찾고 있어요…</div>;
 if(practice!==null)return <Player startWord={practice} onReturn={returnToStory} storyLine={s.en}/>;
 if(missionOpen)return <FinalMission motion={motion} onMotion={()=>setMotion(!motion)} onReturn={()=>{setMissionOpen(false);requestAnimationFrame(()=>document.querySelector<HTMLButtonElement>('[data-final-mission]')?.focus());}} onReviewWord={openWord}/>;
 return <main className={`${styles.adventure} ${motion?'':styles.still}`}>
  <header className={styles.top}><Link href="/learn" onClick={e=>{if(busy)e.preventDefault();else stopGuide();}}><Icon name="back" size={19}/> 나의 모험</Link><span>My Tree House <b>{scene+1} / {scenes.length}</b></span><button onClick={()=>setMotion(!motion)} aria-pressed={motion}>{motion?'움직임 켜짐':'움직임 꺼짐'}</button></header>
  <div className={styles.progress} aria-label={`이야기 ${scene+1} / ${scenes.length}`}><div style={{width:`${(scene+1)/scenes.length*100}%`}}/></div>
  <section className={styles.theater} aria-labelledby="scene-title">
   <div className={`${styles.stage} ${scene===3?styles.atDoor:''} ${revealed?styles.revealed:''}`}>
    {scene===0?<LearningWorld speaking={guideSpeaking} motion={motion}/>:s.art<0?<Image className={styles.landscape} src="/learning/tree-house/dream-world-v2.png" alt="빛나는 섬 위, 푸른 문과 사다리가 있는 나무집" fill priority sizes="100vw"/>:<div className={styles.storyArt}><Image src="/learning/tree-house/story-3d-v2.png" alt={['아빠가 바비를 도와 사다리를 올라요','할아버지와 함께 정글 그림을 발견해요','아이들과 할아버지가 책을 읽어요'][s.art]} width={2172} height={724} loading="eager" style={{width:'300%',height:'auto',top:'50%',transform:'translateY(-50%)',maxWidth:'none',left:`${-s.art*100}%`,position:'absolute'}}/></div>}
    <div className={styles.sunlight}/>{[0,1,2,3,4].map(i=><span key={i} className={styles.leaf} style={{left:`${12+i*19}%`,animationDelay:`${-i*2}s`}} aria-hidden="true"><Icon name="leaf" size={18+i*3}/></span>)}
    <div className={`${styles.sceneTitle} ${scene===0?styles.welcomeTitle:''}`}><span>{scene===0?'드림이와 오늘의 모험':`CHAPTER ${String(scene).padStart(2,'0')}`}</span><h1 id="scene-title">{scene===0?'My Tree House':s.title}</h1></div>
    {scene===1&&<button className={styles.findHouse} onClick={interact} disabled={revealed} aria-label="나무 위 집 찾기">{revealed?'tree + house':null}<Icon name={revealed?'check':'home'}/></button>}
    {scene===2&&<div className={styles.climb}><div className={styles.steps}>{[0,1,2].map(i=><span key={i} className={taps>i?styles.stepDone:''}>—</span>)}</div><button className={styles.storyAction} onClick={interact} disabled={revealed}>{revealed?'모두 올라왔어요!':`한 칸 올라가기 ${taps}/3`}<Icon name="arrow"/></button></div>}
    {scene===3&&<div className={styles.doorFrame}><button className={`${styles.door} ${revealed?styles.openDoor:''} ${taps?styles.knocked:''}`} key={taps} onClick={interact} disabled={revealed} aria-label={`문 두드리기 ${Math.min(taps,3)} / 3`}><span>똑똑!</span><i/></button>{revealed&&<span className={styles.welcomeInside}>Come in!</span>}</div>}
    {scene===4&&<div className={styles.windowFrame}><WordArt index={6} label="창문 너머 정글 그림"/><button className={`${styles.shutters} ${revealed?styles.openShutters:''}`} onClick={interact} disabled={revealed} aria-label="창문 열기"><span/><span/><b>창문을 열어봐요</b></button></div>}
    {scene===5&&<button className={`${styles.paintbrush} ${revealed?styles.paintRevealed:''}`} onClick={interact} disabled={revealed} aria-label="할아버지의 그림 붓 확인"><Icon name="pen" size={30}/>{revealed?'할아버지가 그린 그림이었어요!':'할아버지의 붓을 톡!'}</button>}
    {scene===6&&<button className={`${styles.book} ${revealed?styles.openBook:''}`} onClick={interact} disabled={revealed} aria-label="이야기 책 펼치기"><span className={styles.bookPage}>My<br/>Tree House<Icon name="leaf" size={40}/></span><span className={styles.bookCover}><Icon name="book" size={48}/><b>책을 펼쳐봐요</b></span></button>}
    {revealed&&scene>0&&scene<7&&<span className={styles.discovery} role="status">{['','나무 위의 집을 찾았어요!','아빠와 함께 안전하게 도착!','할아버지가 문을 열어주셨어요!','와! 원숭이가 있는 정글이네요!','그림 속에서 정글을 여행할 수 있겠네요.','포근한 나무집에 이야기가 펼쳐져요.'][scene]}</span>}
   </div>
   {scene>0&&<div className={styles.coach}><LearningWorld compact speaking={speaking} motion={motion}/></div>}
   <div className={`${styles.dialogue} ${scene===0?styles.welcomeDialogue:''}`}>
    {scene===0?<><div className={styles.dialogueTop}><span>드림이</span><button aria-label={guideSpeaking?'드림이 안내 멈추기':'드림이 안내 듣기'} onClick={()=>guideSpeaking?stopGuide():playGuide(0)}><Icon name={guideSpeaking?'stop':'sound'} size={21}/></button></div><p className={styles.guideLine} aria-live="polite">{guideStep>=0?guideLines[guideStep]:'나무 위에 작은 집이 있대! 나랑 함께 가볼래?'}</p><div className={styles.missionPath} aria-label="오늘의 학습 순서"><span>이야기</span><i>›</i><span>듣고 말하기</span><i>›</i><span>단어 놀이</span><i>›</i><span>미션</span></div>{guideError&&<p role="alert" className={styles.hint}>{guideError}</p>}</>:<><div className={styles.dialogueTop}><span>{s.speaker}</span><button onClick={()=>speaking?stop():speak(s.en)} disabled={busy} aria-label={speaking?'대사 멈추기':'대사 듣기'}><Icon name={speaking?'stop':'sound'} size={21}/></button></div><p className={styles.english}>{s.en.split(/(\b(?:tree|house|climb|ladder|knock|door|jungle|window)\b)/gi).map((part,i)=>{const index=data.words.findIndex(w=>w.word===part.toLowerCase());return index<0?<span key={i}>{part}</span>:<button className={styles.wordLink} disabled={busy} key={i} onClick={e=>openWord(index,e.currentTarget)} aria-label={`${part} 단어로 놀기`}>{part}</button>;})}</p><p className={styles.korean}>{s.ko}</p></>}
    {scene>0&&scene<8&&<div className={styles.wordTrail}><div>{([[0,1],[0,1],[2,3],[4,5],[7,6],[6,7],[1,7],[0,1,2,3,4,5,6,7]][scene]).map(i=><button key={i} disabled={busy} onClick={e=>openWord(i,e.currentTarget)}><WordArt index={i} label=""/><b>{data.words[i].word}</b><Icon name="arrow" size={16}/></button>)}</div></div>}
    {scene===7&&<div className={styles.creation}><label htmlFor="story-note">할아버지에게 남기는 나의 한 문장</label><input id="story-note" placeholder="My tree house has a window." maxLength={500} value={sentence} onChange={e=>setSentence(e.target.value)}/><InkPad value={ink} onChange={setInk} label="나무집 추억"/><Recorder recordingKey="adventure-farewell" text={sentence||s.en} onBusy={setBusy}/></div>}
    {(scene===0||revealed||scene>=7)&&<button className={styles.continue} data-final-mission={scene===8?'true':undefined} disabled={busy} onClick={scene===0&&guideStep<0?()=>playGuide(0):scene===8?()=>{stop();setMissionOpen(true);window.scrollTo({top:0,behavior:'instant'});}:next}>{scene===0?(guideStep<0?'드림이와 시작':'이야기 바로 시작'):scene===7?s.action:scene===8?s.action:'이야기 계속하기'}<Icon name="arrow"/></button>}
    {scene>0&&scene<7&&!revealed&&<p className={styles.hint}>{s.action}{scene===3?' · 세 번 똑똑똑!':''}</p>}
   </div>
  </section>
  {(speechError||savedError)&&<p className={styles.error} role="alert">{speechError||savedError}</p>}
  <footer className={styles.bottom}><span>{scene+1} / {scenes.length} · 나무집의 하루</span><Link href={learningHref('/learn/tree-house/practice')} onClick={e=>{if(busy)e.preventDefault();}}>이야기 속 단어 다시 만나기 <Icon name="book" size={15}/></Link></footer>
 </main>;
}
