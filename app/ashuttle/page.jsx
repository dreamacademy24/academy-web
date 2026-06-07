"use client";
// @ts-nocheck
/* eslint-disable */
import { useEffect, useRef } from "react";

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SB_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

const CSS = `
  :root{
    --bg:#f4f6f8;
    --paper:#ffffff;
    --ink:#1c2530;
    --line:#c8d0da;
    --line-strong:#8a96a6;
    --driver:#fff34d;      /* driver yellow */
    --teacher:#5fe08a;     /* teacher green */
    --time:#7fe6ff;        /* time blue */
    --addr:#1f6fb2;        /* address blue */
    --accent:#2563eb;
    --danger:#e1554b;
    --muted:#6b7785;
  }
  *{box-sizing:border-box;}
  body{
    margin:0; background:var(--bg); color:var(--ink);
    font-family:"Segoe UI","Malgun Gothic","Apple SD Gothic Neo",sans-serif;
    font-size:14px; line-height:1.45;
  }
  /* ===== top toolbar ===== */
  .toolbar{
    position:sticky; top:0; z-index:50;
    background:#1c2530; color:#fff;
    display:flex; flex-wrap:wrap; gap:8px; align-items:center;
    padding:10px 16px; box-shadow:0 2px 8px rgba(0,0,0,.18);
  }
  .toolbar h1{font-size:15px; margin:0 12px 0 0; font-weight:700; letter-spacing:.3px;}
  .toolbar .hint{font-size:12px; color:#9fb0c2; margin-left:auto;}
  .btn{
    background:#2f3e50; color:#fff; border:1px solid #44566b;
    padding:6px 12px; border-radius:7px; cursor:pointer; font-size:13px;
    transition:.15s;
  }
  .btn:hover{background:#3c4f66;}
  .btn.primary{background:var(--accent); border-color:var(--accent);}
  .btn.primary:hover{background:#1d4fd8;}
  .btn.ghost{background:transparent;}
  .saved{font-size:12px; color:#5fe08a; min-width:60px;}

  /* ===== paper area ===== */
  .page{
    max-width:1120px; margin:18px auto; background:var(--paper);
    border:1px solid var(--line); border-radius:10px;
    padding:22px 26px 40px; box-shadow:0 4px 20px rgba(20,30,45,.07);
  }
  .legend{
    display:flex; flex-wrap:wrap; gap:6px 22px; align-items:center;
    margin-bottom:14px; padding-bottom:12px; border-bottom:2px solid var(--ink);
  }
  .legend .row{display:flex; align-items:center; gap:7px; font-weight:600;}
  .legend .num{
    display:inline-block; min-width:30px; text-align:center;
    background:var(--driver); padding:2px 8px; border-radius:5px; font-weight:700;
  }
  .legend .arrow{color:var(--muted);}
  .legend .kbryan{background:var(--driver); padding:2px 8px; border-radius:5px;}
  .legend .line-del{
    border:none; background:none; color:#c2ccd6; cursor:pointer;
    font-size:12px; padding:0 2px; opacity:0; transition:.15s;
  }
  .legend .row:hover .line-del{opacity:1;}
  .legend .line-del:hover{color:var(--danger);}
  .add-line{
    background:none; border:1px dashed var(--line-strong); color:var(--muted);
    border-radius:6px; padding:2px 8px; cursor:pointer; font-size:12px;
  }
  .add-line:hover{border-color:var(--accent); color:var(--accent);}

  /* ===== Absent bar ===== */
  .absent-bar{
    display:flex; flex-wrap:wrap; gap:8px; align-items:center;
    margin:0 0 14px; padding:8px 10px; background:#fdeceb;
    border:1px solid #f3c9c5; border-radius:8px;
  }
  .absent-bar .absent-label{
    font-weight:800; color:var(--danger); letter-spacing:.3px;
    text-transform:uppercase; font-size:13px;
  }
  .absent-bar .absent-label:after{content:" :"; }
  .absent-chip{
    display:inline-flex; align-items:center; gap:4px;
    background:#fff; border:1px solid #f0bdb8; border-radius:14px;
    padding:2px 4px 2px 10px; font-weight:600;
  }
  .absent-chip [contenteditable]{outline:none; min-width:20px;}
  .absent-chip [contenteditable]:focus{background:#fff0c2; border-radius:4px;}
  .absent-chip .chip-del{
    border:none; background:none; color:#d39e99; cursor:pointer;
    font-size:12px; line-height:1; padding:0 2px;
  }
  .absent-chip .chip-del:hover{color:var(--danger);}

  .date-nav{
    display:flex; align-items:center; justify-content:center; gap:10px;
    flex-wrap:wrap; margin:6px 0 16px;
  }
  .date-head{
    font-size:20px; font-weight:800; letter-spacing:.5px; min-width:280px;
    text-align:center;
  }
  .nav-btn{
    background:#eef2f7; border:1px solid var(--line); color:var(--ink);
    padding:6px 12px; border-radius:7px; cursor:pointer; font-size:13px; font-weight:600;
  }
  .nav-btn:hover{background:#dde6f0;}
  .date-pick{
    border:1px solid var(--line); border-radius:7px; padding:5px 8px; font-size:13px;
  }
  .copy-note{font-size:12px; color:var(--muted);}

  /* ===== driver block ===== */
  .driver-block{
    border:1.5px solid var(--line-strong); border-radius:8px;
    margin-bottom:16px; overflow:hidden;
  }
  .driver-grid{display:grid; grid-template-columns:1fr 1fr;}
  @media(max-width:720px){.driver-grid{grid-template-columns:1fr;}}

  .cell{
    padding:0; border-right:1.5px solid var(--line-strong);
    min-height:80px; display:flex; flex-direction:column;
  }
  .cell:last-child{border-right:none;}
  @media(max-width:720px){.cell{border-right:none; border-bottom:1.5px solid var(--line-strong);}}

  .driver-name{
    background:var(--driver); font-weight:800; font-size:15px;
    padding:5px 10px; outline:none; border-bottom:1px solid #d9cf3a;
  }
  .driver-name:focus{background:#fffbb0;}
  .period-label{font-size:11px; color:var(--muted); font-weight:600; padding:3px 10px 0;}

  .groups{padding:8px 10px 12px; flex:1;}

  /* ===== time group ===== */
  .group{margin-bottom:12px;}
  .group-head{display:flex; align-items:center; gap:6px; margin-bottom:5px;}
  .time{
    background:var(--time); font-weight:700; padding:2px 8px; border-radius:5px;
    outline:none; min-width:38px; text-align:center;
  }
  .time:focus{background:#b5f0ff;}
  .teacher{
    background:var(--teacher); font-weight:700; padding:2px 8px; border-radius:5px;
    outline:none;
  }
  .teacher:focus{background:#a9f5c4;}
  .group-del{
    margin-left:auto; border:none; background:none; color:var(--muted);
    cursor:pointer; font-size:15px; line-height:1; padding:2px 4px;
  }
  .group-del:hover{color:var(--danger);}

  /* ===== card (address item) ===== */
  .card-list{min-height:14px;}
  .card-list.drag-over{background:#e9f2ff; border-radius:6px; outline:2px dashed var(--accent);}

  .card{
    display:flex; align-items:baseline; gap:6px; flex-wrap:wrap;
    padding:3px 6px 3px 8px; margin:2px 0; border-radius:6px;
    border:1px solid transparent; cursor:grab; position:relative;
  }
  .card:hover{background:#f0f4f9; border-color:var(--line);}
  .card.dragging{opacity:.45;}
  .card .grip{color:#aab4c0; font-size:12px; cursor:grab; user-select:none;}
  .card .addr{color:var(--addr); font-weight:700; outline:none;}
  .card .addr:focus{background:#dbeeff; border-radius:4px;}
  .card .count{font-weight:700; outline:none;}
  .card .count:before{content:"(";}
  .card .count:after{content:")";}
  .card .count:focus{background:#fff0c2; border-radius:4px;}
  .card .names{outline:none; flex:1; min-width:80px;}
  .card .names:focus{background:#eef4ff; border-radius:4px;}
  .card .card-del{
    border:none; background:none; color:#c2ccd6; cursor:pointer;
    font-size:14px; line-height:1; padding:0 2px; opacity:0;
  }
  .card:hover .card-del{opacity:1;}
  .card .card-del:hover{color:var(--danger);}

  .add-card, .add-group{
    background:none; border:1px dashed var(--line-strong); color:var(--muted);
    border-radius:6px; padding:3px 8px; cursor:pointer; font-size:12px; margin-top:4px;
  }
  .add-card:hover,.add-group:hover{border-color:var(--accent); color:var(--accent);}
  .empty-hint{color:#b7c0cb; font-size:12px; font-style:italic; padding:4px 0;}

  /* ===== capture (image export) ===== */
  .page.capturing .card-del,
  .page.capturing .group-del,
  .page.capturing .add-card,
  .page.capturing .add-group,
  .page.capturing .add-line,
  .page.capturing .line-del,
  .page.capturing .chip-del,
  .page.capturing .period-label,
  .page.capturing .grip{ display:none !important; }
  .page.capturing .nav-btn,
  .page.capturing .date-pick,
  .page.capturing .copy-note{ display:none !important; }
  .page.capturing .card:hover{ background:none; border-color:transparent; }
  .page.capturing .card{ break-inside:avoid; }

  /* ===== print ===== */
  @media print{
    .toolbar{display:none;}
    body{background:#fff;}
    .page{box-shadow:none; border:none; margin:0; max-width:none;}
    .card-del,.group-del,.add-card,.add-group,.period-label,.grip{display:none !important;}
    .line-del,.add-line,.chip-del{display:none !important;}
    .nav-btn,.date-pick,.copy-note{display:none !important;}
    .card:hover{background:none; border-color:transparent;}
    @page{size:A4 landscape; margin:10mm;}
  }
`;

