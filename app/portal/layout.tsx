export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (<>
    <style>{`
html,body{background:#f1f5f9 !important;margin:0;padding:0;min-height:100vh}
body{font-family:'Noto Sans KR',sans-serif;color:#1a1a2e}
    `}</style>
    {children}
  </>);
}
