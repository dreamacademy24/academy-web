import { NextResponse } from 'next/server';
import { portalUser, portalDb } from '@/lib/portalAuth';
import { loadLearningChildren } from '@/lib/learning/children';

export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Authorization, Cookie' } });
export async function GET(req: Request) {
  try {
    const user = await portalUser(req);
    if (!user) return reply({ error: '학습할 아이를 확인하려면 보호자 계정으로 로그인해주세요.' }, 401);
    return reply(await loadLearningChildren(portalDb(), user.id));
  } catch {
    return reply({ error: '아이의 학습 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.' }, 503);
  }
}
