import Link from 'next/link';
import StaffNoticeBoard from '@/components/StaffNoticeBoard';
import StaffSessionBoundary from '@/components/StaffSessionBoundary';

export default function StaffNoticesPage(){
  return <StaffSessionBoundary><main style={{maxWidth:1080,margin:'0 auto',padding:'28px 22px',minHeight:'100vh',background:'#f7f9fc'}}><Link href="/admineng/hub" style={{display:'inline-block',marginBottom:24,color:'#425d88'}}>← Teacher Hub</Link><StaffNoticeBoard/></main></StaffSessionBoundary>;
}
