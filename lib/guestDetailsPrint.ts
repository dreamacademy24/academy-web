interface Booking {
  id: string; booker_name: string; booker_english?: string;
  accom_type?: string; accom_room?: string; house_no?: string;
  booking_type?: string; seg1_type?: string; seg2_type?: string;
  checkin_date: string; checkout_date: string;
  pickup_place?: string; drop_off?: string;
  flight_in?: string; flight_out?: string;
  flight_in_airline?: string; flight_in_date?: string; flight_in_time?: string;
  flight_out_airline?: string; flight_out_date?: string; flight_out_time?: string;
  adults?: number; children?: number;
  special_request?: string; reservation_no?: string;
  flight_images?: string[];
  flight_in_no?: string; flight_out_no?: string;
}

interface Detail {
  id?: string;
  booking_id: string;
  booker_name: string;
  checkin_date: string;
  guest_names_en: string;
  bed_setting: string;        // JSON string {room1,room2,room3}
  usim_request: string;       // JSON string [{plan}]
  extra_pickups: string;      // JSON array string [{type,date,airline,flight,time}]
  extra_requests: string;
  public_token: string;
  submitted_at?: string | null;     // 손님 공개폼 제출 시각
  admin_saved_at?: string | null;   // 어드민 저장 완료 시각
}

function bedNum(v: string): string {
  const s = v || "";
  if (!s || s.includes("사용하지 않음")) return "0";
  let n = 0;
  const m = s.match(/더블베드\s*(\d+)개/);
  if (m) n += Number(m[1]);
  else if (s.includes("더블베드")) n += 1;
  if (s.includes("싱글")) n += 1;
  return n > 0 ? String(n) : "-";
}

// 유심 요금제 "24GB / 30일 / ₱499" → 컴팩트 "24GB/30d"
function simCompact(plan: string): string {
  const parts = String(plan || "").split("/").map(x => x.trim());
  const gb = parts.find(p => /GB/i.test(p)) || "";
  const days = parts.find(p => /일|day/i.test(p)) || "";
  const d = days.replace(/\s*일/, "d").replace(/\s*days?/i, "d");
  return [gb, d].filter(Boolean).join("/");
}

