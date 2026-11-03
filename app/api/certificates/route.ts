import { NextResponse } from 'next/server';
import { getStaffIdentity, portalDb } from '@/lib/portalAuth';
import { canUseCertificates, defaultCertificateTemplate, normalizeCertificateBooking, validateCertificateData, validateCertificateTemplate, type CertificateLanguage, type CertificatePayload, type CertificateTemplate } from '@/lib/certificates';
export const dynamic = 'force-dynamic';
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', Vary: 'Cookie' } });
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
async function access(req: Request) {
  const staff = await getStaffIdentity(req);
  if (!staff) return reply({ error: '로그인해주세요. / Please sign in.' }, 401);
  if (!canUseCertificates(staff)) return reply({ error: '공문서 접근 권한이 없습니다. / Certificates access is restricted.' }, 403);
  return staff;
}
export async function GET(req: Request) {
  try {
    const staff = await access(req); if (staff instanceof Response) return staff;
    const url = new URL(req.url), action = url.searchParams.get('action') || 'load';
    if (action === 'access') return reply({ staff });
    const db = portalDb();
    if (action === 'search') {
      const q = (url.searchParams.get('q') || '').trim();
      if (q.length < 2 || q.length > 80) return reply({ error: '검색어를 2~80자로 입력해주세요. / Enter 2–80 characters.' }, 400);
      const { data, error } = await db.rpc('certificate_search_bookings', { p_query: q });
      if (error) throw error;
      return reply({ bookings: (data || []).map(normalizeCertificateBooking) });
    }
    if (action === 'history') {
      const id = url.searchParams.get('documentId'); if (!uuid(id)) return reply({ error: 'Invalid document ID.' }, 400);
      const { data, error } = await db.from('certificate_document_versions').select('*').eq('document_id', id).order('version', { ascending: false });
      if (error) throw error; return reply({ versions: data });
    }
    if (action !== 'load') return reply({ error: 'Unknown action.' }, 400);
    const [ko, en, { data: documents, error: de }] = await Promise.all([
      db.from('certificate_template_versions').select('*').eq('language','ko').order('version', { ascending: false }).limit(1),
      db.from('certificate_template_versions').select('*').eq('language','en').order('version', { ascending: false }).limit(1),
      db.from('certificate_document_versions').select('document_id,version,language,booking_id,student_name,reference,created_at,created_by').order('created_at', { ascending: false }).limit(100),
    ]);
    if (ko.error || en.error || de) throw ko.error || en.error || de;
    const templates = [...(ko.data || []), ...(en.data || [])];
    const latest: Record<string, unknown> = {};
    for (const language of ['ko', 'en'] as CertificateLanguage[]) {
      const row = templates?.find(t => t.language === language);
      latest[language] = { version: row?.version || 0, payload: row?.payload || defaultCertificateTemplate(language) };
    }
    const seen = new Set<string>();
    return reply({ staff, templates: latest, documents: (documents || []).filter(d => { if (seen.has(d.document_id)) return false; seen.add(d.document_id); return true; }) });
  } catch { return reply({ error: '공문서 데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요. / Could not load certificates. Please retry.' }, 503); }
}
export async function POST(req: Request) {
  try {
    const staff = await access(req); if (staff instanceof Response) return staff;
    if (Number(req.headers.get('content-length') || 0) > 60000) return reply({ error: 'Request is too large.' }, 413);
    const raw = await req.text(); if (raw.length > 60000) return reply({ error: 'Request is too large.' }, 413);
    let body; try { body = JSON.parse(raw); } catch { return reply({ error: 'Invalid JSON.' }, 400); }
    if (!body || typeof body !== 'object') return reply({ error: 'Invalid request.' }, 400);
    const { kind, language, expectedVersion, documentId, bookingId, payload } = body;
    if (!['template', 'document'].includes(kind) || !['ko', 'en'].includes(language) || !Number.isInteger(expectedVersion) || expectedVersion < 0 || (kind === 'document' && !uuid(documentId)) || (bookingId !== null && bookingId !== undefined && !uuid(bookingId))) return reply({ error: 'Invalid version, language or document.' }, 400);
    const template: CertificateTemplate = kind === 'template' ? payload : (payload as CertificatePayload)?.template;
    let invalid = validateCertificateTemplate(template, language);
    if (kind === 'document') invalid ||= validateCertificateData(payload?.data, language);
    if (invalid) return reply({ error: invalid }, 400);
    if (bookingId) {
      const { data, error } = await portalDb().from('bookings').select('id').eq('id', bookingId).maybeSingle();
      if (error) throw error; if (!data) return reply({ error: '예약을 찾을 수 없습니다. / Booking not found.' }, 400);
    }
    const { data, error } = await portalDb().rpc('save_certificate_version', {
      p_kind: kind, p_language: language, p_expected_version: expectedVersion, p_document_id: kind === 'document' ? documentId : null,
      p_booking_id: kind === 'document' ? bookingId || null : null, p_payload: payload, p_actor: staff.username,
    });
    if (error?.message?.includes('CERTIFICATE_VERSION_CONFLICT')) return reply({ error: '다른 직원이 먼저 저장했습니다. 이력을 다시 열고 수정해주세요. / Another revision was saved. Reload the latest version before saving.' }, 409);
    if (error) throw error;
    return reply({ saved: data });
  } catch { return reply({ error: '저장하지 못했습니다. 입력 내용을 유지하고 다시 시도해주세요. / Save failed. Your edits are still on screen; please retry.' }, 503); }
}
