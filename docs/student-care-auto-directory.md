# Existing student directory and automatic exact links

User requested that existing students appear immediately instead of requiring staff to manually recreate the directory.

The administrator directory includes all legacy students, even those requiring review. Confirmed care visits keep their existing learner grouping and assignment history. Unlinked source rows remain separate, clearly labelled records; a name alone never merges people. Search, 25-card pagination, unassigned linked visits and review-only filters are available.

GET is read-only. After the initial administrator listing, an admin-only POST synchronizes exact matches then returns the refreshed directory. Database role checks and a transaction advisory lock protect the operation. Automatic linking uses the existing atomic confirmation function, including original snapshots and row locks. A unique matching student ID in the same booking, matching source names, non-placeholder identity and valid booking dates are required. Name-only matches, conflicting IDs, repeated claims, malformed JSON, missing dates/bookings and invalid ranges remain visible for review. Existing links are never rewritten by synchronization; link_method records automatic versus manual creation. Same-name returning records with different IDs still need identity verification.

Teachers continue through the scoped roster function. They receive only active assigned visits and never receive the source directory or administrator fields. This release does not assign teachers automatically.

Migration: 20260912131205_student_care_auto_directory.sql. New functions are SECURITY INVOKER, empty search_path and service-role-only. No source booking/student rows are changed. No new database or paid branch was created.

Validation: 45 database/API/session/reconciliation tests passed, targeted ESLint passed, full production build including TypeScript and 199 pages passed. Tests cover pre-link visibility, malformed/conflicting candidates, repeat refresh, distinct same-name learners, preserved manual return visits and teacher scope.

The existing Korean/English student-care guides are updated in place with screen walkthroughs, controls and expected save results. Their administrator flow is directory → teacher assignment → exceptions. The general staff-workspace manual and its acknowledgement states remain untouched.
