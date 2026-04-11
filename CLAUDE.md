# 드림아카데미 프로젝트 현황

## 기본 정보
- 프레임워크: Next.js (App Router)
- 호스팅: Vercel
- 도메인: dreamacademyph.com
- GitHub: dreamacademy24/academy-web
- DB: Supabase (yiglafscjvjgkxpycevk.supabase.co)
- 로컬 경로: C:/Users/user/academy-web

## 완성된 페이지
- `/` : 메인
- `/booking` : 예약 접수 폼
- `/admin/hub` : 관리자 허브
- `/admin/bookings` : 예약관리 (견적/부킹리스트/인보이스/영수증/확정예약 탭)
- `/invoice` : 인보이스 작성
- `/receipt` : 영수증 발행
- `/dreamhouse-rooms` : 드림하우스 룸 캘린더
- `/staff` : 직원 업무 페이지 (public/team_manager3.html)
- `/guide` : 직원 가이드

## Supabase 테이블
- `bookings` : 예약 (flight_in, flight_out, house_no, pickup_place, special_request, agency, files jsonb, confirmed 포함)
- `staff_tasks` : 업무 (id, title, assignee, assignees, due, created_at, note, done, files, checklist, progress, shared, proj_id, idx)
- `staff_projects` : 프로젝트 (id, name, description, color, members, due, created_at, progress)
- `staff_task_comments` : 업무 댓글 (id, task_id, from_id, text, ts)
- `staff_threads` : 프로젝트 스레드 (id, proj_id, from_id, text, ts)
- `staff_notices` : 공지사항 (id, text, done, date, require_read)
- `staff_chat` : 채팅 (channel, from_id, text, ts)
- `staff_approvals` : 결재 (from_id, to_id, title, body, files jsonb, status, reject_reason)
- `staff_opinions` : 의견요청 (from_id, target, title, body, files jsonb, ts)
- `staff_op_replies` : 의견 답변
- `staff_notifications` : 알림 (id, to_id, type, ref_id, message, is_read, created_at)
- `staff_reports` : 보고 (localStorage tm_reports 사용 중 - Supabase 미이전)
- `notices`, `posts`, `comments`, `profiles`, `applications`, `shuttle_applications`, `fieldtrip_applications`

## team_manager3.html 주요 기능
- 로그인: 직원별 비밀번호, localStorage tm_session
- Supabase anon key: 2026년 갱신 완료
- 채팅: staff_chat 테이블, 채널(전체/공지/잡담/업무)
- 결재: staff_approvals, submitApproval/processApproval/resubmitApproval 함수
- 의견요청: staff_opinions, opinionModal HTML 포함
- 파일첨부: readFilesAsBase64/renderFilePreview/renderAttachments 함수
- 보고: localStorage tm_reports, 보고 모달(reportModal), 상세보기(reportViewModal), 전체보기(reportAllModal)
- 프로젝트 연결업무: linkTaskModal, openLinkTaskModal/linkTaskToProj 함수
- 사이드바: 🔒 어드민 홈 버튼 제거, 상단 ← 관리자 홈 버튼으로 통합
- 관리자 홈 버튼: 우측 상단 헤더에 ← 관리자 홈
- 담당자별 보고 현황: buildReportDashboard에서 각 멤버 카드에 프로젝트 업무도 표시
- 다른 직원 업무 보기: showEmpPage 읽기전용 모드 (접근 차단 제거), "+N개 더" 인라인 펼침
- 알림 시스템: staff_notifications 테이블, createNotif/createNotifMultiple 함수
  - 트리거: 업무 댓글, 공지, 스레드, 결재, 의견요청, 미배정 업무
  - UI: 네비게이션 빨간 점 뱃지 (.notif-dot), 섹션 방문 시 읽음 처리
  - 로딩: 로그인 시 + 30초 폴링 (pollForUpdates에 통합)
  - 타입: task_comment, notice, thread, approval, opinion, unassigned_task

## 확정 예약 탭 (admin/bookings) - 스프레드시트 뷰
- 영수증발행/결제완료/완료 상태 예약 표시
- 컬럼: 예약번호(단축), 담당자, 예약자/학생, 체크인, 체크아웃, D-day, 숙소/룸, 아카데미시작, 아카데미종료, 항공IN, 항공OUT, 픽업장소, 드랍장소, 유학원, 잔금일, 금액, 특이사항, 최종확인(checkbox)
- 컬럼 헤더 클릭으로 정렬 (오름/내림차순)
- 검색바: 예약자, 학생, 유학원, 예약번호 등 검색
- 최종확인 체크박스: Supabase bookings.confirmed 필드에 저장
- D-day 색상: 7일이내 빨강, 30일이내 주황, 이후 초록
- 잔금 D-day: 14일이내 표시

## PayPal
- Sandbox 활성화 완료
- Live 모드: 사무실 방문 서류 제출 후 Live Client ID → Vercel 환경변수 등록 필요

