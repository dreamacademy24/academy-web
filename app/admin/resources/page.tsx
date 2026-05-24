'use client'
import { useState } from 'react'
import Link from 'next/link'

const OT_DATA = [
  { id:'o1', title:'OT 참석 안내', content:`안녕하세요 😊 드림아카데미입니다!\n\nOT 안내 드립니다.\n\n일시: [날짜] [시간]\n장소: 드림아카데미\n\nOT에서는 수업 커리큘럼, 생활 규칙, 셔틀 이용 방법, 애프터스쿨·필드트립 신청 방법 등을 안내해 드립니다.\n\n꼭 참석 부탁드립니다! 😊` },
  { id:'o2', title:'준비물 안내', content:`안녕하세요 😊 드림아카데미입니다!\n\n준비물 안내 드립니다.\n\n■ 공통\n- 여권 (유효기간 6개월 이상)\n- 해외여행자 보험 가입 (강력 권장)\n- 현지 사용 카드 또는 현금\n\n■ 학생\n- 필기도구, 노트\n- 편한 운동복 (애프터스쿨 활동용)\n- 수영복, 수영모 (수영장 이용 시)\n\n궁금하신 사항은 언제든지 문의주세요! 😊` },
]

const AFTERSCHOOL_DATA = [
  { id:'as1', title:'물총놀이', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 아카데미\n💦 Water Gun Fun — 물총놀이\n\n📌 준비사항\n• 젖어도 되는 옷 & 신발 착용 (환복하지 않습니다)\n• 수건 지참 (등원 시 가방에)\n• ⚠️ 개인 물총 지참 불가\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as2', title:'미니 올림픽', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 Club House in Bayswater\n🏅 Mini Olympics — 미니 올림픽\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as3', title:'꽃꽂이', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 아카데미\n🌸 Flower Arrangement — 꽃꽂이 활동 수업\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as4', title:'체육 수업 (Gross Motor)', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 Club House in Bayswater\n🏃 Gross Motor — 다양한 신체 활동을 하는 체육 중심 수업\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as5', title:'손 야구 (Hand Baseball)', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 아카데미\n⚾ Hand Baseball — 손 야구 게임\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as6', title:'신호등 게임 + 보물찾기', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 Club House in Bayswater\n🚦 신호등 게임 및 팀 보물 찾기\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as7', title:'산책 & 열대 과일 미로', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 Dream House Office (B17 L5)\n🌳 Nature Walk & Jackfruit Maze — 베이스워터 내 산책 및 열대 과일 테마 미로\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as8', title:'훌라후프·줄넘기', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 Club House in Bayswater\n🏃 Hula Hoop & Jump Rope — 훌라후프 및 줄넘기 활동\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as9', title:'풍선 테니스', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 Club House in Bayswater\n🎾 Balloon Tennis — 풍선 테니스\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as10', title:'바람개비', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 아카데미\n🌀 Pinwheel Activity — 바람개비 게임\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as11', title:'종이접기·비행기', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 아카데미\n✈️ Origami & Paper Airplane — 종이접기 및 비행기 날리기 대회\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as12', title:'간식 잡기·장애물 코스', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 Club House in Bayswater\n🍭 간식 잡기 게임 및 장애물 코스 게임\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as13', title:'책 탐색·퍼즐', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 아카데미\n📚 Book Hunt & Puzzle — 책 탐색 활동 및 퍼즐 게임\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as14', title:'식물 관찰', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 아카데미\n🔬 Plant Observation — 직접 만든 색깔 확대경으로 식물 관찰\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as15', title:'친환경 식물 심기·허브', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 아카데미\n🌿 Eco Planting & Herb — 친환경 식물 심기 및 허브 심기\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as16', title:'자연 미술 (나뭇잎·풀·꽃)', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 아카데미\n🌺 Art Activity — 나뭇잎, 풀, 꽃을 이용한 미술 활동\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as17', title:'배드민턴·피구', content:`안녕하세요 😊\n\n애프터스쿨 안내 드립니다.\n\n📅 [날짜] ([요일])\n⏰ [시간]\n📍 아카데미\n🏸 Badminton & Dodgeball — 배드민턴 및 피구 게임\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'as18', title:'신청 안내 (드림하우스)', content:`애프터스쿨 신청 안내 드립니다 😊\n\n드림하우스 손님은 드림센터(B17L5) 방문 후\n비치된 신청 종이에 직접 기록해 주세요.\n\n⚠️ 채널이나 현지직원을 통한 신청은 불가합니다.\n⚠️ 당일 신청 불가\n⚠️ 다음 주 수업은 전주 금요일 오후 4:50까지\n\n무단 취소 2회 누적 시 이후 신청이 불가합니다.` },
  { id:'as19', title:'신청 안내 (제이파크·큐브나인)', content:`애프터스쿨 신청 안내 드립니다 😊\n\n아래 네이버 폼으로 신청 후 채널로 꼭 알림 주세요!\n→ [네이버 폼 링크]\n\n⚠️ 당일 신청 불가\n⚠️ 다음 주 수업은 전주 금요일까지\n⚠️ 무단 취소 2회 누적 시 이후 신청 불가` },
]

const FIELDTRIP_DATA = [
  { id:'ft1', title:'쉬라인 투어', content:`안녕하세요 😊 필드트립 안내 드립니다!\n\n📅 [날짜] (토요일)\n⏰ 10:30 ~ 4:30pm\n📍 막탄 쉬라인 (집 앞으로 픽드랍)\n🏛️ Shrine Tour — 막탄의 대표 명소 쉬라인 투어\n\n🚐 픽업: 10:15~20\n🚐 드랍: 4:20~25\n📌 전날 픽업 안내 발송 예정입니다.\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'ft2', title:'니모 브류', content:`안녕하세요 😊 필드트립 안내 드립니다!\n\n📅 [날짜] (토요일)\n⏰ 10:30 ~ 4:30pm\n📍 Nimo Brew (집 앞으로 픽드랍)\n🦎 Nimo Brew — 파충류 및 식물 체험\n\n🚐 픽업: 10:15~20\n🚐 드랍: 4:20~25\n📌 전날 픽업 안내 발송 예정입니다.\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'ft3', title:'크로코랜디아', content:`안녕하세요 😊 필드트립 안내 드립니다!\n\n📅 [날짜] (토요일)\n⏰ 10:30 ~ 4:30pm\n📍 Crocolandia (집 앞으로 픽드랍)\n🐊 Crocolandia — 악어 및 파충류 관찰\n\n🚐 픽업: 10:15~20\n🚐 드랍: 4:20~25\n📌 전날 픽업 안내 발송 예정입니다.\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'ft4', title:'키즈 카페', content:`안녕하세요 😊 필드트립 안내 드립니다!\n\n📅 [날짜] (토요일)\n⏰ 10:30 ~ 4:30pm\n📍 키즈 카페 (집 앞으로 픽드랍)\n☕ Kids Cafe — 어린이 전용 카페\n\n🚐 픽업: 10:15~20\n🚐 드랍: 4:20~25\n📌 전날 픽업 안내 발송 예정입니다.\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'ft5', title:'SM 스케이팅', content:`안녕하세요 😊 필드트립 안내 드립니다!\n\n📅 [날짜] (토요일)\n⏰ 10:30 ~ 4:30pm\n📍 SM Seaside — 아이스 스케이팅 (집 앞으로 픽드랍)\n⛸️ SM Skating — 아이스 스케이팅\n\n🚐 픽업: 10:15~20\n🚐 드랍: 4:20~25\n📌 전날 픽업 안내 발송 예정입니다.\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'ft6', title:'마젤란 십자가', content:`안녕하세요 😊 필드트립 안내 드립니다!\n\n📅 [날짜] (토요일)\n⏰ 10:30 ~ 4:30pm\n📍 마젤란 십자가 (집 앞으로 픽드랍)\n✝️ Magellan's Cross — 세부의 역사 마젤란 십자가\n\n🚐 픽업: 10:15~20\n🚐 드랍: 4:20~25\n📌 전날 픽업 안내 발송 예정입니다.\n\n* 예정된 내용은 사정에 따라 일부 조정될 수 있습니다.` },
  { id:'ft7', title:'픽업 전날 안내 문구', content:`안녕하세요 😊\n\n내일 필드트립 픽업 안내 드립니다.\n\n📅 [날짜]\n🚐 픽업 시간: 10:15 ~ 10:20\n📍 픽업 장소: 집 앞\n\n편한 복장으로 준비해 주세요!\n궁금하신 점은 채널로 문의 주세요 😊` },
  { id:'ft8', title:'미참가 안내', content:`안녕하세요 😊\n\n필드트립 미참가 학생은\n당일 오전 정규 수업이 진행됩니다.\n\n오전 9:00까지 아카데미로 등원해 주세요.\n\n감사합니다 😊` },
  { id:'ft9', title:'통학형 필드트립 안내', content:`안녕하세요 😊 필드트립 안내 드립니다!\n\n📅 [날짜] (토요일)\n⏰ 10:30 ~ 4:30pm\n📍 [장소]\n\n참가비: 3,000페소\n\n🚐 픽업: 10:15~20\n🚐 드랍: 4:20~25\n\n참가를 원하시면 신청해 주세요!\n감사합니다 😊` },
]

