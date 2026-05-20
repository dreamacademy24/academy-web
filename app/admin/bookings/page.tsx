"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { isAdminAuthed } from "@/lib/adminAuth";
import EstimateCalc from "./EstimateCalc";
import * as XLSX from "xlsx";
import { ADMIN_BOOKING_TYPES as BOOKING_TYPES, type BookingTypeValue } from "@/lib/bookingTypes";

interface Booking {
  id:string; reservation_no:string; status:string; booker_name:string; students:any;
  checkin_date:string; checkout_date?:string; accom_type:string; created_at:string; assignee?:string;
  base_price?:number; final_price?:number; balance_date?:string; updated_at?:string;
  flight_in?:string; flight_out?:string; house_no?:string; pickup?:string; drop_off?:string;
  pickup_place?:string; special_request?:string; agency?:string; accom_room?:string;
  billing_items?:any; locals?:any; confirmed?:boolean;
  booking_type?:string; accom_weeks?:number;
  is_all_in_one?:boolean;
  academy_start?:string; academy_end?:string;
}

const SC:Record<string,{bg:string;color:string}>={
  "접수":{bg:"#fef3c7",color:"#92400e"},
  "인보이스발행":{bg:"#dbeafe",color:"#1e40af"},
  "영수증발행":{bg:"#dcfce7",color:"#166534"},
  "결제완료":{bg:"#d1fae5",color:"#065f46"},
  "완료":{bg:"#f1f5f9",color:"#64748b"},
};

function stuNames(s:any):string{
  try{
    const a=typeof s==="string"?JSON.parse(s):s;
    if(!Array.isArray(a)||a.length===0)return "";
    // 학생 객체의 이름 필드 체인: korName(legacy JSONB) → name_kr(students 테이블/신규) → koreanName → name
    return a.map((x:any)=>x?.korName||x?.name_kr||x?.koreanName||x?.name||"").filter(Boolean).join(", ");
  }catch{return "";}
}
function stuWeeks(s:any):string{
  try{const a=typeof s==="string"?JSON.parse(s):s;if(!Array.isArray(a))return "";return a.map((x:any)=>x.weeks?x.weeks+"주":"").filter(Boolean).join(", ");}catch{return "";}
}
function stuCount(s:any):number{
  try{const a=typeof s==="string"?JSON.parse(s):s;if(!Array.isArray(a))return 0;return a.length;}catch{return 0;}
}
function fmt(n?:number){return n?n.toLocaleString("ko-KR")+"원":"-";}
function fDate(d?:string){return d?new Date(d).toLocaleDateString("ko-KR"):"";}
function shortNo(no:string){return no?no.replace("DA-","").slice(-7):"-";}
function addWeeks(dateStr:string,weeks:number):string{
  const d=new Date(dateStr);d.setDate(d.getDate()+weeks*7);return d.toISOString().slice(0,10);
}
// 학원 종료일 계산: start + (weeks-1)*7 + 4 (월~금 운영, invoice/page.tsx와 동일)
function calcAcademyEnd(startStr:string,weeks:number|string):string{
  if(!startStr)return"";
  const w=Number(weeks);
  if(!w||w<1)return"";
  const d=new Date(startStr);d.setDate(d.getDate()+(w-1)*7+4);
  return d.toISOString().slice(0,10);
}
// 다음 월요일 (체크인이 월요일이면 그 날 그대로). academyStart 비통학형 기본 derive
function getNextMonday(dateStr:string):string{
  if(!dateStr)return"";
  const d=new Date(dateStr);
  const day=d.getDay();
  const offset=(8-day)%7; // Mon→0, Tue→6, Wed→5, Thu→4, Fri→3, Sat→2, Sun→1
  d.setDate(d.getDate()+offset);
  return d.toISOString().slice(0,10);
}
// 달력용 helper: timezone-safe YYYY-MM-DD
function calYmd(d:Date):string{
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,"0");
  const dd=String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}
// 월~일 주별로 분할. month는 1~12. 해당 월의 첫날을 포함하는 월요일부터 시작.
function genCalWeeks(year:number,month:number):Date[][]{
  const firstDay=new Date(year,month-1,1);
  const lastDay=new Date(year,month,0);
  const cursor=new Date(firstDay);
  while(cursor.getDay()!==1)cursor.setDate(cursor.getDate()-1);
  const weeks:Date[][]=[];
  while(cursor<=lastDay){
    const week:Date[]=[];
    for(let i=0;i<7;i++){week.push(new Date(cursor));cursor.setDate(cursor.getDate()+1);}
    weeks.push(week);
  }
  return weeks;
}
// 학생 age 필드 → 나이 숫자 추출 (달력/요약 표시용)
// 지원 형식: '2016년'/'2016' (출생년도) / '20190825' (YYYYMMDD) / '만3세' / '7'/'7살'
function getStudentAge(s:{age?:string}):string{
  if(!s.age)return"";
  const a=String(s.age).trim();
  // 1) YYYYMMDD(8자리) 또는 YYYY(4자리) → 앞 4자리 연도 추출
  const yearMatch=a.match(/^(\d{4})/);
  if(yearMatch){
    const age=new Date().getFullYear()-Number(yearMatch[1]);
    return age>0&&age<120?String(age):"";
  }
  // 2) '만N세' / '만 N' 패턴 → N
  const manMatch=a.match(/만\s*(\d{1,2})/);
  if(manMatch)return manMatch[1];
  // 3) 1~2자리 숫자(7, 7살 등) → 그대로
  const num=parseInt(a,10);
  return isNaN(num)?"":String(num);
}
// 학생 총 등록 주수 — 수업시작~종료 날짜 기준 (academyWeeks 필드는 연장 미반영 가능, 폴백으로만 사용)
function getStudentWeeks(s:any):number|null{
  const endRaw=s.academyEnd??s.academy_end??s.endDate??s.end_date??s.checkoutDate??s.checkout_date;
  const startRaw=s.academyStart??s.academy_start??s.startDate??s.start_date??s.checkinDate??s.checkin_date;
  if(endRaw&&startRaw){
    const end=new Date(String(endRaw).length===10?endRaw+'T00:00:00':endRaw);
    const start=new Date(String(startRaw).length===10?startRaw+'T00:00:00':startRaw);
    const days=(end.getTime()-start.getTime())/(24*60*60*1000);
    const weeks=Math.ceil(days/7);
    if(weeks>0)return weeks;
  }
  const aw=Number(s.academyWeeks);
  if(aw>0)return aw;
  return null;
}
// 나이 셀 원본 표기 (리스트 뷰 — YYYYMMDD는 연도만, 그 외는 그대로)
function fmtStudentAge(rawAge?:string):string{
  if(!rawAge)return"-";
  const a=String(rawAge).trim();
  if(/^\d{8}$/.test(a))return a.slice(0,4); // YYYYMMDD → YYYY
  return a;
}
function acaStart(b:any):string{
  if(!b.checkin_date)return"-";
  const isCommute=b.accom_type==="통학형"||b.booking_type==="commute";
  if(isCommute){
    // 통학형: JSONB academyStart 우선, 없으면 checkin_date 그대로
    try{
      const a=typeof b.students==="string"?JSON.parse(b.students):b.students;
      if(Array.isArray(a)&&a[0]?.academyStart)return a[0].academyStart;
    }catch{}
    return b.checkin_date;
  }
  // 비통학형: 다음 월요일
  return getNextMonday(b.checkin_date)||"-";
}
function acaEnd(b:any):string{
  const start=acaStart(b);if(start==="-"||!start)return"-";
  // 통학형: checkout_date 그대로
  const isCommute=b.accom_type==="통학형"||b.booking_type==="commute";
  if(isCommute&&b.checkout_date)return b.checkout_date;
  // 비통학형 우선순위:
  //   1) students[0].academyEnd (직접 저장된 날짜)
  //   2) students[0].academyWeeks 로 calcAcademyEnd
  //   3) b.accom_weeks 로 calcAcademyEnd (마지막 폴백 — booking-level이 stale일 수 있음)
  try{
    const a=typeof b.students==="string"?JSON.parse(b.students):b.students;
    if(Array.isArray(a)&&a[0]){
      const s0=a[0];
      if(s0.academyEnd)return s0.academyEnd;
      const sWeeks=Number(s0.academyWeeks)||0;
      if(sWeeks>0)return calcAcademyEnd(start,sWeeks)||"-";
    }
  }catch{}
  const bWeeks=Number(b.accom_weeks)||0;
  if(bWeeks>0)return calcAcademyEnd(start,bWeeks)||"-";
  return "-";
}
function fmtAccom(b:any):string{
  const t=b.accom_type||"";
  if(t.includes("드림하우스")||t.includes("드하")){
    const h=(b.house_no||"").replace(/\s+/g,"");
    const r=(b.accom_room||"").replace(/\s+/g,"").toLowerCase();
    return "DH"+h+r;
  }
  if(t.includes("제이파크"))return "JPARK";
  if(t.includes("큐브나인"))return "CUBE9";
  return t||"-";
}