## 환경변수 (Vercel)
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- GOOGLE_PRIVATE_KEY (실제 줄바꿈으로 저장)
- NEXT_PUBLIC_PAYPAL_CLIENT_ID (Sandbox)

## 주의사항
- SHEET1, SHEET2 절대 건드리지 않음 (웹 데이터는 SHEET3만)
- localStorage는 typeof window !== 'undefined' 체크 필수
- git push하면 Vercel 자동 배포
- Supabase free tier 자동 pause 주의

## 보안 수정 (2026-04-08)
- URL 파라미터 auth bypass 제거 (?user=ceo 불가)
- XSS 방지 - innerHTML에 esc() 적용
- adminAuth.ts 토큰 기반 인증으로 교체
- 관리자 비밀번호 해시 처리 (simpleHash, 클라이언트 평문 노출 제거)
- 예약번호 6자리로 변경 (충돌 방지)
- 영수증 페이지 중복 상태변경 방지
- PayPal 결제금액 서버검증 추가
- console.log PII 제거
- postMessage wildcard origin 제한
- Supabase RLS 활성화 필요 (모든 테이블)

## Supabase 이전 완료 (2026-04-08)
- staff_tasks: 업무 (공유/동기화)
- staff_projects: 프로젝트
- staff_task_comments: 업무 댓글
- staff_threads: 프로젝트 스레드
- staff_notices: 공지사항
- staff_chat: 채팅 (기존)
- staff_notifications: 알림 (2026-04-10 추가)
- 30초 폴링으로 실시간 동기화 (showSyncBadge)
- localStorage는 캐시 역할만 (Supabase가 source of truth)

## 버그 수정 (2026-04-10)
- 달력 날짜 1일 밀림: toISOString()→localDateStr() 로컬 타임존 기준으로 변경
  - 영향 범위: 월간/주간 달력, todayStr(), 주간 사이드바 weekDs, 마감 알림 tmrStr
  - localDateStr(d): getFullYear/getMonth/getDate로 YYYY-MM-DD 생성
  - parseLocalDate(str): 기존 함수, dL() 등에서 이미 사용 중

