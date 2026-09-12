# Student care production release — 2026-09-12

## Release scope

User explicitly requested direct production deployment and real-use feedback. No extra Supabase project or paid test branch is created. The interrupted preview migration was not applied (confirmed from migration history and table inventory). Preview-only code is excluded from this release.

Base production commit: `ce02d509159a2ce331f2eef6507136161d71230f`. Release workspace: `.release/student-care-live`, branch `codex/student-care-live`. All nine completed learning/care/guide commits were applied on top of current main without conflicts. Unrelated work in the root and unfinished preview work remain untouched.

Included: guest/learning entrance; illustrated My Tree House story and practice activities; slower speech; official DSL-F2 stage label; protected student link review/confirmation; permanent learners with separate visits; shared student roster and per-visit teacher assignments; Korean/English staff guides. Teacher roster access requires an active assignment. Administrators make the first verified links; learners/visits/assignments were all empty before deployment.

Not included: child/account learning sync, teacher recording submission, visit-specific textbook/level editing, lesson notes, report publication, Dreamy game redesign, student-linked video review. The guides clearly state these limits.

## Database

Existing migration `20260912055458_student_care_confirmed_visits` is preserved. Added `20260912105728_student_care_teacher_assignments` using Supabase apply_migration; local filename matches the returned version. No real student records were linked, no assignments were made, and no booking/student source rows were changed by this deployment work.

Verified care_assignment_events RLS enabled; anon/authenticated direct SELECT denied; get_care_roster/set_care_assignment anonymous execution denied and service execution granted. Security advisor's no-policy INFO on the server-only care table is intentional. Existing broad policies elsewhere remain a separately documented issue, not fixed by this feature.

## Predeployment verification

- 39 care/session/API/database tests passed, including visit separation, stale requests, retries, removal, role checks and atomic rollback.
- Full Next production build passed, including TypeScript and 199 generated pages.
- ESLint passed for care APIs/pages, shared session/auth, and modified login APIs. Existing home-file lint issues remain documented in student-care-assignments.md.
- Guide text changed from test-environment instructions to actual-use instructions. Existing staff guide and acknowledgement states are preserved.

## Deployment and rollback

Push the release HEAD to main without force, verify Vercel production Ready and matching SHA, then verify public routes/assets and unauthenticated API denial. Authenticated real student linking is intentionally performed by the administrator after verifying identity; do not fabricate an admin cookie or silently select actual students for a smoke test.

For a web regression, return the production alias to the prior deployment or revert only these release commits. Leave the additive care tables and history intact; do not drop student data as part of a web rollback.

After live verification, publish one ordinary bilingual staff notice with guide links after checking for duplicates. No repeated required-reading task, no resetting existing read/done states.