export default function ResourcesPage() {
  const [tab, setTab] = useState<'fieldtrip'|'afterschool'|'ot'>('fieldtrip')
  const [selected, setSelected] = useState<{id:string,title:string,content:string}|null>(null)
  const [editContent, setEditContent] = useState('')
  const [copied, setCopied] = useState(false)

  const currentData = tab === 'fieldtrip' ? FIELDTRIP_DATA : tab === 'afterschool' ? AFTERSCHOOL_DATA : OT_DATA

  function openModal(item: {id:string,title:string,content:string}) {
    setSelected(item)
    setEditContent(item.content)
    setCopied(false)
  }

  function handleCopy() {
    navigator.clipboard.writeText(editContent).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function handlePrint() {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${selected?.title}</title><style>body{font-family:sans-serif;white-space:pre-wrap;padding:32px;font-size:15px;line-height:1.8;}h2{margin-bottom:16px;}@media print{body{padding:16px;}}</style></head><body><h2>${selected?.title}</h2>${editContent.replace(/\n/g,'<br>')}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 300)
  }

  return (
    <div style={{maxWidth:1100,margin:'0 auto',padding:'32px 24px'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:24}}>
        <Link href="/admin/hub" style={{color:'#6b7280',textDecoration:'none',fontSize:14}}>← 관리자 홈</Link>
        <h1 style={{fontSize:24,fontWeight:700,margin:0}}>📂 자료모음</h1>
      </div>

      <div style={{display:'flex',gap:8,marginBottom:24,borderBottom:'2px solid #e5e7eb',paddingBottom:0}}>
        {([['fieldtrip','🗺️ 필드트립'],['afterschool','🎨 애프터스쿨'],['ot','📋 OT 자료']] as const).map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key)} style={{padding:'10px 20px',border:'none',background:'none',cursor:'pointer',fontWeight:tab===key?700:400,color:tab===key?'#2563eb':'#374151',borderBottom:tab===key?'2px solid #2563eb':'2px solid transparent',marginBottom:-2,fontSize:14}}>
            {label}
          </button>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:14}}>
        {currentData.map(item=>(
          <div key={item.id} onClick={()=>openModal(item)} style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:10,padding:'16px 18px',cursor:'pointer',transition:'box-shadow 0.15s',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}
            onMouseOver={e=>(e.currentTarget.style.boxShadow='0 4px 12px rgba(0,0,0,0.1)')}
            onMouseOut={e=>(e.currentTarget.style.boxShadow='0 1px 3px rgba(0,0,0,0.05)')}>
            <div style={{fontSize:13,fontWeight:600,color:'#111827',marginBottom:6}}>{item.title}</div>
            <div style={{fontSize:11,color:'#9ca3af',whiteSpace:'pre-wrap',overflow:'hidden',maxHeight:52,textOverflow:'ellipsis'}}>{item.content.slice(0,60)}…</div>
          </div>
        ))}
      </div>

      {selected && (
        <div onClick={()=>setSelected(null)} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:24}}>
          <div onClick={e=>e.stopPropagation()} style={{background:'#fff',borderRadius:12,padding:28,width:'100%',maxWidth:580,maxHeight:'90vh',display:'flex',flexDirection:'column',gap:16}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <h2 style={{margin:0,fontSize:18,fontWeight:700}}>{selected.title}</h2>
              <button onClick={()=>setSelected(null)} style={{border:'none',background:'none',fontSize:20,cursor:'pointer',color:'#6b7280'}}>✕</button>
            </div>
            <textarea value={editContent} onChange={e=>setEditContent(e.target.value)}
              style={{width:'100%',minHeight:280,border:'1px solid #d1d5db',borderRadius:8,padding:12,fontSize:14,lineHeight:1.7,resize:'vertical',fontFamily:'inherit',boxSizing:'border-box'}} />
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={handleCopy} style={{padding:'9px 18px',background:copied?'#16a34a':'#f3f4f6',color:copied?'#fff':'#374151',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>
                {copied ? '✅ 복사됨' : '📋 복사'}
              </button>
              <button onClick={handlePrint} style={{padding:'9px 18px',background:'#2563eb',color:'#fff',border:'none',borderRadius:8,cursor:'pointer',fontWeight:600,fontSize:13}}>
                🖨️ 인쇄
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
