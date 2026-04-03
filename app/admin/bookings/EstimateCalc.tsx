"use client";
import { useState, useRef } from "react";
import html2canvas from "html2canvas";

// ── 가격 테이블 (estimate/page.tsx 동일) ──
const DH: Record<string,number>={
  "2-1-1":4390000,"2-1-2":4970000,"2-2-1":4970000,"2-2-2":5550000,"2-3-2":6140000,
  "3-1-1":6400000,"3-1-2":7190000,"3-2-1":7190000,"3-2-2":8010000,"3-3-2":8840000,
  "4-1-1":7950000,"4-1-2":8950000,"4-2-1":8950000,"4-2-2":10010000,"4-3-2":11080000,
  "5-1-1":9930000,"5-1-2":11150000,"5-2-1":11150000,"5-2-2":12460000,"5-3-2":13770000,
  "6-1-1":11920000,"6-1-2":13360000,"6-2-1":13360000,"6-2-2":14910000,"6-3-2":16460000,
  "7-1-1":13910000,"7-1-2":15570000,"7-2-1":15570000,"7-2-2":17360000,"7-3-2":19150000,
  "8-1-1":15910000,"8-1-2":17800000,"8-2-1":17800000,"8-2-2":19830000,"8-3-2":21860000,
  "9-1-1":17890000,"9-1-2":20010000,"9-2-1":20010000,"9-2-2":22280000,"9-3-2":24550000,
  "10-1-1":19870000,"10-1-2":22220000,"10-2-1":22220000,"10-2-2":24740000,"10-3-2":27250000,
  "11-1-1":21860000,"11-1-2":24440000,"11-2-1":24440000,"11-2-2":27190000,"11-3-2":29940000,
  "12-1-1":23840000,"12-1-2":26650000,"12-2-1":26650000,"12-2-2":29640000,"12-3-2":32640000,
};
const JP: Record<string,number>={
  "디럭스-2-1-1":5560000,"디럭스-2-1-2":7040000,"디럭스-2-2-1":6140000,"디럭스-2-1-3":8530000,"디럭스-2-2-2":7630000,
  "프리미어-2-1-1":5700000,"프리미어-2-1-2":7180000,"프리미어-2-2-1":6280000,"프리미어-2-1-3":8670000,"프리미어-2-2-2":7770000,
  "막탄스윗-2-1-1":6260000,"막탄스윗-2-1-2":7740000,"막탄스윗-2-2-1":6840000,"막탄스윗-2-1-3":9230000,"막탄스윗-2-2-2":8330000,
  "디럭스-3-1-1":8180000,"디럭스-3-1-2":10300000,"디럭스-3-2-1":9010000,"디럭스-3-1-3":12410000,"디럭스-3-2-2":11120000,
  "프리미어-3-1-1":8390000,"프리미어-3-1-2":10510000,"프리미어-3-2-1":9220000,"프리미어-3-1-3":12620000,"프리미어-3-2-2":11330000,
  "막탄스윗-3-1-1":9230000,"막탄스윗-3-1-2":11350000,"막탄스윗-3-2-1":10060000,"막탄스윗-3-1-3":13460000,"막탄스윗-3-2-2":12170000,
  "디럭스-4-1-1":10720000,"디럭스-4-1-2":13370000,"디럭스-4-2-1":11780000,"디럭스-4-1-3":16030000,"디럭스-4-2-2":14440000,
  "프리미어-4-1-1":11000000,"프리미어-4-1-2":13650000,"프리미어-4-2-1":12060000,"프리미어-4-1-3":16310000,"프리미어-4-2-2":14720000,
  "막탄스윗-4-1-1":12120000,"막탄스윗-4-1-2":14770000,"막탄스윗-4-2-1":13180000,"막탄스윗-4-1-3":17430000,"막탄스윗-4-2-2":15840000,
  "디럭스-5-1-1":13370000,"디럭스-5-1-2":16680000,"디럭스-5-2-1":14670000,"디럭스-5-1-3":20000000,
  "프리미어-5-1-1":13650000,"프리미어-5-1-2":16960000,"프리미어-5-2-1":14950000,
  "막탄스윗-5-1-1":15050000,"막탄스윗-5-1-2":18360000,"막탄스윗-5-2-1":16350000,
};
const C9: Record<string,number>={
  "디럭스-2-1-1":4630000,"디럭스-2-1-2":5730000,"디럭스-2-2-1":4830000,"디럭스-2-1-3":6830000,"디럭스-2-2-2":5930000,
  "풀억세스룸-2-1-1":5020000,"풀억세스룸-2-1-2":6120000,"풀억세스룸-2-2-1":5220000,"풀억세스룸-2-1-3":7220000,"풀억세스룸-2-2-2":6320000,
  "디럭스-3-1-1":6790000,"디럭스-3-1-2":8330000,"디럭스-3-2-1":7040000,"디럭스-3-1-3":9870000,"디럭스-3-2-2":8580000,
  "풀억세스룸-3-1-1":7380000,"풀억세스룸-3-1-2":8920000,"풀억세스룸-3-2-1":7630000,"풀억세스룸-3-1-3":10460000,"풀억세스룸-3-2-2":9170000,
  "디럭스-4-1-1":8860000,"디럭스-4-1-2":10750000,"디럭스-4-2-1":9160000,"디럭스-4-1-3":12640000,"디럭스-4-2-2":11050000,
  "풀억세스룸-4-1-1":9640000,"풀억세스룸-4-1-2":11530000,"풀억세스룸-4-2-1":9940000,"풀억세스룸-4-1-3":13420000,"풀억세스룸-4-2-2":11830000,
  "디럭스-5-1-1":11050000,"디럭스-5-1-2":13410000,"디럭스-5-2-1":11400000,"디럭스-5-1-3":15770000,"디럭스-5-2-2":13760000,
  "풀억세스룸-5-1-1":12030000,"풀억세스룸-5-1-2":14390000,"풀억세스룸-5-2-1":12380000,"풀억세스룸-5-1-3":16750000,"풀억세스룸-5-2-2":14740000,
  "디럭스-6-1-1":13230000,"디럭스-6-1-2":16060000,"디럭스-6-2-1":13630000,"디럭스-6-1-3":18890000,"디럭스-6-2-2":16460000,
  "풀억세스룸-6-1-1":14410000,"풀억세스룸-6-1-2":17240000,"풀억세스룸-6-2-1":14810000,"풀억세스룸-6-1-3":20070000,
};

