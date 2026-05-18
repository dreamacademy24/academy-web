'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface FormState {
  q1: string; q2: string; q6: string;
}

const SIM_PLANS = ["2GB / 3일 / ₱75","6GB / 7일 / ₱149","24GB / 30일 / ₱499","36GB / 30일 / ₱599","48GB / 30일 / ₱699"];

export default function PortalCheckinDetailPage() {
  const router = useRouter();
  const [bookingId, setBookingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [form, setForm] = useState<FormState>({ q1:'', q2:'', q6:'' });
  const [bedConfig, setBedConfig] = useState({room1:"",room2:"",room3:"더블베드 1개 (1~2인 스테이)"});
  const [simCards, setSimCards] = useState<{plan:string}[]>([]);
  const [extraPickups, setExtraPickups] = useState<{type:string;date:string;airline:string;flight:string;time:string}[]>([]);
  const [flightForm, setFlightForm] = useState({
    flight_in_airline:"", flight_in_no:"", flight_in_date:"", flight_in_time:"", flight_in_origin:"", flight_in_undecided:false,
    flight_out_airline:"", flight_out_no:"", flight_out_date:"", flight_out_time:"", flight_out_destination:"", flight_out_undecided:false,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const raw = localStorage.getItem('portalSession');
    if (!raw) { router.replace('/portal'); return; }
    const session = JSON.parse(raw);
    if (!session.booking_id || Date.now() > session.expires) {
      router.replace('/portal'); return;
    }
    const bid = session.booking_id;
    setBookingId(bid);

    fetch(`/api/checkin-portal?bookingId=${bid}`)
      .then(r => r.json())
      .then(d => {
        const det = d.detail || {};
        if (det.submitted_at) setAlreadySubmitted(true);
        if (det.submitted_at || det.booker_name) {
          setForm({
            q1: det.booker_name || '',
            q2: det.guest_names_en || '',
            q6: det.extra_requests || '',
          });
          try {
            const b = JSON.parse(det.bed_setting || "{}");
            if (b.room1 || b.room2) setBedConfig({room1:b.room1||"", room2:b.room2||"", room3:b.room3||"더블베드 1개 (1~2인 스테이)"});
          } catch {}
          try {
            const s = JSON.parse(det.usim_request || "[]");
            if (Array.isArray(s)) setSimCards(s);
          } catch {}
          try {
            const ep = JSON.parse(det.extra_pickups || "[]");
            if (Array.isArray(ep)) setExtraPickups(ep);
          } catch {}
          setFlightForm({
            flight_in_airline: det.flight_in_airline || "",
            flight_in_no: det.flight_in_no || "",
            flight_in_date: (det.flight_in_date || "").split("T")[0] || "",
            flight_in_time: det.flight_in_time || "",
            flight_in_origin: det.flight_in_origin || "",
            flight_in_undecided: !!det.flight_in_undecided,
            flight_out_airline: det.flight_out_airline || "",
            flight_out_no: det.flight_out_no || "",
            flight_out_date: (det.flight_out_date || "").split("T")[0] || "",
            flight_out_time: det.flight_out_time || "",
            flight_out_destination: det.flight_out_destination || "",
            flight_out_undecided: !!det.flight_out_undecided,
          });
        }
        setLoading(false);
      })
      .catch(() => { setError('불러오기 실패'); setLoading(false); });
  }, [router]);

  function up<K extends keyof FormState>(k: K, v: string) {
    setForm(prev => ({ ...prev, [k]: v }));
  }

  async function submit() {
    if (!form.q1.trim()) { alert('1번 문항(예약자 성함과 입실 일자)을 입력해주세요.'); return; }
    setSubmitting(true);
    const res = await fetch('/api/checkin-portal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        booker_name: form.q1,
        guest_names_en: form.q2,
        bed_setting: JSON.stringify(bedConfig),
        usim_request: JSON.stringify(simCards),
        extra_pickups: JSON.stringify(extraPickups),
        extra_requests: form.q6,
        ...flightForm,
      }),
    });
    setSubmitting(false);
    if (!res.ok) { const j = await res.json().catch(()=>({})); alert('제출 실패: ' + (j.error||'')); return; }
    setDone(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (<>
    <style>{`
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Noto Sans KR',sans-serif;background:#f7f9fc;color:#1a1a2e;line-height:1.6}
      .cf-w{max-width:680px;margin:0 auto;padding:32px 20px 60px}
      .cf-h{text-align:center;padding:20px 0 28px;border-bottom:2px solid #e2e8f0;margin-bottom:24px}
      .cf-h .brand{font-size:14px;font-weight:700;color:#1a6fc4;letter-spacing:.05em;margin-bottom:4px}
      .cf-h h1{font-size:22px;font-weight:800;color:#1a1a2e;line-height:1.4}
      .cf-h .desc{font-size:13px;color:#6b7c93;margin-top:8px}
      .q{background:#fff;border-radius:14px;padding:20px;box-shadow:0 2px 10px rgba(0,0,0,0.04);margin-bottom:14px;border:1px solid #e2e8f0}
      .q-num{display:inline-block;background:#1a6fc4;color:#fff;width:24px;height:24px;border-radius:50%;text-align:center;font-size:13px;font-weight:800;line-height:24px;margin-right:8px}
      .q-title{font-size:15px;font-weight:700;color:#1a1a2e;margin-bottom:6px}
      .q-hint{font-size:12px;color:#6b7c93;margin-bottom:10px;line-height:1.5}
      .q-hint b{color:#1a6fc4}
      .fi{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff}
      .fi:focus{border-color:#1a6fc4}
      .ta{width:100%;padding:11px 14px;border:1px solid #e2e8f0;border-radius:10px;font-size:14px;font-family:inherit;outline:none;background:#fff;resize:vertical;min-height:100px}
      .ta:focus{border-color:#1a6fc4}
      .btn-submit{display:block;width:100%;padding:16px;background:#1a6fc4;color:#fff;font-size:16px;font-weight:800;border:none;border-radius:12px;cursor:pointer;font-family:inherit;margin-top:20px;box-shadow:0 4px 14px rgba(26,111,196,0.25)}
      .btn-submit:hover{background:#0d3d7a}.btn-submit:disabled{background:#94a3b8;cursor:not-allowed}
      .notice{padding:32px;text-align:center;background:#fff;border-radius:14px;box-shadow:0 2px 10px rgba(0,0,0,0.05);font-size:15px;color:#475569;line-height:1.7}
      .notice.ok{color:#166534;background:#f0fdf4;border:1px solid #bbf7d0}
      .notice.err{color:#dc2626;background:#fef2f2;border:1px solid #fecaca}
      .edit-btn{display:block;margin:14px auto 0;padding:10px 24px;background:none;border:1px solid #1a6fc4;color:#1a6fc4;border-radius:8px;cursor:pointer;font-size:14px;font-weight:600}
    `}</style>
    <div className="cf-w">
      <button onClick={() => router.back()} style={{background:'none',border:'none',color:'#6b7280',cursor:'pointer',marginBottom:16,fontSize:13}}>← 마이페이지로</button>
      <div className="cf-h">
        <div className="brand">DREAM ACADEMY · DREAM HOUSE</div>
        <h1>드림하우스 체크인 사전 정보</h1>
        <div className="desc">아래 6가지 정보를 입력해 주세요. 입실 준비에 활용됩니다.</div>
      </div>

      {loading && <div className="notice">로딩 중...</div>}
      {!loading && error && <div className="notice err">{error}</div>}
      {!loading && done && <div className="notice ok">제출 완료! 감사합니다 🙏<br/>곧 세부에서 만나요 ^^</div>}
      {!loading && !error && alreadySubmitted && !done && (
        <div>
          <div className="notice ok">✅ 이미 제출하셨습니다. 아래에서 내용을 수정할 수 있습니다.</div>
        </div>
      )}

      {!loading && !error && !done && (
        <>
          {alreadySubmitted && <div style={{height:12}}/>}
          <div className="q">
            <div className="q-title"><span className="q-num">1</span>예약자 대표 성함과 입실 일자</div>
            <div className="q-hint">예: <b>홍길동, 2026년 5월 9일</b></div>
            <input className="fi" value={form.q1} onChange={e=>up('q1',e.target.value)} placeholder="홍길동, 2026년 5월 9일"/>
          </div>
          <div className="q">
            <div className="q-title"><span className="q-num">2</span>투숙자 전체인원 영문이름</div>
            <div className="q-hint">예: <b>kim ooo / yoo ooo ooo</b> (가족 전원의 영문이름)</div>
            <p style={{fontSize:12,color:"#888",marginBottom:6}}>※ 이전에 작성하신 경우 다시 작성하지 않아도 됩니다.</p>
            <input className="fi" value={form.q2} onChange={e=>up('q2',e.target.value)} placeholder="kim ooo / yoo ooo ooo"/>
          </div>

          {/* ① 베드 세팅 */}
          <div className="q">
            <div className="q-title"><span className="q-num">3</span>원하시는 베드 세팅</div>
            <div className="q-hint">보통 <b>2~3인: 마스터룸 베드2개</b> / <b>4인 이상: 마스터룸 베드2개 + 작은방 베드1개</b></div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{border:"1px solid #e0e4ef",borderRadius:10,padding:"12px 16px"}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:10,color:"#334"}}>룸 1 — 마스터룸 (큰방)</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["더블베드 1개 (2인 스테이)","더블베드 2개 (3~4인 스테이)"].map(opt=>(
                    <button key={opt} type="button"
                      onClick={()=>setBedConfig(p=>({...p,room1:opt}))}
                      style={{padding:"8px 16px",borderRadius:20,border:"2px solid",fontSize:13,cursor:"pointer",
                        borderColor:bedConfig.room1===opt?"#4f6ef7":"#dde3f0",
                        background:bedConfig.room1===opt?"#4f6ef7":"#fff",
                        color:bedConfig.room1===opt?"#fff":"#556"}}>{opt}</button>
                  ))}
                </div>
              </div>
              <div style={{border:"1px solid #e0e4ef",borderRadius:10,padding:"12px 16px"}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:10,color:"#334"}}>룸 2 — 2층방 (작은방)</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["더블베드 1개 (2인 스테이)","더블베드+싱글 (3인 스테이)","사용하지 않음"].map(opt=>(
                    <button key={opt} type="button"
                      onClick={()=>setBedConfig(p=>({...p,room2:opt}))}
                      style={{padding:"8px 16px",borderRadius:20,border:"2px solid",fontSize:13,cursor:"pointer",
                        borderColor:bedConfig.room2===opt?"#4f6ef7":"#dde3f0",
                        background:bedConfig.room2===opt?"#4f6ef7":"#fff",
                        color:bedConfig.room2===opt?"#fff":"#556"}}>{opt}</button>
                  ))}
                </div>
              </div>
              <div style={{border:"1px solid #e0e4ef",borderRadius:10,padding:"12px 16px"}}>
                <div style={{fontWeight:700,fontSize:14,marginBottom:10,color:"#334"}}>룸 3 — 1층방</div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  {["더블베드 1개 (1~2인 스테이)","사용하지 않음"].map(opt=>(
                    <button key={opt} type="button"
                      onClick={()=>setBedConfig(p=>({...p,room3:opt}))}
                      style={{padding:"8px 16px",borderRadius:20,border:"2px solid",fontSize:13,cursor:"pointer",
                        borderColor:bedConfig.room3===opt?"#4f6ef7":"#dde3f0",
                        background:bedConfig.room3===opt?"#4f6ef7":"#fff",
                        color:bedConfig.room3===opt?"#fff":"#556"}}>{opt}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ② 유심 대여 */}
          <div className="q">
            <div className="q-title"><span className="q-num">4</span>유심 대여 신청</div>
            <div className="q-hint">필요하신 유심 수량과 요금제를 선택해 주세요. (필요 없으시면 비워두세요)</div>
            <div style={{background:'#f8f9fa',border:'1px solid #e2e8f0',borderRadius:8,padding:16,marginBottom:12,fontSize:12.5,lineHeight:1.7,color:'#374151'}}>
              <div style={{fontWeight:800,fontSize:14,marginBottom:8,color:'#1a1a2e'}}>📱 유심 대여 서비스</div>
              <div style={{fontWeight:700,color:'#1a6fc4',marginTop:6,marginBottom:4}}>#기본 안내</div>
              <ul style={{paddingLeft:18,margin:0}}>
                <li>제공 요금제 → <b>Smart 올데이터+ 요금제</b></li>
                <li>통신사 관계 없이 <b>무제한 통화</b></li>
                <li>이용 가능 요금제 기간: <b>3일 / 7일 / 30일</b></li>
              </ul>
              <div style={{fontWeight:700,marginTop:10,marginBottom:4,color:'#1a1a2e'}}>요금</div>
              <ul style={{paddingLeft:18,margin:0}}>
                <li>2GB / 3일 → <b>₱75</b></li>
                <li>6GB / 7일 → <b>₱149</b></li>
                <li>24GB / 30일 → <b>₱499</b></li>
                <li>36GB / 30일 → <b>₱599</b></li>
                <li>48GB / 30일 → <b>₱699</b></li>
              </ul>
              <div style={{marginTop:10,padding:'8px 10px',background:'#fef3c7',border:'1px solid #fde68a',borderRadius:6,fontSize:12,color:'#92400e',fontWeight:600}}>
                ⚠️ 유심 반납 안내: 퇴실 시 반드시 반납해 주세요.
              </div>
            </div>
            <div style={{marginTop:12}}>
              <div style={{background:"#fff8e1",borderRadius:8,padding:"8px 14px",fontSize:13,color:"#856404",marginBottom:10}}>
                💡 유심 비용은 보증금에서 차감됩니다. 퇴실 시 반드시 반납해 주세요.
              </div>
              {simCards.map((sim,i)=>(
                <div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
                  <span style={{fontSize:13,color:"#667",minWidth:52,fontWeight:600}}>유심 {i+1}</span>
                  <select value={sim.plan}
                    onChange={e=>setSimCards(prev=>{const n=[...prev];n[i]={plan:e.target.value};return n;})}
                    style={{flex:1,padding:"8px 12px",borderRadius:8,border:"1.5px solid #dde3f0",fontSize:14}}>
                    <option value="">— 요금제 선택 —</option>
                    {SIM_PLANS.map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                  <button type="button"
                    onClick={()=>setSimCards(prev=>prev.filter((_,j)=>j!==i))}
                    style={{padding:"6px 12px",borderRadius:8,border:"1px solid #fcc",background:"#fff5f5",color:"#e53",fontSize:13,cursor:"pointer"}}>
                    삭제
                  </button>
                </div>
              ))}
              {simCards.length<6 && (
                <button type="button"
                  onClick={()=>setSimCards(prev=>[...prev,{plan:""}])}
                  style={{width:"100%",padding:"10px",borderRadius:8,border:"2px dashed #4f6ef7",background:"#f5f7ff",color:"#4f6ef7",fontSize:14,cursor:"pointer",marginTop:4}}>
                  + 유심 추가 (최대 6개)
                </button>
              )}
            </div>
          </div>

          {/* ③ 추가 픽드랍 */}
          <div className="q">
            <div className="q-title"><span className="q-num">5</span>항공편</div>
            <div className="q-hint">입국·출국 항공편 정보를 입력해 주세요. 미정인 경우 체크박스를 선택해 주세요.</div>
            {([
              ['in','🛬 입국편','출발지','인천','flight_in'] as const,
              ['out','🛫 출국편','도착지','인천','flight_out'] as const,
            ]).map(([key,label,placeLabel,placeholder,prefix]) => {
              const und = (flightForm as any)[prefix+'_undecided'] as boolean;
              const get = (suffix:string) => (flightForm as any)[prefix+'_'+suffix] as string;
              const set = (suffix:string, v:string|boolean) => setFlightForm(p=>({...p,[prefix+'_'+suffix]:v}));
              return (
                <div key={key} style={{border:"1px solid #e0e4ef",borderRadius:10,padding:14,marginBottom:10,background:"#fafafe"}}>
                  <div style={{fontWeight:700,fontSize:14,marginBottom:8,color:"#334"}}>{label}</div>
                  <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,marginBottom:10}}>
                    <input type="checkbox" checked={und} onChange={e=>set('undecided',e.target.checked)}/>
                    미정(추후 입력)
                  </label>
                  <fieldset disabled={und} style={{border:"none",padding:0,margin:0,opacity:und?0.4:1}}>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                      <div>
                        <div style={{fontSize:11,color:"#889",marginBottom:3}}>항공사</div>
                        <input type="text" value={get('airline')} onChange={e=>set('airline',e.target.value)} placeholder="예: 대한항공"
                          style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                      </div>
                      <div>
                        <div style={{fontSize:11,color:"#889",marginBottom:3}}>편명</div>
                        <input type="text" value={get('no')} onChange={e=>set('no',e.target.value)} placeholder={key==='in'?'예: KE601':'예: KE602'}
                          style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                      </div>
                      <div>
                        <div style={{fontSize:11,color:"#889",marginBottom:3}}>날짜</div>
                        <input type="date" value={get('date')} onChange={e=>set('date',e.target.value)}
                          style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                      </div>
                      <div>
                        <div style={{fontSize:11,color:"#889",marginBottom:3}}>시간</div>
                        <input type="time" value={get('time')} onChange={e=>set('time',e.target.value)}
                          style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                      </div>
                      <div style={{gridColumn:"1/3"}}>
                        <div style={{fontSize:11,color:"#889",marginBottom:3}}>{placeLabel}</div>
                        <input type="text" value={get(key==='in'?'origin':'destination')} onChange={e=>set(key==='in'?'origin':'destination',e.target.value)} placeholder={placeholder}
                          style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                      </div>
                    </div>
                  </fieldset>
                </div>
              );
            })}
          </div>

          <div className="q">
            <div className="q-title"><span className="q-num">6</span>추가 픽드랍 신청</div>
            <div className="q-hint">기본 픽업/드랍 외 추가 필요 시 작성해 주세요. (선택)</div>
            <div>
              {extraPickups.map((ep,i)=>(
                <div key={i} style={{border:"1px solid #e0e4ef",borderRadius:10,padding:12,marginBottom:10,background:"#fafafe"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                    <div style={{display:"flex",gap:6}}>
                      {["픽업","드랍"].map(t=>(
                        <button key={t} type="button"
                          onClick={()=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],type:t};return n;})}
                          style={{padding:"6px 14px",borderRadius:18,border:"2px solid",fontSize:13,cursor:"pointer",
                            borderColor:ep.type===t?"#4f6ef7":"#dde3f0",
                            background:ep.type===t?"#4f6ef7":"#fff",
                            color:ep.type===t?"#fff":"#556"}}>{t}</button>
                      ))}
                    </div>
                    <button type="button" onClick={()=>setExtraPickups(prev=>prev.filter((_,j)=>j!==i))}
                      style={{fontSize:12,color:"#e53",background:"none",border:"none",cursor:"pointer"}}>✕ 삭제</button>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
                    <div>
                      <div style={{fontSize:11,color:"#889",marginBottom:3}}>날짜</div>
                      <input type="date" value={ep.date}
                        onChange={e=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],date:e.target.value};return n;})}
                        style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:"#889",marginBottom:3}}>시간</div>
                      <input type="time" value={ep.time}
                        onChange={e=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],time:e.target.value};return n;})}
                        style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:"#889",marginBottom:3}}>항공사</div>
                      <input type="text" value={ep.airline} placeholder="예: 대한항공"
                        onChange={e=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],airline:e.target.value};return n;})}
                        style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                    </div>
                    <div>
                      <div style={{fontSize:11,color:"#889",marginBottom:3}}>편명</div>
                      <input type="text" value={ep.flight} placeholder="예: KE601"
                        onChange={e=>setExtraPickups(prev=>{const n=[...prev];n[i]={...n[i],flight:e.target.value};return n;})}
                        style={{width:"100%",padding:"6px 10px",borderRadius:6,border:"1px solid #dde",fontSize:13}}/>
                    </div>
                  </div>
                </div>
              ))}
              <button type="button" onClick={()=>setExtraPickups(prev=>[...prev,{type:"픽업",date:"",airline:"",flight:"",time:""}])}
                style={{width:"100%",padding:"10px",borderRadius:8,border:"2px dashed #4f6ef7",background:"#f5f7ff",color:"#4f6ef7",fontSize:14,cursor:"pointer"}}>
                + 픽드랍 추가
              </button>
            </div>
          </div>
          <div className="q">
            <div className="q-title"><span className="q-num">7</span>기타 요청사항</div>
            <div className="q-hint">추가 픽드랍, 알러지 등 자유롭게 작성해 주세요. (선택)</div>
            <textarea className="ta" value={form.q6} onChange={e=>up('q6',e.target.value)} placeholder="자유롭게 작성"/>
          </div>
          <button className="btn-submit" onClick={submit} disabled={submitting}>
            {submitting ? '제출 중...' : alreadySubmitted ? '수정 내용 저장하기' : '제출하기'}
          </button>
        </>
      )}
    </div>
  </>);
}
