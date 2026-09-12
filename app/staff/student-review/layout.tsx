import StaffSessionBoundary from '@/components/StaffSessionBoundary';
export default function Layout({children}:{children:React.ReactNode}){return <StaffSessionBoundary requiredRole="korean_admin">{children}</StaffSessionBoundary>;}
