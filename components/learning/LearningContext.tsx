'use client';

import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {createContext,useContext,useEffect,useMemo,useState,type ReactNode} from 'react';
import {supabase} from '@/lib/supabase';
import {createLearningStorage,DEMO_SCOPE,learningScopeKey,type LearningScope,type LearningStorage} from '@/lib/learning/storage';
import {createLearningRequestFence,matchLearningContext,parseLearningSelection,type LearningSelection} from '@/lib/learning/context';
import styles from './LearningContext.module.css';

const Context = createContext<{scope:LearningScope;storage:LearningStorage}|null>(null);
export function useLearningStorage() {
  const context = useContext(Context);
  if (!context) throw new Error('Learning activities require a verified learning context.');
  return context.storage;
}
export function useLearningHref() {
  const context = useContext(Context);
  if (!context) throw new Error('Learning links require a learning context.');
  return (path: string) => {
    if (context.scope.kind === 'demo') return path;
    const query = new URLSearchParams({learnerId:context.scope.learnerId,visitId:context.scope.visitId});
    return `${path}?${query.toString()}`;
  };
}
function LearningProvider({scope,name,children}:{scope:LearningScope;name:string;children:ReactNode}) {
  const value = useMemo(() => ({scope,storage:createLearningStorage(scope)}),[scope]);
  return <Context.Provider value={value}><div className={styles.session}><div className={styles.bar}><span>{scope.kind==='demo'?'체험 모드 · 이 기기에만 저장':`${name} · My Tree House`}</span><Link href="/learn">{scope.kind==='demo'?'학습 홈':'아이 바꾸기 · 학습 홈'}</Link></div>{children}</div></Context.Provider>;
}
type AccessState = {status:'checking'|'signin'|'invalid'|'error'} | {status:'ready';scope:LearningScope;name:string};
function VerifyLearningSession({selection,children}:{selection:Extract<LearningSelection,{kind:'learner'}>;children:ReactNode}) {
  const [access,setAccess] = useState<AccessState>({status:'checking'});
  const [retry,setRetry] = useState(0);
  useEffect(() => {
    const fence = createLearningRequestFence();
    let mounted = true, controller:AbortController|undefined;
    async function check() {
      const ticket = fence.begin();
      controller?.abort(); controller = new AbortController();
      const signal = controller.signal;
      setAccess({status:'checking'});
      try {
        const {data,error} = await supabase.auth.getSession();
        if (!mounted || !fence.isCurrent(ticket)) return;
        if (error) { setAccess({status:'error'}); return; }
        if (!data.session?.access_token) { setAccess({status:'signin'}); return; }
        const response = await fetch('/api/learning/children',{headers:{Authorization:`Bearer ${data.session.access_token}`},cache:'no-store',signal});
        if (!mounted || !fence.isCurrent(ticket)) return;
        if (response.status===401) { setAccess({status:'signin'}); return; }
        if (!response.ok) { setAccess({status:'error'}); return; }
        const payload:unknown = await response.json();
        if (!mounted || !fence.isCurrent(ticket)) return;
        const verified = matchLearningContext(payload,selection);
        setAccess(verified?{status:'ready',...verified}:{status:'invalid'});
      } catch { if (mounted && fence.isCurrent(ticket) && !signal.aborted) setAccess({status:'error'}); }
    }
    void check();
    const {data:{subscription}} = supabase.auth.onAuthStateChange(event => {
      if (event==='SIGNED_OUT') { fence.cancel();controller?.abort();setAccess({status:'signin'}); }
      else if (event==='SIGNED_IN'||event==='TOKEN_REFRESHED'||event==='USER_UPDATED') {
        fence.cancel();controller?.abort();setAccess({status:'checking'});
        queueMicrotask(() => { if (mounted) void check(); });
      }
    });
    const focus = () => { if (document.visibilityState==='visible') void check(); };
    window.addEventListener('focus',focus);
    return () => { mounted=false;fence.cancel();controller?.abort();subscription.unsubscribe();window.removeEventListener('focus',focus); };
  },[selection,retry]);
  if (access.status==='ready') return <LearningProvider key={learningScopeKey(access.scope)} scope={access.scope} name={access.name}>{children}</LearningProvider>;
  const message = access.status==='checking'?'아이의 학습 정보를 확인하고 있어요…':access.status==='signin'?'보호자 계정으로 로그인한 뒤 학습할 아이를 선택해주세요.':access.status==='invalid'?'이 아이에게 배정된 단원을 다시 선택해주세요.':'학습 정보를 불러오지 못했어요. 다시 확인해주세요.';
  return <main className={styles.state}><h1>학습 준비</h1><p role={access.status==='error'?'alert':'status'}>{message}</p>{access.status==='error'&&<button onClick={()=>setRetry(value=>value+1)}>다시 확인</button>}{access.status==='signin'&&<Link href="/portal?returnTo=%2Flearn">보호자 로그인</Link>}{access.status!=='checking'&&<Link href="/learn">학습 홈에서 아이 선택</Link>}</main>;
}
export default function LearningContextGuard({children,previewOnly=false}:{children:ReactNode;previewOnly?:boolean}) {
  const search = useSearchParams();
  const learnerId = search.get('learnerId'), visitId = search.get('visitId');
  const selection = useMemo(() => parseLearningSelection(learnerId,visitId),[learnerId,visitId]);
  if (previewOnly) return <LearningProvider scope={DEMO_SCOPE} name="직원 체험">{children}</LearningProvider>;
  if (search.getAll('learnerId').length>1 || search.getAll('visitId').length>1 || selection.kind==='invalid') return <main className={styles.state}><h1>학습할 아이를 선택해주세요.</h1><Link href="/learn">학습 홈으로</Link></main>;
  if (selection.kind==='demo') return <LearningProvider scope={DEMO_SCOPE} name="체험">{children}</LearningProvider>;
  return <VerifyLearningSession key={`${selection.learnerId}:${selection.visitId}`} selection={selection}>{children}</VerifyLearningSession>;
}
