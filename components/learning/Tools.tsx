'use client';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getRecording, putRecording, type Recording, type Stroke } from '@/lib/learning/storage';

export function Icon({ name, size = 22 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    sound: <><path d="M11 4 5 9H2v6h3l6 5V4Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/></>,
    mic: <><rect x="8" y="2" width="8" height="13" rx="4"/><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3m-4 0h8"/></>,
    arrow: <path d="m9 5 7 7-7 7M3 12h13"/>, back: <path d="m14 5-7 7 7 7M7 12h14"/>,
    check: <path d="m5 12 4 4L19 6"/>, home: <><path d="m3 10 9-7 9 7v11H3V10Z"/><path d="M9 21v-8h6v8"/></>,
    book: <><path d="M12 5C8 2 4 3 2 4v16c3-2 7-2 10 0 3-2 7-2 10 0V4c-2-1-6-2-10 1v15"/></>,
    pen: <><path d="m4 16-1 5 5-1L21 7l-6-6L4 16Z"/><path d="m12 4 6 6M4 16l4 4"/></>,
    star: <path d="m12 2 3 6 7 1-5 5 1 8-6-4-6 4 1-8-5-5 7-1 3-6Z"/>,
    leaf: <><path d="M20 3C9 1 2 8 5 16s15 4 15-13Z"/><path d="M3 22 15 9"/></>,
    stop: <rect x="5" y="5" width="14" height="14" rx="3"/>,
    undo: <><path d="m8 3-5 5 5 5M3 8h10a7 7 0 0 1 0 14"/></>,
    download: <><path d="M12 2v13m-5-5 5 5 5-5M4 17v5h16v-5"/></>,
    info: <><circle cx="12" cy="12" r="10"/><path d="M12 10v7M12 6v1"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.star}</svg>;
}

export function WordArt({ index, label, className = '' }: { index: number; label: string; className?: string }) {
  return <div className={`word-art ${className}`} role="img" aria-label={label}><Image src="/learning/tree-house/words.webp" alt="" loading="eager" width={1774} height={887} sizes="(max-width: 700px) 1000px, 1400px" style={{ width: '400%', maxWidth: 'none', height: '200%', position: 'absolute', left: `${-(index % 4) * 100}%`, top: `${-Math.floor(index / 4) * 100}%` }} /></div>;
}

export function useSpeech() {
  const [speaking, setSpeaking] = useState(false); const [speechError, setError] = useState('');
  const generation = useRef(0);
  const stop = useCallback(() => { generation.current++; if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setSpeaking(false); }, []);
  useEffect(() => { const pause = () => { if (document.hidden) stop(); }; document.addEventListener('visibilitychange', pause); return () => { generation.current++; if ('speechSynthesis' in window) speechSynthesis.cancel(); document.removeEventListener('visibilitychange', pause); }; }, [stop]);
  function speak(text: string) {
    if (!('speechSynthesis' in window)) { setError('이 브라우저에서는 소리를 들려줄 수 없어요. 선생님과 함께 읽어주세요.'); return; }
    window.speechSynthesis.cancel(); const id = ++generation.current;
    const u = new SpeechSynthesisUtterance(text); u.lang = 'en-US'; u.rate = .82;
    const voices = speechSynthesis.getVoices(); const voice = voices.find(v => /en-US/i.test(v.lang) && /Google|Samantha|Aria/i.test(v.name)) || voices.find(v => /^en/i.test(v.lang));
    if (voice) u.voice = voice;
    setError(''); setSpeaking(true);
    u.onend = () => { if (generation.current === id) setSpeaking(false); };
    u.onerror = e => { if (generation.current === id) { setSpeaking(false); if (e.error !== 'canceled' && e.error !== 'interrupted') setError('기기의 영어 음성을 재생하지 못했어요. 소리 설정을 확인해주세요.'); } };
    speechSynthesis.speak(u);
  }
  return { speak, stop, speaking, speechError };
}

