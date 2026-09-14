import type { Metadata } from 'next';
import Booking3Form from './Booking3Form';
export const metadata: Metadata = { title: '화상영어 신청 | 드림아카데미', description: '주 2·3·5회, 하루 25분. 드림아카데미 화상영어 전용 신청서.', alternates: { canonical: '/booking3' } };
export default function Page() { return <Booking3Form />; }