// accom_type이 패키지 계열(콤보/올인원)인지 판별
function isPackage(t?: string): boolean {
  const s = t || "";
  return s.includes("+") || s.includes("올인원") || s.includes("패키지");
}

  function enText(v: any): string {
    let s = (v === null || v === undefined) ? "" : String(v);
    if (!s) return s;
    const map: [string, string][] = [
      // 베드 세팅 (긴 문자열 먼저)
      ["더블베드 2개 (3~4인 스테이)", "Double Bed x2 (3-4 guests)"],
      ["더블베드+싱글 (3인 스테이)", "Double+Single Bed (3 guests)"],
      ["더블베드 1개 (1~2인 스테이)", "Double Bed x1 (1-2 guests)"],
      ["더블베드 1개 (2인 스테이)", "Double Bed x1 (2 guests)"],
      ["사용하지 않음", "Not in use"],
      // 숙소/장소 ("막탄공항"을 "공항"보다 먼저)
      ["드림하우스", "Dream House"],
      ["막탄공항", "Mactan Airport"],
      ["공항", "Airport"],
      ["필요함", "Required"],
      ["불필요", "Not required"],
      ["미정", "TBD"],
      ["픽업", "Pick-up"],
      ["드랍", "Drop"],
    ];
    for (const [ko, en] of map) s = s.split(ko).join(en);
    // 기간 "N일" → "N days" (날짜 문자열은 tr 미적용이므로 안전)
    s = s.replace(/(\d+)\s*일/g, "$1 days");
    return s;
  }

  export function buildGuestDetails(b: Booking, d: Partial<Detail>, bedConfig: {room1:string;room2:string;room3:string}, simCards: {plan:string}[], localItems: {name:string;amount:string}[], flightImages: string[]) {
    const dash = (v: unknown) => v === null || v === undefined || v === "" ? "-" : String(v).replace(/[&<>"\']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\'":"&#39;",'"':"&quot;"}[c]!));
    const label = (en:string,ko:string) => `${en}<small class="ko" lang="ko">${ko}</small>`;
    const L = {title:'GUEST DETAILS',name:label('GUEST NAME','예약자'),house:label('HOUSE NO.','하우스 번호'),
      cin:label('CHECK-IN','체크인'),cout:label('CHECK-OUT','체크아웃'),pick:label('ARRIVAL / PICK-UP','입국 · 픽업'),
      master:label('2F MASTER','2층 큰방'),small:label('2F SMALL','2층 작은방'),first:label('1F ROOM','1층 방'),
      sim:label('SIM PLAN','유심 요금제'),load:label('QUANTITY','유심 수량'),guest:label('ALL GUESTS','투숙객 전체'),
      add:label('EXTRA TRANSFER','추가 픽업 · 드랍'),memo:label('MEMO','메모'),settle:label('SETTLEMENT','정산'),
      deposit:label('DEPOSIT','보증금'),date:label('DATE','날짜'),item:label('ITEM','항목'),amount:label('AMOUNT','금액'),note:label('NOTE','비고'),pkg:label('ALL-INCLUSIVE PACKAGE','올인원 패키지')};

    const logo = (typeof window !== "undefined" ? window.location.origin : "") + "/dream-academy-logo.png";
    const nameLine = b.booker_english ? `${dash(b.booker_english)} <small class="ko" lang="ko">${dash(b.booker_name)}</small>` : dash(b.booker_name);
    const houseNo = dash(b.house_no || b.accom_room);
    const checkIn = dash(d.checkin_date || b.checkin_date);
    const checkOut = dash(b.checkout_date);
    const arrAirline = [b.flight_in_airline, b.flight_in_no].filter(Boolean).join(" ") || (b.flight_in || "");
    const arrWhen = [((b.flight_in_date || "").split("T")[0] || "").replace(/-/g,"."), b.flight_in_time].filter(Boolean).join(" ");
    const arrFlight = dash([arrAirline, arrWhen].filter(Boolean).join(" / ") || b.pickup_place);
    const m1 = bedNum(bedConfig.room1), m2 = bedNum(bedConfig.room2), m3 = bedNum(bedConfig.room3);
    const simList = simCards.map(s => simCompact(s.plan)).filter(Boolean);
    const simText = simList.length ? simList.join(", ") : "-";
    const loadText = simList.length ? String(simList.length) : "-";
    const guests = dash(d.guest_names_en);
    let addText = "-";
    try {
      const arr = JSON.parse(d.extra_pickups || "[]");
      if (Array.isArray(arr) && arr.length > 0) {
        addText = arr.map((p: { type?: string; date?: string; time?: string; airline?: string; flight?: string }) => {
          const line = `[${p.type || ""}] ${p.date || ""} ${p.time || ""} ${p.airline || ""} ${p.flight || ""}`.replace(/\s+/g, " ").trim();
          return dash(line);
        }).join("  |  ");
      }
    } catch {}
    const etc = d.extra_requests ? dash(d.extra_requests) : "";
    const isPkg = isPackage(b.accom_type);
    const pkgBadge = isPkg ? `<span class="pkg">${L.pkg}</span>` : "";
    const memoLines = Array.from({length:2}).map(()=>`<div class="mline"></div>`).join("");
    const memoHtml = (etc ? `<div class="metxt">${etc}</div>` : "") + memoLines;

    // 정산 섹션 - 보증금 항목 찾기
    const depositItem = localItems.find(l => l.name?.includes("보증금") || l.name?.toLowerCase().includes("deposit"));
    let depositAmt = "_______ PHP";
    if(depositItem && depositItem.amount){
      depositAmt = `${Number(String(depositItem.amount).replace(/[,\s]/g,"")).toLocaleString()} PHP`;
    } else {
      // 체크인~체크아웃 주수로 자동 계산 (Dream House 기준: 4주=8000, 3주=6000, 2주=4000)
      const cin = new Date(b.checkin_date||""); const cout = new Date(b.checkout_date||"");
      if(!isNaN(cin.getTime()) && !isNaN(cout.getTime())){
        const days = Math.round((cout.getTime()-cin.getTime())/(1000*60*60*24));
        const weeks = Math.round(days/7);
        const depMap:{[k:number]:number} = {2:4000,3:6000,4:8000};
        if(depMap[weeks]) depositAmt = `${depMap[weeks].toLocaleString()} PHP`;
        else if(weeks>4) depositAmt = `8,000 PHP`;
        else if(weeks>=1) depositAmt = `${weeks*2000} PHP`;
      }
    }
    const otherLocals = localItems.filter(l => !l.name?.includes("보증금") && !l.name?.toLowerCase().includes("deposit"));
    const blankRows = 11;
    const settleRows = Array.from({length:blankRows}).map(()=>
      `<tr><td class="sdate"></td><td class="sitem"></td><td class="samt"></td><td class="snote"></td></tr>`
    ).join("");

    const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"/>
