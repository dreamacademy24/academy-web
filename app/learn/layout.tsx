import './learning.css';
export const metadata = { title: 'Dream Learning · My Tree House', description: '보고, 듣고, 쓰고, 말하는 나만의 영어 모험', manifest: '/manifest-guest.webmanifest' };
export default function Layout({children}:{children:React.ReactNode}) { return <div className="learning-app">{children}</div>; }