type AccomType="dreamhouse"|"jpark"|"cubenine";
const accomLabel:Record<AccomType,string>={dreamhouse:"드림하우스",jpark:"제이파크",cubenine:"큐브나인"};

function getPrice(type:AccomType,roomType:string,weeks:number,parents:number,kids:number):number|null{
  if(type==="dreamhouse") return DH[`${weeks}-${parents}-${kids}`]??null;
  if(type==="jpark") return JP[`${roomType}-${weeks}-${parents}-${kids}`]??null;
  return C9[`${roomType}-${weeks}-${parents}-${kids}`]??null;
}

function won(n:number){return n.toLocaleString("ko-KR")+"원";}

interface ExtraItem{name:string;amount:number;}

interface PlanState{
  parents:number;
  kids:number;
  extras:ExtraItem[];
  discounts:ExtraItem[];
}

const defaultPlan=():PlanState=>({parents:1,kids:2,extras:[],discounts:[]});

export default function EstimateCalc(){
  const resultRef=useRef<HTMLDivElement>(null);

  // 공통
  const [accom,setAccom]=useState<AccomType>("dreamhouse");
  const [roomType,setRoomType]=useState("디럭스");
  const [weeks,setWeeks]=useState(4);

  // 1안 / 2안
  const [p1,setP1]=useState<PlanState>(defaultPlan());
  const [p2,setP2]=useState<PlanState>(defaultPlan());

  function updatePlan(setter:React.Dispatch<React.SetStateAction<PlanState>>,patch:Partial<PlanState>){
    setter(prev=>({...prev,...patch}));
  }

  function addExtra(setter:React.Dispatch<React.SetStateAction<PlanState>>,field:"extras"|"discounts"){
    setter(prev=>({...prev,[field]:[...prev[field],{name:"",amount:0}]}));
  }
  function removeExtra(setter:React.Dispatch<React.SetStateAction<PlanState>>,field:"extras"|"discounts",idx:number){
    setter(prev=>({...prev,[field]:prev[field].filter((_,i)=>i!==idx)}));
  }
  function setExtra(setter:React.Dispatch<React.SetStateAction<PlanState>>,field:"extras"|"discounts",idx:number,patch:Partial<ExtraItem>){
    setter(prev=>({...prev,[field]:prev[field].map((item,i)=>i===idx?{...item,...patch}:item)}));
  }

  // 가격 계산
  function calc(plan:PlanState){
    const base=getPrice(accom,roomType,weeks,plan.parents,plan.kids);
    if(base===null) return null;
    const extraSum=plan.extras.reduce((s,e)=>s+e.amount,0);
    const discountSum=plan.discounts.reduce((s,e)=>s+e.amount,0);
    return {base,extraSum,discountSum,subtotal:base+extraSum,final:base+extraSum-discountSum};
  }

  const r1=calc(p1);
  const r2=calc(p2);

  const accomName=accomLabel[accom]+(accom!=="dreamhouse"?` ${roomType}`:"");
  const today=new Date().toLocaleDateString("ko-KR",{year:"numeric",month:"long",day:"numeric"});

  async function saveImage(){
    const el=resultRef.current;
    if(!el) return;
    const canvas=await html2canvas(el,{scale:2,backgroundColor:"#ffffff",useCORS:true});
    const link=document.createElement("a");
    link.download=`견적서_${accomName}_${weeks}주_${today}.png`;
    link.href=canvas.toDataURL("image/png");
    link.click();
  }

  function renderPlanInputs(plan:PlanState,setter:React.Dispatch<React.SetStateAction<PlanState>>,label:string){
    return(
      <div style={{flex:1,minWidth:280}}>
        <div style={{fontWeight:700,fontSize:14,color:"#1a6fc4",marginBottom:12}}>{label}</div>
        <div style={{display:"flex",gap:8,marginBottom:8}}>
          <label style={{flex:1}}>
            <span style={lbl}>보호자</span>
            <select style={sel} value={plan.parents} onChange={e=>{const v=Number(e.target.value);updatePlan(setter,{parents:v});}}>
              {[1,2,3].map(n=><option key={n} value={n}>{n}명</option>)}
            </select>
          </label>
          <label style={{flex:1}}>
            <span style={lbl}>아이</span>
            <select style={sel} value={plan.kids} onChange={e=>updatePlan(setter,{kids:Number(e.target.value)})}>
              {[1,2,3,4,5].map(n=><option key={n} value={n}>{n}명</option>)}
            </select>
          </label>
        </div>
        <div style={{marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:12,fontWeight:600,color:"#6b7c93"}}>추가항목</span>
            <button style={addBtn} onClick={()=>addExtra(setter,"extras")}>+ 추가</button>
          </div>
          {plan.extras.map((item,i)=>(
            <div key={i} style={{display:"flex",gap:6,marginBottom:4}}>
              <input style={{...inp,flex:1}} placeholder="항목명" value={item.name} onChange={e=>setExtra(setter,"extras",i,{name:e.target.value})}/>
              <input style={{...inp,width:110}} type="number" placeholder="금액" value={item.amount||""} onChange={e=>setExtra(setter,"extras",i,{amount:Number(e.target.value)})}/>
              <button style={delBtn} onClick={()=>removeExtra(setter,"extras",i)}>×</button>
            </div>
          ))}
        </div>
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
            <span style={{fontSize:12,fontWeight:600,color:"#6b7c93"}}>할인항목</span>
            <button style={addBtn} onClick={()=>addExtra(setter,"discounts")}>+ 추가</button>
          </div>
          {plan.discounts.map((item,i)=>(
            <div key={i} style={{display:"flex",gap:6,marginBottom:4}}>
              <input style={{...inp,flex:1}} placeholder="항목명" value={item.name} onChange={e=>setExtra(setter,"discounts",i,{name:e.target.value})}/>
              <input style={{...inp,width:110}} type="number" placeholder="금액" value={item.amount||""} onChange={e=>setExtra(setter,"discounts",i,{amount:Number(e.target.value)})}/>
              <button style={delBtn} onClick={()=>removeExtra(setter,"discounts",i)}>×</button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  function renderPlanResult(plan:PlanState,r:{base:number;extraSum:number;discountSum:number;subtotal:number;final:number}|null,label:string){
    if(!r) return <div style={{flex:1,textAlign:"center",padding:40,color:"#94a3b8",fontSize:13}}>가격 정보 없음</div>;
    return(
      <div style={{flex:1,padding:"0 20px"}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{fontSize:15,fontWeight:700,color:"#1a1a2e",marginBottom:4}}>{label}</div>
          <div style={{fontSize:12,color:"#6b7c93"}}>보호자 {plan.parents}명 + 아이 {plan.kids}명</div>
        </div>

        <div style={{display:"flex",justifyContent:"space-between",padding:"10px 0",fontSize:14}}>
          <span style={{color:"#6b7c93"}}>정가</span>
          <span style={{fontWeight:600}}>{won(r.base)}</span>
        </div>

        {plan.extras.filter(e=>e.name&&e.amount).map((e,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13}}>
            <span style={{color:"#6b7c93"}}>{e.name}</span>
            <span style={{color:"#1a6fc4",fontWeight:600}}>+{won(e.amount)}</span>
          </div>
        ))}

        {(plan.extras.filter(e=>e.name&&e.amount).length>0||plan.discounts.filter(e=>e.name&&e.amount).length>0)&&(
          <div style={{borderTop:"1px solid #e2e8f0",margin:"8px 0"}}/>
        )}

        {plan.discounts.filter(e=>e.name&&e.amount).map((e,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",fontSize:13}}>
            <span style={{color:"#6b7c93"}}>{e.name}</span>
            <span style={{color:"#dc2626",fontWeight:600}}>-{won(e.amount)}</span>
          </div>
        ))}

        <div style={{borderTop:"2px solid #e2e8f0",marginTop:12,paddingTop:12}}>
          {r.discountSum>0&&(
            <div style={{display:"flex",justifyContent:"space-between",padding:"4px 0",fontSize:13}}>
              <span style={{color:"#94a3b8"}}>정가합계</span>
              <span style={{textDecoration:"line-through",color:"#94a3b8"}}>{won(r.subtotal)}</span>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",padding:"8px 0",alignItems:"center"}}>
            <span style={{fontSize:15,fontWeight:800,color:"#1a1a2e"}}>할인가</span>
            <span style={{fontSize:22,fontWeight:800,color:"#1a6fc4"}}>{won(r.final)}</span>
          </div>
        </div>
      </div>
    );
  }

  return(
    <>
      {/* ── 입력 영역 (no-print) ── */}
      <div className="no-print" style={{background:"#fff",borderRadius:14,padding:24,boxShadow:"0 2px 12px rgba(0,0,0,0.06)",marginBottom:20}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:16}}>공통 설정</div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:20}}>
          <label style={{flex:1,minWidth:140}}>
            <span style={lbl}>숙소</span>
            <select style={sel} value={accom} onChange={e=>{const v=e.target.value as AccomType;setAccom(v);if(v==="jpark")setRoomType("디럭스");else if(v==="cubenine")setRoomType("디럭스");else setRoomType("");}}>
              <option value="dreamhouse">드림하우스</option>
              <option value="jpark">제이파크</option>
              <option value="cubenine">큐브나인</option>
            </select>
          </label>
          {accom==="jpark"&&(
            <label style={{flex:1,minWidth:140}}>
              <span style={lbl}>룸타입</span>
              <select style={sel} value={roomType} onChange={e=>setRoomType(e.target.value)}>
                <option value="디럭스">디럭스</option><option value="프리미어">프리미어</option><option value="막탄스윗">막탄스윗</option>
              </select>
            </label>
          )}
          {accom==="cubenine"&&(
            <label style={{flex:1,minWidth:140}}>
              <span style={lbl}>룸타입</span>
              <select style={sel} value={roomType} onChange={e=>setRoomType(e.target.value)}>
                <option value="디럭스">디럭스</option><option value="풀억세스룸">풀억세스룸</option>
              </select>
            </label>
          )}
          <label style={{flex:1,minWidth:100}}>
            <span style={lbl}>기간</span>
            <select style={sel} value={weeks} onChange={e=>setWeeks(Number(e.target.value))}>
              {Array.from({length:11},(_,i)=>i+2).map(w=><option key={w} value={w}>{w}주</option>)}
            </select>
          </label>
        </div>

        <div style={{display:"flex",gap:20,flexWrap:"wrap"}}>
          {renderPlanInputs(p1,setP1,"1안")}
          {renderPlanInputs(p2,setP2,"2안")}
        </div>
      </div>

      {/* ── 출력 영역 (이미지 캡처 대상) ── */}
      <div id="estimate-result" ref={resultRef} style={{background:"#fff",borderRadius:14,padding:32,boxShadow:"0 2px 12px rgba(0,0,0,0.06)"}}>
        {/* 헤더 */}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{fontSize:22,fontWeight:800,color:"#1a6fc4",letterSpacing:"-0.02em",marginBottom:4}}>DREAM ACADEMY</div>
          <div style={{fontSize:11,color:"#94a3b8",letterSpacing:"0.1em",marginBottom:16}}>드림아카데미 견적서</div>
          <div style={{display:"inline-block",background:"#f1f5f9",borderRadius:8,padding:"8px 20px"}}>
            <span style={{fontSize:14,fontWeight:700,color:"#1a1a2e"}}>{accomName}</span>
            <span style={{margin:"0 8px",color:"#d1d5db"}}>|</span>
            <span style={{fontSize:14,fontWeight:600,color:"#6b7c93"}}>{weeks}주</span>
          </div>
        </div>

        {/* 2열 비교 */}
        <div style={{display:"flex",gap:0,minHeight:200}}>
          <div style={{flex:1,borderRight:"1px solid #e2e8f0"}}>
            {renderPlanResult(p1,r1,"1안")}
          </div>
          <div style={{flex:1}}>
            {renderPlanResult(p2,r2,"2안")}
          </div>
        </div>

        {/* 하단 */}
        <div style={{marginTop:24,padding:"16px 20px",background:"#fffbeb",border:"1px solid #fde68a",borderRadius:10,textAlign:"center",fontSize:12,color:"#92400e",lineHeight:1.7}}>
          ※ 정가 기준 견적이며, 할인 적용 시 위 금액으로 안내됩니다.
        </div>
        <div style={{textAlign:"center",marginTop:12,fontSize:11,color:"#94a3b8"}}>발행일: {today}</div>
      </div>

      {/* ── 버튼 (no-print) ── */}
      <div className="no-print" style={{marginTop:16,textAlign:"center"}}>
        <button onClick={saveImage} style={{padding:"12px 32px",background:"#1a6fc4",color:"#fff",fontSize:14,fontWeight:700,border:"none",borderRadius:10,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}>
          이미지 저장
        </button>
      </div>
    </>
  );
}

// ── 인라인 스타일 ──
const lbl:React.CSSProperties={display:"block",fontSize:11,fontWeight:600,color:"#6b7c93",marginBottom:4};
const sel:React.CSSProperties={width:"100%",padding:"9px 12px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"'Noto Sans KR',sans-serif",outline:"none",background:"#fff"};
const inp:React.CSSProperties={padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"'Noto Sans KR',sans-serif",outline:"none"};
const addBtn:React.CSSProperties={padding:"3px 10px",fontSize:11,fontWeight:600,color:"#1a6fc4",background:"#eff6ff",border:"1px solid #bfdbfe",borderRadius:6,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"};
const delBtn:React.CSSProperties={padding:"3px 8px",fontSize:14,color:"#dc2626",background:"#fef2f2",border:"1px solid #fecaca",borderRadius:6,cursor:"pointer",lineHeight:1};