<title>${L.title} — ${dash(b.booker_name)}</title>
<style>
  *{box-sizing:border-box;-webkit-print-color-adjust:exact !important;print-color-adjust:exact !important;}
  body{font-family:Arial,Helvetica,'Malgun Gothic',sans-serif;color:#1f2937;margin:0;padding:0;background:#fff;}
  .ko{display:block;font-size:9px;font-weight:400;letter-spacing:0;color:#64748b;margin-top:3px;text-transform:none;line-height:1.4;}
  .fld .lbl .ko,.settle-hd .ko,.settle-tbl .ko,.pkg-badge .ko{display:inline;margin:0 0 0 4px;white-space:nowrap;}
  .fld .lbl .ko::before,.settle-hd .ko::before,.settle-tbl .ko::before,.pkg-badge .ko::before{content:'('}
  .fld .lbl .ko::after,.settle-hd .ko::after,.settle-tbl .ko::after,.pkg-badge .ko::after{content:')'}
  .fld .val .ko{display:inline;margin-left:4px;}
  #cdwrap{overflow:hidden;}
  #cdsheet{padding:22px 26px;min-height:257mm;display:flex;flex-direction:column;transform-origin:top center;}

  .hd{display:flex;align-items:flex-end;justify-content:space-between;border-bottom:2px solid #1f2937;padding-bottom:8px;margin-bottom:18px;}
  .hd img{height:38px;width:auto;}
  .hd-title{font-size:26px;font-weight:800;letter-spacing:2px;color:#1f2937;}
  .pkg-badge{display:inline-block;box-shadow:inset 0 0 0 1000px #eef2ff !important;color:#4f46e5 !important;font-size:10px;font-weight:700;letter-spacing:0.06em;padding:2px 10px;border-radius:4px;margin-top:5px;}

  .info{display:grid;grid-template-columns:1fr .85fr 1.3fr;gap:0;border:1px solid #aebdc8;margin-bottom:18px;}
  .fld{padding:12px 13px;min-width:0;border-right:1px solid #c5cfd7;border-bottom:1px solid #c5cfd7;overflow-wrap:anywhere;}
  .fld:nth-child(3n){border-right:0}.fld:nth-child(n+4){border-bottom:0}
  .fld .lbl{font-size:11px;color:#64748b;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:3px;}
  .fld .val{font-size:14px;font-weight:700;color:#1f2937;line-height:1.55;margin-top:7px;}
  .fld .val .sub{font-weight:400;color:#6b7280;}

  .cards{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:16px;}
  .card{box-shadow:inset 0 0 0 1000px #f8fafc !important;border:1.5px solid #94a3b8;border-radius:8px;padding:9px 8px;text-align:center;}
  .card .ct{font-size:11px;color:#475569;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;margin-bottom:4px;}
  .card .cv{font-size:23px;font-weight:800;color:#1f2937;}
  .card .cv.sm{font-size:15px;}

  .line{display:flex;gap:12px;border:1.5px solid #94a3b8;border-radius:8px;padding:9px 12px;margin-bottom:8px;align-items:baseline;}
  .line .k{font-size:11px;color:#475569;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;flex-shrink:0;width:105px;}
  .line .v{font-size:14px;color:#1f2937;font-weight:600;flex:1;}
  .line.memo .v{color:#374151;font-weight:400;}
  .metxt{font-size:13px;color:#374151;margin-bottom:4px;}
  .mline{border-bottom:1.5px solid #64748b;height:22px;}

  .settle-hd{font-size:12px;font-weight:800;letter-spacing:0.08em;color:#1f2937;margin:6px 0 8px;display:flex;justify-content:space-between;align-items:center;}
  .dep-pill{box-shadow:inset 0 0 0 1000px #fef3c7 !important;color:#92400e !important;font-size:13px;font-weight:800;padding:4px 14px;border-radius:6px;}
  .dep-pill .ko{display:inline;margin:0 6px;}
  .settle-tbl{width:100%;border-collapse:collapse;}
  .settle-tbl th{box-shadow:inset 0 0 0 1000px #f8fafc !important;color:#475569 !important;font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;text-align:left;padding:9px 10px;border-bottom:2px solid #475569;}
  .settle-tbl td{padding:11px 10px;border-bottom:1.5px solid #94a3b8;font-size:13px;height:38px;}
  .settle-tbl th,.settle-tbl td{border:1px solid #aebdc8;}
  .settle-tbl th.samt,.settle-tbl td.samt{text-align:right;}
  .sdate{width:18%;} .sitem{width:42%;} .samt{width:18%;} .snote{width:22%;}

  @media print{
    @page{size:A4;margin:10mm 12mm;}
    body{padding:0;}
  }
</style></head>
<body>
<div id="cdwrap"><div id="cdsheet">
  <div class="hd">
    <img src="${logo}" onerror="this.style.display='none'"/>
    <div style="text-align:right;">
      <div class="hd-title">${L.title}</div>
      <small class="ko">체크인 디테일 · 영문 / 한글 통합</small>
      ${isPkg ? `<div><span class="pkg-badge">${L.pkg}</span></div>` : ""}
    </div>
  </div>

  <div class="info">
    <div class="fld"><div class="lbl">${L.name}</div><div class="val">${nameLine}</div></div>
    <div class="fld"><div class="lbl">${L.house}</div><div class="val">${houseNo}</div></div>
    <div class="fld"><div class="lbl">${L.pick}</div><div class="val">${arrFlight}</div></div>
    <div class="fld"><div class="lbl">${L.cin}</div><div class="val">${checkIn}</div></div>
    <div class="fld"><div class="lbl">${L.cout}</div><div class="val">${checkOut}</div></div>
    <div class="fld"><div class="lbl">${L.guest}</div><div class="val">${guests}</div></div>
  </div>

  <div class="cards">
    <div class="card"><div class="ct">${L.master}</div><div class="cv">${m1}</div></div>
    <div class="card"><div class="ct">${L.small}</div><div class="cv">${m2}</div></div>
    <div class="card"><div class="ct">${L.first}</div><div class="cv">${m3}</div></div>
    <div class="card"><div class="ct">${L.sim}</div><div class="cv sm">${dash(simText)}</div></div>
    <div class="card"><div class="ct">${L.load}</div><div class="cv">${loadText}</div></div>
  </div>

  <div class="line"><span class="k">${L.add}</span><span class="v">${addText}</span></div>
  <div class="line memo"><span class="k">${L.memo}</span><div class="v">${memoHtml}</div></div>

  <div style="flex:1"></div>
  <div class="settle-hd"><span>${L.settle}</span><span class="dep-pill">${L.deposit} ${depositAmt}</span></div>
  <table class="settle-tbl">
    <thead><tr>
      <th class="sdate">${L.date}</th><th class="sitem">${L.item}</th><th class="samt">${L.amount}</th><th class="snote">${L.note}</th>
    </tr></thead>
    <tbody>${settleRows}</tbody>
  </table>
</div></div>
  <script>(function(){function fit(){var w=document.getElementById('cdwrap'),s=document.getElementById('cdsheet');if(!w||!s)return;s.style.transform='';w.style.height='';var maxH=Math.round(277/25.4*96);var h=s.scrollHeight;if(h>maxH){var f=maxH/h;s.style.transform='scale('+f+')';w.style.height=(h*f)+'px';}}if(document.readyState!=='loading')fit();else document.addEventListener('DOMContentLoaded',fit);window.addEventListener('load',fit);})();</script>
  <script>window.onload=function(){window.print();};</script>
${flightImages.length > 0 ? `<div style="page-break-before:always;padding:24px">
  <div style="font-size:15px;font-weight:800;color:#1a6fc4;border-bottom:2px solid #1a6fc4;padding-bottom:6px;margin-bottom:14px">FLIGHT TICKETS (${flightImages.length})<small class="ko">항공권 사진</small></div>
  ${flightImages.map(u => `<img src="${dash(u)}" style="width:100%;max-height:46vh;object-fit:contain;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:12px"/>`).join("")}
</div>` : ""}</body></html>`;
    // <script>autoprint 제거 후 state에 저장 → 오버레이 iframe으로 표시
    return (html.replace(/<script>window\.onload[^<]*<\/script>/g, ""));
  }

