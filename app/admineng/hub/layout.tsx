import StaffSessionBoundary from '@/components/StaffSessionBoundary';

export default function TeacherHubLayout({children}:{children:React.ReactNode}){
  return <StaffSessionBoundary>{children}</StaffSessionBoundary>;
}