const BODY_HTML = `<div class="toolbar">
    <h1>🚐 Pick up & Drop off Schedule</h1>
    <button class="btn" onclick="addDriver()">+ Add driver</button>
    <button class="btn primary" onclick="save()">💾 Save</button>
    <button class="btn ghost" onclick="window.print()">🖨️ Print / PDF</button>
    <button class="btn ghost" onclick="saveImage()" id="imgBtn">🖼️ Save image</button>
    <button class="btn ghost" onclick="resetAll()">↺ Reset</button>
    <span class="saved" id="savedMsg"></span>
    <span class="hint">Drag cards to move · click text to edit</span>
  </div>

  <div class="page">
    <div class="legend" id="legend"></div>
    <div class="absent-bar" id="absent"></div>
    <div class="date-nav">
      <button class="nav-btn" onclick="goDay(-1)">◀ Prev day</button>
      <div class="date-head" id="dateHead"></div>
      <button class="nav-btn" onclick="goDay(1)">Next day ▶</button>
      <input type="date" id="datePick" class="date-pick" onchange="jumpTo(this.value)">
      <span class="copy-note">↳ Next day copies today's list</span>
    </div>
    <div id="board"></div>
  </div>`;

export default function AshuttlePage() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || root.dataset.booted) return;   // guard React strict-mode double run
    root.dataset.booted = "1";
    root.innerHTML = BODY_HTML;

    // ---------- app logic ----------

    let currentISO = "2026-06-01";           // ISO date of the day on screen

    /* ===== seed data (June 01, 2026 Monday) ===== */
    const seed = {
      date: "June 01, 2026  Monday",
      legend: [
        {num:"25", label:"Lunch", arrow:true},
        {num:"3", label:"Extra", arrow:false},
        {num:"25", label:"Snacks", arrow:false}
      ],
      kbryan:"K. Bryan",
      absent: ["GoEun","sir hanry","mam sage","no ride mam candies","choi gun / jia / jiu"],
      drivers: [
        {
          name:"K. Marco",
          am:[ {time:"8:40", teacher:"T. Janrey", cards:[
            {addr:"B17 L15", count:"3", names:"Choi Yeonggeun & Choi Hajin + mom"},
            {addr:"B17 L16", count:"3", names:"Park Sea & Park Sein +mom"},
            {addr:"B17 L17", count:"4", names:"Kim Haseo, Kim Haon & Kim Hawoo +mom"}
          ]}],
          pm:[
            {time:"4:00", teacher:"T. Pen", cards:[
              {addr:"B17 L14", count:"1", names:"Sunny"},
              {addr:"Pacific Villa Pajac", count:"1", names:"Justin"}
            ]},
            {time:"5:00", teacher:"T. Hazel", cards:[
              {addr:"B17 L15", count:"2", names:"Choi Yeonggeun & Choi Hajin"},
              {addr:"B17 L16", count:"2", names:"Park Sea & Park Sein"},
              {addr:"B17 L17", count:"3", names:"Kim Haseo, Kim Haon & Kim Hawoo"},
              {addr:"B17 L18", count:"2", names:"Moon Seonbeen & Moon Chaean"}
            ]}
          ]
        },
        {
          name:"K. Ed",
          am:[
            {time:"8:30", teacher:"T. Annie", cards:[
              {addr:"Pacific Villa Pajac", count:"1", names:"Justin"}
            ]},
            {time:"8:40~45", teacher:"", cards:[
              {addr:"B17 L7", count:"1", names:"Im Sea"},
              {addr:"B17 L9", count:"1", names:"Kim Eunwoo"},
              {addr:"B17 L13", count:"2", names:"Choi Seou & Choi Eunu"},
              {addr:"B17 L14", count:"3", names:"Sunny, Iro & Rian"}
            ]}
          ],
          pm:[
            {time:"5:00", teacher:"", cards:[
              {addr:"B17 L10", count:"2", names:"Kwak Seoa & Kwak Jia"},
              {addr:"B17 L11", count:"2", names:"Kim Roa & Kim Roun"},
              {addr:"B17 L12", count:"2", names:"Jeong Mingi & Jeong Ruha"}
            ]}
          ]
        },
        {
          name:"K. Bryan",
          am:[ {time:"8:40", teacher:"T. Joy", cards:[
            {addr:"B17 L10", count:"3", names:"Kwak Seoa & Kwak Jia +mom"},
            {addr:"B17 L11", count:"4", names:"Kim Roa & Kim Roun +2 mom"},
            {addr:"B17 L12", count:"3", names:"Jeong Mingi & Jeong Ruha + mom"}
          ]}],
          pm:[ {time:"1:30", teacher:"T. Janrey", cards:[
            {addr:"B17 L14", count:"2", names:"Iro & Rian"}
          ]}]
        },
        {
          name:"K. Leo",
          am:[ {time:"8:40", teacher:"", cards:[
            {addr:"B16 L19", count:"2", names:"Lee Ra byeol + Mom"},
            {addr:"B17 L18", count:"4", names:"Moon Seonbeen & Moon Chaean + Mom 2"},
            {addr:"B17 L8", count:"3", names:"Shin Nayoung + Parents"}
          ]}],
          pm:[
            {time:"5:00", teacher:"T. Harper", cards:[
              {addr:"B16 L19", count:"2", names:"Lee Ra byeol"},
              {addr:"B17 L7", count:"1", names:"Im Sea"},
              {addr:"B17 L8", count:"1", names:"Shin Nayoung"},
              {addr:"B17 L9", count:"1", names:"Kim Eunwoo"},
              {addr:"B17 L13", count:"2", names:"Choi Seou & Choi Eunu"}
            ]},
            {time:"9:00", teacher:"only mother", cards:[
              {addr:"b17L17", count:"1", names:"Name"},
              {addr:"b17L16", count:"1", names:"Name"},
              {addr:"b17L15", count:"1", names:"Name"},
              {addr:"b17L12", count:"1", names:"Name"},
              {addr:"b17L10", count:"1", names:"Name"}
            ]}
          ]
        }
      ]
    };

    let state = JSON.parse(JSON.stringify(seed));

    /* ===== date helpers ===== */
    const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
    const WEEK=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    function todayISO(){ const d=new Date(); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10); }
    function fmtDate(iso){ const d=new Date(iso+"T00:00:00"); const dd=String(d.getDate()).padStart(2,"0"); return MONTHS[d.getMonth()]+" "+dd+", "+d.getFullYear()+"  "+WEEK[d.getDay()]; }
    function shiftISO(iso, delta){ const d=new Date(iso+"T00:00:00"); d.setDate(d.getDate()+delta); return d.toISOString().slice(0,10); }

    /* ===== Supabase REST (shared storage for all teachers) ===== */
    const SB_HEAD={ apikey:SB_KEY, Authorization:"Bearer "+SB_KEY };
    async function sbGet(iso){ try{ const r=await fetch(SB_URL+"/rest/v1/pickup_schedules?day=eq."+iso+"&select=data",{headers:SB_HEAD}); const a=await r.json(); return (a&&a[0])?a[0].data:null; }catch(e){ return null; } }
    async function sbLatest(){ try{ const r=await fetch(SB_URL+"/rest/v1/pickup_schedules?select=day,data&order=day.desc&limit=1",{headers:SB_HEAD}); const a=await r.json(); return (a&&a[0])?a[0]:null; }catch(e){ return null; } }
    async function sbUpsert(iso,data){ await fetch(SB_URL+"/rest/v1/pickup_schedules",{method:"POST",headers:Object.assign({},SB_HEAD,{"Content-Type":"application/json",Prefer:"resolution=merge-duplicates,return=minimal"}),body:JSON.stringify({day:iso,data:data,updated_at:new Date().toISOString()})}); }
    async function dayExists(iso){ return (await sbGet(iso))!==null; }

    /* ===== save / load ===== */
    async function save(){ try{ state.date=fmtDate(currentISO); await sbUpsert(currentISO,state); flash("Saved \u2713"); }catch(e){ flash("Save failed"); } }
    async function loadDay(iso){ const d=await sbGet(iso); state = d ? d : JSON.parse(JSON.stringify(seed)); if(!state.absent) state.absent=[]; currentISO=iso; state.date=fmtDate(iso); }
    async function load(){
      currentISO = todayISO();
      const d = await sbGet(currentISO);
      if(d){ state = d; }
      else{
        const latest = await sbLatest();                 // carry over the most recent day
        state = latest ? JSON.parse(JSON.stringify(latest.data)) : JSON.parse(JSON.stringify(seed));
        state.date = fmtDate(currentISO);
        await sbUpsert(currentISO, state);               // create today from it
      }
      if(!state.absent) state.absent=[];
      state.date = fmtDate(currentISO);
    }
    async function goDay(delta){ const t=shiftISO(currentISO,delta); if(await dayExists(t)){ await loadDay(t); } else { const c=JSON.parse(JSON.stringify(state)); c.date=fmtDate(t); state=c; currentISO=t; await save(); } render(); }
    async function jumpTo(iso){ if(!iso) return; if(await dayExists(iso)){ await loadDay(iso); } else { const c=JSON.parse(JSON.stringify(state)); c.date=fmtDate(iso); state=c; currentISO=iso; await save(); } render(); }
    function flash(msg){ const el=document.getElementById("savedMsg"); if(!el) return; el.textContent=msg; setTimeout(function(){ el.textContent=""; },1600); }
    async function resetAll(){ if(!confirm("Reset THIS day to the base schedule? (other days are kept)")) return; state=JSON.parse(JSON.stringify(seed)); state.date=fmtDate(currentISO); await save(); render(); }

    /* ===== rendering ===== */
    function render(){
      document.getElementById("dateHead").textContent = state.date;
      const dp = document.getElementById("datePick");
      if(dp) dp.value = currentISO;
      renderLegend();
      renderAbsent();
      const board = document.getElementById("board");
      board.innerHTML = "";
      state.drivers.forEach((drv, di)=>{
        const block = document.createElement("div");
        block.className = "driver-block";
        const grid = document.createElement("div");
        grid.className = "driver-grid";
        grid.appendChild(cellEl(di, "am", drv.name, "AM · Pick up"));
        grid.appendChild(cellEl(di, "pm", drv.name, "PM · Drop off"));
        block.appendChild(grid);
        board.appendChild(block);
      });
    }

    function renderLegend(){
      const wrap = document.getElementById("legend");
      wrap.innerHTML = "";
      state.legend.forEach((it, i)=>{
        const row = document.createElement("div");
        row.className = "row";
        row.innerHTML =
          `<span class="num" contenteditable="true">${it.num}</span>` +
          `<span contenteditable="true">${it.label}</span>` +
          (it.arrow ? `<span class="arrow">➜</span><span class="kbryan" contenteditable="true">${state.kbryan}</span>` : "") +
          `<button class="line-del" title="Delete line">✕</button>`;
        const spans = row.querySelectorAll("[contenteditable]");
        spans[0].onblur = e=>{ it.num = e.target.textContent; save(); };
        spans[1].onblur = e=>{ it.label = e.target.textContent; save(); };
        if(it.arrow && spans[2]) spans[2].onblur = e=>{ state.kbryan = e.target.textContent; save(); };
        row.querySelector(".line-del").onclick = ()=>{ state.legend.splice(i,1); render(); save(); };
        wrap.appendChild(row);
      });
      const add = document.createElement("button");
      add.className = "add-line"; add.textContent = "+ Add line";
      add.onclick = ()=>{ state.legend.push({num:"0", label:"Item", arrow:false}); render(); save(); };
      wrap.appendChild(add);
    }

    function renderAbsent(){
      const wrap = document.getElementById("absent");
      wrap.innerHTML = "";
      const label = document.createElement("span");
      label.className = "absent-label"; label.textContent = "Absent";
      wrap.appendChild(label);
      state.absent.forEach((name, i)=>{
        const chip = document.createElement("span");
        chip.className = "absent-chip";
        chip.innerHTML = `<span contenteditable="true">${name}</span><button class="chip-del" title="Delete">✕</button>`;
        chip.querySelector("[contenteditable]").onblur = e=>{ state.absent[i] = e.target.textContent; save(); };
        chip.querySelector(".chip-del").onclick = ()=>{ state.absent.splice(i,1); render(); save(); };
        wrap.appendChild(chip);
      });
      const add = document.createElement("button");
      add.className = "add-line"; add.textContent = "+ Add absent";
      add.onclick = ()=>{ state.absent.push("Name"); render(); save(); };
      wrap.appendChild(add);
    }

    function cellEl(di, period, name, periodLabel){
      const cell = document.createElement("div");
      cell.className = "cell";

      const nm = document.createElement("div");
      nm.className = "driver-name";
      nm.contentEditable = "true";
      nm.textContent = name;
      nm.onblur = e=>{ state.drivers[di].name = e.target.textContent;
        // sync the driver name across both cells
        render(); save(); };
      cell.appendChild(nm);

      const plabel = document.createElement("div");
      plabel.className = "period-label";
      plabel.textContent = periodLabel;
      cell.appendChild(plabel);

      const groups = document.createElement("div");
      groups.className = "groups";

      const arr = state.drivers[di][period];
      arr.forEach((g, gi)=> groups.appendChild(groupEl(di, period, gi, g)));

      const addG = document.createElement("button");
      addG.className = "add-group";
      addG.textContent = "+ Add time group";
      addG.onclick = ()=>{ arr.push({time:"00:00", teacher:"", cards:[]}); render(); save(); };
      groups.appendChild(addG);

      cell.appendChild(groups);
      return cell;
    }

    function groupEl(di, period, gi, g){
      const grp = document.createElement("div");
      grp.className = "group";

      const head = document.createElement("div");
      head.className = "group-head";

      const time = document.createElement("span");
      time.className = "time"; time.contentEditable = "true"; time.textContent = g.time;
      time.onblur = e=>{ g.time = e.target.textContent; save(); };

      const teacher = document.createElement("span");
      teacher.className = "teacher"; teacher.contentEditable = "true";
      teacher.textContent = g.teacher || "Teacher";
      teacher.style.opacity = g.teacher ? "1" : ".5";
      teacher.onfocus = e=>{ if(!g.teacher){ e.target.textContent=""; e.target.style.opacity="1"; } };
      teacher.onblur = e=>{ g.teacher = e.target.textContent.trim();
        if(!g.teacher){ e.target.textContent="Teacher"; e.target.style.opacity=".5"; } save(); };

      const delG = document.createElement("button");
      delG.className = "group-del"; delG.textContent = "✕"; delG.title = "Delete group";
      delG.onclick = ()=>{ if(confirm("Delete this time group?")){ state.drivers[di][period].splice(gi,1); render(); save(); } };

      head.appendChild(time); head.appendChild(teacher); head.appendChild(delG);
      grp.appendChild(head);

      const list = document.createElement("div");
      list.className = "card-list";
      list.dataset.di = di; list.dataset.period = period; list.dataset.gi = gi;
      setupDrop(list);

      if(g.cards.length === 0){
        const hint = document.createElement("div");
        hint.className = "empty-hint"; hint.textContent = "Drop cards here";
        list.appendChild(hint);
      }
      g.cards.forEach((c, ci)=> list.appendChild(cardEl(di, period, gi, ci, c)));
      grp.appendChild(list);

      const addC = document.createElement("button");
      addC.className = "add-card"; addC.textContent = "+ Add";
      addC.onclick = ()=>{ g.cards.push({addr:"Address", count:"1", names:"Name"}); render(); save(); };
      grp.appendChild(addC);

      return grp;
    }

    function cardEl(di, period, gi, ci, c){
      const card = document.createElement("div");
      card.className = "card";
      card.draggable = true;
      card.dataset.di = di; card.dataset.period = period; card.dataset.gi = gi; card.dataset.ci = ci;

      const grip = document.createElement("span"); grip.className="grip"; grip.textContent="⠿";

      const addr = document.createElement("span");
      addr.className = "addr"; addr.contentEditable = "true"; addr.textContent = c.addr;
      addr.onblur = e=>{ c.addr = e.target.textContent; save(); };

      const count = document.createElement("span");
      count.className = "count"; count.contentEditable = "true"; count.textContent = c.count;
      count.onblur = e=>{ c.count = e.target.textContent.replace(/[()]/g,"").trim(); save(); };

      const names = document.createElement("span");
      names.className = "names"; names.contentEditable = "true"; names.textContent = c.names;
      names.onblur = e=>{ c.names = e.target.textContent; save(); };

      const del = document.createElement("button");
      del.className = "card-del"; del.textContent = "✕"; del.title = "Delete";
      del.onclick = ()=>{ state.drivers[di][period][gi].cards.splice(ci,1); render(); save(); };

      // disable drag while editing text
      [addr,count,names].forEach(el=>{
        el.addEventListener("mousedown", ()=>{ card.draggable=false; });
        el.addEventListener("blur", ()=>{ card.draggable=true; });
      });

      card.appendChild(grip); card.appendChild(addr);
      card.appendChild(count); card.appendChild(names); card.appendChild(del);

      card.addEventListener("dragstart", e=>{
        card.classList.add("dragging");
        e.dataTransfer.setData("text/plain", JSON.stringify({di,period,gi,ci}));
        e.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", ()=> card.classList.remove("dragging"));

      return card;
    }

    /* ===== drag and drop ===== */
    function setupDrop(list){
      list.addEventListener("dragover", e=>{ e.preventDefault(); list.classList.add("drag-over"); });
      list.addEventListener("dragleave", ()=> list.classList.remove("drag-over"));
      list.addEventListener("drop", e=>{
        e.preventDefault(); list.classList.remove("drag-over");
        const src = JSON.parse(e.dataTransfer.getData("text/plain"));
        const tgt = { di:+list.dataset.di, period:list.dataset.period, gi:+list.dataset.gi };
        // remove card from source
        const card = state.drivers[src.di][src.period][src.gi].cards.splice(src.ci,1)[0];
        if(!card) return;
        // compute insert position by mouse Y
        const cards = [...list.querySelectorAll(".card")];
        let insertAt = state.drivers[tgt.di][tgt.period][tgt.gi].cards.length;
        for(let i=0;i<cards.length;i++){
          const r = cards[i].getBoundingClientRect();
          if(e.clientY < r.top + r.height/2){ insertAt = i; break; }
        }
        state.drivers[tgt.di][tgt.period][tgt.gi].cards.splice(insertAt,0,card);
        render(); save();
      });
    }

    /* ===== add driver ===== */
    function addDriver(){
      const nm = prompt("New driver name (e.g. K. Sam)", "K. ");
      if(!nm) return;
      state.drivers.push({ name:nm, am:[{time:"8:00",teacher:"",cards:[]}], pm:[{time:"5:00",teacher:"",cards:[]}] });
      render(); save();
    }

    /* ===== save as one-page image (PNG) ===== */
    async function saveImage(){
      if(typeof html2canvas === "undefined"){
        flash("Image blocked here — download this file & open in a browser");
        return;
      }
      const btn = document.getElementById("imgBtn");
      const page = document.querySelector(".page");
      btn.disabled = true; flash("Saving image…");
      if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
      page.classList.add("capturing");
      try{
        const canvas = await html2canvas(page, {
          scale: 2,
          backgroundColor: "#ffffff",
          useCORS: true,
          windowWidth: page.scrollWidth,
          windowHeight: page.scrollHeight
        });
        const safe = (state.date || "schedule").trim().replace(/[^\w]+/g, "_");
        const filename = "Pickup_Dropoff_" + safe + ".png";
        canvas.toBlob(function(blob){
          if(!blob){ flash("Image save failed"); return; }
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = filename;
          document.body.appendChild(a); a.click();
          setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 2000);
          flash("Image saved ✓");
        }, "image/png");
      }catch(e){
        flash("Image save failed");
        console.error(e);
      }finally{
        page.classList.remove("capturing");
        btn.disabled = false;
      }
    }

    /* ===== init ===== */
    // expose handlers used by inline onclick in the injected markup
    window.goDay = goDay; window.jumpTo = jumpTo; window.save = save;
    window.saveImage = saveImage; window.resetAll = resetAll; window.addDriver = addDriver;

    // load html2canvas (image export) once
    if (!window.html2canvas) {
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
      document.body.appendChild(s);
    }

    // boot
    (async () => { await load(); render(); })();
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div ref={ref} />
    </>
  );
}
