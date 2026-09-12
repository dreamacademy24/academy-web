# Staff session and student navigation — 2026-09-12

The workspace previously trusted persistent browser metadata while Student Care required an eight-hour signed server cookie. An expired cookie could leave the workspace looking signed in, and `/login` sent stale metadata back to the hub.

- Verify current active staff through `/api/staff/session`; renew valid cookies on opening, focus and every four visible minutes.
- Use the verified server identity before rendering admin workspace, Teacher Hub, Student Care and student review. Keep the separate legacy online-attendance login intact.
- Never issue a session from localStorage identity. An already expired browser must authenticate once. Sign-in exits same-origin frames and returns to the original safe staff page.
- Return 503 for identity-lookup failures rather than treating a database outage as expired authentication. Preserve the displayed workspace during temporary background connection failures.
- Move directory, care, tutor, online English and guide links into the top-level 학생관리 group. Preserve alert badges and track iframe navigation in the active menu.
- Amend the existing care guide path in Korean and English. Publish one ordinary correction notice after deployment and live verification; do not change older read/completion states.

Validation: 57 relevant session, role, return-path, care API and database tests pass; targeted changed-file lint and TypeScript pass. Production build and live checks are recorded after release.
