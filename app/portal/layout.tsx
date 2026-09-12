import Link from 'next/link';
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (<>
    <style>{`
html,body{background:#f1f5f9 !important;margin:0;padding:0;min-height:100vh}
body{font-family:'Noto Sans KR',sans-serif;color:#1a1a2e}
    `}</style>
    <div style={{padding:'10px 20px',background:'#e7eff2',textAlign:'right',fontSize:12,color:'#386274'}}><Link href="/dream-app" style={{display:'inline-block',padding:'6px 10px'}}>← 게스트 / 학습모드 선택</Link></div>
    {children}
  </>);
}
