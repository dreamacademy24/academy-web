'use client';
import {useState} from 'react';
import DailyReports from './DailyReports';
import IssueBoard from './IssueBoard';
export default function Page(){const [daily,setDaily]=useState(false);return daily?<><div style={{padding:16}}><button onClick={()=>setDaily(false)}>← 미해결 문제 관리</button></div><DailyReports/></>:<IssueBoard onDaily={()=>setDaily(true)}/>;}
