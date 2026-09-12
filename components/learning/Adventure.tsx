'use client';
import Image from 'next/image';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {Icon,InkPad,Recorder,WordArt,useSpeech} from './Tools';
import {getAdventure,putAdventure,type Stroke} from '@/lib/learning/storage';
import styles from './Adventure.module.css';

const scenes=[
 {title:'나무집 창문 너머에는?',speaker:'오늘의 이야기',en:'My Tree House',ko:'바비와 미아가 할아버지의 나무집에 놀러 왔어요. 우리도 함께 가볼까요?',action:'이야기 속으로',art:-1},
 {title:'저 위에 집이 있어!',speaker:'Mia · 미아',en:'Look! A house in a tree!',ko:'커다란 나무 위에 작은 집이 있네요. 할아버지는 어디 계실까요?',action:'집을 찾아봐요',art:-1},
 {title:'한 칸씩, 천천히.',speaker:'Dad · 아빠',en:'Let’s climb the ladder. I will help you.',ko:'아빠가 도와주신대요. 사다리를 한 칸씩 눌러 함께 올라가요.',action:'사다리를 올라가요',art:0},
 {title:'안에 누구 계세요?',speaker:'Bobby · 바비',en:'Knock, knock! Grandpa?',ko:'문을 똑똑 두드려 우리가 왔다고 알려줄까요?',action:'문을 두드려요',art:-1},
 {title:'창문 너머의 비밀',speaker:'Grandpa · 할아버지',en:'Come in! Look out the window.',ko:'어서 오렴! 할아버지가 창문을 가리켰어요. 창문을 열어볼까요?',action:'창문을 열어요',art:1},
 {title:'진짜 정글일까?',speaker:'Mia · 미아',en:'A jungle! Is it real?',ko:'초록 잎과 재미있는 원숭이들! 그런데… 할아버지 손에 무엇이 있을까요?',action:'비밀을 찾아봐요',art:1},
 {title:'함께 읽으면 더 즐거워.',speaker:'Grandpa · 할아버지',en:'No. I painted it. Come and read with me.',ko:'정글은 할아버지가 그린 그림이었어요! 이제 옆에 앉아 책을 펼쳐봐요.',action:'책을 펼쳐요',art:2},
 {title:'내 나무집 이야기도 남겨요.',speaker:'Bobby · 바비',en:'I like this little house.',ko:'바비처럼 나무집 이야기를 말하거나 그려보세요. 오늘의 추억이 될 거예요.',action:'이야기 간직하기',art:2},
 {title:'또 놀러 올게요, 할아버지!',speaker:'이야기의 끝',en:'Goodbye, Grandpa!',ko:'책을 제자리에 놓았어요. 아빠와 함께 한 사람씩 천천히 사다리를 내려가요.',action:'다시 놀러 가기',art:-1},
];
export default function Adventure(){
 const [scene,setScene]=useState(0);const [ready,setReady]=useState(false);const [taps,setTaps]=useState(0);const [revealed,setRevealed]=useState(false);const [sentence,setSentence]=useState('');const [ink,setInk]=useState<Stroke[]>([]);const [busy,setBusy]=useState(false);const [savedError,setSavedError]=useState('');const [motion,setMotion]=useState(true);const {speak,stop,speaking,speechError}=useSpeech();const s=scenes[scene];
 useEffect(()=>{let live=true;getAdventure().then(d=>{if(!live)return;if(d){if(Number.isInteger(d.scene)&&d.scene>=0&&d.scene<scenes.length)setScene(d.scene);if(typeof d.sentence==='string')setSentence(d.sentence.slice(0,500));if(Array.isArray(d.ink))setInk(d.ink);}if(matchMedia('(prefers-reduced-motion: reduce)').matches)setMotion(false);setReady(true);}).catch(()=>{if(live){setSavedError('이 기기에서 이전 이야기를 불러오지 못했어요.');setReady(true);}});return()=>{live=false;};},[]);
 useEffect(()=>{if(!ready)return;putAdventure({scene,sentence,ink}).then(()=>setSavedError('')).catch(()=>setSavedError('저장 공간을 확인해주세요. 이번 이야기가 기기에 남지 않을 수 있어요.'));},[ready,scene,sentence,ink]);
 function next(){if(busy)return;window.scrollTo({top:0,behavior:"instant"});stop();setTaps(0);setRevealed(false);setScene(n=>Math.min(n+1,8));speak(scenes[Math.min(scene+1,8)].en);}
 function interact(){if(busy||revealed)return;const count=taps+1;setTaps(count);if(scene===2&&count<3){speak('Up!');return;}if(scene===3&&count<3){speak('Knock!');return;}setRevealed(true);speak(({1:'A tree house!',2:'We are here!',3:'Come in!',4:'A jungle!',5:'No. I painted it.',6:'I like this little house.'} as Record<number,string>)[scene]||s.en);}
 if(!ready)return <div className={styles.loading}>나무집으로 가는 길을 찾고 있어요…</div>;
 return <main className={`${styles.adventure} ${motion?'':styles.still}`}>
  <header className={styles.top}><Link href="/learn" onClick={e=>{if(busy)e.preventDefault();}}><Icon name="back" size={19}/> 이야기 서재</Link><span>DREAM STORY <b>01</b></span><button onClick={()=>setMotion(!motion)} aria-pressed={motion}>{motion?'움직임 켜짐':'움직임 꺼짐'}</button></header>
  <div className={styles.progress} aria-label={`이야기 ${scene+1} / ${scenes.length}`}><div style={{width:`${(scene+1)/scenes.length*100}%`}}/></div>
  <section className={styles.theater} key={scene} aria-labelledby="scene-title">
   <div className={`${styles.stage} ${scene===3?styles.atDoor:''} ${revealed?styles.revealed:''}`}>
    {s.art<0?<Image className={styles.landscape} src="/learning/tree-house/scene.webp" alt="푸른 나무 위 빨간 지붕의 작은 집" fill priority sizes="100vw"/>:<div className={styles.storyArt}><Image src="/learning/tree-house/story.webp" alt={['아빠가 바비를 도와 사다리를 올라요','할아버지와 함께 정글 그림을 발견해요','아이들과 할아버지가 책을 읽어요'][s.art]} width={2172} height={724} loading="eager" style={{width:'300%',height:'auto',top:'50%',transform:'translateY(-50%)',maxWidth:'none',left:`${-s.art*100}%`,position:'absolute'}}/></div>}
    <div className={styles.sunlight}/>{[0,1,2,3,4].map(i=><span key={i} className={styles.leaf} style={{left:`${12+i*19}%`,animationDelay:`${-i*2}s`}} aria-hidden="true"><Icon name="leaf" size={18+i*3}/></span>)}
    <div className={styles.sceneTitle}><span>{scene===0?'AN INTERACTIVE STORY':`CHAPTER ${String(scene).padStart(2,'0')}`}</span><h1 id="scene-title">{s.title}</h1></div>
    {scene===1&&<button className={styles.findHouse} onClick={interact} disabled={revealed} aria-label="나무 위 집 찾기">{revealed?'tree + house':null}<Icon name={revealed?'check':'home'}/></button>}
    {scene===2&&<div className={styles.climb}><div className={styles.steps}>{[0,1,2].map(i=><span key={i} className={taps>i?styles.stepDone:''}>—</span>)}</div><button className={styles.storyAction} onClick={interact} disabled={revealed}>{revealed?'모두 올라왔어요!':`한 칸 올라가기 ${taps}/3`}<Icon name="arrow"/></button></div>}
    {scene===3&&<div className={styles.doorFrame}><button className={`${styles.door} ${revealed?styles.openDoor:''} ${taps?styles.knocked:''}`} key={taps} onClick={interact} disabled={revealed} aria-label={`문 두드리기 ${Math.min(taps,3)} / 3`}><span>똑똑!</span><i/></button>{revealed&&<span className={styles.welcomeInside}>Come in!</span>}</div>}
    {scene===4&&<div className={styles.windowFrame}><WordArt index={6} label="창문 너머 정글 그림"/><button className={`${styles.shutters} ${revealed?styles.openShutters:''}`} onClick={interact} disabled={revealed} aria-label="창문 열기"><span/><span/><b>창문을 열어봐요</b></button></div>}
    {scene===5&&<button className={`${styles.paintbrush} ${revealed?styles.paintRevealed:''}`} onClick={interact} disabled={revealed} aria-label="할아버지의 그림 붓 확인"><Icon name="pen" size={30}/>{revealed?'할아버지가 그린 그림이었어요!':'할아버지의 붓을 톡!'}</button>}
    {scene===6&&<button className={`${styles.book} ${revealed?styles.openBook:''}`} onClick={interact} disabled={revealed} aria-label="이야기 책 펼치기"><span className={styles.bookPage}>My<br/>Tree House<Icon name="leaf" size={40}/></span><span className={styles.bookCover}><Icon name="book" size={48}/><b>책을 펼쳐봐요</b></span></button>}
    {revealed&&scene>0&&scene<7&&<span className={styles.discovery} role="status">{['','나무 위의 집을 찾았어요!','아빠와 함께 안전하게 도착!','할아버지가 문을 열어주셨어요!','와! 원숭이가 있는 정글이네요!','그림 속에서 정글을 여행할 수 있겠네요.','포근한 나무집에 이야기가 펼쳐져요.'][scene]}</span>}
   </div>
   <div className={styles.dialogue}><div className={styles.dialogueTop}><span>{s.speaker}</span><button onClick={()=>speaking?stop():speak(s.en)} disabled={busy} aria-label={speaking?'대사 멈추기':'대사 듣기'}><Icon name={speaking?'stop':'sound'} size={21}/></button></div><p className={styles.english}>{s.en}</p><p className={styles.korean}>{s.ko}</p>
    {scene===7&&<div className={styles.creation}><label htmlFor="story-note">할아버지에게 남기는 나의 한 문장</label><input id="story-note" placeholder="My tree house has a window." maxLength={500} value={sentence} onChange={e=>setSentence(e.target.value)}/><InkPad value={ink} onChange={setInk} label="나무집 추억"/><Recorder recordingKey="adventure-farewell" text={sentence||s.en} onBusy={setBusy}/></div>}
    {(scene===0||revealed||scene>=7)&&<button className={styles.continue} disabled={busy} onClick={scene===8?()=>{stop();setScene(0);setRevealed(false);setTaps(0);}:next}>{scene===0?s.action:scene===7?s.action:scene===8?s.action:'이야기 계속하기'}<Icon name="arrow"/></button>}
    {scene>0&&scene<7&&!revealed&&<p className={styles.hint}>{s.action}{scene===3?' · 세 번 똑똑똑!':''}</p>}
   </div>
  </section>
  {(speechError||savedError)&&<p className={styles.error} role="alert">{speechError||savedError}</p>}
  <footer className={styles.bottom}><span>{scene+1} / {scenes.length} · 나무집의 하루</span><Link href="/learn/tree-house/practice" onClick={e=>{if(busy)e.preventDefault();}}>이야기 속 단어 다시 만나기 <Icon name="book" size={15}/></Link></footer>
  {scene===8&&<div className={styles.ending}><h2>오늘은 우리가 이야기의 친구였어요.</h2><p>나무집을 찾고, 문을 두드리고, 할아버지의 비밀을 알아냈어요.</p><Link href="/learn">이야기 서재로 돌아가기</Link></div>}
 </main>;
}