export function InkPad({ value, onChange, label = '내 글씨', guide = '' }: { value: Stroke[]; onChange: (value: Stroke[]) => void; label?: string; guide?: string }) {
  const svg = useRef<SVGSVGElement>(null); const active = useRef<Stroke>([]); const pointer = useRef<number | null>(null); const [live, setLive] = useState<Stroke>([]); const [showGuide, setGuide] = useState(false);
  function finish() { if (active.current.length) onChange([...value, active.current].slice(-100)); active.current = []; pointer.current = null; setLive([]); }
  function point(e: React.PointerEvent<SVGSVGElement>) { const r = e.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(640, (e.clientX-r.left)/r.width*640)), y: Math.max(0, Math.min(240,(e.clientY-r.top)/r.height*240)) }; }
  const draw = (stroke: Stroke) => stroke.map((p,i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') + (stroke.length === 1 ? ' l.1,.1' : '');
  return <div className="ink-tool"><div className="ink-top"><span><Icon name="pen" size={17}/> 손가락이나 펜으로 써보세요</span>{guide && <button className="text-button" onClick={() => setGuide(!showGuide)}>{showGuide ? '보기 숨기기' : '따라 쓸 글자 보기'}</button>}</div>
    <svg ref={svg} className="ink-canvas" viewBox="0 0 640 240" role="img" aria-label={`${label} 손글씨 쓰기판`} onPointerDown={e => { if (pointer.current !== null) return; e.preventDefault(); pointer.current=e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); active.current=[point(e)];setLive([...active.current]); }} onPointerMove={e => { if (pointer.current!==e.pointerId) return; const p=point(e); const last=active.current.at(-1); if (last && Math.hypot(last.x-p.x,last.y-p.y)<1.3) return; if(active.current.length>=2000) return; active.current.push(p); setLive([...active.current]); }} onPointerUp={e => { if(pointer.current===e.pointerId)finish(); }} onPointerCancel={finish} onLostPointerCapture={() => { if(pointer.current!==null)finish(); }}>
      {[70,140,210].map(y => <line key={y} x1="20" y1={y} x2="620" y2={y} stroke="#dce3e8" strokeDasharray={y===140?'5 7':undefined}/>)}
      {showGuide && <text x="320" y="168" textAnchor="middle" fill="#dce5e2" fontSize="115" fontFamily="Arial">{guide}</text>}
      {[...value,live].map((s,i)=><path key={i} d={draw(s)} fill="none" stroke="#263f51" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round"/>)}
    </svg><div className="ink-bottom"><span>{value.length ? '글씨를 쓰면 기기에 자동 저장돼요.' : '내가 쓰는 글씨가 그대로 남아요.'}</span><button className="small-button" disabled={!value.length} onClick={() => onChange(value.slice(0,-1))}><Icon name="undo" size={16}/> 한 획 지우기</button><button className="small-button" disabled={!value.length} onClick={() => { if(confirm('이 쓰기판의 글씨를 모두 지울까요?'))onChange([]); }}>모두 지우기</button></div></div>;
}

export function Recorder({ recordingKey, text, onSaved, onBusy }: { recordingKey: string; text: string; onSaved?: () => void; onBusy?: (busy: boolean) => void }) {
  const [status,setStatus]=useState<'idle'|'permission'|'recording'|'saving'>('idle'); const [seconds,setSeconds]=useState(0); const [record,setRecord]=useState<Recording>(); const [url,setUrl]=useState(''); const [error,setError]=useState('');
  const rec=useRef<MediaRecorder|null>(null); const stream=useRef<MediaStream|null>(null); const timer=useRef<ReturnType<typeof setInterval>|null>(null); const alive=useRef(true); const epoch=useRef(0); const startTime=useRef(0); const interrupted=useRef(false); const cb=useRef({onSaved,onBusy});
  useEffect(()=>{cb.current={onSaved,onBusy};},[onSaved,onBusy]);
  const stop=useCallback(()=>{ if(timer.current)clearInterval(timer.current);timer.current=null;if(rec.current?.state==='recording')rec.current.stop();stream.current?.getTracks().forEach(t=>t.stop()); },[]);
  useEffect(()=>{alive.current=true;getRecording(recordingKey).then(r=>{if(alive.current)setRecord(r);}).catch(()=>{if(alive.current)setError('기기 저장을 열지 못했어요. 녹음 파일 저장 기능을 사용할 수 없어요.');});
    const hidden=()=>{if(document.hidden){epoch.current++;interrupted.current=true;if(!rec.current||rec.current.state==='inactive'){setStatus('idle');cb.current.onBusy?.(false);}stop();}};document.addEventListener('visibilitychange',hidden);
    return()=>{alive.current=false;epoch.current++;stop();cb.current.onBusy?.(false);document.removeEventListener('visibilitychange',hidden);};},[recordingKey,stop]);
  useEffect(()=>{if(!record)return;const src=URL.createObjectURL(record.blob);setUrl(src);return()=>URL.revokeObjectURL(src);},[record]);
  async function start(){
    if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){setError('이 브라우저는 녹음을 지원하지 않아요. Chrome 또는 Safari에서 열어주세요.');return;}
    setError('');setStatus('permission');cb.current.onBusy?.(true);const ticket=++epoch.current;
    try{
      const s=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true}});
      if(!alive.current||ticket!==epoch.current){s.getTracks().forEach(t=>t.stop());return;}
      if ('speechSynthesis' in window) speechSynthesis.cancel();stream.current=s;interrupted.current=false;
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));const r=new MediaRecorder(s,mime?{mimeType:mime}:undefined);rec.current=r;const chunks:Blob[]=[];
      r.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      let failed=false;
      r.onerror=()=>{failed=true;if(alive.current)setError('녹음이 중단됐어요. 마이크를 확인하고 다시 시도해주세요.');stop();};
      r.onstop=async()=>{if(timer.current)clearInterval(timer.current);timer.current=null;s.getTracks().forEach(t=>t.stop());const duration=Math.round((Date.now()-startTime.current)/1000);const blob=new Blob(chunks,{type:r.mimeType||chunks[0]?.type||'audio/webm'});
        if(alive.current)setStatus('saving');
        try{if(failed)throw new Error('녹음이 중단되어 저장하지 못했어요. 다시 녹음해주세요.');if(blob.size<100||duration<1)throw new Error('조금 더 길게 말한 뒤 정지해주세요.');const saved={blob,text,seconds:duration,savedAt:new Date().toISOString(),interrupted:interrupted.current};await putRecording(recordingKey,saved);if(alive.current){setRecord(saved);cb.current.onSaved?.();}}
        catch(e){if(alive.current)setError(e instanceof Error?e.message:'녹음을 저장하지 못했어요. 저장 공간을 확인해주세요.');}
        finally{if(alive.current){setStatus('idle');cb.current.onBusy?.(false);}}
      };
      startTime.current=Date.now();setSeconds(0);r.start();setStatus('recording');timer.current=setInterval(()=>{const elapsed=Math.floor((Date.now()-startTime.current)/1000);if(alive.current)setSeconds(elapsed);if(elapsed>=30)stop();},250);
    }catch(e){if(ticket!==epoch.current)return;stream.current?.getTracks().forEach(t=>t.stop());if(alive.current){setStatus('idle');cb.current.onBusy?.(false);setError(e instanceof DOMException&&e.name==='NotAllowedError'?'마이크 사용을 허용해주세요. 지금은 건너뛰고 나중에 녹음해도 괜찮아요.':'마이크를 열지 못했어요. 다른 앱이 마이크를 사용 중인지 확인해주세요.');}}
  }
  return <div className="recorder"><div className={`record-orbit ${status==='recording'?'is-recording':''}`}><button className="record-button" aria-label={status==='recording'?'녹음 정지':'녹음 시작'} disabled={status==='permission'||status==='saving'} onClick={status==='recording'?stop:start}><Icon name={status==='recording'?'stop':'mic'} size={34}/></button></div>
    <strong>{status==='recording'?`듣고 있어요 · ${seconds}초`:status==='permission'?'마이크를 준비하고 있어요':status==='saving'?'녹음을 저장하고 있어요':record?'내 목소리, 다시 들어볼까요?':'내 목소리로 말해봐요'}</strong>
    <p>{status==='recording'?'다 말했으면 가운데 버튼을 눌러주세요.':record?'다시 녹음하면 이전 녹음이 바뀌어요.':'버튼을 누르고 편하게 말해보세요. 최대 30초예요.'}</p>
    {error&&<p className="error-message" role="alert">{error}</p>}
    {status==='permission'&&<button className="text-button" onClick={()=>{epoch.current++;setStatus('idle');cb.current.onBusy?.(false);}}>마이크 준비 취소하기</button>}
    {url&&<div className="record-playback"><audio controls src={url} preload="metadata" aria-label="내 녹음 듣기"/><a href={url} download={`${recordingKey.replace(/[^a-z0-9-]/gi,'-')}.${record?.blob.type.includes('mp4')?'m4a':'webm'}`} className="text-button"><Icon name="download" size={16}/> 파일로 저장</a><small>{record?.interrupted?'화면을 나가기 전까지의 녹음이에요. ':'기기에 저장됨 · '}{record?.seconds}초 · 자동 발음 점수는 매기지 않아요.</small></div>}
  </div>;
}