export default function AdminBookingsPage(){
  const router=useRouter();
  const [authed,setAuthed]=useState(false);
  const [bookings,setBookings]=useState<Booking[]>([]);
  const [filter,setFilter]=useState("전체");
  const [confirmFilter,setConfirmFilter]=useState("전체");
  const [loading,setLoading]=useState(false);
  const [mainTab,setMainTab]=useState<"newlist"|"list"|"receipt"|"confirm"|"estimate"|"students">("newlist");
  const [confirmSearch,setConfirmSearch]=useState("");
  const [confirmSort,setConfirmSort]=useState<{key:string;asc:boolean}>({key:"checkin_date",asc:true});
  const ASSIGNEES=["May","Jamin","Candice"];
  const statusFilters=["전체","접수","인보이스발행","영수증발행","완료"];
  const confirmStatuses=["전체","영수증발행","결제완료","완료"];

  /* ── STEP 22: 예약 유형 선택 모달 ── */
  const [showNewBooking,setShowNewBooking]=useState(false);
  const [modalTab,setModalTab]=useState<'allInOne'|'nonPackage'>('allInOne');
  const [npType,setNpType]=useState<'dh_only'|'jp_only'|'cn_only'|'commute'>('dh_only');
  const [bType,setBType]=useState<BookingTypeValue>("dreamhouse");
  const [newForm,setNewForm]=useState({booker_name:"",booker_english:"",booker_phone:"",check_in:"",check_out:"",
    dh_weeks:2,jp_weeks:1,cn_period:"1주",room_accom:"dreamhouse",room_weeks:1,
    pickup_place:"",drop_place:"",agency:"",special_request:""});
  const [savingNew,setSavingNew]=useState(false);

  const CN_PERIODS=["1주","2주","4주","6일"];
  const ROOM_ACCOMS=[{v:"dreamhouse",l:"드림하우스"},{v:"jaypark",l:"제이파크"},{v:"cubenine",l:"큐브나인"}];
  const NP_TYPES=[
    {v:'dh_only' as const, label:'드림하우스', desc:'숙소만 이용'},
    {v:'jp_only' as const, label:'제이파크',   desc:'숙소만 이용'},
    {v:'cn_only' as const, label:'큐브나인',   desc:'숙소만 이용'},
    {v:'commute' as const, label:'통학형',     desc:'숙소 없이 학원만'},
  ];

  /* ── STEP 23: 항공권 + 학생 ── */
  const emptyFlight={airline:"",flight_no:"",date:"",time:"",place:""};
  const [flightIn,setFlightIn]=useState({...emptyFlight,undecided:false});
  const [flightOut,setFlightOut]=useState({...emptyFlight,undecided:false});
  const emptyStudent={name_kr:"",name_en:"",birth_date:"",gender:"",level:""};
  const [students23,setStudents23]=useState<typeof emptyStudent[]>([{...emptyStudent}]);
  function addStudent(){if(students23.length<5)setStudents23([...students23,{...emptyStudent}]);}
  function removeStudent(i:number){setStudents23(students23.filter((_,idx)=>idx!==i));}
  function updateStudent(i:number,key:string,val:string){const arr=[...students23];arr[i]={...arr[i],[key]:val};setStudents23(arr);}

  /* ── STEP 24: 결제 상태 ── */
  const [payForm,setPayForm]=useState({total_amount:0,deposit_amount:0,deposit_paid:false,payment_memo:""});

  /* ── 학생관리 탭 (bookings의 students JSONB에서 추출) ── */
  interface StudentRow{
    key:string; // booking_id + index
    booking_id:string; reservation_no:string; status:string; booker_name:string;
    accom_type:string; house_no:string; accom_room:string;
    agency:string; balance_date:string; checkin_date:string; checkout_date:string;
    flight_in:string; flight_out:string;
    special_request:string;
    // from students jsonb
    korName:string; engName:string; age:string; grade:string;
    academyStart:string; academyEnd:string; academyWeeks:string; photo:string;
  }
  const [stuSearch,setStuSearch]=useState("");
  const [stuSort,setStuSort]=useState<{key:string;asc:boolean}>({key:"academyStart",asc:true});
  const [stuView,setStuView]=useState<"list"|"cal">("list");
  const _now=new Date();
  const [stuYear,setStuYear]=useState<string>(String(_now.getFullYear())); // "" = 전체, "2026" 등
  const [stuMonthNum,setStuMonthNum]=useState<string>(String(_now.getMonth()+1).padStart(2,"0")); // "" = 전체, "01"~"12"
  const [stuSpecialPopup,setStuSpecialPopup]=useState<{booking_id:string;current:string}|null>(null);
  const [stuSpecialEdit,setStuSpecialEdit]=useState("");
  // 확정예약 탭 특이사항 펼침 토글 (booking id Set)
  const [expandedSr,setExpandedSr]=useState<Set<string>>(new Set());

  // 모든 예약(bookings)의 students JSONB를 평탄화 + academyStart 빠른순(오름차순)
  // 수업 시작일 = student JSONB academyStart → 없으면 체크인 다음 월요일
  // 수업 종료일 = 시작 월요일 + 주수*7-3 (금요일, 어드민 상세 calcAcademyEnd와 동일 공식)
  const studentsList:StudentRow[]=bookings.flatMap(b=>{
    let arr:Record<string,string>[]=[];
    try{
      const parsed=typeof b.students==="string"?JSON.parse(b.students):b.students;
      if(Array.isArray(parsed)) arr=parsed;
    }catch{return[];}
    if(arr.length===0) return [];
    return arr.map((s,i)=>{
      // 수업 시작일: student JSON academyStart → 없으면 체크인 다음 월요일
      const academyStart=s.academyStart||s.academy_start||getNextMonday(b.checkin_date||"");
      // weeks: booking.accom_weeks → student.academyWeeks → student.accom_weeks → 기본 4
      const weeks=Number(b.accom_weeks)||Number(s.academyWeeks)||Number(s.accom_weeks)||4;
      // 수업 종료일 = 시작 + 주수*7-3 = 금요일 (calcAcademyEnd: start+(w-1)*7+4 와 동일)
      const academyEnd=calcAcademyEnd(academyStart,weeks);
      return{
        key:b.id+"_"+i,
        booking_id:b.id,
        reservation_no:b.reservation_no||"",
        status:b.status||"",
        booker_name:b.booker_name||"",
        accom_type:b.accom_type||"",
        house_no:b.house_no||"",
        accom_room:b.accom_room||"",
        agency:b.agency||"",
        balance_date:b.balance_date||"",
        checkin_date:b.checkin_date||"",
        checkout_date:b.checkout_date||"",
        flight_in:b.flight_in||"",
        flight_out:b.flight_out||"",
        special_request:b.special_request||"",
        korName:s.korName||s.name_kr||s.name||s.kor_name||s.korean_name||"",
        engName:s.engName||s.name_en||s.eng_name||s.english_name||"",
        age:s.age||"",
        // grade: 한글 라벨로 정규화. s.grade(킨더/주니어) 우선, 없으면 s.level(kinder/junior) 변환
        grade:s.grade||(s.level==="kinder"?"킨더":s.level==="junior"?"주니어":""),
        academyStart,
        academyEnd,
        academyWeeks:s.academyWeeks||"",
        photo:s.photo||"",
      };
    });
  }).sort((a,b)=>new Date(a.academyStart||"9999").getTime()-new Date(b.academyStart||"9999").getTime());

  function exportStudentsXlsx(rows:StudentRow[]){
    const data=rows.map(s=>({
      예약번호:shortNo(s.reservation_no),상태:s.status,
      시작일:s.academyStart,종료일:s.academyEnd,기간:s.academyWeeks?s.academyWeeks+"주":"",
      "킨더/주니어":s.grade||"",
      한글이름:s.korName,영어이름:s.engName,나이:s.age,
      숙소:fmtAccom(s as unknown as Record<string,string>),
      체크인:s.checkin_date,체크아웃:s.checkout_date,
      예약자명:s.booker_name,잔금일:s.balance_date,
      사진허용:s.photo,특이사항:s.special_request,
    }));
    const ws=XLSX.utils.json_to_sheet(data);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"학생관리");XLSX.writeFile(wb,"학생관리_"+new Date().toISOString().slice(0,10)+".xlsx");
  }

  /* ── STEP 28: 엑셀 내보내기 ── */
  function exportListXlsx(rows:Booking[]){
    const data=rows.map(b=>({예약번호:b.reservation_no,상태:b.status,담당자:b.assignee||"",예약자명:b.booker_name,학생이름:stuNames(b.students),체크인:b.checkin_date||"",숙소:b.accom_type||"",접수일:fDate(b.created_at)}));
    const ws=XLSX.utils.json_to_sheet(data);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"부킹리스트");XLSX.writeFile(wb,"부킹리스트_"+new Date().toISOString().slice(0,10)+".xlsx");
  }
  function exportConfirmXlsx(rows:Booking[]){
    const data=rows.map(b=>({예약번호:shortNo(b.reservation_no),예약자명:b.booker_name,학생이름:stuNames(b.students),체크인:b.checkin_date||"",체크아웃:b.checkout_date||"","숙소/룸":fmtAccom(b),아카데미시작:acaStart(b),항공IN:b.flight_in||"",항공OUT:b.flight_out||"",픽업장소:b.pickup_place||"",드랍장소:b.drop_off||"",유학원:b.agency||"",잔금일:b.balance_date||"",금액:b.final_price||b.base_price||0}));
    const ws=XLSX.utils.json_to_sheet(data);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"확정예약");XLSX.writeFile(wb,"확정예약_"+new Date().toISOString().slice(0,10)+".xlsx");
  }

  /* ── STEP 33: 항공권 확인 자동 태스크 생성 ── */
  async function createFlightCheckTasks(){
    const today=new Date();today.setHours(0,0,0,0);
    const targets=confirmList.filter(b=>{
      if(!b.checkin_date)return false;
      const ci=new Date(b.checkin_date);ci.setHours(0,0,0,0);
      const diff=Math.round((ci.getTime()-today.getTime())/(1000*60*60*24));
      return diff>=25&&diff<=35;
    });
    if(targets.length===0){alert("체크인 25~35일 이내 예약이 없습니다.");return;}
    // 기존 태스크 조회 (중복 방지 - title에 예약번호 포함 여부)
    const {data:existing,error:eErr}=await supabase.from("staff_tasks").select("title");
    if(eErr){alert("staff_tasks 테이블 조회 실패: "+eErr.message);return;}
    const existTitles=new Set((existing??[]).map((t:{title:string})=>t.title));
    const toInsert=targets.filter(b=>{
      const title="✈️ 항공권 확인 - "+b.booker_name+" ("+b.checkin_date+")";
      return !existTitles.has(title);
    }).map(b=>{
      const ci=new Date(b.checkin_date);ci.setDate(ci.getDate()-30);
      const dueStr=ci.toISOString().slice(0,10);
      return{
        title:"✈️ 항공권 확인 - "+b.booker_name+" ("+b.checkin_date+")",
        assignee:b.assignee||"all",
        due:dueStr,
        done:false,
        shared:true,
        note:"예약번호: "+b.reservation_no+"\n체크인: "+b.checkin_date+"\n학생: "+stuNames(b.students),
      };
    });
    if(toInsert.length===0){alert("새로 생성할 태스크가 없습니다. (이미 생성됨)");return;}
    const {error:iErr}=await supabase.from("staff_tasks").insert(toInsert);
    if(iErr){alert("태스크 생성 실패: "+iErr.message);return;}
    alert(toInsert.length+"개 항공권 확인 태스크가 생성됐어요!");
  }

  async function saveNewBooking(){
    if(!newForm.booker_name.trim()){alert("예약자명을 입력하세요.");return;}
    setSavingNew(true);
    // 예약번호 생성 (booking/invoice 페이지와 동일 포맷: DA-YYYYMMDD-NNNNNN)
    const todayCompact=new Date().toISOString().slice(0,10).replace(/-/g,"");
    const rno="DA-"+todayCompact+"-"+Math.floor(Math.random()*900000+100000);
    const accomDetail:Record<string,unknown>={booking_type:bType};
    if(bType==="dreamhouse"){accomDetail.dh_weeks=newForm.dh_weeks;}
    else if(bType==="dreamhouse_jaypark"){accomDetail.dh_weeks=newForm.dh_weeks;accomDetail.jp_weeks=newForm.jp_weeks;}
    else if(bType==="dreamhouse_cubenine"){accomDetail.dh_weeks=newForm.dh_weeks;accomDetail.cn_period=newForm.cn_period;}
    else if(bType==="jaypark"){accomDetail.jp_weeks=newForm.jp_weeks;}
    else if(bType==="cubenine"){accomDetail.cn_period=newForm.cn_period;}
    else if(bType==="commute"){/* 통학형: 숙소 정보 없음 */}
    else if(bType==="room_only"){accomDetail.room_accom=newForm.room_accom;accomDetail.room_weeks=newForm.room_weeks;}
    // Build flight info JSON
    const flightInfo:Record<string,unknown>={};
    if(!flightIn.undecided){flightInfo.in={airline:flightIn.airline,flight_no:flightIn.flight_no,date:flightIn.date,time:flightIn.time,place:flightIn.place};}else{flightInfo.in={undecided:true};}
    if(!flightOut.undecided){flightInfo.out={airline:flightOut.airline,flight_no:flightOut.flight_no,date:flightOut.date,time:flightOut.time,place:flightOut.place};}else{flightInfo.out={undecided:true};}
    // bookings 테이블용 매핑 (booking_type → accom_type 한글 라벨)
    const BTYPE_KO:Record<string,string>={
      dreamhouse:"드림하우스",
      dreamhouse_jaypark:"드림하우스+제이파크",
      dreamhouse_cubenine:"드림하우스+큐브나인",
      jaypark:"제이파크 단독",
      cubenine:"큐브나인 단독",
      commute:"통학형",
      room_only:"숙소만",
    };
    const flightInStr=flightIn.undecided?"미정":[flightIn.airline,flightIn.flight_no,flightIn.date,flightIn.time].filter(Boolean).join(" ");
    const flightOutStr=flightOut.undecided?"미정":[flightOut.airline,flightOut.flight_no,flightOut.date,flightOut.time].filter(Boolean).join(" ");
    // Insert into bookings via API (옛 테이블, KO 라벨 사용)
    const body:Record<string,unknown>={
      reservation_no:rno,
      accom_type:BTYPE_KO[bType]||bType,
      booker_name:newForm.booker_name.trim(),
      booker_english:newForm.booker_english.trim()||null,
      booker_phone:newForm.booker_phone.trim()||null,
      checkin_date:newForm.check_in||null,
      checkout_date:newForm.check_out||null,
      flight_in:flightInStr||null,
      flight_out:flightOutStr||null,
      pickup_place:newForm.pickup_place.trim()||null,
      drop_off:newForm.drop_place.trim()||null,
      agency:newForm.agency.trim()||null,
      special_request:newForm.special_request.trim()||null,
      base_price:payForm.total_amount||0,
      final_price:payForm.total_amount||0,
      status:"접수",
      confirmed:false,
      // accom 분해 컬럼 (bookings 테이블에 존재)
      dh_weeks:(bType==="dreamhouse"||bType==="dreamhouse_jaypark"||bType==="dreamhouse_cubenine")?newForm.dh_weeks:null,
      jp_weeks:(bType==="jaypark"||bType==="dreamhouse_jaypark")?newForm.jp_weeks:null,
      cn_period:(bType==="cubenine"||bType==="dreamhouse_cubenine")?newForm.cn_period:null,
    };
    const r=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/bookings`,{
      method:"POST",headers:{"Content-Type":"application/json","apikey":process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,"Authorization":"Bearer "+process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,"Prefer":"return=representation"},
      body:JSON.stringify(body),
    });
    if(!r.ok){const e=await r.text();alert("저장 실패: "+e);setSavingNew(false);return;}
    const inserted=await r.json();
    // Insert accommodation detail into booking_accommodations
    const accomRows:Record<string,unknown>[]=[];
    if(bType==="dreamhouse"||bType==="dreamhouse_jaypark"||bType==="dreamhouse_cubenine"){
      accomRows.push({booking_id:inserted[0]?.id,accommodation_type:"dreamhouse",nights:newForm.dh_weeks*7});
    }
    if(bType==="dreamhouse_jaypark"){accomRows.push({booking_id:inserted[0]?.id,accommodation_type:"jaypark",nights:newForm.jp_weeks*7});}
    if(bType==="dreamhouse_cubenine"){
      const cnDays=newForm.cn_period==="6일"?6:parseInt(newForm.cn_period)*7;
      accomRows.push({booking_id:inserted[0]?.id,accommodation_type:"cubenine",nights:cnDays,package_type:newForm.cn_period});
    }
    if(bType==="jaypark"){accomRows.push({booking_id:inserted[0]?.id,accommodation_type:"jaypark",nights:newForm.jp_weeks*7});}
    if(bType==="cubenine"){
      const cnDays=newForm.cn_period==="6일"?6:parseInt(newForm.cn_period)*7;
      accomRows.push({booking_id:inserted[0]?.id,accommodation_type:"cubenine",nights:cnDays,package_type:newForm.cn_period});
    }
    if(bType==="room_only"){accomRows.push({booking_id:inserted[0]?.id,accommodation_type:newForm.room_accom,nights:newForm.room_weeks*7});}
    // commute(통학형): accomRows 추가 없음
    if(accomRows.length>0){
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/booking_accommodations`,{
        method:"POST",headers:{"Content-Type":"application/json","apikey":process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,"Authorization":"Bearer "+process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!},
        body:JSON.stringify(accomRows),
      });
    }
    // STEP 23: Insert students
    const bookingId=inserted[0]?.id;
    const stuRows=students23.filter(s=>s.name_kr.trim()).map(s=>({
      booking_id:bookingId,name_kr:s.name_kr.trim(),name_en:s.name_en.trim()||null,
      age:s.birth_date||null,level:s.level||null,
    }));
    if(stuRows.length>0&&bookingId){
      const stuR=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/students`,{
        method:"POST",headers:{"Content-Type":"application/json","apikey":process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,"Authorization":"Bearer "+process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!},
        body:JSON.stringify(stuRows),
      });
      if(!stuR.ok){console.error("students INSERT failed:",await stuR.text());}
    }
    // bookings.students JSONB도 동기화 (리스트/학생관리 탭이 이 컬럼 참조)
    // /booking·/invoice와 동일하게 JSON.stringify 형태로 저장 (text/jsonb 양쪽 호환)
    if(bookingId){
      // 비통학형: 체크인 다음 월요일이 academy 시작. 통학형: 체크인 그대로
      const isCommuteNew=bType==="commute";
      const academyStartCalc=isCommuteNew?(newForm.check_in||""):(newForm.check_in?getNextMonday(newForm.check_in):"");
      const studentsJsonb=students23.filter(s=>s.name_kr.trim()).map(s=>({
        korName:s.name_kr.trim(),
        engName:s.name_en.trim()||"",
        age:s.birth_date||"",
        grade:"",
        academyStart:academyStartCalc,
        academyEnd:"",
        academyWeeks:"",
        photo:"",
        level:s.level||"",
        birth_date:s.birth_date||"",
      }));
      const patchR=await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`,{
        method:"PATCH",headers:{"Content-Type":"application/json","apikey":process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,"Authorization":"Bearer "+process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!},
        // students 컬럼은 jsonb — 배열 그대로 전송 (JSON.stringify 이중 래핑 금지)
        body:JSON.stringify({students:studentsJsonb}),
      });
      if(!patchR.ok){const e=await patchR.text();console.error("bookings.students PATCH failed:",e);alert("학생 정보 동기화 실패: "+e+"\n예약은 등록됐지만 리스트에 학생이름이 안 보일 수 있습니다.");}
    }
    setSavingNew(false);setShowNewBooking(false);
    setNewForm({booker_name:"",booker_english:"",booker_phone:"",check_in:"",check_out:"",dh_weeks:2,jp_weeks:1,cn_period:"1주",room_accom:"dreamhouse",room_weeks:1,pickup_place:"",drop_place:"",agency:"",special_request:""});
    setBType("dreamhouse");
    setFlightIn({...emptyFlight,undecided:false});setFlightOut({...emptyFlight,undecided:false});
    setStudents23([{...emptyStudent}]);
    setPayForm({total_amount:0,deposit_amount:0,deposit_paid:false,payment_memo:""});
    await load(); // 리스트 새로고침
    alert("새 예약이 등록되었습니다!");
  }

  async function saveNewNonPackage(){
    if(!newForm.booker_name.trim()){alert("예약자명을 입력하세요.");return;}
    if(!newForm.check_in){alert(npType==='commute'?"수업시작 날짜를 입력하세요.":"체크인 날짜를 입력하세요.");return;}
    if(!newForm.check_out){alert(npType==='commute'?"수업종료 날짜를 입력하세요.":"체크아웃 날짜를 입력하세요.");return;}
    setSavingNew(true);
    const today=new Date().toISOString().slice(0,10).replace(/-/g,"");
    const reservationNo=`DA-${today}-${Math.floor(Math.random()*900000+100000)}`;
    const accomTypeMap:Record<string,string>={dh_only:"드림하우스 단독",jp_only:"제이파크 단독",cn_only:"큐브나인 단독",commute:"통학형"};
    const accomType=accomTypeMap[npType];
    const isCommuteNP=npType==='commute';
    const payload:any={
      reservation_no:reservationNo,status:"접수",
      booker_name:newForm.booker_name.trim(),
      booker_english:newForm.booker_english.trim()||null,
      booker_phone:newForm.booker_phone.trim()||null,
      checkin_date:newForm.check_in||null,
      checkout_date:newForm.check_out||null,
      accom_type:accomType,
      accom_weeks:0,
      pickup_place:isCommuteNP?null:(newForm.pickup_place.trim()||null),
      drop_off:isCommuteNP?null:(newForm.drop_place.trim()||null),
      agency:newForm.agency.trim()||null,
      special_request:newForm.special_request.trim()||null,
    };
    if(isCommuteNP)payload.booking_type='commute';
    const {data:inserted,error}=await supabase.from("bookings").insert(payload).select();
    if(error){alert("저장 실패: "+error.message);setSavingNew(false);return;}
    const bookingId=inserted?.[0]?.id;
    if(bookingId){
      const studentRows=students23.filter(s=>s.name_kr.trim()).map(s=>({
        booking_id:bookingId,name_kr:s.name_kr.trim(),name_en:s.name_en.trim()||null,
        age:s.birth_date||null,
        level:s.level==="kinder"?"kinder":(s.level==="junior"?"junior":null),
        academy_start:newForm.check_in||null,
        academy_end:newForm.check_out||null,
      }));
      if(studentRows.length>0)await supabase.from("students").insert(studentRows);
      const studentsJsonb=students23.filter(s=>s.name_kr.trim()).map(s=>({
        korName:s.name_kr.trim(),engName:s.name_en.trim()||"",
        academyStart:newForm.check_in||"",academyEnd:newForm.check_out||"",
        academyWeeks:"",photo:"",level:s.level||"",birth_date:s.birth_date||"",
      }));
      if(studentsJsonb.length>0){
        await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/bookings?id=eq.${bookingId}`,{
          method:"PATCH",headers:{"Content-Type":"application/json","apikey":process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,"Authorization":"Bearer "+process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!},
          body:JSON.stringify({students:studentsJsonb}),
        });
      }
    }
    setSavingNew(false);setShowNewBooking(false);
    setNewForm({booker_name:"",booker_english:"",booker_phone:"",check_in:"",check_out:"",dh_weeks:2,jp_weeks:1,cn_period:"1주",room_accom:"dreamhouse",room_weeks:1,pickup_place:"",drop_place:"",agency:"",special_request:""});
    setNpType('dh_only');setStudents23([{...emptyStudent}]);
    await load();
    alert("비패키지 예약이 등록되었습니다!");
  }

  useEffect(()=>{
    if(typeof window==='undefined')return;
    if(isAdminAuthed()){setAuthed(true);}
    else{window.location.href="/admin";}
  },[]);

  const load=useCallback(async()=>{
    setLoading(true);
    const {data,error}=await supabase.from("bookings").select("*").order("checkin_date",{ascending:true});
    if(error){console.error(error);alert("데이터 로드 실패");}
    if(data){
      const allInOnes=(data as any[]).filter(b=>b.is_all_in_one).map(b=>({name:b.booker_name,id:b.id,val:b.is_all_in_one}));
      console.log('[load] total:',data.length,'/ is_all_in_one truthy:',allInOnes.length,allInOnes);
      const sample=data[0] as any;
      console.log('[load] sample[0] keys:',sample?Object.keys(sample).filter(k=>k.includes('all')||k.includes('portal')):'none');
      setBookings(data as Booking[]);
    }
    setLoading(false);
  },[]);

  useEffect(()=>{if(authed)load();},[authed,load]);

  if(!authed) return null;

  const filtered=filter==="전체"?bookings:bookings.filter(b=>b.status===filter);
  const rcpList=bookings.filter(b=>["영수증발행","완료"].includes(b.status));
  const confirmList=bookings.filter(b=>["영수증발행","결제완료","완료"].includes(b.status));
  const confirmFiltered=confirmFilter==="전체"?confirmList:confirmList.filter(b=>b.status===confirmFilter);

  function getDday(dateStr?:string){
    if(!dateStr)return null;
    const today=new Date();today.setHours(0,0,0,0);
    const target=new Date(dateStr);target.setHours(0,0,0,0);
    const diff=Math.round((target.getTime()-today.getTime())/(1000*60*60*24));
    if(diff===0)return{label:"D-Day",color:"#dc2626"};
    if(diff>0)return{label:"D-"+diff,color:diff<=7?"#dc2626":diff<=30?"#ea580c":"#16a34a"};
    return{label:"D+"+Math.abs(diff),color:"#94a3b8"};
  }

  function getBalanceDday(dateStr?:string){
    if(!dateStr)return null;
    const today=new Date();today.setHours(0,0,0,0);
    const target=new Date(dateStr);target.setHours(0,0,0,0);
    const diff=Math.round((target.getTime()-today.getTime())/(1000*60*60*24));
    if(diff<0)return{label:"잔금초과",color:"#dc2626"};
    if(diff===0)return{label:"잔금오늘",color:"#dc2626"};
    if(diff<=14)return{label:"잔금D-"+diff,color:"#ea580c"};
    return null;
  }

  return(<><style>{`
*{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Noto Sans KR',sans-serif;background:#f1f5f9;color:#1a1a2e;}
.aw{max-width:1400px;margin:0 auto;padding:24px;}
.ah{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:12px;}.ah h1{font-size:22px;font-weight:800;}
.ah-right{display:flex;gap:8px;align-items:center;}
.ah-btn{padding:8px 16px;font-size:13px;font-weight:600;border-radius:8px;border:none;cursor:pointer;font-family:'Noto Sans KR',sans-serif;}
.ah-new{background:#1a6fc4;color:#fff;text-decoration:none;display:inline-flex;align-items:center;padding:8px 16px;font-size:13px;font-weight:600;border-radius:8px;}.ah-new:hover{background:#0d3d7a;}
.ah-ref{background:#f1f5f9;color:#1a1a2e;border:1px solid #e2e8f0;}.ah-ref:hover{background:#e2e8f0;}
.ah-home{color:#6b7c93;font-size:13px;text-decoration:none;font-weight:600;}.ah-home:hover{color:#1a6fc4;}
.main-tabs{display:flex;gap:4px;background:#fff;padding:4px;border-radius:10px;margin-bottom:16px;box-shadow:0 2px 8px rgba(0,0,0,0.06);}
.main-tab{flex:1;padding:12px 8px;font-size:13px;font-weight:700;text-align:center;border:none;border-radius:8px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;background:transparent;color:#6b7c93;transition:all 150ms;white-space:nowrap;}.main-tab:hover{color:#1a1a2e;}.main-tab.ac{background:#1a6fc4;color:#fff;}
.sub-tabs{display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap;}
.sub-tab{padding:6px 14px;font-size:12px;font-weight:600;border:none;border-radius:7px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;background:#fff;color:#6b7c93;transition:all 150ms;}.sub-tab:hover{color:#1a1a2e;}.sub-tab.ac{background:#1a6fc4;color:#fff;}
.tbl-w{width:100%;background:#fff;border-radius:12px;overflow-x:auto;box-shadow:0 2px 12px rgba(0,0,0,0.06);}
.tbl{width:100%;border-collapse:collapse;min-width:850px;}
.tbl th{font-size:11px;font-weight:700;color:#6b7c93;padding:12px 12px;text-align:left;background:#f8fafc;border-bottom:1px solid #e2e8f0;white-space:nowrap;}
.tbl td{font-size:13px;padding:10px 12px;border-bottom:1px solid #f1f5f9;color:#1a1a2e;white-space:nowrap;}
.tbl tbody tr:hover td{background:#f8fafc;cursor:pointer;}
.tbl td.wrap{white-space:normal;min-width:120px;max-width:200px;word-break:break-word;font-size:12px;}
.badge{display:inline-block;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;}
.empty{text-align:center;padding:40px;color:#94a3b8;font-size:14px;}
.asg{border:1px solid #e2e8f0;border-radius:6px;padding:4px 8px;font-size:12px;background:#fff;font-family:'Noto Sans KR',sans-serif;cursor:pointer;outline:none;}.asg:focus{border-color:#1a6fc4;}
.act{padding:4px 10px;font-size:11px;font-weight:700;border:none;border-radius:6px;cursor:pointer;font-family:'Noto Sans KR',sans-serif;margin-right:4px;}
.act-b{background:#1a6fc4;color:#fff;}.act-b:hover{background:#0d3d7a;}
.act-g{background:#16a34a;color:#fff;}.act-g:hover{background:#15803d;}
.act-r{background:#fef2f2;color:#dc2626;border:1px solid #fecaca;}.act-r:hover{background:#fee2e2;}
.dday{display:inline-block;font-size:11px;font-weight:700;padding:2px 7px;border-radius:10px;background:#f0fdf4;}
.ss-w{width:100%;background:#fff;border-radius:12px;overflow-x:auto;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #e2e8f0;}
.ss{width:100%;border-collapse:collapse;min-width:1200px;table-layout:auto;}
.ss th{font-size:10px;font-weight:700;color:#6b7c93;padding:6px 4px;text-align:left;background:#f1f5f9;border:1px solid #e2e8f0;white-space:nowrap;cursor:pointer;user-select:none;position:relative;}.ss th:hover{background:#e2e8f0;}
.ss th .arr{margin-left:1px;font-size:9px;color:#94a3b8;}
.ss th .arr.ac{color:#1a6fc4;}
.ss td{font-size:11px;padding:5px 4px;border:1px solid #f1f5f9;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px;}
.ss tbody tr:hover td{background:#eff6ff;}
.ss tbody tr.confirmed-row td{background:#f0fdf4;}
.ss td.wrap{white-space:normal;min-width:80px;max-width:140px;word-break:break-word;overflow:hidden;}
.ss .chk{width:16px;height:16px;cursor:pointer;accent-color:#16a34a;}
.cf-search{display:flex;gap:8px;align-items:center;margin-bottom:10px;flex-wrap:wrap;}
.cf-search input{padding:7px 12px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;width:260px;outline:none;font-family:'Noto Sans KR',sans-serif;}.cf-search input:focus{border-color:#1a6fc4;}
.cf-search .cnt{font-size:12px;color:#6b7c93;}
.cal-wrap{width:100%;background:#fff;border-radius:12px;overflow-x:auto;box-shadow:0 2px 12px rgba(0,0,0,0.06);border:1px solid #e2e8f0;padding:14px;}
.cal-tbl{width:100%;border-collapse:collapse;table-layout:fixed;min-width:1000px;}
.cal-tbl th{font-size:11px;font-weight:700;color:#475569;padding:8px 6px;background:#f8fafc;border:1px solid #e2e8f0;text-align:center;}
.cal-tbl td{vertical-align:top;padding:6px;border:1px solid #e2e8f0;font-size:11px;height:90px;}
.cal-side{background:#f5f3ff;color:#4c1d95;font-weight:700;text-align:center;width:100px;}
.cal-side .cal-total{margin-top:6px;padding-top:6px;border-top:1px solid #ddd6fe;font-size:14px;color:#6d28d9;}
.cal-cell .cal-d{font-weight:800;color:#1a1a2e;font-size:12px;margin-bottom:3px;}
.cal-cell.out-month{background:#fafafa;}.cal-cell.out-month .cal-d{color:#cbd5e1;}
.cal-newin{background:#dcfce7;color:#166534;font-weight:700;padding:2px 5px;border-radius:4px;font-size:10px;display:block;margin-bottom:3px;}
.cal-out{background:#fef2f2;color:#dc2626;font-weight:700;padding:2px 5px;border-radius:4px;font-size:10px;display:block;margin-bottom:3px;}
.cal-stu-in{color:#16a34a;font-size:10px;line-height:1.4;}
.cal-stu-out{color:#dc2626;font-size:10px;line-height:1.4;}
@media(max-width:700px){.main-tabs{display:grid;grid-template-columns:1fr 1fr;}.main-tab{font-size:11px;padding:10px 4px;}.aw{padding:16px 12px;}.ah{flex-direction:column;align-items:stretch;}.ah h1{text-align:center;font-size:18px;}.ah-right{justify-content:center;flex-wrap:wrap;}.tbl-w{display:none;}.mob-cards{display:flex !important;}.ah-btn,.ah-new,.sub-tab{min-height:44px;display:inline-flex;align-items:center;justify-content:center;}.pw-b{min-height:44px;}}
@media print{
  @page{size:A4 landscape;margin:8mm;}
  body{background:#fff !important;font-size:9px !important;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
  *{-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
  /* 헤더·탭·필터·검색·토글버튼·이전다음달 버튼 모두 숨김 */
  .ah,.main-tabs,.cf-search,.sub-tabs,.no-print{display:none !important;}
  /* 페이지 컨테이너 padding/max-width 제거 */
  .aw{padding:0 !important;max-width:none !important;}
  /* 달력 컨테이너 — 그림자/보더 제거 */
  .cal-wrap{box-shadow:none !important;border:none !important;padding:0 !important;overflow:visible !important;}
  /* 7열이 A4 가로에 꽉 차도록 min-width 해제 */
  .cal-tbl{min-width:0 !important;width:100% !important;table-layout:fixed !important;}
  .cal-tbl th{font-size:9px !important;padding:4px 3px !important;}
  .cal-tbl td{font-size:8px !important;padding:3px !important;height:auto !important;min-height:60px;}
  .cal-side{width:80px !important;}
  .cal-cell .cal-d{font-size:9px !important;margin-bottom:2px !important;}
  .cal-newin,.cal-out{font-size:7px !important;padding:1px 3px !important;margin-bottom:2px !important;}
  .cal-stu-in,.cal-stu-out{font-size:8px !important;line-height:1.25 !important;}
  /* 월 타이틀 가운데 정렬 */
  .cal-title{text-align:center !important;width:100%;font-size:14px !important;margin-bottom:6mm !important;}
}
  `}</style>

  <div className="aw">
    <div className="ah">
      <h1>예약 관리</h1>
      <div className="ah-right">
        <a href="/admin" className="ah-home">← 관리자 홈</a>
        <a className="ah-btn" href="/booking" target="_blank" rel="noopener noreferrer" style={{background:"#7c3aed",color:"#fff",border:"none",textDecoration:"none"}}>📋 패키지</a>
        <a className="ah-btn" href="/booking2" target="_blank" rel="noopener noreferrer" style={{background:"#fff",color:"#475569",border:"1px solid #cbd5e1",textDecoration:"none"}}>📋 비패키지</a>
        <button className="ah-btn ah-ref" onClick={load} disabled={loading}>{loading?"로딩...":"새로고침"}</button>
      </div>
    </div>

    <div className="main-tabs">
      <button className={`main-tab${mainTab==="estimate"?" ac":""}`} onClick={()=>setMainTab("estimate")}>📊 견적</button>
      <button className={`main-tab${mainTab==="newlist"?" ac":""}`} onClick={()=>setMainTab("newlist")}>📋 부킹 리스트{(()=>{const n=bookings.filter(b=>b.status==="접수"||b.status==="접수중").length;return n>0&&<span style={{background:"#e85d35",color:"#fff",borderRadius:10,padding:"1px 7px",fontSize:11,marginLeft:4,fontWeight:700}}>{n}</span>;})()}</button>
      <button className={`main-tab${mainTab==="list"?" ac":""}`} onClick={()=>setMainTab("list")}>📄 인보이스</button>
      <button className={`main-tab${mainTab==="receipt"?" ac":""}`} onClick={()=>setMainTab("receipt")}>🧾 영수증</button>
      <button className={`main-tab${mainTab==="confirm"?" ac":""}`} onClick={()=>setMainTab("confirm")}>✅ 확정 예약</button>
      <button className={`main-tab${mainTab==="students"?" ac":""}`} onClick={()=>setMainTab("students")}>📚 학생관리</button>
    </div>

    {/* ── 탭0: 신규 접수 예약 ── */}
    {mainTab==="newlist"&&(()=>{
      const newBookings=bookings.filter(b=>b.status==="접수"||b.status==="접수중");
      return(<div>
        <div style={{marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:14,fontWeight:700}}>📋 신규 접수 예약</span>
          <span style={{background:"#e85d35",color:"#fff",borderRadius:20,padding:"2px 10px",fontSize:12,fontWeight:700}}>{newBookings.length}건</span>
        </div>
        {newBookings.length===0?(
          <div style={{textAlign:"center",padding:"60px 0",color:"#aaa",fontSize:14}}>신규 접수 예약이 없습니다</div>
        ):(<div className="tbl-w"><table className="tbl"><thead><tr>
          <th>예약번호</th><th>예약자명</th><th>학생이름</th><th>체크인</th><th>숙소</th><th>접수일</th><th>액션</th>
        </tr></thead><tbody>
          {newBookings.map(b=>(<tr key={b.id} onClick={()=>router.push("/admin/bookings/"+b.id)}>
            <td style={{fontWeight:600,color:"#5b6cf8"}}>{shortNo(b.reservation_no)}</td>
            <td>{b.booker_name||"-"}</td>
            <td style={{fontSize:12,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={stuNames(b.students)}>{stuNames(b.students)}</td>
            <td>{b.checkin_date||"-"}</td>
            <td>{fmtAccom(b as unknown as Record<string,string>)||"-"}</td>
            <td style={{fontSize:12,color:"#888"}}>{fDate(b.created_at)}</td>
            <td onClick={e=>e.stopPropagation()} style={{display:"flex",gap:4}}>
              <button className="act act-b" onClick={()=>router.push("/invoice?id="+b.id)}>인보이스</button>
              <button className="act" style={{background:"#f1f5f9",color:"#475569",border:"1px solid #cbd5e1"}} onClick={()=>router.push("/admin/bookings/"+b.id)}>상세보기</button>
            </td>
          </tr>))}
        </tbody></table></div>)}
      </div>);
    })()}

    {/* ── 탭1: 인보이스 (전체 부킹 리스트) ── */}
    {mainTab==="list"&&(<>
      <div className="sub-tabs">
        {statusFilters.map(t=><button key={t} className={`sub-tab${filter===t?" ac":""}`} onClick={()=>setFilter(t)}>{t} {t!=="전체"&&<>({bookings.filter(b=>b.status===t).length})</>}</button>)}
        <button className="sub-tab" style={{marginLeft:"auto",background:"#dcfce7",color:"#166534"}} onClick={()=>exportListXlsx(filtered)}>📥 엑셀</button>
      </div>
      <div className="tbl-w"><table className="tbl"><thead><tr>
        <th>예약번호</th><th>상태</th><th>담당자</th><th>예약자명</th><th>학생이름</th><th>체크인</th><th>숙소</th><th>접수일</th><th>액션</th>
      </tr></thead><tbody>
        {filtered.length===0?<tr><td colSpan={9} className="empty">예약이 없습니다.</td></tr>:
        filtered.map(b=>{
          const sc=SC[b.status]||SC["접수"];
          return(<tr key={b.id} onClick={()=>router.push("/admin/bookings/"+b.id)}>
            <td style={{fontWeight:600,color:"#1a6fc4"}}>{b.reservation_no}</td>
            <td><span className="badge" style={{background:sc.bg,color:sc.color}}>{b.status}</span></td>
            <td><select className="asg" value={b.assignee||""} style={{color:b.assignee?"#1a6fc4":"#94a3b8"}} onClick={e=>e.stopPropagation()} onChange={async e=>{const v=e.target.value;await supabase.from("bookings").update({assignee:v}).eq("id",b.id);setBookings(prev=>prev.map(x=>x.id===b.id?{...x,assignee:v}:x));}}><option value="">미지정</option>{ASSIGNEES.map(a=><option key={a} value={a}>{a}</option>)}</select></td>
            <td>{b.booker_name}{(b as any).is_all_in_one&&<span style={{display:"inline-block",marginLeft:4,fontSize:11,background:"#fef3c7",color:"#92400e",padding:"1px 6px",borderRadius:10,fontWeight:700,verticalAlign:"middle"}}>🌟 올인원</span>}</td>
            <td style={{maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={stuNames(b.students)}>{stuNames(b.students)}</td>
            <td>{b.checkin_date||"미정"}</td>
            <td title={b.accom_type||"미정"}>{b.accom_type||"미정"}</td>
            <td>{fDate(b.created_at)}</td>
            <td onClick={e=>e.stopPropagation()}>
              <button className="act act-b" onClick={()=>router.push("/invoice?id="+b.id)}>인보이스</button>
              <button className="act act-g" onClick={()=>window.open("/receipt?id="+b.id,"_blank")}>영수증</button>
              <button className="act" style={{background:"#eff6ff",color:"#1a6fc4",border:"1px solid #bfdbfe"}} onClick={()=>{navigator.clipboard.writeText("https://www.dreamacademyph.com/payment?id="+b.id);alert("결제 링크가 복사되었습니다!");}}>💳 결제링크</button>
              <button className="act act-r" onClick={async()=>{if(confirm("정말 삭제하시겠습니까?\n"+b.booker_name+" / "+b.reservation_no)){const{error}=await supabase.from("bookings").delete().eq("id",b.id);if(error){alert("삭제 실패: "+error.message);return;}load();}}}>삭제</button>
            </td>
          </tr>);
        })}
      </tbody></table></div>
      <div className="mob-cards" style={{display:"none",flexDirection:"column",gap:12}}>
        {filtered.length===0?<div className="empty">예약이 없습니다.</div>:
        filtered.map(b=>{
          const sc=SC[b.status]||SC["접수"];
          return(<div key={b.id} onClick={()=>router.push("/admin/bookings/"+b.id)} style={{background:"#fff",borderRadius:12,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontWeight:700,color:"#1a6fc4",fontSize:14}}>{b.reservation_no}</span>
              <span className="badge" style={{background:sc.bg,color:sc.color}}>{b.status}</span>
            </div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{b.booker_name}</div>
            <div style={{fontSize:13,color:"#6b7c93",marginBottom:4}}>{stuNames(b.students)}</div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:12,color:"#94a3b8"}}>
              <span>체크인: {b.checkin_date||"미정"}</span><span>{b.assignee||"미지정"}</span>
            </div>
            <div style={{display:"flex",gap:6,marginTop:10}} onClick={e=>e.stopPropagation()}>
              <button className="act act-b" style={{flex:1,minHeight:40}} onClick={()=>router.push("/invoice?id="+b.id)}>인보이스</button>
              <button className="act act-g" style={{flex:1,minHeight:40}} onClick={()=>window.open("/receipt?id="+b.id,"_blank")}>영수증</button>
              <button className="act act-r" style={{flex:1,minHeight:40}} onClick={async()=>{if(confirm("정말 삭제하시겠습니까?\n"+b.booker_name)){const{error}=await supabase.from("bookings").delete().eq("id",b.id);if(error){alert("삭제 실패: "+error.message);return;}load();}}}>삭제</button>
            </div>
          </div>);
        })}
      </div>
    </>)}

    {/* ── 탭2: 영수증 ── */}
    {mainTab==="receipt"&&(<>
      <div className="tbl-w"><table className="tbl"><thead><tr>
        <th>예약번호</th><th>예약자명</th><th>학생이름</th><th>체크인</th><th>최종금액</th>
      </tr></thead><tbody>
        {rcpList.length===0?<tr><td colSpan={5} className="empty">영수증 발행 내역이 없습니다.</td></tr>:
        rcpList.map(b=>(
          <tr key={b.id} onClick={()=>window.open("/receipt?id="+b.id,"_blank")}>
            <td style={{fontWeight:600,color:"#1a6fc4"}}>{b.reservation_no}</td>
            <td>{b.booker_name}</td><td style={{maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={stuNames(b.students)}>{stuNames(b.students)}</td>
            <td>{b.checkin_date||"미정"}</td>
            <td style={{fontWeight:700}}>{fmt(b.final_price)}</td>
          </tr>
        ))}
      </tbody></table></div>
      <div className="mob-cards" style={{display:"none",flexDirection:"column",gap:12}}>
        {rcpList.length===0?<div className="empty">영수증 발행 내역이 없습니다.</div>:
        rcpList.map(b=>(
          <div key={b.id} onClick={()=>window.open("/receipt?id="+b.id,"_blank")} style={{background:"#fff",borderRadius:12,padding:16,boxShadow:"0 2px 8px rgba(0,0,0,0.06)",cursor:"pointer"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <span style={{fontWeight:700,color:"#1a6fc4",fontSize:14}}>{b.reservation_no}</span>
              <span style={{fontWeight:700}}>{fmt(b.final_price)}</span>
            </div>
            <div style={{fontSize:14,fontWeight:600,marginBottom:4}}>{b.booker_name}</div>
            <div style={{fontSize:13,color:"#6b7c93"}}>{stuNames(b.students)} · 체크인: {b.checkin_date||"미정"}</div>
          </div>
        ))}
      </div>
    </>)}

    {/* ── 탭4: 확정 예약 (스프레드시트) ── */}
    {mainTab==="confirm"&&(()=>{
      const q=confirmSearch.toLowerCase();
      const searched=confirmFiltered.filter(b=>{
        if(!q)return true;
        return [b.reservation_no,b.booker_name,stuNames(b.students),b.assignee,b.agency,b.pickup_place,b.drop_off,b.special_request,b.accom_type,b.house_no].some(v=>v&&v.toLowerCase().includes(q));
      });
      const cols:{key:string;label:string;get:(b:Booking)=>string|number}[]=[
        {key:"reservation_no",label:"예약번호",get:b=>shortNo(b.reservation_no)},
        {key:"assignee",label:"담당자",get:b=>b.assignee||"-"},
        {key:"booker_name",label:"예약자/학생",get:b=>b.booker_name},
        {key:"checkin_date",label:"체크인",get:b=>b.checkin_date||"-"},
        {key:"checkout_date",label:"체크아웃",get:b=>b.checkout_date||"-"},
        {key:"dday",label:"D-day",get:b=>{const d=getDday(b.checkin_date);return d?parseInt(d.label.replace(/[^-\d]/g,""))||0:9999;}},
        {key:"accom",label:"숙소/룸",get:b=>fmtAccom(b)},
        {key:"aca_start",label:"아카데미시작",get:b=>acaStart(b)},
        {key:"aca_end",label:"아카데미종료",get:b=>acaEnd(b)},
        {key:"flight_in",label:"항공IN",get:b=>b.flight_in||"-"},
        {key:"flight_out",label:"항공OUT",get:b=>b.flight_out||"-"},
        {key:"pickup_place",label:"픽업장소",get:b=>b.pickup_place||"-"},
        {key:"drop_off",label:"드랍장소",get:b=>b.drop_off||"-"},
        {key:"agency",label:"유학원",get:b=>b.agency||"-"},
        {key:"balance_date",label:"잔금일",get:b=>b.balance_date||"-"},
        {key:"price",label:"금액",get:b=>b.final_price||b.base_price||0},
        {key:"special_request",label:"특이사항",get:b=>b.special_request||"-"},
      ];
      const sorted=[...searched].sort((a,b)=>{
        const {key,asc}=confirmSort;
        let va:any,vb:any;
        const col=cols.find(c=>c.key===key);
        if(col){va=col.get(a);vb=col.get(b);}
        else if(key==="confirmed"){va=a.confirmed?1:0;vb=b.confirmed?1:0;}
        else{va="";vb="";}
        if(typeof va==="number"&&typeof vb==="number")return asc?va-vb:vb-va;
        return asc?String(va).localeCompare(String(vb)):String(vb).localeCompare(String(va));
      });
      const toggleSort=(key:string)=>setConfirmSort(prev=>prev.key===key?{key,asc:!prev.asc}:{key,asc:true});
      const arrow=(key:string)=>confirmSort.key===key?(confirmSort.asc?"▲":"▼"):"⇅";
      const arrowCls=(key:string)=>confirmSort.key===key?"arr ac":"arr";
      return(<>
        <div className="sub-tabs">
          {confirmStatuses.map(t=><button key={t} className={`sub-tab${confirmFilter===t?" ac":""}`} onClick={()=>setConfirmFilter(t)}>{t} {t!=="전체"&&<>({confirmList.filter(b=>b.status===t).length})</>}</button>)}
        </div>
        <div className="cf-search">
          <input placeholder="🔍 예약자, 학생, 유학원, 예약번호 검색..." value={confirmSearch} onChange={e=>setConfirmSearch(e.target.value)}/>
          <span className="cnt">{sorted.length}건</span>
          <button className="sub-tab" style={{marginLeft:"auto",background:"#dcfce7",color:"#166534",padding:"6px 14px",fontSize:12,fontWeight:600,border:"none",borderRadius:7,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>exportConfirmXlsx(sorted)}>📥 엑셀 내보내기</button>
        </div>
        {/* STEP 24: 통계 바 */}
        <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
          <div style={{padding:"8px 16px",background:"#fff",borderRadius:8,border:"1px solid #e2e8f0",fontSize:12}}>
            <span style={{color:"#6b7c93"}}>전체 확정</span> <span style={{fontWeight:800,color:"#1a1a2e",marginLeft:4}}>{confirmList.length}건</span>
          </div>
          <div style={{padding:"8px 16px",background:"#f0fdf4",borderRadius:8,border:"1px solid #bbf7d0",fontSize:12}}>
            <span style={{color:"#166534"}}>예약금 완료</span> <span style={{fontWeight:800,color:"#166534",marginLeft:4}}>{confirmList.filter(b=>b.balance_date&&b.balance_date.includes("완료")).length}건</span>
          </div>
          <div style={{padding:"8px 16px",background:"#fefce8",borderRadius:8,border:"1px solid #fde68a",fontSize:12}}>
            <span style={{color:"#854d0e"}}>미입금</span> <span style={{fontWeight:800,color:"#854d0e",marginLeft:4}}>{confirmList.filter(b=>!b.balance_date||!b.balance_date.includes("완료")).length}건</span>
          </div>
          <button onClick={createFlightCheckTasks} style={{marginLeft:"auto",padding:"8px 16px",background:"#7c3aed",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>🔔 알림 태스크 생성</button>
        </div>
        <div className="ss-w"><table className="ss"><thead><tr>
          {cols.map(c=><th key={c.key} onClick={()=>toggleSort(c.key)}>{c.label}<span className={arrowCls(c.key)}>{arrow(c.key)}</span></th>)}
          <th onClick={()=>toggleSort("confirmed")}>최종확인<span className={arrowCls("confirmed")}>{arrow("confirmed")}</span></th>
        </tr></thead><tbody>
          {sorted.length===0?<tr><td colSpan={cols.length+1} className="empty">확정 예약이 없습니다.</td></tr>:
          sorted.map(b=>{
            const dday=getDday(b.checkin_date);
            const bdday=getBalanceDday(b.balance_date);
            return(<tr key={b.id} className={b.confirmed?"confirmed-row":""} onClick={()=>router.push("/admin/bookings/"+b.id)} style={{cursor:"pointer"}}>
              <td style={{fontWeight:700,color:"#1a6fc4"}}>{shortNo(b.reservation_no)}</td>
              <td>{b.assignee||"-"}</td>
              <td>
                <div style={{fontWeight:600}}>{b.booker_name}{(b as any).is_all_in_one&&<span style={{display:"inline-block",marginLeft:4,fontSize:11,background:"#fef3c7",color:"#92400e",padding:"1px 6px",borderRadius:10,fontWeight:700,verticalAlign:"middle"}}>🌟 올인원</span>}</div>
                <div style={{color:"#6b7c93",fontSize:10}}>{stuNames(b.students)}</div>
              </td>
              <td style={{fontWeight:600}}>{b.checkin_date||"-"}</td>
              <td>{b.checkout_date||"-"}</td>
              <td>{dday&&<span className="dday" style={{color:dday.color,background:dday.color+"15"}}>{dday.label}</span>}{bdday&&<div style={{fontSize:9,color:bdday.color,fontWeight:700,marginTop:1}}>{bdday.label}</div>}</td>
              <td>{fmtAccom(b)}</td>
              <td>{acaStart(b)}</td>
              <td>{acaEnd(b)}</td>
              <td>{b.flight_in||"-"}</td>
              <td>{b.flight_out||"-"}</td>
              <td>{b.pickup_place||"-"}</td>
              <td>{b.drop_off||"-"}</td>
              <td>{b.agency||"-"}</td>
              <td>{b.balance_date||"-"}</td>
              <td style={{fontWeight:700}}>{fmt(b.final_price||b.base_price)}</td>
              <td className="wrap" title={b.special_request||""} style={{cursor:b.special_request?"pointer":"default",maxWidth:expandedSr.has(b.id)?"none":160}} onClick={e=>{e.stopPropagation();if(!b.special_request)return;setExpandedSr(prev=>{const n=new Set(prev);if(n.has(b.id))n.delete(b.id);else n.add(b.id);return n;});}}>
                {!b.special_request?"-":expandedSr.has(b.id)?b.special_request:(b.special_request.length>22?b.special_request.slice(0,22)+"...":b.special_request)}
              </td>
              <td onClick={e=>e.stopPropagation()} style={{textAlign:"center"}}>
                <input type="checkbox" className="chk" checked={!!b.confirmed} onChange={async e=>{
                  const v=e.target.checked;
                  await supabase.from("bookings").update({confirmed:v}).eq("id",b.id);
                  setBookings(prev=>prev.map(x=>x.id===b.id?{...x,confirmed:v}:x));
                }}/>
              </td>
            </tr>);
          })}
        </tbody></table></div>
      </>);
    })()}

    {/* ── 탭6: 학생관리 (bookings.students JSONB 평탄화) ── */}
    {mainTab==="students"&&(()=>{
      const q=stuSearch.toLowerCase();
      const stuCols:{key:string;label:string;get:(s:StudentRow)=>string|number}[]=[
        {key:"reservation_no",label:"예약번호",get:s=>shortNo(s.reservation_no)},
        {key:"academyStart",label:"시작일",get:s=>s.academyStart||""},
        {key:"academyEnd",label:"종료일",get:s=>s.academyEnd||""},
        {key:"academyWeeks",label:"기간",get:s=>s.academyWeeks?s.academyWeeks+"주":""},
        {key:"grade",label:"킨더/주니어",get:s=>s.grade||""},
        {key:"korName",label:"한글이름",get:s=>s.korName||""},
        {key:"engName",label:"영어이름",get:s=>s.engName||""},
        {key:"age",label:"나이",get:s=>s.age||""},
        {key:"accom",label:"숙소/룸",get:s=>fmtAccom(s as unknown as Record<string,string>)},
        {key:"checkin_date",label:"체크인",get:s=>s.checkin_date||""},
        {key:"checkout_date",label:"체크아웃",get:s=>s.checkout_date||""},
        {key:"booker_name",label:"예약자명",get:s=>s.booker_name||""},
        {key:"photo",label:"사진허용",get:s=>s.photo||""},
        {key:"special_request",label:"특이사항",get:s=>s.special_request||""},
      ];
      const searched=studentsList.filter(s=>{
        // 년 필터: academyStart의 년도가 일치해야 함 (시작 기준 유지)
        if(stuYear&&(!s.academyStart||!s.academyStart.startsWith(stuYear+"-")))return false;
        // 월 필터(overlap): 수업 기간[start, end]이 선택 월에 조금이라도 걸치면 포함
        if(stuMonthNum){
          if(!s.academyStart)return false;
          const year=Number(stuYear)||new Date(s.academyStart).getFullYear();
          const month=Number(stuMonthNum);
          const monthStart=new Date(year,month-1,1);
          const monthEnd=new Date(year,month,0);
          const startDate=new Date(s.academyStart);
          const endDate=new Date(s.academyEnd||s.academyStart);
          if(startDate>monthEnd||endDate<monthStart)return false;
        }
        if(!q)return true;
        return [s.korName,s.engName,s.booker_name,s.reservation_no].some(v=>v&&v.toLowerCase().includes(q));
      });
      const sorted=[...searched].sort((a,b)=>{
        const {key,asc}=stuSort;
        const col=stuCols.find(c=>c.key===key);
        if(!col)return 0;
        const va=String(col.get(a));const vb=String(col.get(b));
        return asc?va.localeCompare(vb):vb.localeCompare(va);
      });
      const toggleStuSort=(k:string)=>setStuSort(p=>p.key===k?{key:k,asc:!p.asc}:{key:k,asc:true});
      const arr=(k:string)=>stuSort.key===k?(stuSort.asc?"▲":"▼"):"⇅";
      const arrCls=(k:string)=>stuSort.key===k?"arr ac":"arr";
      return(<>
        <div className="cf-search">
          <input placeholder="🔍 한글/영어 이름, 예약자명, 예약번호 검색..." value={stuSearch} onChange={e=>setStuSearch(e.target.value)}/>
          <div style={{display:"flex",gap:4}}>
            <button className={`sub-tab${stuView==="list"?" ac":""}`} onClick={()=>setStuView("list")}>📋 리스트</button>
            <button className={`sub-tab${stuView==="cal"?" ac":""}`} onClick={()=>setStuView("cal")}>📅 달력</button>
          </div>
          <span className="cnt">{stuView==="list"?`${sorted.length}명`:""}</span>
          {stuView==="list"&&<button className="sub-tab" style={{marginLeft:"auto",background:"#dcfce7",color:"#166534",padding:"6px 14px",fontSize:12,fontWeight:600,border:"none",borderRadius:7,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>exportStudentsXlsx(sorted)}>📥 엑셀 내보내기</button>}
          {stuView==="cal"&&<button className="sub-tab" style={{marginLeft:"auto",background:"#dbeafe",color:"#1e40af",padding:"6px 14px",fontSize:12,fontWeight:600,border:"none",borderRadius:7,cursor:"pointer",fontFamily:"inherit"}} onClick={()=>window.print()}>🖨️ 인쇄 (A4 가로)</button>}
        </div>
        <div className="sub-tabs" style={{marginBottom:8}}>
          <span style={{fontSize:11,color:"#6b7c93",fontWeight:700,padding:"6px 8px"}}>년도:</span>
          {["",String(_now.getFullYear()-1),String(_now.getFullYear()),String(_now.getFullYear()+1)].map(y=>(
            <button key={y||"all-y"} className={`sub-tab${stuYear===y?" ac":""}`} onClick={()=>setStuYear(y)}>{y||"전체"}</button>
          ))}
        </div>
        <div className="sub-tabs">
          <span style={{fontSize:11,color:"#6b7c93",fontWeight:700,padding:"6px 8px"}}>월:</span>
          {["","01","02","03","04","05","06","07","08","09","10","11","12"].map(m=>(
            <button key={m||"all-m"} className={`sub-tab${stuMonthNum===m?" ac":""}`} onClick={()=>setStuMonthNum(m)}>{m?parseInt(m)+"월":"전체"}</button>
          ))}
        </div>
        {stuView==="list"?(
        <div className="ss-w"><table className="ss"><thead><tr>
          {stuCols.map(c=><th key={c.key} onClick={()=>toggleStuSort(c.key)}>{c.label}<span className={arrCls(c.key)}>{arr(c.key)}</span></th>)}
        </tr></thead><tbody>
          {sorted.length===0?<tr><td colSpan={stuCols.length} className="empty">학생 데이터가 없습니다.</td></tr>:
          sorted.map(s=>{
            return(
            <tr key={s.key} onClick={()=>router.push("/admin/bookings/"+s.booking_id)} style={{cursor:"pointer"}}>
              <td style={{fontWeight:700,color:"#1a6fc4"}}>{shortNo(s.reservation_no)}</td>
              <td>{s.academyStart||"-"}</td>
              <td>{s.academyEnd||"-"}</td>
              <td>{s.academyWeeks?s.academyWeeks+"주":"-"}</td>
              <td>{s.grade||"-"}</td>
              <td style={{fontWeight:700}}>{s.korName||"-"}</td>
              <td>{s.engName||"-"}</td>
              <td>{fmtStudentAge(s.age)}</td>
              <td>{fmtAccom(s as unknown as Record<string,string>)}</td>
              <td>{s.checkin_date||"-"}</td>
              <td>{s.checkout_date||"-"}</td>
              <td>{s.booker_name||"-"}</td>
              <td style={{textAlign:"center"}}>{s.photo||""}</td>
              <td className="wrap" onClick={e=>{e.stopPropagation();setStuSpecialPopup({booking_id:s.booking_id,current:s.special_request||""});setStuSpecialEdit(s.special_request||"");}} style={{cursor:"pointer",color:s.special_request?"#1a6fc4":"#94a3b8",textDecoration:s.special_request?"underline":"none"}}>
                {s.special_request?(s.special_request.length>30?s.special_request.slice(0,30)+"...":s.special_request):"+ 추가"}
              </td>
            </tr>);
          })}
        </tbody></table></div>
        ):(
          (()=>{
            const calYear=Number(stuYear)||_now.getFullYear();
            const calMonth=Number(stuMonthNum)||(_now.getMonth()+1);
            const weeks=genCalWeeks(calYear,calMonth);
            return (
              <div className="cal-wrap">
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                  <button className="sub-tab no-print" onClick={()=>{
                    let y=calYear,m=calMonth-1;
                    if(m<1){y-=1;m=12;}
                    setStuYear(String(y));setStuMonthNum(String(m).padStart(2,"0"));
                  }}>← 이전달</button>
                  <div className="cal-title" style={{fontSize:16,fontWeight:800,color:"#1a1a2e"}}>{calYear}년 {calMonth}월 학생 캘린더</div>
                  <button className="sub-tab no-print" onClick={()=>{
                    let y=calYear,m=calMonth+1;
                    if(m>12){y+=1;m=1;}
                    setStuYear(String(y));setStuMonthNum(String(m).padStart(2,"0"));
                  }}>다음달 →</button>
                </div>
                <table className="cal-tbl">
                  <thead>
                    <tr>
                      <th className="cal-side">주별 요약</th>
                      <th>월</th><th>화</th><th>수</th><th>목</th><th>금</th><th>토</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weeks.map((week,wi)=>{
                      const wsStr=calYmd(week[0]);
                      const weStr=calYmd(week[6]);
                      // 주별 재학중인 학생 (start <= weekEnd && end >= weekStart)
                      // guardian "-/-" 같은 placeholder 엔트리는 카운트/배지에서 제외
                      const isRealStudent=(s:StudentRow)=>{
                        const k=s.korName||""; const e=s.engName||"";
                        if(!k&&!e) return false;          // 이름 필드 자체가 없는 경우 일단 표시 안함
                        if(k==="-"&&(e==="-"||!e)) return false; // guardian "-/-" 항목만 숨김
                        return true;
                      };
                      const active=studentsList.filter(s=>{
                        if(!isRealStudent(s))return false;
                        if(!s.academyStart)return false;
                        const aen=s.academyEnd||s.academyStart;
                        return s.academyStart<=weStr&&aen>=wsStr;
                      });
                      const kCount=active.filter(s=>s.grade==="킨더").length;
                      const jCount=active.filter(s=>s.grade==="주니어").length;
                      const newIns=studentsList.filter(s=>isRealStudent(s)&&s.academyStart&&s.academyStart>=wsStr&&s.academyStart<=weStr);
                      const outs=studentsList.filter(s=>isRealStudent(s)&&s.academyEnd&&s.academyEnd>=wsStr&&s.academyEnd<=weStr);
                      return (
                        <tr key={wi}>
                          <td className="cal-side">
                            <div>Kinder-{kCount}</div>
                            <div>Junior-{jCount}</div>
                            <div className="cal-total">{jCount}/{kCount}</div>
                          </td>
                          {week.slice(0,6).map((day,di)=>{
                            const dStr=calYmd(day);
                            const inMonth=day.getMonth()===calMonth-1;
                            const isMon=day.getDay()===1;
                            const isFri=day.getDay()===5;
                            const startList=studentsList.filter(s=>s.academyStart===dStr);
                            const endList=studentsList.filter(s=>s.academyEnd===dStr);
                            return (
                              <td key={di} className={`cal-cell${inMonth?"":" out-month"}`}>
                                <div className="cal-d">{day.getMonth()+1}/{day.getDate()}</div>
                                {isMon&&newIns.length>0&&<span className="cal-newin">{newIns.length} New in</span>}
                                {isFri&&outs.length>0&&<span className="cal-out">Graduation / {outs.length} out</span>}
                                {startList.map(s=>{const isKinder=s.grade==="킨더";const age=getStudentAge(s);const ageStr=age?`${age}y`:"-";const totalW=getStudentWeeks(s);const wkStr=totalW?`${totalW}w`:"-w";return (<div key={`s${s.key}`} className="cal-stu-in" title={`${s.korName||""} ${s.engName||""}`.trim()} style={{fontSize:11}}>+ {isKinder&&<span style={{color:"#1a1a2e",fontWeight:800}}>K</span>}{s.korName||""}/{s.engName||""}/{ageStr}/{wkStr}</div>);})}
                                {endList.map(s=>{const isKinder=s.grade==="킨더";const age=getStudentAge(s);const ageStr=age?`${age}y`:"-";const totalW=getStudentWeeks(s);const wkStr=totalW?`${totalW}w`:"-w";return (<div key={`e${s.key}`} className="cal-stu-out" title={`${s.korName||""} ${s.engName||""}`.trim()} style={{fontSize:11}}>- {isKinder&&<span style={{color:"#1a1a2e",fontWeight:800}}>K</span>}{s.korName||""}/{s.engName||""}/{ageStr}/{wkStr}</div>);})}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()
        )}
      </>);
    })()}

    {/* ── 탭5: 견적계산기 ── */}
    {mainTab==="estimate"&&<EstimateCalc/>}
  </div>

  {/* 특이사항 편집 팝업 */}
  {stuSpecialPopup&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}} onClick={()=>setStuSpecialPopup(null)}>
    <div style={{background:"#fff",borderRadius:16,padding:24,width:"100%",maxWidth:520,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
      <h2 style={{fontSize:17,fontWeight:800,marginBottom:14}}>특이사항 편집</h2>
      <textarea value={stuSpecialEdit} onChange={e=>setStuSpecialEdit(e.target.value)}
        style={{width:"100%",padding:12,border:"1px solid #e2e8f0",borderRadius:10,fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",minHeight:200,lineHeight:1.6}}
        placeholder="특이사항을 입력하세요..."/>
      <div style={{fontSize:11,color:"#94a3b8",marginTop:6}}>기존 내용에 추가하거나 수정할 수 있습니다. 저장 시 해당 예약의 모든 학생에 공통 반영됩니다.</div>
      <div style={{display:"flex",gap:8,justifyContent:"flex-end",marginTop:14}}>
        <button onClick={()=>setStuSpecialPopup(null)} style={{padding:"10px 20px",border:"1px solid #e2e8f0",borderRadius:8,background:"#f1f5f9",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
        <button onClick={async()=>{
          await supabase.from("bookings").update({special_request:stuSpecialEdit}).eq("id",stuSpecialPopup.booking_id);
          setBookings(prev=>prev.map(b=>b.id===stuSpecialPopup.booking_id?{...b,special_request:stuSpecialEdit}:b));
          setStuSpecialPopup(null);
        }} style={{padding:"10px 24px",border:"none",borderRadius:8,background:"#1a6fc4",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>저장</button>
      </div>
    </div>
  </div>)}

  {/* ── STEP 22: 예약 유형 선택 모달 ── */}
  {showNewBooking&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,padding:16}} onClick={()=>setShowNewBooking(false)}>
    <div style={{background:"#fff",borderRadius:16,padding:28,width:"100%",maxWidth:540,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
      <h2 style={{fontSize:20,fontWeight:800,marginBottom:14}}>신규 예약 등록</h2>

      {/* 탭 분리 */}
      <div style={{display:"flex",gap:6,marginBottom:18,borderBottom:"2px solid #e2e8f0"}}>
        <button onClick={()=>setModalTab('allInOne')} style={{flex:1,padding:"10px 12px",background:"none",border:"none",borderBottom:modalTab==='allInOne'?"3px solid #7c3aed":"3px solid transparent",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",color:modalTab==='allInOne'?"#7c3aed":"#6b7c93",marginBottom:-2}}>🌟 올인원 패키지</button>
        <button onClick={()=>setModalTab('nonPackage')} style={{flex:1,padding:"10px 12px",background:"none",border:"none",borderBottom:modalTab==='nonPackage'?"3px solid #7c3aed":"3px solid transparent",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit",color:modalTab==='nonPackage'?"#7c3aed":"#6b7c93",marginBottom:-2}}>📋 비패키지</button>
      </div>

      {modalTab==='allInOne'&&(<>

      {/* 유형 선택 */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:13,fontWeight:700,color:"#475569",marginBottom:8}}>예약 유형</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          {BOOKING_TYPES.map(t=>(
            <div key={t.value} onClick={()=>setBType(t.value)} style={{
              border:bType===t.value?"2px solid #7c3aed":"2px solid #e2e8f0",
              borderRadius:12,padding:"12px 14px",cursor:"pointer",transition:"all 150ms",
              background:bType===t.value?"#f5f3ff":"#fff",
            }}>
              <div style={{fontSize:14,fontWeight:700,color:bType===t.value?"#7c3aed":"#1a1a2e"}}>{t.label}</div>
              <div style={{fontSize:11,color:"#6b7c93",marginTop:2}}>{t.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 동적 필드 — 통학형은 숙소 정보 없음 */}
      {bType!=="commute"&&(
      <div style={{marginBottom:16,padding:14,background:"#f8fafc",borderRadius:10}}>
        <div style={{fontSize:13,fontWeight:700,color:"#475569",marginBottom:10}}>숙소 상세</div>
        {(bType==="dreamhouse"||bType==="dreamhouse_jaypark"||bType==="dreamhouse_cubenine")&&(
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
            <label style={{fontSize:13,minWidth:90}}>드림하우스</label>
            <select value={newForm.dh_weeks} onChange={e=>setNewForm({...newForm,dh_weeks:Number(e.target.value)})}
              style={{padding:"6px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,fontFamily:"inherit"}}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(w=><option key={w} value={w}>{w}주</option>)}
            </select>
          </div>
        )}
        {bType==="dreamhouse_jaypark"&&(
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
            <label style={{fontSize:13,minWidth:90}}>제이파크</label>
            <select value={newForm.jp_weeks} onChange={e=>setNewForm({...newForm,jp_weeks:Number(e.target.value)})}
              style={{padding:"6px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,fontFamily:"inherit"}}>
              {[1,2,3,4,5,6,7,8].map(w=><option key={w} value={w}>{w}주</option>)}
            </select>
          </div>
        )}
        {bType==="dreamhouse_cubenine"&&(
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
            <label style={{fontSize:13,minWidth:90}}>큐브나인</label>
            <select value={newForm.cn_period} onChange={e=>setNewForm({...newForm,cn_period:e.target.value})}
              style={{padding:"6px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,fontFamily:"inherit"}}>
              {CN_PERIODS.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
        {bType==="jaypark"&&(
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
            <label style={{fontSize:13,minWidth:90}}>제이파크</label>
            <select value={newForm.jp_weeks} onChange={e=>setNewForm({...newForm,jp_weeks:Number(e.target.value)})}
              style={{padding:"6px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,fontFamily:"inherit"}}>
              {[1,2,3,4,5,6,7,8].map(w=><option key={w} value={w}>{w}주</option>)}
            </select>
          </div>
        )}
        {bType==="cubenine"&&(
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
            <label style={{fontSize:13,minWidth:90}}>큐브나인</label>
            <select value={newForm.cn_period} onChange={e=>setNewForm({...newForm,cn_period:e.target.value})}
              style={{padding:"6px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,fontFamily:"inherit"}}>
              {CN_PERIODS.map(p=><option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        )}
        {bType==="room_only"&&(<>
          <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:8}}>
            <label style={{fontSize:13,minWidth:90}}>숙소</label>
            <select value={newForm.room_accom} onChange={e=>setNewForm({...newForm,room_accom:e.target.value})}
              style={{padding:"6px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,fontFamily:"inherit"}}>
              {ROOM_ACCOMS.map(a=><option key={a.v} value={a.v}>{a.l}</option>)}
            </select>
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            <label style={{fontSize:13,minWidth:90}}>기간</label>
            <select value={newForm.room_weeks} onChange={e=>setNewForm({...newForm,room_weeks:Number(e.target.value)})}
              style={{padding:"6px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:13,fontFamily:"inherit"}}>
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(w=><option key={w} value={w}>{w}주</option>)}
            </select>
          </div>
        </>)}
      </div>
      )}

      {/* 기본 정보 */}
      {[
        {label:"예약자명 *",key:"booker_name",type:"text",ph:"홍길동"},
        {label:"보호자 영문이름",key:"booker_english",type:"text",ph:"HONG GILDONG"},
        {label:"연락처",key:"booker_phone",type:"text",ph:"010-0000-0000"},
        {label:bType==="commute"?"수업시작":"체크인",key:"check_in",type:"date",ph:""},
        {label:bType==="commute"?"수업종료":"체크아웃",key:"check_out",type:"date",ph:""},
        {label:"픽업장소",key:"pickup_place",type:"text",ph:"공항"},
        {label:"드랍장소",key:"drop_place",type:"text",ph:"공항"},
        {label:"유학원",key:"agency",type:"text",ph:""},
      ].map(f=>(
        <div key={f.key} style={{marginBottom:10}}>
          <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:3}}>{f.label}</label>
          <input type={f.type} placeholder={f.ph} value={(newForm as Record<string,any>)[f.key]}
            onChange={e=>setNewForm({...newForm,[f.key]:e.target.value})}
            style={{width:"100%",padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
        </div>
      ))}
      <div style={{marginBottom:16}}>
        <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:3}}>특이사항</label>
        <textarea value={newForm.special_request} onChange={e=>setNewForm({...newForm,special_request:e.target.value})}
          style={{width:"100%",padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",minHeight:50}}/>
      </div>

      {/* STEP 23: 항공권 */}
      <div style={{marginBottom:16,padding:14,background:"#f0f4ff",borderRadius:10}}>
        <div style={{fontSize:13,fontWeight:700,color:"#1e40af",marginBottom:10}}>입국편</div>
        <label style={{fontSize:12,display:"flex",alignItems:"center",gap:6,marginBottom:8,cursor:"pointer"}}>
          <input type="checkbox" checked={flightIn.undecided} onChange={e=>setFlightIn({...flightIn,undecided:e.target.checked})}/>
          <span style={{color:"#6b7c93"}}>미정</span>
        </label>
        {!flightIn.undecided&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          <input placeholder="항공사 (예: 대한항공)" value={flightIn.airline} onChange={e=>setFlightIn({...flightIn,airline:e.target.value})} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          <input placeholder="편명 (예: KE631)" value={flightIn.flight_no} onChange={e=>setFlightIn({...flightIn,flight_no:e.target.value})} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          <input type="date" value={flightIn.date} onChange={e=>setFlightIn({...flightIn,date:e.target.value})} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          <input type="time" value={flightIn.time} onChange={e=>setFlightIn({...flightIn,time:e.target.value})} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          <input placeholder="출발지 (예: 인천)" value={flightIn.place} onChange={e=>setFlightIn({...flightIn,place:e.target.value})} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none",gridColumn:"1/3"}}/>
        </div>)}
        <div style={{fontSize:13,fontWeight:700,color:"#166534",marginTop:14,marginBottom:10}}>출국편</div>
        <label style={{fontSize:12,display:"flex",alignItems:"center",gap:6,marginBottom:8,cursor:"pointer"}}>
          <input type="checkbox" checked={flightOut.undecided} onChange={e=>setFlightOut({...flightOut,undecided:e.target.checked})}/>
          <span style={{color:"#6b7c93"}}>미정</span>
        </label>
        {!flightOut.undecided&&(<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
          <input placeholder="항공사" value={flightOut.airline} onChange={e=>setFlightOut({...flightOut,airline:e.target.value})} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          <input placeholder="편명" value={flightOut.flight_no} onChange={e=>setFlightOut({...flightOut,flight_no:e.target.value})} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          <input type="date" value={flightOut.date} onChange={e=>setFlightOut({...flightOut,date:e.target.value})} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          <input type="time" value={flightOut.time} onChange={e=>setFlightOut({...flightOut,time:e.target.value})} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          <input placeholder="도착지 (예: 인천)" value={flightOut.place} onChange={e=>setFlightOut({...flightOut,place:e.target.value})} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none",gridColumn:"1/3"}}/>
        </div>)}
      </div>

      {/* STEP 23: 학생 */}
      <div style={{marginBottom:16,padding:14,background:"#fefce8",borderRadius:10}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <span style={{fontSize:13,fontWeight:700,color:"#854d0e"}}>학생 정보</span>
          <span style={{fontSize:11,color:"#a16207"}}>{students23.length}/5명</span>
          {students23.length<5&&<button onClick={addStudent} style={{marginLeft:"auto",padding:"4px 12px",border:"1px solid #e2e8f0",borderRadius:6,background:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ 학생 추가</button>}
        </div>
        {students23.map((s,i)=>(
          <div key={i} style={{padding:10,background:"#fff",borderRadius:8,marginBottom:8,border:"1px solid #e2e8f0"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
              <span style={{fontSize:12,fontWeight:700,color:"#475569"}}>학생 {i+1}</span>
              {students23.length>1&&<button onClick={()=>removeStudent(i)} style={{marginLeft:"auto",padding:"2px 8px",border:"none",background:"#fef2f2",color:"#dc2626",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>삭제</button>}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              <input placeholder="한글 이름 *" value={s.name_kr} onChange={e=>updateStudent(i,"name_kr",e.target.value)} onBlur={async()=>{if(s.name_kr.trim()&&!s.name_en.trim()){const k=s.name_kr.trim();const{data}=await supabase.from("students").select("name_en").eq("name_kr",k);const found=(data||[]).find(r=>r.name_en&&r.name_en.trim());if(found?.name_en)updateStudent(i,"name_en",found.name_en);}}} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
              <input placeholder="영어 이름" value={s.name_en} onChange={e=>updateStudent(i,"name_en",e.target.value)} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
              <input placeholder="생년월일/나이" value={s.birth_date} onChange={e=>updateStudent(i,"birth_date",e.target.value)} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
              <select value={s.level} onChange={e=>updateStudent(i,"level",e.target.value)} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none",background:"#fff"}}>
                <option value="">킨더/주니어 선택</option>
                <option value="kinder">킨더 (Kinder)</option>
                <option value="junior">주니어 (Junior)</option>
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* STEP 24: 결제 */}
      <div style={{marginBottom:16,padding:14,background:"#f0fdf4",borderRadius:10}}>
        <div style={{fontSize:13,fontWeight:700,color:"#166534",marginBottom:10}}>결제 정보</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#475569",display:"block",marginBottom:2}}>전체 금액 (원)</label>
            <input type="number" placeholder="0" value={payForm.total_amount||""} onChange={e=>setPayForm({...payForm,total_amount:parseInt(e.target.value)||0})}
              style={{width:"100%",padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:600,color:"#475569",display:"block",marginBottom:2}}>예약금 (원)</label>
            <input type="number" placeholder="0" value={payForm.deposit_amount||""} onChange={e=>setPayForm({...payForm,deposit_amount:parseInt(e.target.value)||0})}
              style={{width:"100%",padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:8}}>
          <label style={{fontSize:12,display:"flex",alignItems:"center",gap:6,cursor:"pointer"}}>
            <input type="checkbox" checked={payForm.deposit_paid} onChange={e=>setPayForm({...payForm,deposit_paid:e.target.checked})}/>
            <span>예약금 입금 완료</span>
          </label>
          {payForm.total_amount>0&&payForm.deposit_amount>0&&(
            <span style={{fontSize:11,color:"#6b7c93"}}>잔금: {(payForm.total_amount-payForm.deposit_amount).toLocaleString()}원</span>
          )}
        </div>
        <input placeholder="결제 메모 (선택)" value={payForm.payment_memo} onChange={e=>setPayForm({...payForm,payment_memo:e.target.value})}
          style={{width:"100%",padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
      </div>

      </>)}

      {modalTab==='nonPackage'&&(<>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:13,fontWeight:700,color:"#475569",marginBottom:8}}>예약 유형</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {NP_TYPES.map(t=>(
              <div key={t.v} onClick={()=>setNpType(t.v)} style={{
                border:npType===t.v?"2px solid #7c3aed":"2px solid #e2e8f0",
                borderRadius:12,padding:"12px 14px",cursor:"pointer",
                background:npType===t.v?"#f5f3ff":"#fff",
              }}>
                <div style={{fontSize:14,fontWeight:700,color:npType===t.v?"#7c3aed":"#1a1a2e"}}>{t.label}</div>
                <div style={{fontSize:11,color:"#6b7c93",marginTop:2}}>{t.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{marginBottom:14,padding:14,background:"#f8fafc",borderRadius:10}}>
          <div style={{fontSize:13,fontWeight:700,color:"#475569",marginBottom:10}}>{npType==='commute'?"수업 일정":"체크인 · 체크아웃"}</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#475569",display:"block",marginBottom:3}}>{npType==='commute'?"수업시작 *":"체크인 *"}</label>
              <input type="date" value={newForm.check_in} onChange={e=>setNewForm({...newForm,check_in:e.target.value})}
                style={{width:"100%",padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:600,color:"#475569",display:"block",marginBottom:3}}>{npType==='commute'?"수업종료 *":"체크아웃 *"}</label>
              <input type="date" value={newForm.check_out} onChange={e=>setNewForm({...newForm,check_out:e.target.value})}
                style={{width:"100%",padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
            </div>
          </div>
        </div>

        {[
          {label:"예약자명 *",key:"booker_name",type:"text",ph:"홍길동"},
          {label:"보호자 영문이름",key:"booker_english",type:"text",ph:"HONG GILDONG"},
          {label:"연락처",key:"booker_phone",type:"text",ph:"010-0000-0000"},
          ...(npType!=='commute'?[
            {label:"픽업장소",key:"pickup_place",type:"text",ph:"공항"},
            {label:"드랍장소",key:"drop_place",type:"text",ph:"공항"},
          ]:[]),
          {label:"유학원",key:"agency",type:"text",ph:""},
        ].map(f=>(
          <div key={f.key} style={{marginBottom:10}}>
            <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:3}}>{f.label}</label>
            <input type={f.type} placeholder={f.ph} value={(newForm as Record<string,any>)[f.key]}
              onChange={e=>setNewForm({...newForm,[f.key]:e.target.value})}
              style={{width:"100%",padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none"}}/>
          </div>
        ))}

        <div style={{marginBottom:16,padding:14,background:"#fefce8",borderRadius:10}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <span style={{fontSize:13,fontWeight:700,color:"#854d0e"}}>학생 정보</span>
            <span style={{fontSize:11,color:"#a16207"}}>{students23.length}/5명</span>
            {students23.length<5&&<button onClick={addStudent} style={{marginLeft:"auto",padding:"4px 12px",border:"1px solid #e2e8f0",borderRadius:6,background:"#fff",fontSize:11,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>+ 학생 추가</button>}
          </div>
          {students23.map((s,i)=>(
            <div key={i} style={{padding:10,background:"#fff",borderRadius:8,marginBottom:8,border:"1px solid #e2e8f0"}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                <span style={{fontSize:12,fontWeight:700,color:"#475569"}}>학생 {i+1}</span>
                {students23.length>1&&<button onClick={()=>removeStudent(i)} style={{marginLeft:"auto",padding:"2px 8px",border:"none",background:"#fef2f2",color:"#dc2626",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>삭제</button>}
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <input placeholder="한글 이름 *" value={s.name_kr} onChange={e=>updateStudent(i,"name_kr",e.target.value)} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                <input placeholder="영어 이름" value={s.name_en} onChange={e=>updateStudent(i,"name_en",e.target.value)} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                <input placeholder="생년월일/나이" value={s.birth_date} onChange={e=>updateStudent(i,"birth_date",e.target.value)} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none"}}/>
                <select value={s.level} onChange={e=>updateStudent(i,"level",e.target.value)} style={{padding:"7px 10px",border:"1px solid #e2e8f0",borderRadius:6,fontSize:12,fontFamily:"inherit",outline:"none",background:"#fff"}}>
                  <option value="">킨더/주니어 선택</option>
                  <option value="kinder">킨더 (Kinder)</option>
                  <option value="junior">주니어 (Junior)</option>
                </select>
              </div>
            </div>
          ))}
        </div>

        <div style={{marginBottom:16}}>
          <label style={{fontSize:12,fontWeight:600,color:"#475569",display:"block",marginBottom:3}}>특이사항</label>
          <textarea value={newForm.special_request} onChange={e=>setNewForm({...newForm,special_request:e.target.value})}
            style={{width:"100%",padding:"8px 10px",border:"1px solid #e2e8f0",borderRadius:8,fontSize:13,fontFamily:"inherit",outline:"none",resize:"vertical",minHeight:50}}/>
        </div>
      </>)}

      <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
        <button onClick={()=>setShowNewBooking(false)}
          style={{padding:"10px 20px",border:"1px solid #e2e8f0",borderRadius:8,background:"#f1f5f9",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>취소</button>
        <button onClick={modalTab==='allInOne'?saveNewBooking:saveNewNonPackage} disabled={savingNew}
          style={{padding:"10px 24px",border:"none",borderRadius:8,background:"#7c3aed",color:"#fff",fontSize:13,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>
          {savingNew?"저장 중...":"예약 등록"}
        </button>
      </div>
    </div>
  </div>)}
  </>);
}