## team_manager3.html 업데이트 (2026-04-11)
- 헤더 타이틀 버그 수정: topbar-left에 flex:1;min-width:0, topbar-right에 flex-shrink:0 적용
- 의견요청 카드 클릭 시 상세 팝업 구현: opDetailModal 모달, 본문+댓글 목록+댓글 입력. op.id를 문자열로 전달 (bigint 정밀도 문제 해결)
- 홈 직원 카드 업무 색상 구분: D-2 이하 빨강(#ef4444), 진행중 파랑(#3b82f6). DOM API style.setProperty('color',val,'important') 사용
- 체크리스트 날짜 필드 추가: parseClInput()으로 "업무명 4/24" 입력 시 날짜 자동 분리, clDueHtml()으로 📅 버튼 렌더링, 마감 지난 항목 빨강
- 업무 추가 팀 공유 토글 (tmShare): ON 시 shared:true로 달력·전체 보드에 표시
- 하위 업무(Sub-task) 구조: tmSubToggle 토글, checklist 필드에 {_sub:true,items:[...]} 형태로 저장
  - 버그: tmSubToggleSpan(position:absolute;inset:0)이 checkbox 클릭 가로챔 → pointer-events:none으로 수정
- 프로젝트 상세 탭 구조: 개요/업무/댓글/보고/파일 탭 분리 (setProjTab 함수)
- 전체 업무 컬럼 정렬: 업무명(2fr)/담당자(1fr)/마감일(1fr)/상태(1fr)/액션(80px) 중앙 정렬
- 채팅 미읽음 뱃지: 99+ 상한 추가
- 파일 첨부 최대 10개: MAX_FILES=10, readFilesAsBase64/handleTMF/handleQAF에서 제한
- 체크리스트/하위업무 이벤트 바인딩: DOMContentLoaded에서 addEventListener 사용 (인라인 핸들러 스코프 문제 대응)

## Key learnings & principles
- **토글 스위치 버그 패턴**: position:absolute;inset:0 span이 checkbox 위를 덮으면 change 이벤트 발생 안 함. span에 pointer-events:none 추가로 해결
- **Supabase bigint ID**: onclick에 숫자로 전달 시 JS 정수 정밀도(2^53) 초과로 ID 깨짐. 문자열로 전달('id')
- **파일 개수 제한**: MAX_FILES 전역 변수로 관리. readFilesAsBase64 함수에서 참조
- **인라인 핸들러 vs addEventListener**: let/const 변수는 window 스코프에 없어 인라인 onclick에서 접근 문제 가능. DOMContentLoaded addEventListener 권장

## 남은 작업
- staff_reports Supabase 이전 (보고 현황, 현재 localStorage)
- PayPal Live 모드 활성화
- Supabase RLS 정책 설정 (모든 테이블, staff_notifications 포함)
- Supabase Auth 도입 (장기 계획)
- 드림하우스 룸 캘린더 개선
- 인보이스 결제섹션 레이아웃 (견적계산기 박스 이동)

## 새 대화 시작
"드림아카데미 프로젝트 이어서 진행해줘"
→ GitHub CLAUDE.md 읽고 현재 상태 파악 후 바로 작업

## 전체 로드맵 (2026-04 확정)

### 예약 유형 4가지
1. 드림하우스 단독 패키지
2. 드하 + 제이파크 조합
3. 드하 + 큐브나인 조합 (1주/2주/4주/6일)
4. 숙소만 (Room Only)

### 인보이스 2방향
- 손님용: 한국어, 결제안내 중심
- 리조트용 예약확인서: 영어, 이메일 자동발송

### 새 Supabase 테이블 (구현 예정)
bookings / booking_accommodations / invoices / students / academy_enrollments / online_class_enrollments / tutors / tutor_schedules / tutor_invoices / ssp_records / drivers / vehicles / pickup_requests / shuttle_requests / driver_schedules / checkin_details / guest_profiles / tutor_requests

### 추가 기능 (구현 예정)
- 픽드랍/셔틀/기사 관리 (기사 4명, 12인승, 스케줄 달력)
- 드림하우스 체크인 디테일 자동생성
- 학생/튜터/화상영어/SSP 관리
- 엑셀 내보내기/가져오기
- 손님 포털 (회원가입/예약신청/셔틀/픽드랍/튜터 신청)
- 다국어 지원 (한/영/일) - next-intl
- 기사 메신저 자동전달 (솔라피 연동, 나중에)
- 카카오 채팅 위젯 (맨 나중)

### 구현 순서 (54 스텝)
Phase 0: DB 세팅 (1~9)
Phase 1: 픽드랍/셔틀/기사 (10~15)
Phase 2: 체크인 디테일 자동생성 (16~20)
Phase 3: 어드민 예약 개편 + 인보이스 (21~25)
Phase 4: 학생/튜터/화상영어/엑셀 (26~30)
Phase 5: 손님 포털 (31~36)
Phase 6: 다국어 한/영/일 (37~42)
Phase 7: 홈페이지 콘텐츠 개선 (43~46)
Phase 8: 자동화 고도화 + 기타 (47~54)

## 현재 진행 상황 (2026-04-11 업데이트)

### 완료된 작업 (STEP 1~9)
- STEP 1 ✅ CLAUDE.md 업데이트 & git push
- STEP 2 ✅ bookings_new, booking_accommodations, invoices_new 테이블 생성
- STEP 3 ✅ students, academy_enrollments, ssp_records 테이블 생성
- STEP 4 ✅ tutors, tutor_schedules, tutor_invoices, online_class_enrollments 테이블 생성
- STEP 5 ✅ drivers, vehicles, pickup_requests, shuttle_requests, driver_schedules 테이블 생성
- STEP 6 ✅ checkin_details 테이블 생성
- STEP 7 ✅ guest_profiles, tutor_requests 테이블 생성
- STEP 8 ✅ CSV 마이그레이션 스크립트 작성 (scripts/migrate-csv.mjs)
- STEP 9 ✅ 마이그레이션 실행 완료 — bookings_new 117건, students 426건 INSERT
- 🔧 버그픽스: 직원업무 자동 로그인 수정 + Jun 역할 일반직원으로 변경

### 다음 작업 (STEP 10부터)
- STEP 10: Supabase Auth 활성화 + RLS 전체 설정
  - 이메일/비밀번호 Auth 활성화
  - 전체 테이블 RLS 설정 (손님은 자기 데이터만, 어드민 전체 접근)
  - service role key 사용 API 경유 확인
- STEP 11~: Phase 1 직원 업무 — 픽드랍/셔틀/기사 시스템

### Supabase 신규 테이블 목록 (총 18개)
bookings_new, booking_accommodations, invoices_new,
students, academy_enrollments, ssp_records,
tutors, tutor_schedules, tutor_invoices, online_class_enrollments,
drivers, vehicles, pickup_requests, shuttle_requests, driver_schedules,
checkin_details, guest_profiles, tutor_requests

### 주요 데이터 현황
- bookings_new: 117건 (기존 CSV 마이그레이션)
- students: 426건 (기존 CSV 마이그레이션)
- 기존 bookings 테이블 유지 (구 스키마, Phase 3에서 코드 전환 시 제거 예정)

### 로드맵 체크리스트 파일
- dreamacademy-roadmap.html (로컬 파일, 54개 스텝 체크리스트)

### 새 대화 시작 방법
"드림아카데미 프로젝트 이어서 진행해줘"
→ CLAUDE.md 읽고 STEP 10부터 이어서 진행
