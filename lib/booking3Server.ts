import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { portalDb } from './portalAuth';
import { buildOnlineSessionDates } from './onlineClassSchedule';
import { booking3Quote, validateBooking3, type Booking3Form } from './booking3';

function cipherKey() { return createHash('sha256').update(process.env.BOOKING3_CREDENTIAL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY!).digest(); }
export function encryptBooking3Password(password: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', cipherKey(), iv);
  const body = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64');
}
export function decryptBooking3Password(value: string) {
  const data = Buffer.from(value, 'base64'), decipher = createDecipheriv('aes-256-gcm', cipherKey(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString('utf8');
}
export async function issueBooking3(id: string, startDate: string) {
  const db = portalDb();
  const { data: application, error: loadError } = await db.from('online_applications').select('*').eq('id', id).single();
  if (loadError || !application) throw new Error('신청서를 찾을 수 없습니다.');
  if (application.status === 'issued') {
    if (!application.enrollment_id) throw new Error('발급 후 수강권이 삭제된 신청서입니다. 수강생 내역을 확인해주세요.');
    return { enrollmentId: application.enrollment_id, username: application.account_username, password: application.account_cipher ? decryptBooking3Password(application.account_cipher) : null, existing: !!application.existing_user_id };
  }
  if (application.status !== 'pending' && !(application.status === 'processing' && Date.now() - Date.parse(application.updated_at) > 180000)) throw new Error('이미 처리 중이거나 취소된 신청서입니다. 잠시 후 다시 확인해주세요.');
  const form = validateBooking3({ ...application.payload, startDate });
  const quote = booking3Quote(form.weekly, form.months);
  if (JSON.stringify(quote) !== JSON.stringify(application.quote)) {
    // Postgres JSONB key ordering differs; compare values, never trust client totals.
    for (const k of Object.keys(quote) as (keyof typeof quote)[]) if (quote[k] !== application.quote[k]) throw new Error('신청 회차·금액 확인이 필요합니다.');
  }
  const { data: holidays, error: holidayError } = await db.from('holidays').select('date').eq('is_deployed', true);
  if (holidayError) throw new Error('휴일을 확인하지 못했습니다. 발급하지 않았습니다.');
  let stays: { from: string; to: string }[] = [];
  if (application.existing_user_id) {
    const { data: bookings, error } = await db.from('bookings').select('checkin_date,checkout_date').eq('portal_user_id', application.existing_user_id).neq('status', '취소');
    if (error) throw new Error('기존 예약 체류 기간을 확인하지 못했습니다.');
    stays = (bookings || []).filter(b => b.checkin_date && b.checkout_date).map(b => ({ from: b.checkin_date, to: b.checkout_date }));
  }
  const plan = buildOnlineSessionDates(form.startDate, form.days, quote.totalSessions, new Set((holidays || []).map(h => h.date)), stays);
  if (plan.dates.length !== quote.totalSessions) throw new Error('전체 수업 일정을 만들 수 없습니다. 시작일을 확인해주세요.');
  const claim = randomUUID();
  const password = application.account_cipher ? decryptBooking3Password(application.account_cipher) : 'Da!' + randomBytes(12).toString('base64url');
  const username = application.account_username || ('oc' + id.replaceAll('-', '').slice(0, 16));
  const { data: locked, error: lockError } = await db.from('online_applications').update({ status: 'processing', claim_token: claim, updated_at: new Date().toISOString(), ...(!application.existing_user_id ? { account_username: username, account_cipher: application.account_cipher || encryptBooking3Password(password) } : {}) }).eq('id', id).eq('status', application.status).eq('updated_at', application.updated_at).select('id').maybeSingle();
  if (lockError || !locked) throw new Error('다른 직원이 처리 중입니다. 새로고침해주세요.');
  try {
    let userId: string | null = application.existing_user_id || application.provision_user_id;
    let accountUsername = username;
    if (application.existing_user_id) {
      const { data, error } = await db.auth.admin.getUserById(application.existing_user_id);
      if (error || !data.user) throw new Error('연결된 기존 앱 계정을 확인하지 못했습니다.');
      accountUsername = data.user.email?.split('@')[0] || '기존 계정';
    } else if (!userId) {
      const email = `${username}@dreamacademyph.com`;
      const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { booking3_application_id: id }, user_metadata: { portal_type: 'online_class' } });
      if (!error && data.user) userId = data.user.id;
      else {
        // Recover only this application's previously created account after a network interruption.
        const auth = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const recovered = await auth.auth.signInWithPassword({ email, password });
        if (recovered.error || recovered.data.user?.app_metadata?.booking3_application_id !== id) throw new Error('앱 계정 발급을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.');
        userId = recovered.data.user.id;
        await auth.auth.signOut();
      }
      const { error: checkpointError } = await db.from('online_applications').update({ provision_user_id: userId }).eq('id', id).eq('claim_token', claim);
      if (checkpointError) throw new Error('계정 연결 저장에 실패했습니다. 같은 신청서에서 다시 발급해주세요.');
    }
    if (!application.existing_user_id) {
      const { error } = await db.from('profiles').upsert({ id: userId, username, name: form.guardian, phone: form.phone, email: form.email, children: [{ name: form.student, name_en: form.englishName, birth_year: form.birthYear }], booking3_application_id: id }, { onConflict: 'id' });
      if (error) throw new Error('앱 프로필 저장에 실패했습니다. 다시 발급해주세요.');
    }
    const { error: linkError } = await db.from('online_applications').update({ provision_user_id: userId, account_username: accountUsername }).eq('id', id).eq('claim_token', claim);
    if (linkError) throw new Error('앱 연결 정보를 저장하지 못했습니다.');
    const { data: enrollmentId, error: finishError } = await db.rpc('finalize_online_application', { p_id: id, p_claim: claim, p_dates: plan.dates, p_start: form.startDate });
    if (finishError) throw new Error('수강권·출석부 저장을 완료하지 못했습니다. 같은 신청서에서 다시 발급해주세요.');
    return { enrollmentId, username: accountUsername, password: application.existing_user_id ? null : password, existing: !!application.existing_user_id };
  } catch (error) {
    await db.from('online_applications').update({ status: 'pending', claim_token: null, updated_at: new Date().toISOString() }).eq('id', id).eq('claim_token', claim).eq('status', 'processing');
    throw error;
  }
}
