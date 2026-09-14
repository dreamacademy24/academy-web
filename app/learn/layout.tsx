import './learning.css';
export const metadata = { title: 'Dream Learning · 드림이와 영어 모험', description: '드림이와 이야기 속으로! 듣고, 말하고, 게임하며 이어가는 나의 영어 모험', manifest: '/manifest-guest.webmanifest' };
export default function Layout({children}:{children:React.ReactNode}) { return <div className="learning-app">{children}</div>; }
