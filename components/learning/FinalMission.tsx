'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import data from '@/lib/learning/tree-house.json';
import { useLearningStorage } from './LearningContext';
import Dreamy from './Dreamy';
export { default as Dreamy } from './Dreamy';
import { initialMission, restoreMission, reduceMission, pictureRounds, matchWords, spellWords, type MissionAction } from '@/lib/learning/final-mission';
import { Icon, WordArt, useSpeech } from './Tools';
import Matching from './Matching';
import styles from './FinalMission.module.css';

const chapters = [
  { name: '숲길', title: '나무집을 찾아가요.', line: 'Look! A tree. A house.', help: '소리를 듣고, 드림이가 찾는 그림을 톡 눌러줘요.' },
  { name: '나무집', title: '나무집 친구들을 이어줘요.', line: 'A ladder. A door. A window.', help: '단어를 먼저 누르고, 어울리는 그림을 찾아줘요.' },
  { name: '추억책', title: '추억책의 이름을 완성해요.', line: 'My tree house!', help: '글자를 톡톡 누르거나, 키보드로 직접 써도 좋아요.' },
];

export default function FinalMission({ motion, onMotion, onReturn, onReviewWord }: {
  motion: boolean; onMotion: () => void; onReturn: () => void;
  onReviewWord: (index: number, button: HTMLButtonElement) => void;
}) {
  const {getFinalMission,putFinalMission}=useLearningStorage();
  const [state, setState] = useState(initialMission);
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [answer, setAnswer] = useState('');
  const [used, setUsed] = useState<number[]>([]);
  const [assisted, setAssisted] = useState(false);
  const [hint, setHint] = useState(false);
  const [feedback, setFeedback] = useState('');
  const title = useRef<HTMLHeadingElement>(null);
  const { speak, stop, speechError } = useSpeech();

  useEffect(() => {
    let live = true;
    getFinalMission().then(value => { if (live) { setState(restoreMission(value)); setReady(true); } })
      .catch(() => { if (live) { setSaveError('이 기기에 미션을 저장할 수 없어요. 지금은 계속 놀 수 있어요.'); setReady(true); } });
    return () => { live = false; };
  }, [getFinalMission]);
  useEffect(() => {
    if (!ready) return;
    let live = true;
    putFinalMission(state).then(() => { if (live) setSaveError(''); })
      .catch(() => { if (live) setSaveError('미션을 저장하지 못했어요. 창을 닫으면 이번 진행이 남지 않을 수 있어요.'); });
    return () => { live = false; };
  }, [ready, state, putFinalMission]);
  useEffect(() => { if (ready) title.current?.focus({ preventScroll: true }); }, [ready, state.checkpoint, state.round]);

  const done = state.checkpoint === 3;
  const chapter = chapters[Math.min(state.checkpoint, 2)];
  const picture = pictureRounds[state.round] ?? pictureRounds[0];
  const spellIndex = spellWords[state.round] ?? spellWords[0];
  const spell = data.words[spellIndex].word;
  const tiles = spell === 'tree' ? ['e', 't', 'e', 'r'] : ['u', 'e', 'h', 's', 'o'];
  const progress = done ? 3 : state.checkpoint;
  const send = (action: MissionAction) => setState(current => reduceMission(current, action));
  function advance() {
    stop(); send({ type: 'next' }); setAnswer(''); setUsed([]); setAssisted(false); setHint(false); setFeedback('');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  function choosePicture(word: number) {
    if (state.solved) return;
    const correct = word === picture.word;
    send({ type: 'picture', word });
    setFeedback(correct ? '찾았어! 드림이와 한 걸음 더 가볼까?' : '괜찮아. 다시 듣고 그림을 천천히 살펴보자.');
    speak(data.words[picture.word].word);
  }
  function checkSpelling() {
    if (state.solved || !answer.trim()) return;
    const correct = answer.trim().toLowerCase() === spell;
    send({ type: 'spell', answer, assisted });
    setFeedback(correct ? '완성했어! 추억책에 우리 단어가 생겼어.' : '조금 달라. 한 글자씩 다시 살펴보자.');
    speak(spell);
  }

  if (!ready) return <main className={styles.loading}>드림이가 추억책을 가져오고 있어요…</main>;
  return <main className={`${styles.mission} ${motion ? '' : styles.still}`}>
    <header className={styles.top}>
      <button onClick={() => { stop(); onReturn(); }}><Icon name="back" size={18}/> 이야기로 돌아가기</button>
      <span>MY TREE HOUSE</span>
      <button onClick={onMotion} aria-pressed={motion}>{motion ? '움직임 켜짐' : '움직임 꺼짐'}</button>
    </header>
    <div className={styles.layout}>
      <aside className={styles.world} aria-label={`드림이의 여행 · 미션 ${progress} / 3 완료`}>
        <Image src="/learning/tree-house/scene.webp" alt="오늘 함께 놀았던 나무집" fill sizes="(max-width: 800px) 100vw, 420px" priority/>
        <div className={styles.worldShade}/>
        <div className={styles.worldTitle}><span>DREAMY’S LITTLE ADVENTURE</span><h2>우리의<br/>나무집 추억책</h2></div>
        <div className={styles.trail}>
          {chapters.map((item, i) => <div key={item.name} className={i < progress ? styles.lit : ''} aria-current={!done && i === state.checkpoint ? 'step' : undefined}><span>{i < progress ? <Icon name="check" size={18}/> : i + 1}</span><b>{item.name}</b></div>)}
          <div className={styles.traveler} style={{ '--position': Math.min(progress, 2) } as CSSProperties}><Dreamy happy={done || state.solved} live motion={motion}/></div>
        </div>
        <div className={styles.worldNote}><Icon name={done ? 'star' : 'book'} size={18}/>{done ? '우리의 첫 모험, 완성!' : '세 개의 잎을 모아 추억책을 열어요.'}</div>
      </aside>

      <section className={styles.card} aria-labelledby="mission-title">
        <div className={styles.guide}><div className={styles.avatar}><Dreamy happy={state.solved}/></div><p><b>드림이</b>{done ? '끝까지 함께해줘서 고마워!' : state.checkpoint === 0 ? '안녕! 오늘 만난 친구들을 추억책에 담자.' : state.checkpoint === 1 ? '나무집에 도착했어! 친구들의 짝을 찾아주자.' : '마지막 한 걸음! 우리 나무집의 이름을 써보자.'}</p></div>
        <div className={styles.heading}>
          <span>{done ? 'ADVENTURE COMPLETE' : `MISSION ${String(state.checkpoint + 1).padStart(2, '0')} · ${state.checkpoint === 1 ? '3 PAIRS' : `${state.round + 1} / 2`}`}</span>
          <h1 id="mission-title" tabIndex={-1} ref={title}>{done ? '우리의 추억책이 열렸어요!' : chapter.title}</h1>
          {!done && <p>{chapter.help}</p>}
        </div>

        {state.checkpoint === 0 && <div className={styles.pictureGame}>
          <button className={styles.listen} onClick={() => speak(data.words[picture.word].word)} aria-label="미션 단어 듣기"><Icon name="sound" size={25}/><strong>{data.words[picture.word].word}</strong><small>천천히 듣기</small></button>
          <div className={styles.pictures}>{picture.choices.map((id, i) => <button key={id} disabled={state.solved} aria-label={`미션 그림 ${i + 1}`} className={state.solved && id === picture.word ? styles.found : ''} onClick={() => choosePicture(id)}><WordArt index={id} label={`선택 그림 ${i + 1}`}/><span>{state.solved && id === picture.word ? <Icon name="check" size={18}/> : i + 1}</span></button>)}</div>
        </div>}

        {state.checkpoint === 1 && <div className={styles.matchGame}><Matching index={3} wordIds={[...matchWords]} initialMatched={state.matched} showHeading={false} onComplete={() => speak('We did it!')} onMatch={word => send({ type: 'match', word })} onMistake={word => send({ type: 'mistake', word })}/></div>}

        {state.checkpoint === 2 && <div className={styles.spellGame}>
          <div className={styles.spellPrompt}><WordArt index={spellIndex} label="추억책에 넣을 그림"/><button className={styles.listen} onClick={() => speak(spell)} aria-label="미션 단어 듣기"><Icon name="sound"/><span>천천히 듣기</span></button></div>
          <form onSubmit={event => { event.preventDefault(); checkSpelling(); }}>
            <label htmlFor="mission-spelling">들리는 단어를 완성해요.</label>
            <input id="mission-spelling" aria-describedby="mission-feedback" value={state.solved ? spell : answer} disabled={state.solved} maxLength={12} autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} inputMode="text" placeholder={Array.from(spell, () => '·').join(' ')} onChange={event => { setAnswer(event.target.value); setUsed([]); setFeedback(''); }}/>
            <div className={styles.tiles}>{tiles.map((letter, i) => <button type="button" key={i} disabled={state.solved || used.includes(i) || answer.length >= spell.length} aria-label={`${letter} 글자 넣기 ${i + 1}`} onClick={() => { setAnswer(value => value + letter); setUsed(value => [...value, i]); setAssisted(true); setFeedback(''); }}>{letter}</button>)}</div>
            <div className={styles.spellTools}><button type="button" disabled={state.solved || !answer} onClick={() => { setAnswer(''); setUsed([]); setFeedback(''); }}>글자 비우기</button><button type="button" disabled={state.solved} aria-expanded={hint} onClick={() => { setHint(value => !value); setAssisted(true); speak(spell); }}>{hint ? '도움 닫기' : '글자 도움'}</button></div>
            {hint && !state.solved && <p className={styles.hint}>천천히 보고 써봐요. <b>{spell}</b></p>}
            {!state.solved && <button className={styles.primary} disabled={!answer.trim()} type="submit">완성했어요 <Icon name="check" size={18}/></button>}
          </form>
        </div>}

        {!done && <><p id="mission-feedback" className={`${styles.feedback} ${state.solved ? styles.correct : ''}`} role="status">{state.solved ? feedback || '잘했어! 함께 다음으로 가보자.' : feedback || '서두르지 않아도 괜찮아. 함께 해보자.'}</p>{state.solved && <button className={styles.primary} onClick={advance}>{state.checkpoint === 2 && state.round === 1 ? '추억책 열기' : state.checkpoint !== 1 && state.round === 0 ? '한 걸음 더' : '다음 미션으로'}<Icon name="arrow" size={18}/></button>}</>}

        {done && <div className={styles.complete}>
          <div className={styles.memoryBook}><div><Icon name="leaf" size={36}/><strong>My<br/>Tree House</strong><span>드림이와 나의 첫 모험</span></div><div><Dreamy happy/><b>We did it!</b></div></div>
          <div className={styles.badges}>{['그림 발견 · 2 / 2', '짝 맞추기 · 3 / 3', '글자 완성 · 2 / 2'].map(label => <span key={label}><Icon name="leaf" size={18}/>{label}</span>)}</div>
          <button className={styles.endingLine} onClick={() => speak('My tree house! We did it!')}><Icon name="sound"/> My tree house! We did it!</button>
          {state.supportedWords.length > 0 && <p className={styles.supportNote}>글자 도움으로 완성한 단어: {state.supportedWords.map(i => data.words[i].word).join(', ')}</p>}
          {state.reviewWords.length > 0 && <div className={styles.review}><h2>한 번 더 만나면 더 반가운 친구들</h2><div>{state.reviewWords.map(i => <button key={i} onClick={event => { stop(); onReviewWord(i, event.currentTarget); }} aria-label={`${data.words[i].word} 다시 연습하기`}><WordArt index={i} label=""/><b>{data.words[i].word}</b><Icon name="arrow" size={16}/></button>)}</div></div>}
          <div className={styles.finishActions}><Link className={styles.primary} href="/learn" onClick={stop}>이야기 서재로 <Icon name="book" size={18}/></Link><button onClick={() => { stop(); send({ type: 'restart' }); setAnswer(''); setUsed([]); setHint(false); setAssisted(false); setFeedback(''); window.scrollTo({ top: 0, behavior: 'instant' }); }}>미션 다시 놀기</button></div>
        </div>}
        {(speechError || saveError) && <p className={styles.error} role="alert">{speechError}{speechError && saveError && ' '}{saveError}</p>}
        <p className={styles.storage}>미션 기록은 지금 사용하는 기기에 저장돼요.</p>
      </section>
    </div>
  </main>;
}
