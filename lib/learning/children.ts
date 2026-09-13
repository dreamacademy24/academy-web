import type { portalDb } from '@/lib/portalAuth';
import { describeAssignment, type AssignmentRecord, type LearningAssignment } from './catalog';

type Database = ReturnType<typeof portalDb>;
type Booking = { id: string; portal_user_id: string; students: unknown; status: string | null };
type Link = { booking_id: string; source_index: number; legacy_student_id: string; learner_id: string; visit_id: string };
type Visit = { id: string; learner_id: string; booking_id: string; start_date: string; end_date: string };
type Assignment = AssignmentRecord & { visit_id: string };
export type LearningChild = {
  learnerId: string; nameKr: string; nameEn: string | null;
  visits: { visitId: string; startDate: string; endDate: string; assignment: LearningAssignment | null }[];
};
export type LearningChildren = { children: LearningChild[]; pendingCount: number };
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
function stringField(value: Record<string, unknown>, fields: string[]) {
  for (const field of fields) if (typeof value[field] === 'string' && value[field].trim()) return value[field].trim();
  return null;
}
function entries(value: unknown): unknown[] {
  const parsed = typeof value === 'string' ? JSON.parse(value) : value;
  if (parsed == null) return [];
  if (!Array.isArray(parsed)) throw new Error('Invalid booking students');
  return parsed;
}

/** Join only a parent's verified booking sources; a shared name never establishes identity. */
export function assembleLearningChildren(userId: string, bookings: Booking[], links: Link[], visits: Visit[], assignments: Assignment[]): LearningChildren {
  const result: LearningChildren = { children: [], pendingCount: 0 };
  const children = new Map<string, LearningChild>();
  const currentAssignments = new Map<string, Assignment>();
  for (const assignment of assignments) {
    const previous = currentAssignments.get(assignment.visit_id);
    if (!previous || assignment.version > previous.version) currentAssignments.set(assignment.visit_id, assignment);
  }
  const visitMap = new Map(visits.map(visit => [visit.id, visit]));
  const linkMap = new Map<string, Link[]>();
  for (const link of links) {
    const key = `${link.booking_id}:${link.source_index}`;
    linkMap.set(key, [...(linkMap.get(key) ?? []), link]);
  }
  for (const booking of bookings) {
    if (booking.portal_user_id !== userId || !uuid(booking.id) || ['취소', 'cancelled', 'canceled'].includes((booking.status ?? '').trim().toLowerCase())) continue;
    for (const [index, entry] of entries(booking.students).entries()) {
      if (!object(entry)) { result.pendingCount++; continue; }
      const sourceId = stringField(entry, ['id', 'student_id']);
      const matches = linkMap.get(`${booking.id}:${index}`) ?? [];
      const link = matches.length === 1 ? matches[0] : null;
      const visit = link ? visitMap.get(link.visit_id) : null;
      if (!uuid(sourceId) || (entry.id && entry.student_id && entry.id !== entry.student_id)
        || !link || link.legacy_student_id !== sourceId || !uuid(link.learner_id)
        || !visit || visit.booking_id !== booking.id || visit.learner_id !== link.learner_id) {
        result.pendingCount++; continue;
      }
      let child = children.get(link.learner_id);
      const nameKr = stringField(entry, ['korName', 'name_kr', 'koreanName', 'name']) ?? '';
      const nameEn = stringField(entry, ['engName', 'name_en']);
      if (!child) {
        child = { learnerId: link.learner_id, nameKr, nameEn, visits: [] };
        children.set(link.learner_id, child);
      } else if (visit.start_date > (child.visits[0]?.startDate ?? '')) {
        child.nameKr = nameKr; child.nameEn = nameEn;
      }
      if (!child.visits.some(existing => existing.visitId === visit.id)) child.visits.push({
        visitId: visit.id, startDate: visit.start_date, endDate: visit.end_date,
        assignment: describeAssignment(currentAssignments.get(visit.id)),
      });
      child.visits.sort((a, b) => b.startDate.localeCompare(a.startDate) || a.visitId.localeCompare(b.visitId));
    }
  }
  result.children = [...children.values()].sort((a, b) => (a.nameKr || a.nameEn || '').localeCompare(b.nameKr || b.nameEn || '') || a.learnerId.localeCompare(b.learnerId));
  return result;
}

async function parentBookings(db: Database, userId: string): Promise<Booking[]> {
  const result: Booking[] = [];
  for (let offset = 0; offset < 10000; offset += 100) {
    const { data, error } = await db.from('bookings').select('id,portal_user_id,students,status').eq('portal_user_id', userId).order('id').range(offset, offset + 99);
    if (error || !Array.isArray(data)) throw new Error('Booking lookup failed');
    result.push(...data as Booking[]);
    if (data.length < 100) return result;
  }
  throw new Error('Booking lookup exceeded limit');
}

async function associatedRows<T>(db: Database, table: string, fields: string, field: string, ids: string[]): Promise<T[]> {
  const result: T[] = [];
  for (let start = 0; start < ids.length; start += 50) {
    let complete = false;
    for (let offset = 0; offset < 10000; offset += 100) {
      const { data, error } = await db.from(table).select(fields).in(field, ids.slice(start, start + 50)).order('id').range(offset, offset + 99);
      if (error || !Array.isArray(data)) throw new Error('Learning lookup failed');
      result.push(...data as T[]);
      if (data.length < 100) { complete = true; break; }
    }
    if (!complete) throw new Error('Learning lookup exceeded limit');
  }
  return result;
}

export async function loadLearningChildren(db: Database, userId: string): Promise<LearningChildren> {
  const bookings = (await parentBookings(db, userId)).filter(booking => booking.portal_user_id === userId);
  if (!bookings.length) return { children: [], pendingCount: 0 };
  const links = await associatedRows<Link>(db, 'care_links', 'id,booking_id,source_index,legacy_student_id,learner_id,visit_id', 'booking_id', bookings.map(booking => booking.id));
  const visitIds = [...new Set(links.map(link => link.visit_id).filter(uuid))];
  const [visits, assignments] = await Promise.all([
    associatedRows<Visit>(db, 'care_visits', 'id,learner_id,booking_id,start_date,end_date', 'id', visitIds),
    associatedRows<Assignment>(db, 'care_learning_assignments', 'id,visit_id,level_code,unit_id,effective_at,created_at,version', 'visit_id', visitIds),
  ]);
  return assembleLearningChildren(userId, bookings, links, visits, assignments);
}
