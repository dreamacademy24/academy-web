'use client';
import {useEffect,useState} from 'react';
import DailyReports from './DailyReports';
import IssueBoard from './IssueBoard';
import './workspace.css';
type View='daily'|'write'|'issues';
const readView=():View=>{const v=window.location.hash.slice(1);return v==='write'||v==='issues'?v:'daily'};
export default function Page(){
 const [view,setView]=useState<View>('daily');
 useEffect(()=>{setView(readView());const sync=()=>setView(readView());window.addEventListener('popstate',sync);window.addEventListener('hashchange',sync);return()=>{window.removeEventListener('popstate',sync);window.removeEventListener('hashchange',sync)}},[]);
 const go=(next:View)=>{if(next===view)return;window.history.pushState(null,'','#'+next);setView(next);window.scrollTo({top:0,behavior:'smooth'})};
 return <div className="house-workspace"><header className="house-heading"><span>DREAM HOUSE</span><h1>드림하우스 보고</h1><p>오늘의 점검부터 문제 해결과 확인까지, 한곳에서 이어서 기록해요.</p></header><nav className="house-nav" aria-label="하우스 보고 메뉴">{([['daily','일일보고 확인'],['write','보고 작성'],['issues','하우스 문제 관리']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={view===key} onClick={()=>go(key)}>{label}</button>)}</nav>{view!=='daily'&&<button className="house-return" onClick={()=>go('daily')}>← 일일보고로 돌아가기</button>}<div hidden={view==='issues'}><DailyReports active={view!=='issues'} mode={view==='write'?'write':'view'} onModeChange={m=>go(m==='write'?'write':'daily')} onIssues={()=>go('issues')}/></div><div hidden={view!=='issues'}><IssueBoard active={view==='issues'} onDaily={()=>go('daily')}/></div></div>
}
