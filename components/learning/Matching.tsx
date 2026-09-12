'use client';
import {useState} from 'react';
import data from '@/lib/learning/tree-house.json';
import {WordArt,useSpeech} from './Tools';

export default function Matching({index,onComplete}:{index:number;onComplete:()=>void}){
 const ids=[index,(index+1)%8,(index+3)%8];
 const [selected,setSelected]=useState<number|null>(null);
 const [matched,setMatched]=useState<number[]>([]);
 const [message,setMessage]=useState('단어를 누르고, 어울리는 그림을 찾아주세요.');
 const {speak,speechError}=useSpeech();
 function choose(id:number){
  if(selected===null){setMessage('먼저 단어를 하나 골라주세요.');return;}
  if(selected!==id){setMessage('아직 짝이 아니에요. 소리와 그림을 다시 살펴봐요.');return;}
  const next=[...matched,id];setMatched(next);setSelected(null);speak(data.words[id].word);
  setMessage(next.length===3?'세 쌍 모두 찾았어요! 나무집의 친구들이 모였네요.':'짝을 찾았어요! 다른 친구도 만나볼까요?');
  if(next.length===3)onComplete();
 }
 return <div className="game-area"><span className="eyebrow">TREE HOUSE · MATCH</span><h2>이야기 속 친구를 이어줘요.</h2><p>단어와 그림, 세 쌍을 찾아봐요.</p><div className="story-match"><div>{ids.map(id=><button key={id} disabled={matched.includes(id)} aria-pressed={selected===id} onClick={()=>{setSelected(id);speak(data.words[id].word);}}>{matched.includes(id)?'✓ ':''}{data.words[id].word}</button>)}</div><div>{[ids[2],ids[0],ids[1]].map((id,n)=><button key={id} disabled={matched.includes(id)} aria-label={`짝 맞추기 그림 ${n+1}`} onClick={()=>choose(id)}><WordArt index={id} label={`선택 그림 ${n+1}`}/>{matched.includes(id)&&<span>✓</span>}</button>)}</div></div><p role="status">{message}</p><small>{matched.length} / 3</small>{speechError&&<p role="alert">{speechError}</p>}</div>;
}
