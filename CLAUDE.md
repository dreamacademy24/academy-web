# 드림아카데미 프로젝트 현황

## 기본 정보
- 프레임워크: Next.js (App Router)
- 호스팅: Vercel
- 도메인: dreamacademyph.com
- GitHub: dreamacademy24/academy-web
- DB: Supabase (yiglafscjvjgkxpycevk.supabase.co)
- 로컬 경로: C:/Users/desko/academy-web

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
- **Supabase 공개 폼 RLS 고통**: "TO public" 정책이 이론상 anon+authenticated 포함해야 하나 PostgREST 캐시/구현상 차이로 401 지속 가능. 정석 패턴은 Next.js API Route + service_role.
- **React 폼 state 주입**: name 속성 없이 id만 쓰는 경우 `Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set` 사용 + `dispatchEvent('input'/'change')`
- **Chrome MCP 검증 팁**: role=radiogroup + role=radio 패턴은 `querySelectorAll('[role="radiogroup"]')`로 그룹 순회 후 `querySelectorAll('button')[idx].click()`
- **supabase-js silent fail**: `.insert(...)` 에러 체크 안 하면 400 응답도 성공처럼 진행됨. 항상 `const { error } = await ... .select()` 패턴 + alert/console.error로 노출.

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

### 완료된 작업 (STEP 1~21)
- STEP 1 ✅ CLAUDE.md 업데이트
- STEP 2~7 ✅ Supabase 신규 테이블 18개 생성
- STEP 8~9 ✅ CSV 마이그레이션 — bookings_new 117건, students 426건
- STEP 10 ✅ Supabase Auth 활성화 + RLS 전체 설정 + exec_sql 함수
- STEP 11 ✅ /admin/drivers — 기사 4명 + 차량 등록 화면
- STEP 12 ✅ 픽드랍 자동 추출 (bookings_new → pickup_requests)
- STEP 13 ✅ /admin/pickups — 픽드랍 목록 + 기사 배정 + 12인승 초과 경고
- STEP 14 ✅ /admin/shuttle — 셔틀 관리 + 기사 배정
- STEP 15 ✅ admin/hub 카드 9개 (기사관리/픽드랍/셔틀/기사스케줄/체크인디테일 추가)
- STEP 16 ✅ /admin/driver-schedule — 주간 달력뷰 (날짜×기사 격자, 인쇄)
- STEP 17~21 ✅ /admin/checkin-details — 체크인 디테일 자동생성 + PDF 출력
- 🔧 버그픽스 ✅ 직원업무 자동 로그인 + Jun 역할 일반직원 변경
- 🔧 링크 자동 연결 ✅ 의견요청/공지/채팅/댓글 URL 클릭 가능하게

### 다음 작업 (STEP 22부터)
- STEP 22: 예약 유형 선택 UI + 숙소 조합 동적 필드 (/admin/bookings 개편)
- STEP 23: 항공권 구조화 + 학생 자동생성
- STEP 24: 결제 상태 구조화 + 확정예약 탭 개선
- STEP 25~27: 인보이스 3가지 템플릿 + 리조트용 예약확인서 + 결제섹션 개선
- STEP 28~32: 학생/튜터/화상영어/엑셀
- STEP 33~42: 손님 포털
- STEP 43~48: 다국어 한/영/일
- STEP 49~54: 홈페이지 개선 + 마무리

### admin/hub 카드 현황 (9개)
예약 관리 / 사이트 관리 / 직원업무 / 드림하우스 /
기사 관리(/admin/drivers) / 픽드랍 관리(/admin/pickups) /
셔틀 관리(/admin/shuttle) / 기사 스케줄(/admin/driver-schedule) /
체크인 디테일(/admin/checkin-details)

### 새 대화 시작 방법
"드림아카데미 프로젝트 이어서 진행해줘"
→ CLAUDE.md 읽고 STEP 22 (어드민 예약 개편)부터 바로 이어서 진행

## 현재 진행 상황 (2026-04-11 최신)

### 완료된 작업 (STEP 1~33)
- STEP 1~21 ✅ (이전 세션 완료)
- STEP 22 ✅ 예약 유형 선택 UI + 숙소 조합 동적 필드
- STEP 23 ✅ 항공권 구조화 + 학생 자동생성
- STEP 24 ✅ 결제 상태 구조화 + 확정예약 탭 통계
- STEP 25 ✅ 손님용 인보이스 + 리조트용 예약확인서 분리
- STEP 26 ✅ 튜터 관리 페이지 (/admin/tutors)
- STEP 27 ✅ 화상영어 출석 관리 (/admin/online-class)
- STEP 28 ✅ 엑셀 내보내기 (확정예약/부킹리스트)
- STEP 29 ✅ SSP 관리 페이지 (/admin/ssp)
- STEP 30 ✅ 학생 관리 페이지 (/admin/students)
- STEP 31 ✅ 튜터 스케줄 주간 달력 (/admin/tutor-schedule)
- STEP 32 ✅ 튜터 인보이스 정산 (/admin/tutor-invoice)
- STEP 33 ✅ 체크인 30일전 항공권 확인 자동 태스크 생성

### admin/hub 카드 현황 (총 14개)
예약관리 / 사이트관리 / 직원업무 / 드림하우스 /
기사관리 / 픽드랍 / 셔틀 / 기사스케줄 / 체크인디테일 /
튜터관리 / 화상영어 / SSP관리 / 학생관리 /
튜터스케줄 / 튜터인보이스

### 다음 작업 (STEP 34~)
- STEP 34~42: 손님 포털 (예약 조회, 서류 업로드 등)
- STEP 43~48: 다국어 한/영/일
- STEP 49~54: 홈페이지 개선

### 새 대화 시작 방법
"드림아카데미 프로젝트 이어서 진행해줘"
→ CLAUDE.md 읽고 STEP 34부터 바로 이어서 진행

## 2026-04-12 완료 작업

### 통합 UI 개편
- ✅ Master View 7탭 완성 (/admin/bookings/[id]):
  기본정보 → 픽업/체크인 → 학생 → 인보이스 → 튜터 → 셔틀 → **코멘트**
  - 코멘트 탭: 직원 메모, 본인 작성만 삭제 가능
- ✅ /admin/tutors 3탭 통합: 튜터 목록 / 튜터 스케줄 / 튜터 인보이스
- ✅ /admin/shuttle-management 3탭 통합: 셔틀 / 기사 / 기사 스케줄
- ✅ admin/hub 12개 카드 가로형 정리 (기존 16개 → 통합)

### 로그인 통합
- ✅ /login 페이지 하나로 통합
  - admin- 접두사 → 관리자 로직 (adminAuth.ts, simpleHash)
  - 그 외 → Supabase Auth 이메일 로그인
  - 성공 시: 관리자 /admin/hub, 일반 /portal/dashboard
- ✅ 14개 어드민 페이지 /admin → /login 리다이렉트 통일
- ✅ 비밀번호 눈 아이콘 👁/🙈 (/login, /signup, /guide, /admin/*)

### 손님 예약 폼 개편
- ✅ /booking 전면 개편 (6섹션):
  예약유형 4카드(드하/드하+제이파크/드하+큐브나인/통학형)
  → 숙소 기간 → 예약자 정보 → 체크인·항공편 → 학생 정보 → 특이사항
  - 통학형 선택 시 숙소+항공편 섹션 자동 숨김
  - 체크아웃 자동 계산, 항공편 "미정" 체크박스
- ✅ /signup 확장: 자녀 정보 (최대 5명), 주소 필드, 눈 아이콘
  - "User already registered" 한국어 에러 메시지
- ✅ /portal/tutor 18항목 폼 (네이버 폼 대체)

### 손님 포털 6개 기능 완성
- ✅ /portal (예약 조회 로그인, 24h 세션)
- ✅ /portal/dashboard (6개 메뉴 카드)
- ✅ /portal/my-booking (예약 상세)
- ✅ /portal/flight (항공편 등록, 체크인 7일 전 잠금)
- ✅ /portal/payment (PayPal 잔금 결제)
- ✅ /portal/shuttle (셔틀 신청, 4개 장소)
- ✅ /portal/pickup (추가 픽드랍)
- ✅ /portal/tutor (튜터 수업 18항목 폼)
- 모든 신청 → 어드민 태스크 자동 생성 (staff_tasks)

### 어드민 손님 신청관리
- ✅ /admin/portal-requests (3탭 통합: 셔틀/픽업/튜터)
- 상태 필터 (전체/대기/확정/취소)
- 승인 시 driver_schedules 자동 등록 (셔틀/픽업)
- 구 bookings 예약은 notes의 portal_booking_id로 매핑

### 직원업무 (team_manager3.html)
- ✅ 의견요청 댓글 말풍선 UI:
  본인=오른쪽 파란색, 타인=왼쪽 흰색, 아바타 32px, 단어 단위 줄바꿈

### Supabase 테이블 확장
- ✅ booking_comments 테이블 생성 (scripts/setup-booking-comments.sql)
- ✅ tutor_requests 21컬럼 추가 (scripts/setup-tutor-requests.sql)
- ✅ profiles children(jsonb), address(text) 추가 (scripts/setup-profiles-extended.sql)
- ✅ drivers.share_token 추가 (기사 전용 모바일 뷰 /driver/[token])

### admin/hub 최종 12개 카드
1.예약관리(파랑) 2.사이트관리 3.직원업무 4.드림하우스
5.체크인디테일 6.학생관리 7.손님신청관리
8.셔틀·기사관리(3탭) 9.픽드랍관리
10.튜터관리(3탭) 11.화상영어 12.SSP관리

### 다음 작업 대기
- STEP 43~48: 다국어 한/영/일 (next-intl 기반 세팅은 STEP 43~44 완료)
- STEP 49~54: 홈페이지 콘텐츠 개선
- Supabase RLS 세부 정책 (손님 포털 데이터 격리)
- PayPal Live 모드 전환

### Supabase 대시보드 실행 필요 SQL
- scripts/setup-booking-comments.sql
- scripts/setup-tutor-requests.sql
- scripts/setup-profiles-extended.sql

## 2026-04-13 완료 작업
### 회원가입 시스템 개편
- ✅ 아이디 기반 회원가입/로그인 (내부적으로 username@dreamacademyph.com 가상이메일)
- ✅ 카카오 주소 검색 API (우편번호 + 도로명 + 상세주소)
- ✅ 자녀 정보 나이 → 출생연도(birth_year)로 변경
- ✅ 이메일 필수 입력 (비밀번호 찾기/보안 알림용)
- ✅ 중복확인 Auth + profiles 양쪽 체크 (/api/check-username)
- ✅ profiles 테이블 컬럼 추가: username(unique), email, address, children, phone
- ✅ 회원가입 페이지 전면 재작성 (CSS/로직 버그 수정)
### 직원업무 (team_manager3.html) 개선
- ✅ 내 업무 탭: 진행률 바 + Urgent/Schedule 섹션 분리
- ✅ 인라인 상태 드롭다운 + 호버 액션 버튼 + 사이드패널 (진행 중)
- ✅ 의견요청 마스터-디테일 레이아웃 (좌측 리스트 + 우측 상세/댓글)
### 하우스 보고 시스템
- ✅ 하우스 보고 탭 전체 직원 공개 (jun 전용 조건 제거)
- ✅ 상태버튼 문제/해결중/해결로 변경 (텍스트 버튼)
- ✅ 첫방문/재방문 제거
- ✅ 미해결 항목 이월 기능 (house_pending_items 테이블)
- ✅ 어드민 하우스 보고 확인 페이지 (/admin/house-reports)
### Supabase 추가 작업 필요
- house_pending_items 테이블 생성 SQL:
CREATE TABLE IF NOT EXISTS house_pending_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  room_no text NOT NULL,
  content text NOT NULL,
  status text DEFAULT 'problem',
  report_id uuid REFERENCES house_reports(id),
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE house_pending_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all" ON house_pending_items FOR ALL USING (true) WITH CHECK (true);
### 다음 작업
- 내 업무 탭 인라인 상태변경 + 호버액션 + 사이드패널 Claude Code 결과 확인
- house_pending_items SQL 실행 필요
- PayPal Live 모드 전환
- Supabase RLS 세부 정책

## 2026-04-15 완료 작업
- 홈 대시보드 전면 개편 (미배정/확인필요/오늘마감/이번주완료 + 클릭연결)
- 알림 뱃지 시스템 개선 (미읽은 알림 수 표시)
- 의견요청 투표 기능 추가 (staff_votes 테이블, 투표 UI, 결과 바)
- 프로젝트 디자인 예시 1~5 HTML (public/vote/design-1~5.html)
- 회원 관리 페이지 개편 (app/admin/site/page.tsx - 8컬럼 테이블)
- 회원 API 수정 (full_name→name, SUPABASE_SERVICE_ROLE_KEY Vercel 추가)
- 홈 미배정 클릭 → 전체업무 연동 수정 (확인됨)
- 전체업무 사이드패널 오픈 버그 수정 (확인됨)
- 직원별 뷰 읽기 권한 개방 (비관리자도 shared 업무 열람 가능)
- 완료 업무 삭제 기능 (CEO/Jenna: 전체, 일반직원: 본인 업무만)
- 개인업무 공간 null-safe 방어코드 추가

### 내일 할 작업 (우선순위순)
1. 개인업무 공간 사이드바 클릭 버그 - Eric(나) 클릭 시 showEmpPage 자동 호출 안됨
2. 개인업무 데일리 레이아웃 - 업무목록 아래 데일리 자연스럽게 이어지도록
3. Supabase SQL 실행 확인 - staff_votes 테이블 생성 여부
4. 투표 기능 실제 작동 확인 - 의견요청 탭 투표 게시글 자동 생성
5. 프로젝트 페이지 디자인 적용 - 투표 결과 후 적용
6. PayPal Live 활성화 (회사에서 서류 제출)

### Supabase SQL 미실행 항목
아래 SQL을 Supabase SQL Editor에서 실행해야 함:
```sql
ALTER TABLE staff_opinions ADD COLUMN IF NOT EXISTS type text DEFAULT 'general';
ALTER TABLE staff_opinions ADD COLUMN IF NOT EXISTS vote_options jsonb DEFAULT '[]';
ALTER TABLE staff_opinions ADD COLUMN IF NOT EXISTS vote_deadline date;
CREATE TABLE IF NOT EXISTS staff_votes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  opinion_id bigint NOT NULL,
  voter_id text NOT NULL,
  option_idx integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(opinion_id, voter_id)
);
ALTER TABLE staff_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all" ON staff_votes FOR ALL USING (true) WITH CHECK (true);
```

## 2026-04-16 완료 작업
- ✅ 사이드바 클릭 버그 수정 (showEmpPage requestAnimationFrame)
- ✅ 결재함 UX 개선 (상신폼 토글, 승인 후 즉시 갱신, 가독성)
- ✅ 하우스보고 content required 버그 수정
- ✅ 하우스보고 사진/동영상 첨부 기능 추가
- ✅ 하우스보고 수정 기능 추가
- ✅ b17-5, b17-6 룸 목록 제거 / 전체(공용공간) 옵션 추가
- ✅ 홈 대시보드 개선 (미배정/완료 제외, 새로 배정된 업무 카드 추가)
- ✅ 개인업무 사이드바 데일리 레이아웃 개선 (노란 배경, 앰버 진행바)
- ✅ staff_votes 테이블 생성 + staff_opinions 컬럼 추가 완료
- ✅ 투표 항목 이미지 첨부 기능 추가

### 내일 할 작업 (우선순위순)
1. 투표 기능 실제 작동 확인 (의견요청 탭)
2. 프로젝트 페이지 디자인 적용 (투표 결과 후)
3. PayPal Live 활성화 (회사에서 서류 제출)

### 작업 방식 (매 대화 적용)
- Claude Code 앱에 프롬프트 붙여넣기 → 결과 여기 공유
- 수정 후 항상 git push → Vercel 자동 배포
- 로컬 경로: C:/Users/desko/academy-web

## 2026-04-17 완료 작업
- ✅ 하위업무 체크 토글 + 참고 메모 기능
- ✅ 결재 파일첨부 Supabase Storage 업로드로 변경 (용량 제한 해결)
- ✅ staff-files Storage 버킷 생성 + 정책 설정
- ✅ 하우스보고 전면 개선 (삭제/상세보기/가독성/reporter 수정)
- ✅ 포털 내 신청 내역 페이지 (/portal/my-requests)
- ✅ 메인 상담하기→마이페이지 버튼, 네비 내페이지 제거
- ✅ 모든 포털 뒤로가기 → 마이페이지로 통일
- ✅ 개인업무 공간 탭 3개 (업무/데일리/결재) 완성
- ✅ 결재 탭 CEO/Jenna vs 직원 분리

## 현재 진행 상황 (2026-04-17 최신)

### 2026-04-17 완료 작업 — 화상영어 시스템 대개편
- 세션 데이터 재처리 31명 (25 + 6) · 휴강 테이블 35건 (2025~2026)
- 튜터 계정 5개 생성 (admin-ann/angel/carla/amelyn/cristel)
- 튜터 영문 가이드 (/guide 4번째 탭)
- Team Manager ↔ 어드민 허브 Online Class 분리
- 관리자/튜터 페이지 역할 분리
  · /admin/online-class-attendance (모니터링 전용, 튜터 색상/범례)
  · /tutor/online-class (Today/My Students/My Schedule 3탭)
- 인보이스 캘린더 모달 (월별 그리드 + Print)
- 특이사항 inline 편집 (online_enrollments.tutor_notes 컬럼)
- Undo 버튼 라벨
- 주간 네비게이션 (이전/이번/다음/오늘)
- PC 기준 레이아웃 (1500px)

### 보류 작업
- 심시우 (심시아와 혼동), 전가빈 (notes 기간 이상) — 원본 재확인 필요

### 다음 작업 우선순위
1. ⭐ 화상영어 입력 시스템 새 구조 — 손님 신청 → 메이 승인 → 자동 생성
2. STEP 43~48 다국어 (한/영/일)
3. STEP 49~54 홈페이지 개선 + PWA
4. PayPal Live 활성화
5. 카카오톡 채널 위젯
6. 브라우저 푸시 알림

### 새 대화 시작
"드림아카데미 프로젝트 이어서 진행해줘"

### 로컬 경로
C:/Users/desko/academy-web

### 작업 방식 (매 대화 적용)
- Claude Code 앱에 프롬프트 붙여넣기 → 결과 여기 공유
- 수정 후 항상 git push → Vercel 자동 배포
- 로컬 경로: C:/Users/desko/academy-web

## 2026-04-17 화상영어 시스템 대개편 완료

### 데이터 정리
- 31명 세션 재처리 (25+6명), 누락 세션 443개 → 교정
- 휴강 테이블 구축 (online_class_holidays) — 2025 DEC 5건 + 2026 전체 30건
- online_enrollments에 tutor_notes 컬럼 추가

### 계정
- 튜터 5명 로그인 계정: admin-ann/angel/carla/amelyn/cristel (비번: 이름+2026!)

### 페이지 구조 개편
- /admin/online-class-attendance: 관리자 모니터링 (출결 버튼 제거, 튜터 색상/범례, 2-col 그리드)
- /tutor/online-class: 튜터 개인 (Today/My Students/My Schedule 3탭)
- /guide: 4번째 탭 "Tutor Guide (English)" 추가
- /staff/online-class 삭제 + Team Manager 사이드바 화상영어 제거
- lib/tutorColors.ts (5색 공통 매핑)

### 기능
- 인보이스 캘린더 모달 (영문명 클릭 → 월별 그리드 + Print)
- 특이사항 inline 편집
- Undo 버튼 (출결 되돌리기)
- 주간 네비게이션 (이전/이번/다음 주 + 오늘 버튼, 관리자+튜터 공통)
- PC 기준 레이아웃 (1500px)

### 보류 작업 (다음 섹션)
- 심시우 (심시아와 혼동), 전가빈 (notes 이상) — 원본 재확인 필요
- 화상영어 새 입력 시스템 (손님 신청 → 메이 승인 → 자동 생성)
- STEP 43~54 (다국어/홈페이지/PWA)
- PayPal Live, 카카오톡 위젯, 웹푸시

### 새 대화 시작
"드림아카데미 프로젝트 이어서 진행해줘"

## 2026-04-19 완료 작업
- ✅ 결재 승인완료/반려 탭 status 오타 전체 수정 (approve→approved, reject→rejected)
- ✅ 결재 승인완료 탭 내용 표시 버그 수정 (renderEmpApvTab onclick 오타)
- ✅ 하우스보고 전체 탭 미해결 항목 섹션 연동 완료
- ✅ 하우스보고 reporter "CEO/Jun" 정상 표시
- ✅ 하우스보고 오전/오후/체크인 탭 제거 (보고하기/전체 2개로 단순화)
- ✅ house_pending_items 마이그레이션 (기존 problem 항목 3건)
- ✅ 확인필요 카운트 미해결 항목 수와 연동
- ✅ 보고 제출 시 problem 항목 pending 자동 생성 확인
- ✅ status 키 progress→in_progress 통일
- ✅ 결재 파일첨부 Supabase Storage 업로드 (staff-files 버킷)
- ✅ task/결재 댓글 id null 에러 수정
- ✅ 하위업무 체크 토글 + 참고 메모 기능

### 하우스보고 남은 개선사항
- 보고/지시 유형 구분 (보고 vs 지시 선택 기능) - 미완료
- 전체 카드에서 수정/사진/영상 첨부 - 이미 있음 확인됨
- 댓글/피드백 기능 - 미완료

### 로컬 경로
C:/Users/desko/academy-web

### 작업 방식 (매 대화 적용)
- Claude Code 앱에 프롬프트 붙여넣기 → 결과 여기 공유
- 수정 후 항상 git push → Vercel 자동 배포
- 로컬 경로: C:/Users/desko/academy-web

## 2026-04-19 추가 완료
- ✅ 하우스보고 미해결 항목 API RLS 정책 추가 (anon 역할 허용)
- ✅ house-reports API anon key fallback 추가
- ✅ 보고하기 탭 최근 보고 목록 삭제 버튼 추가
- ✅ 결재 승인완료 탭 onclick 오타 수정 (approve→approved)

## 미완료 / 보류 (결재)
- 🐛 결재 상신자 본인 화면에서 첨부파일 미표시 (재확인 필요)
  · 증상: Sage가 결재 상신 시 이미지 첨부 → CEO 결재자 화면은 정상, 상신자 본인의 직원 공간 결재 탭에서 자기 결재 열람 시 첨부파일 영역 안 보임
  · ✅ 60abb9a 수정 시도됨: `_empApvShowMyList` (3285~3312) 에 `renderAttachments(a.files)` 호출 누락분 추가
  · 유저 프롬프트에 적혀있던 `_empApvShowList`(CEO용)가 아닌 `_empApvShowMyList`(본인용)가 실제 렌더 경로
  · 확인 방법: Sage로 로그인 → 결재 탭 → 대기 중/승인됨/반려됨 클릭 → 본인이 이미지 첨부한 건 열어서 첨부 썸네일 보이는지 확인
  · 만약 여전히 안 보이면: submitApproval → files 저장 실패 여부 DB 확인, sbGet select 쿼리 검증, 캐시 강제 새로고침(Ctrl+F5)

## 2026-04-20 완료 작업
- ✅ 결재 `_empApvShowMyList` approve→approved, reject→rejected 오타 수정 (48ab885)
- ✅ 의견요청 게시판 이미지/동영상/오디오 첨부 인라인 미리보기 (38a3c5d)
- ✅ 결재 상신자 본인 화면 첨부파일 렌더 누락 수정 (60abb9a)
- ✅ 개인 업무 공간 "진행 중" 섹션 드래그 정렬 기능

### Supabase SQL 미실행 (드래그 정렬 DB 동기화용)
```sql
ALTER TABLE staff_tasks ADD COLUMN IF NOT EXISTS sort_idx int;
```
· 실행 전까지: 드래그 정렬은 localStorage에만 저장 (같은 브라우저에서만 순서 유지)
· 실행 후: Supabase 동기화되어 기기 간 순서 공유 가능
· 컬럼 없는 상태에서도 기존 업무 기능은 영향 없음 (sort_idx는 별도 sbPatch로 분리 호출, 실패 시 무시)

## 2026-04-21 완료 작업

### 튜터 시스템 Phase 1~2 전체 완료
- ✅ /admin/tutors 튜터 POST 400 완전 해결 (1f7a93d)
  · 증상: GET 성공 / POST 400 Silent Fail — 에러 체크 없이 모달 닫힘
  · 수정: saveTutor/toggleActive/loadTutors 전부 `error` 체크 + alert + await loadTutors()
  · Supabase 측에서 hourly_rate/phone/specialty/is_active/created_at 컬럼 추가로 최종 해결
- ✅ /tutor-apply 공개 튜터 신청 폼 완료 (ab2b4c9 → 1f02426)
  · 19문항 6섹션 (기본/유형/일정/영어레벨/수업방향/동의)
  · 클라이언트 밸리데이션: 필수, end>=start, 일요일 차단, class_focus 1~2개
  · 에러 인라인 배너 + aria-invalid, 성공 시 /tutor-apply/success 라우팅
  · 성인 수강자 케이스 반영 라벨 수정 (자녀/아이 → 수강자, 섹션4 제목 간결화)
  · 라이브 검증 3샘플 통과: A=성인, B=어린이 2명, C=비대칭 레벨
- ✅ /admin/tutors "📬 튜터 신청" 4번째 탭 (ea6e0cb)
  · 신규 파일 app/admin/tutors/TutorApplications.tsx (자립 컴포넌트, 530줄)
  · 툴바: 상태 칩(6종) + 튜터 필터(전체/미배정/활성 튜터) + 검색(예약자·수강자명) + 카운터
  · 테이블 10컬럼 + 레벨 편차 >=3 ⚠ 배지
  · 2-col 상세 모달: 좌측 6섹션 읽기전용(pre-wrap) / 우측 어드민 폼
    status, assigned_tutor_id, total_sessions, total_amount, admin_memo
  · 회차·금액 자동 계산 힌트 (실제 저장은 수동)
  · 저장 실패 → 모달 상단 inline 빨간 배너 / 성공 → 하단 토스트 (alert 미사용)
  · 삭제 확인 모달 → DELETE → 토스트
- ✅ team_manager3.html renderApprovalPage 댓글 블록 누락 패치 (0675ade)
  · BUGS_VISIBILITY_AUDIT.md HIGH 1-1 해결
  · pending/mine 양쪽에 _empApvShowList와 동일한 댓글 블록 이식
  · _empOpenApproval 복제 경로 동반 버그 수정 (wrap clear + slot 재스캔)
- ✅ admin/user 뷰 비대칭 버그 전수 감사 리포트 작성 (a111240)
  · BUGS_VISIBILITY_AUDIT.md — HIGH 1 / MED 6 / LOW 8 집계
  · 섹션별 admin 함수 vs user 함수 대칭 검증

### Supabase 현재 상태 (tutor_applications)
- RLS **비활성화 중** (공개 폼이라 실질 문제 없음)
- 이유: `public_can_insert` / `insert_any_role` 정책 다 생성했으나 PostgREST 캐시 / authenticated role 충돌로 401 지속
- 테이블 GRANT는 authenticated에만 SELECT/UPDATE/DELETE 허용 → RLS 없이도 실질 보안 유지
- 관련 SQL들은 전부 Supabase SQL Editor에 저장됨
- **Phase 3+에서 정석 패턴 전환 예정**: `/api/tutor-apply` Next.js API Route + `service_role` key (브라우저에는 anon만 노출)

## On the horizon — 튜터 관리 시스템 통합 비전 (Phase 3+)

### 레퍼런스
- `/admin/online-class` (화상영어 관리) 패턴 거의 복붙 수준으로 재사용
- 기존 운영 중: 수강생 33명, 튜터 5명 (T.Amelyn / Angel / Ann / Carla / Cristel)

### 분리 운영 설계
- `/admin/online-class` = **화상영어** (현재 운영 중, 유지)
- `/admin/tutor-class` (가칭, 신설 예정) = **드림하우스 방문 튜터**
  · 두 시스템은 데이터 모델도 분리 (`online_class_enrollments` vs `tutor_applications` + `tutor_lessons`)

### 방문 튜터 16명 (2026-04-13 구글시트 기준)
janet, joy, sam, gerlyn, jessa, erica, crista, mel, cristel, janrey, phen, vincent, harper, gab, suzy, annie, abegail
- "미배정" 컬럼 별도 운영 (신청 수신 후 배정 전 상태)
- ※ 나열은 17명이지만 운영 기준 16명 표기 — 착수 시 명단 재확인 필요

### 탭 구조 (`/admin/tutor-class`)
1. 📋 **신청 수신함** — tutor_applications 기반 (이미 ea6e0cb에서 골격 완성)
2. 📊 **주간 스케줄** — /online-class의 주간 그리드 패턴 복붙, 튜터별 색상
3. 👥 **수강생 목록** — 확정된 신청건 기준 활성 수강생 카드
4. 💰 **인보이스** — 튜터별 월별 방문 수업 집계

### 티쳐 포털 (`/tutor/portal`)
- 티쳐 개인 로그인 (`tutor-[name]` 패턴, 화상영어 티쳐 로그인 참고)
- 본인 My Schedule (드하 방문 + 화상영어 통합 뷰)
- Phase 1·2 완료되었으므로 Phase 3 착수 조건은 충족

### Phase 3 디테일 작업들
- **엑셀 Export**: tutor_applications 필터링된 목록 CSV/XLSX
- **회차·금액 자동 저장 토글**: 현재 힌트만 표시 → "힌트 값 사용" 체크박스로 확정 저장
- **확정 처리 워크플로우**: status=confirmed 전환 시 `tutor_lessons` 자동 생성 (요일×기간×시간 전개)
- **인보이스 연동**: 기존 튜터 인보이스 탭에 방문수업 집계 합산
- **연결 예약**: `booking_id` 컬럼 활용 — house_or_reserver 기반 bookings 퍼지 매치
- **알림 자동화**: 상태 변경 시 담당 튜터에게 카카오/이메일 알림
- **RLS 정석 전환**: /api/tutor-apply API Route + service_role

### 우선순위
- **천천히 진행** (2026-04-21 메이와 합의)
- 긴급 아이템 아님, 기본 기능은 Phase 2로 이미 운영 가능

# 2026-04-22 세션 정리 (튜터 시스템 대작업)

## 완료 커밋
- 15a87f5 — 엑셀 다운로드 (2시트: 손님명단/정산용, +208라인)
- 5322c95 — /admin/tutor-class 신설 (4탭 + 확정→레슨 자동 변환)
- 9dd5da8 — 수강생 목록 + 출결 모달 (415라인)
- 1b51b89 — 타임수/예약자/동의 체크박스 (3파일 +141/-38)

## Supabase 스키마 변경
- 신규 테이블: `tutor_lessons` + `tutor_lesson_sessions` (RLS 비활성화, GRANT 전체)
- `tutor_applications` + `tutor_lessons`에 `sessions_per_day` 컬럼 (1|2)
- `tutor_applications`에 `reserver_type`(name|house), `agreed_tutor_rules_bool` 컬럼
- 기존 3건 마이그레이션: 샘플 C=2타임, A/B=1타임
- 강연미 lesson=1타임

## 71건 실제 신청 데이터 분석 (드림하우스__튜터_신청_폼.xlsx)
- 1:1 = 59건 (83%) / 1:2 = 12건 (17%)
- 타임: 1시간 31건 / 2시간 15건 / 애매 22건 / 복잡 3건
- 레벨: 비기너 34 / 미디엄 21 / 제로 15 / 어드밴스 1
- 방향: 놀이+학습 37 / 놀이식 17 / 학습식 17
- 포커스 1위: "스피킹+액티비티" 29건
- 튜터 규정 동의 답변 11가지 → 체크박스로 통일

## 가격 정책 확정
- 1:1 × 1타임(50분) = ₱300/회
- 1:1 × 2타임(100분) = ₱600/회
- 1:2 × 1타임(50분) = ₱350/회
- 1:2 × 2타임(100분) = ₱700/회
- `total_amount = total_sessions × sessions_per_day × hourly_rate`
- 회차 = 수업 날짜 수 (타임 수 아님)

## 실제 운영 패턴 (드림아카데미_최신_26_04_13 CSV)
- 운영 튜터 17명: janet, joy, sam, gerlyn, jessa, erica, crista, mel, cristel, janrey, phen, vincent, harper, gab, suzy, annie, abegail
- 수강생 14명 / 수업 81건 (4/12~5/28)
- 가장 활발: gerlyn(한지민 Sally) / cristel(한지율 Lily) 각 19건
- 한 학생 여러 튜터 케이스: 신도현/최우주 (abegail 5회 + janrey 4회)

## 다음 세션 튜터 관련 해야할 일 (우선순위순)

### 최우선: 라이브 검증
1. /admin/tutor-class 수강생 목록 탭 (강연미 lesson, 출결 모달 8회차)
2. /tutor-apply 새 폼 (타임수/예약자/동의) + 테스트 제출 DB 저장 확인
3. /admin/tutors 테이블 "타임" 컬럼 (1T/1T/2T)
4. 샘플 C 모달 자동 계산 "₱300 × 2타임 × 8회 = ~₱4,800"
5. 엑셀 "타임" 컬럼 추가
6. 샘플 C 재확정 시 lesson.sessions_per_day=2

### Phase 4 튜터 시스템 완성
7. 💰 인보이스 탭 (Dream Academy 샘플 양식, html2canvas PDF)
8. 📅 주간 스케줄 탭 (sessions 그리드, online-class 복붙)
9. 수강생 목록 고도화 (confirmed_time 수동 모달, lesson 편집/중단)

### 데이터 import
10. 튜터 17명 일괄 추가
11. 과거 71건 신청 import (기록 보존)

### 폼 개선 (71건 분석 기반)
12. 하우스 번호 정규식 검증 (B[숫자]-L[숫자])
13. 빠지는 날 UI (라디오 예/아니오/미정 + 조건부 텍스트)
14. 학생 나이 1:2 분리 (이름+나이 개별)
15. 튜터 규정 전문 펼치기

### 장기 백로그
16. /tutor/portal 튜터 개인 로그인
17. 알림 자동화 (카카오/이메일)
18. 1:2 세션별 출결 분리 (attendance_by_student JSONB)
19. 세션별 튜터 override (tutor_lesson_sessions.tutor_id)
20. RLS 정석 복구 (/api/tutor-apply + service_role)
21. xlsx-js-style 교체
22. 예약 시스템 통합 (booking_id 연결)

## 발견된 알려진 버그
- **필터 모순 (재현 불안정):** 저장 직후 "전체 칩 + 모든 튜터 = 0건" race condition. 새로고침 정상
- **setNative 모달 select** PATCH payload `assigned_tutor_id` 누락 (사람 클릭 시 정상)

## Key learnings 추가
- Supabase 새 테이블 생성 시 자동 RLS enable. DISABLE + GRANT 별도 SQL 필요
- `TRIM(boolean)` 에러 → `COALESCE(컬럼, false)` 사용
- 과거 자유 텍스트 데이터는 자동 파싱 어려움. 새 폼에서 구조화 후 기록 보존용으로만 import

# 2026-04-23 세션 (Phase 4 완성 + 17명 import + 동기화 버그 발견/수정)

## 완료 커밋
- aecbca5 — 인보이스(TUTOR INFORMATION) + html2canvas PNG 저장
- bc5b8f6 — 주간 스케줄 (7-컬럼 그리드 + 튜터 색상 + 세션 모달)
- 89c32c1 — fix: 신청 튜터 변경 시 tutor_lessons.tutor_id 자동 동기화

## Supabase 작업
- 튜터 17명 일괄 INSERT 완료 (Sam, Gerlyn, Jessa, Erica, Crista, Mel, Cristel, Janrey, Phen, Vincent, Harper, Gab, Suzy, Annie, Abegail) + Janet 시급 보정
- 강연미 → Janet 배정 (PATCH 성공)
- 이유정 → Joy 배정 (PATCH 성공)

## tutors 테이블 스키마 메모
- INSERT 시 `active` 컬럼 제외 필요 (default 자동)
- 컬럼명: `name`, `specialty`, `hourly_rate`
- 에러 42703: `column "active" does not exist` (다른 이름이거나 default 처리)

## 라이브 검증 결과
- ✅ Phase 4 인보이스 탭 완전 동작 (TUTOR INFORMATION 샘플 매칭)
- ✅ Phase 4 주간 스케줄 탭 완전 동작
- ✅ 17명 import 모든 드롭다운에 노출 확인 (필터/배정 모달)
- ✅ 신청 수신함 테이블에 배정된 튜터 즉시 반영

## 🐛 발견된 버그 + 수정 완료 (89c32c1)
**튜터 배정 → 주간 스케줄 동기화 안 됨**
- 증상: `tutor_applications.assigned_tutor_id` 업데이트 후 `tutor_lessons.tutor_id` 자동 sync 누락
- 결과: 강연미에 Janet 배정 후 주간 스케줄 5/13 카드 여전히 "미배정" 회색
- 해결: Option A (클라이언트 사이드 동기화) 채택
  · `TutorApplications.saveAdmin()` 내부 application UPDATE 성공 후 `oldTutorId !== newTutorId` 조건일 때만
    `UPDATE tutor_lessons SET tutor_id = $new WHERE application_id = $id` 실행
  · lesson 미존재 시 0 rows matched = 안전한 no-op (최초 confirmed 분기는 INSERT가 tutor_id 직접 세팅)
  · 동기화 실패 시 경고 토스트 append, 상위 저장은 성공 처리 (비차단)
- 검증 대기: 이미 확정된 건에서 튜터 재배정 → 주간 스케줄 카드 색상/이름 즉시 반영
- 향후 과제: Option B (Postgres Trigger)는 공개 API/다른 어드민 경로가 생길 때 정석 전환

## 다음 세션 우선순위
1. 빈 주 그리드 마이크로픽스 (Mon~Sun 헤더 항상 표시)
2. 수강생 목록 고도화 (confirmed_time 수동 입력 모달, lesson 편집/중단/취소)
3. 과거 71건 신청 import (기록 보존)
4. 폼 개선 (하우스 정규식 B[숫자]-L[숫자], 1:2 학생 이름+나이 분리)
5. `/tutor/portal` 튜터 개인 로그인

## Key learnings 추가
- Supabase INSERT 에러 42703: 존재하지 않는 컬럼명 지정 시 발생. default 처리되는 컬럼은 payload에서 제외
- Native HTML `<select>`에 키보드 'j' 누르면 J로 시작하는 옵션 순환 점프 (Janet → Janrey → Jessa → Joy)
- Postgres "Success. No rows returned" = INSERT/UPDATE 성공 응답 (RETURNING/SELECT 없으면 0 rows 반환)
- **동기화 Option A vs B 패턴:** 단일 클라이언트 경로는 코드 내 동기화로 충분. 다중 진입점(공개 API, 직접 SQL) 예정이면 Trigger 정석. 상태 전환 직후 파생 데이터 동기화가 필요한 모든 케이스에 적용 가능

## 2026-04-24 세션 (튜터 배정 동기화 버그 완전 해결)

### 완료 커밋
- `89c32c1` fix: 튜터 배정 시 tutor_lessons.tutor_id 자동 동기화
- `36d30c2` debug: lesson sync 진단 로그 추가
- `fc3df3e` fix: TutorApplications detail.id stale reference 해결 (detailId + detailSnap 분리)

### 진짜 원인 (라이브 콘솔 로그로 증명)
`detail` 단일 state에 row 객체 전체를 저장하는 구조에서 list refetch(`await loadApps()`)
중 detail이 stale해지며 다른 row의 id를 들고 있게 됨.
콘솔 로그상 "강연미" 모달 헤더인데 내부 appId는 Amber(951811b8)/이유정(31e826ee)로 찍힘.

### 해결 방식 (fc3df3e)
- `detail` 단일 state → `detailId` (source of truth) + `detailSnap` (폴백) 분리
- `detail = useMemo`로 `apps.find(a => a.id === detailId) || detailSnap`로 파생
- 이제 `detail.id`와 `detail.children_names`가 어긋날 수 없음

### 라이브 검증 결과 (fc3df3e 배포 후)
- `[lesson sync]` appId: `63013125-a7e2...` (강연미) ✅ 정확하게 잡힘
- oldTutorId: Janet, newTutorId: Joy, rows: 1건 동기화 완료
- 주간 스케줄 5/13 카드 즉시 반영 확인

### DB 데이터 피해 복구 (SQL Editor 수동)
디버깅 중 버그로 잘못 저장된 건들 모두 수동 복구:
- Amber: Janet → Angel (테스트) 복원
- 이유정: Janet → Joy 복원
- 강연미: Janet 재확정 + lesson tutor_id sync

### 부가 발견 이슈 (낮은 우선순위, 별도 처리)
1. `apple-mobile-web-app-capable` meta deprecated → `mobile-web-app-capable` 추가 필요
2. `sw.js:1 Failed to convert value to 'Response'` → Service Worker 이슈 (PWA 도입 시)
3. 주간 스케줄 fetch에서 `lesson_time.asc` 400 에러 → 해당 컬럼 존재 여부 확인 필요

### 다음 세션 우선순위 (업데이트)
1. 빈 주 그리드 마이크로픽스 (Mon~Sun 헤더 항상 표시, "표시할 튜터가 없습니다" 메시지 개선)
2. 수강생 목록 고도화 (confirmed_time 모달, lesson 편집/중단)
3. 과거 71건 신청 import
4. 폼 개선 (하우스 정규식, 1:2 학생 분리)
5. 부가 발견 이슈 3건 처리

### Key learnings 추가
- **React state 분리 원칙:** 단일 객체 state가 list refetch 중 stale해질 수 있으면,
  id(source of truth) + snapshot(fallback) + useMemo로 파생하는 패턴이 안전
- Chrome MCP의 find() + click() 자동화 자체는 정상이었음 — 진짜 버그는 앱의 state 관리 쪽
- 디버깅 중 쓴 라이브 클릭이 실제 데이터를 변경할 수 있음 → 중요 환경에서는 test 플래그 가드 고려

## 2026-04-27 작업

### 완료
- 가격 데이터 407개 항목 갱신 (전체금액.xlsx 기준): DH 132 + JP 165 + C9 110 = 407
  - 정가 = 비수기 × 1.25 (10000원 단위 올림) 공식 적용
  - 인덱스 [0]=정가, [1]=비수기, [2]=성수기
  - 깨진 글자 풀억세스룸-7-1-2 복구
- Booking 단독 옵션: 제이파크 단독, 큐브나인 단독 카드 추가 (BookingType union 확장)
- 인보이스 매핑 fix: booking.accom_type → calculator state (setCm/setA1T/setA2T)
- 사진촬영 X 시 "사진제공 없음" 표시 (조건부 렌더링)
- 어드민 학생탭 0명 버그 fix: API route에서 students 빈 배열 시 booking.students JSON fallback (parseBookingStudents 헬퍼)
- 인보이스 전액입금 토글: forceFullPayment state + effectiveFullPayment 헬퍼, 3곳 통일
- 아카데미 시작/종료 자동 계산:
  - getNextMonday: 월요일 입력 시 다음 주 월요일로 미루던 버그 fix
  - calcAcademyEnd 헬퍼 신설: start + (weeks-1)*7 + 4 (월~금 운영)
  - 6곳 통일 적용
- booking submit 시 academy 자동 채움:
  - bookings.students JSON enrichedStudents에 academyStart/End/Weeks 포함
  - students 테이블 insert 시 academy_start/academy_end 컬럼 추가
  - bookings 테이블에는 academy_* 컬럼 없으므로 INSERT 안 함 (안전)
  - 어드민 부킹 상세 기본정보 + 학생 카드에 fallback derive 추가
- 영수증 지불내역 자동채움:
  - defaultAmountFor 헬퍼: 예약금 → 1,000,000, 잔금 → balance
  - upd 함수: type 변경 시 amount 비어있으면 자동채움 (사용자 입력 보호)
  - addPayment: 잔금 기본값 자동 채움
- 인보이스/영수증 시간 표시:
  - 인보이스 한국어 예약확인서: "체크인 (3PM 입실)" / "체크아웃 (12noon 퇴실)"
  - 인보이스 INVOICE: 동일
  - 영수증: "체크인 (오후 3시 입실)" / "체크아웃 (정오 12시 퇴실)"

### 백업 태그
- `backup-2026-04-27` (커밋 범위 6e47e44..ee9a0a9, 라이브 검증 완료)
- 복원: `git checkout backup-2026-04-27`

### 추후 작업
- 새 예약관리 시스템 설계 (큰 작업): 4가지 예약 유형, 신규 DB 테이블 10개
- Step 10: 직원 가이드 문서 (한/영)
- 브라우저 푸시 알림 (PWA 전환 포함)
- 카카오톡 채팅 위젯
- PayPal Live 활성화 (서류 제출 후)

### 핵심 학습 포인트
- bookings vs bookings_new 테이블 분기: API route에서 bookings_new 우선 → 옛 bookings fallback
- students 테이블 vs bookings.students JSON: 두 source 공존, fallback 패턴 필요
- accom_type 컨벤션: "드림하우스", "드림하우스+제이파크", "드림하우스+큐브나인", "제이파크 단독", "큐브나인 단독", "통학형"
- 깨진 UTF-8 바이트(EF BF BD) 발견 시 str_replace 실패 → Python/Node 라인 단위 교체로 우회

## 2026-04-28 세션 (인보이스/부킹 폼 정합성 + 환불규정 모달)

### 완료 커밋 (9개)
- `a7b55e4` 환불 규정 jaypark 매칭 + 사진촬영 미허용 안내
- `9e4da90` 부킹 페이지 유학원 필드 제거
- `8bced05` 견적 페이지 체크아웃 자동 표시 (체크인 input 아래 read-only)
- `b7f5c33` BOOKING_TYPES 통합 (`lib/bookingTypes.ts` 신설) + 통학형/단독 어드민 추가
- `585c3fa` 인보이스 콤보 0주 버그 fix + 한쪽 0주 시 빨간 가드
- `d203e51` 인보이스 현지지불 자동채움 버튼 (SSP/SSP-i Card/주니어 교재/킨더 재료비)
- `256443b` 인보이스 시간 형식 통일 (값 셀 "15:00PM"/"12noon", 라벨에서 영문 제거)
- `a8b25a1` 부킹 영문명 + 추가 보호자(0~2명) + 1주 옵션 + 분해 컬럼 저장
- `d5df3b7` 인보이스 자동 복원 (콤보 weeks/룸타입/영문명/인원, 1주 가격 fallback=2주/2)

### 신규 파일
- `lib/bookingTypes.ts` — 손님/어드민이 공유하는 BookingType 단일 source (PUBLIC 6종 + ADMIN_ONLY room_only)
- `lib/refundPolicy.ts` (직전 세션) + `components/RefundPolicyModal.tsx` (직전 세션) — 부킹/견적 공유 환불 규정 데이터 + 모달

### Supabase DB 마이그레이션 (실행 완료)
`bookings` 테이블에 컬럼 추가:
- `extra_guardians` (jsonb)
- `adults` (int), `children` (int)
- `dh_weeks` (int), `jp_weeks` (int), `cn_weeks` (int), `cn_period` (text)
- `jp_room_type` (text), `cn_room_type` (text)
- `booker_phone` (text)

### 테스트 부킹 (Chrome MCP 자동 검증)
- `DA-20260428-155971` (id=`8573deae-3398-44cd-8a7b-163817248abf`) — 콤보 1+1주, 보호자 2명, 학생 1명
- 추가 테스트 부킹 (52c19a9 fix 검증용): id=`a0d822cc-cd1b-46a1-8e62-665504bfa367` — fix 후에도 미동작 확인됨

### 남은 알려진 이슈 (다음 세션 우선)
1. 🚨 **[긴급] 인보이스 콤보 자동 복원 버그 — fix 시도 후에도 미동작** — 커밋 `52c19a9`에서 매칭을 includes 기반으로 완화했음에도 인보이스에서 a1W/a2W가 여전히 default(2/2) 유지됨. accom_type 매칭 외에 다른 경로(예: `data.base_price>0`일 때 `billing_items`에서 복원하는 line 549~565 블록)가 오버라이드 가능성 있음.
   - **다음 세션 첫 작업**:
     1. Supabase에서 `SELECT accom_type, dh_weeks, jp_weeks, base_price, billing_items FROM bookings WHERE id='a0d822cc-cd1b-46a1-8e62-665504bfa367'` 실행 → 실제 저장값 확인
     2. invoice items 복원 로직(line 547+ `if(data.base_price>0)` 분기) 점검 — billing_items가 있으면 콤보 분기보다 나중에 실행돼서 default 값으로 덮어쓰지 않는지 검증
     3. useEffect 발화 순서 + setState 비동기 처리로 인한 race condition도 가설로 점검
2. **cn_period="6일"** 케이스 → 정규식 `\d+`이 "6"을 추출 → a2W=6주로 잘못 매핑됨. 별도 분기 처리 필요 (1주로 매핑).
3. **jp_room_type / cn_room_type 부킹 입력 UI 없음** — 컬럼만 추가되고 부킹 폼에 룸타입 select가 없어 항상 NULL 저장. 부킹 폼에 룸타입 입력 UI 추가 필요 또는 룸타입 분기 자체 보류.
4. **픽업장소 select "드림하우스" 옵션** — 메이가 제거 요청했으나 미진행 (`app/booking/page.tsx:307`).
5. **어드민 상세 페이지에 영문명/추가 보호자 표시 미반영** (Step 5) — `app/admin/bookings/[id]/page.tsx`에 `booker_english` / `extra_guardians` 표시 영역 추가 필요.

### 다음 세션 시작 방법
"드림아카데미 프로젝트 이어서 진행해줘 — 인보이스 콤보 자동 복원 버그부터"
→ CLAUDE.md 읽고 위 #1 (긴급) 부터 시작

## 2026-04-29 세션 (Excel 마이그레이션 + bookings_new 전환)

### 마이그레이션 데이터 INSERT 완료
- 소스: `data/dream_migration_filled_1.xlsx` (구글시트 export)
- **bookings_new 테이블에 36건 INSERT** (마이그레이션 명단 33명 + 도유민 2회 + 김장미/장이화 합쳐진 1행)
- **students 테이블에 61명 INSERT** (booking_id FK로 연결)
- 마이그레이션 스크립트:
  - `scripts/migrate_from_excel.ts` — 메인 마이그레이션 (xlsx 파싱 + INSERT)
  - `scripts/retry_commute.ts` — commute fallback (room_only 임시 사용)
  - `scripts/insert_commute_students.ts` — 추가 학생 + 4번째 도유민
  - `scripts/cleanup_final.ts` — 중복 students 정리 + 진단

### Supabase DB 변경
- **`bookings_new.booking_type` CHECK 제약 ALTER 완료**: `commute` 추가 (기존: dreamhouse / dreamhouse_jaypark / dreamhouse_cubenine / room_only / **commute**)
- 도유민 / 김광진 / 정지은의 booking_type을 `room_only` → `commute`로 UPDATE 완료
- 도유민#2(4번째)는 `room_only` 그대로 (UPDATE 누락 — 동일 ALTER에서 같이 처리할지 다음 작업)

### bookings_new.booking_type 분포 (마이그레이션 데이터 기준)
- dreamhouse 32건 + commute 3건(도유민, 김광진, 정지은) + room_only 1건(도유민#2 — commute 교정 필요)

### 어드민 page.tsx 전환
- 커밋 `d356723`: `app/admin/bookings/page.tsx`의 모든 `from("bookings")` → `from("bookings_new")` (load + delete + update + assignee 변경 + confirmed 토글). `.order("checkin_date")` → `.order("check_in")`.

### 즉시 수정 필요 항목 (다음 세션 우선)

🔴 **[미확인]** 신규 예약 등록 모달 — 저장 후 리스트에 안 보이는 버그
- bookings_new → bookings INSERT 코드 수정 완료했으나 실제 저장 확인 못함
- 다음 세션 첫 번째로 테스트 필요
- 테스트: "+ 신규 예약" → "드하+제이파크" → 예약자명 입력 → 예약 등록 클릭 → 리스트 확인

🟠 **[미완료]** 인보이스 디자인 리디자인 (app/invoice/page.tsx)
- 목표: 보라 그라데이션 헤더 제거 → 흰 배경 + teal 섹션헤더 + 네이비 총금액박스
- Claude Code 프롬프트 이미 작성됨, 실행 필요

### bookings_new 컬럼 (28개)
```
academy_end, academy_start, agency, balance_due, booker_name, booker_phone,
booking_type, check_in, check_out, confirmed, created_at, drop_place,
flight_in_airline, flight_in_date, flight_in_time,
flight_out_airline, flight_out_date, flight_out_time, id, num_adults, num_children,
paid_amount, payment_status, pickup_place, special_request, status, total_amount, updated_at
```

### students 컬럼 (15개)
```
academy_end, academy_start, address_detail, age, booking_id, class_type,
created_at, id, level, name_en, name_kr, photo_allowed, pickup_location,
special_request, ssp
```

### 옛 `bookings` 테이블
- 마이그레이션 시도 38건 모두 롤백 완료 (`scripts/rollback_and_discover.ts` + `rollback_leftover.ts`)
- 손님 부킹 페이지(`app/booking/page.tsx`)는 여전히 `from("bookings")`로 INSERT — 추후 통합 결정 필요

### 다음 세션 시작 방법
"드림아카데미 프로젝트 이어서 진행해줘 — 신규 예약 저장 버그 확인부터"

⚠️ CLAUDE.md 로드 방법 (중요):
- 새 대화에서 raw.githubusercontent.com 직접 접근은 차단됨
- 반드시 dreamacademyph.com 탭이 열린 상태에서 시작할 것
- Claude가 브라우저 탭 JS로 fetch해서 불러와야 함
- 탭 없으면: 탭 먼저 열고 → 다시 "불러와줘" 요청

### 2026-04-30 세션 완료
- bookings_new DROP + bookings 원복 완료
- 정혜영 복원 (영수증 기반 INSERT)
- RLS allow_all 정책 추가 (bookings + students)
- 견적 숙소 6종 확장 + 통학형 가격 추가
- 포함사항 분리 fix (DH/JP/C9/COMMUTE 개별화)
- 신규 예약 모달 bookings_new→bookings 수정

### 미완료 작업
🔴 신규 예약 저장 실제 동작 확인 필요 (alert 떴으나 리스트 미표시)
🟠 인보이스 디자인 리디자인 (app/invoice/page.tsx, guest용)

## 2026-05-04 세션 (pdallday 페이지 전체 완성)

### pdallday 탭 완성 현황 (`/pdallday`)
- 01 올데이 프로그램 ✅: PlayDream 소개 + 드림어드벤처 + 타임테이블 + 10개 탐험대 테마
- 02 드림하우스 ✅: 히어로 + 공간구성 + 패키지혜택 + 갤러리
- 03 제이파크 ✅: 정밀 크롭 이미지 + 리조트정보 + 혜택
- 04 큐브나인 ✅: 풀뷰 히어로 + 정보 + 갤러리
- 06 규정 안내 ✅: 예약절차/취소규정/휴무/FAQ
- 07 데일리 클래스 ✅: 4종 수업 + 5월 테마 HTML 카드

### 브랜드 원칙 (pdallday)
- "드림아카데미" 이름 절대 불가 — 순수 PlayDream 브랜딩
- OG 태그, 헤더, 뱃지, 본문 전체 PlayDream 브랜드만 사용

### 🔴 다음 세션 첫 작업: pdallday panel-8 휴무 테이블 수정
현황: panel-8 휴무 테이블이 한국 공휴일 기준으로 잘못 작성되어 있음
목표: 아래 실제 휴무 기준으로 교체

#### 실제 휴무 기준 (확정)
- 센터(학원) 휴무: 12월 31일, 1월 1일 2일만
- 드림센터(헬퍼, 셔틀) 휴무: mf-2025 tab-7 기준 (아래 일정)

#### 드림센터 휴무 일정 (2026년, mf-2025 tab-7 기준)
- 1월: 1일(목) 신정, 2일(금) / 📌 학원 방학 ~1/3
- 2월: 휴무 없음
- 3월: 20일(금)
- 4월: 2일(목), 3일(금), 4일(토)
- 5월: 1일(금) 노동절, 29일(금)
- 6월: 12일(금)
- 7월: 휴무 없음
- 8월: 9일(일) 아이언맨 / ⚠️ 8/9 도로통제로 투어셔틀 X
- 9월: 24일(목), 25일(금), 26일(토)
- 10월: 9일(금) 한글날, 30일(금), 31일(토)
- 11월: 27일(금)
- 12월: 24일(목), 25일(금) 크리스마스, 26일(토), 28~30일, 31일(목) / 📌 학원 방학 12/24~1/3

⚠️ 비수기 휴무에 대한 별도 환불/보강 없음
수업·헬퍼·셔틀 미운영 / 식사는 정상 제공

### 진행 중인 어드민 미완료 작업 (이전 세션 인계)
🔴 신규 예약 저장 실제 동작 확인 필요 (alert 떴으나 리스트 미표시)
🟠 인보이스 디자인 리디자인 (app/invoice/page.tsx, guest용)

## 2026-05-05 세션 (인보이스 개선 + 직원 관리)

### 인보이스 (app/invoice/page.tsx) 완료 사항
- guest 인보이스 전면 개편:
  - DREAM ACADEMY → DREAM COMPANY (이민국 대응)
  - 학생이름 폴백 체인: engName → name_en → korName → name_kr
  - students 테이블 fallback (booking.students 비어있으면 students 테이블 직접 조회)
  - Total Amount Due 흰 글씨 → 검정 (#1f2937)
  - PAYMENT METHOD 섹션 전체 제거 (계좌/PayPal)
  - Account No. 제거, Account Holder: Cha Youngri
  - 하단 안내 문구: "Please confirm the total amount and refund policy..."만 유지
  - 드림하우스 → Dream House (영문화)
  - Room No. 기본값: Dream House = B17L10
- 구버전 인보이스 미리보기: 총 청구 금액 흰 글씨 → 검정 수정
- 영수증: 인원 구성 "보호자 2 + 아이 1" 형식으로 변경

### 신규 예약 (app/admin/bookings/page.tsx) 완료 사항
- 보호자 영문이름(booker_english) 필드 추가 → 손님용 인보이스 English Name 자동 연결
- 통학형: 숙소 상세 UI 숨김
- 학생 JSONB 저장 버그 수정 (JSON.stringify 이중 래핑 제거, jsonb 타입 직접 저장)
- reservation_no 자동 생성 (DA-YYYYMMDD-NNNNNN)
- students 저장 후 bookings JSONB 동기화 → 부킹 리스트/학생관리/인보이스 연결

### 예약 상세 (app/admin/bookings/[id]/page.tsx)
- 통학형: 체크인→수업시작, 체크아웃→수업종료 (academy_start/end 값 표시)

### 직원 관리
- Jenna/Yuna 퇴사 처리 완료:
  - app/admin/bookings/page.tsx ASSIGNEES에서 제거
  - app/guide/page.tsx에서 제거
  - public/team_manager3.html 전체 정리 (15곳: EMPS, isAdmin, DEFAULT_PASSWORDS, 결재 등)
  - public/staff.html 정리 (5곳)
  - Supabase auth.users에서 삭제 완료
- Candice 추가:
  - ASSIGNEES에 추가
  - team_manager3.html / staff.html EMPS에 추가 (color: #14b8a6, initial: CA)
  - app/login/page.tsx 허용 계정 목록에 추가 (h_1q6h54)
  - 로그인: admin-candice / candice2026!
  - Supabase auth.users에 계정 존재 확인

### pdallday panel-8 (public/pdallday/index.html)
- panel-8 주요 안내사항 전면 재작성 (정적 HTML):
  - 예약절차 4단계 / 공통유의사항 4박스 / 패키지별 예약금&정원
  - 환불규정 테이블 / 현지추가비용 / 보호자추가요금 / 유료서비스 / 2026 휴무캘린더
  - 보호자 추가 요금: DH 17만 / JP 18만 / C9 15만
  - SSP/방학 섹션 제거, 식사 단어 제거

### 다음 세션 작업 목록
1. 학생관리 탭: 날짜 빠른순 정렬 + 월별 필터 (academyStart 기준)
2. 손님용 인보이스 추가 금액 항목 (어드민 결제 정보 폼에 표시 확인 필요)
3. pdallday panel-8 휴무 테이블: 센터 휴무 = 12/31, 1/1만 / 드림센터 = mf-2025 tab-7 기준
4. Supabase: additions jsonb 컬럼 추가 필요
   ALTER TABLE bookings ADD COLUMN IF NOT EXISTS additions jsonb DEFAULT '[]';
5. booker_english 컬럼 확인:
   ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booker_english text;

## 2026-05-06 세션 (인보이스/예약상세/학생관리 대규모 개선)

### 손님용 인보이스 (app/invoice/page.tsx)
- 통학형 Check-in/Check-out → Class Start/Class End 레이블 변경 (resort/guest/email body 3곳)
- DB checkout_date 우선 사용
  · overallCO: dbCheckout state 추가, dbCheckout || (combo?a2CO:a1CO)
  · 학생 academyEnd 표시 폴백: s.academyEnd || calcAcademyEnd(...)
- useEffect에서 academyEnd stale 덮어쓰기 방지 (s.academyEnd || calc(...) 패턴)
- LOCAL PAYMENT 자동 항목 prepend (autoLocals useMemo)
  · 보호자(cP)당 1줄: '1인 SSP / SSP I card' 11,000 PHP
  · 주니어 학생 ≥1: '교재비 - 주니어 1권' 350 PHP
  · 킨더 학생 ≥1: '킨더 - 재료비 N주 X,XXX페소' (4주=2,500/2주=1,750/비례)
  · adultCount = Math.max(1, Number(cP)||1) 방어 — cP=0/NaN 케이스에도 SSP 1줄 보장
- guest invoice 기타: PAYMENT METHOD 섹션 제거, 'Please confirm...' 안내 단일 라인 유지

### 예약 상세 (app/admin/bookings/[id]/page.tsx)
- 기본정보 탭 수동 편집 기능
  · ✏️수정 → 💾저장/취소 버튼 바
  · 편집 가능: 예약자, 연락처, 체크인/아웃, 기간(주), 예약유형(드롭다운 6종), 유학원, 항공편(text), 픽업/드랍장소
  · 통학형이면 체크인 라벨이 '수업시작', 체크아웃이 '수업종료'
  · 저장: PATCH /api/bookings/[id] (bookings_new 우선, bookings 폴백, service_role)
- 학생 탭 수동 편집 (모든 학생)
  · DB row(UUID) + booking_json(JSONB-only) 둘 다 ✏️수정 가능
  · idx 기반 매칭으로 JSON-only 학생도 식별
  · 편집: 한글/영문이름, 생년도, 킨더/주니어 select, academy 시작/종료, SSP/사진허용/픽드롭/주소/특이사항
  · 저장 분기: DB row 있으면 PATCH students 테이블 + PUT bookings.students JSONB / 없으면 PUT만
- 픽업/체크인 탭: 기본 픽업정보 표시(b.pickup_place/drop_off) + row 인라인 편집
- 셔틀 탭: row 인라인 편집 (날짜/시간/장소/인원/왕복/상태/메모)
- 신규 API: /api/bookings/[id]/update-row
  · PATCH: {table:'students'|'pickup_requests'|'shuttle_requests', rowId, fields} — 화이트리스트, booking_id 검증
  · PUT: {studentsJsonb} — bookings.students JSONB 전체 동기화

### 학생관리 (app/admin/bookings/page.tsx)
- 리스트: 상태/잔금일 컬럼 제거 (사용자 요청)
- 킨더/주니어 컬럼: grade || level 매핑으로 한글 라벨 표시
- 달력 뷰 추가 (📋리스트/📅달력 토글, stuView state)
  · 주별 월~일 7컬럼 + 좌측 주별 요약 (Kinder-N/Junior-N/합계 J/K)
  · 셀 콘텐츠: M/D 날짜, 월요일에 'N New in' 초록 배지, 금요일에 'Graduation/N out' 빨강 배지
  · 학생 표기: '+ 한글이름 영문이름(나이)' (academyStart) / '- ...' (academyEnd)
  · ← 이전달 / 다음달 → 네비 (stuYear/stuMonthNum 동기 갱신)
  · timezone-safe calYmd 헬퍼 (toISOString 회피)
  · genCalWeeks(year, month): 월요일 시작 주 배열 생성
  · getStudentAge(s): age 4자리=현재년-year, 1~2자리=그대로
- academyStart 정확화 (김희영 5/9 → 5/11 케이스)
  · getNextMonday(dateStr) 헬퍼 신설
  · 비통학형: studentsList map에서 항상 getNextMonday(checkin_date)로 derive (JSONB stale 무시)
  · 통학형: JSONB 값 우선 (사용자 수동 입력 보존)
  · saveNewBooking studentsJsonb도 동일 로직 적용 (향후 stale 방지)
- 월 필터 overlap (start<=monthEnd && end>=monthStart)로 변경 (시작월 정확 일치 → 기간 걸침)
- academyStart 빠른순 .sort() 적용 + stuSort 기본 asc:true

### 드림하우스 룸 캘린더 (app/dreamhouse-rooms/page.tsx)
- toDateStr timezone 오류 수정 (toISOString → getFullYear/getMonth/getDate)
  · KST/PHT에서 로컬 자정이 UTC 변환 시 하루 밀리던 버그 — 체크인 5/9 인데 5/10부터 블록되던 현상
- 날짜 비교를 문자열 직접 비교로 변경 (lexicographic 안전)
- 체크인 당일 ~ 체크아웃 당일까지 inclusive 양 끝 블록
- isCheckout 단순화: cellBookings.some(b => b.checkout_date === dateStr)

### 예약 접수 페이지 (app/booking/page.tsx)
- 통학형 선택 시 섹션4 분기 렌더 (showAccom 가드 제거)
  · 통학형: '4️⃣ 수업 일정' — 수업시작/수업종료 manual date input + '통학형은 픽업/항공편이 없습니다' 안내
  · 그 외: 기존 '4️⃣ 체크인 · 항공편' 유지
- 검증 강화: 통학형도 checkIn 필수 + checkOut 누락도 차단

### 신규예약 모달 (app/admin/bookings/page.tsx)
- 통학형 선택 시 체크인→'수업시작' / 체크아웃→'수업종료' 레이블 인라인 분기

### 확정예약 탭 특이사항 컬럼
- 22자 truncate + '...' 표시
- title 속성으로 hover 툴팁
- 클릭 토글 (expandedSr Set state)으로 셀 확장/접힘
- 펼친 상태는 maxWidth:none, 접힘 상태는 160px

### 데이터 보정
- 차영리 예약 (DA-20260505-956940) Supabase 직접 PATCH
  · checkout_date: 2026-05-26 → 2026-06-05
  · students[0].academyEnd: "" → "2026-06-05"
  · students[0].academyStart: "2026-05-09" → "2026-05-11" (Mon)

## 다음 섹션 예정 작업

### [최우선] 전체 가독성 및 업무 효율성 재검토
- 페이지 순회로 버그·UX 문제 스캔:
  · 예약 접수 (/booking)
  · 어드민 예약관리 전체 탭 (부킹리스트/인보이스/영수증/확정예약/학생관리)
  · 예약 상세 전체 탭 (기본정보/픽업체크인/학생/인보이스/튜터/셔틀/코멘트)
  · 손님용 인보이스 (/invoice)
  · 드림하우스 룸 캘린더 (/dreamhouse-rooms)
  · 견적 탭
- 불편한 UX 개선 리스트 작성
- 발견 버그 우선순위 정리 후 일괄 수정

### 기존 우선순위 (P1~P5)
1. [P1] 견적서 포함/불포함 박스
2. [P2] 예약 페이지 동의 체크박스
3. [P3] 인보이스 현지 지불 자동화 (킨더 재료비 자동 채움까지 미완 — 부분 완료)
4. [P4] 신규예약 모달 6가지 유형 정비
5. [P5] 견적서 체크아웃 날짜 자동 표시

## 2026-05-06 오후 세션 (UX 스캔 + 다수 버그 수정)

### UX 스캔 완료 (Part 1~2)
- /booking: P1/P2 이미 완료 확인 (포함/불포함 박스, 동의 체크박스)
- 부킹리스트: 숙소 컬럼 title 툴팁 / 정혜영 학생이름 stuNames 폴백 수정
- 인보이스/영수증/부킹리스트: 학생이름 maxWidth:200 truncate + hover title
- 확정예약: acaEnd .weeks→.academyWeeks 버그 수정 (아카데미종료 24건 전부 정상화)
- 확정예약: acaEnd 우선순위 students[0].academyEnd → academyWeeks → accom_weeks
- 학생관리 리스트: YYYYMMDD→연도(4자리) 정규화, 만N세→달력 나이 숫자 표시
- 견적 탭 Task A: 발행일 new Date() 자동갱신 (visibilitychange + focus + 1분 인터벌)
- 견적 탭 Task B (P5): 체크인/체크아웃 날짜 견적서 출력물 표시 (미입력 시 숨김)
- 예약상세 학생 탭 Task C: 세 번째 항목 빈값("-") filter(Boolean) 숨김
- 학생관리 달력: A4 가로 인쇄 기능 (@media print + 🖨️ 인쇄 버튼)
- 학생관리 달력: 킨더 학생 이름 앞 검정 굵은 K 표시

### 인보이스 룸 번호 버그 수정 (app/invoice/page.tsx)
- B17L10 하드코딩 4곳 → "TBA"/"미정"으로 교체
- house_no || accom_room 폴백 + DH 접두어 제거 + 대문자 정규화
- DB accom_room = "b17L14" → 인보이스 "B17L14" 정상 표시

### 체크인 피켓 카드 신규 (app/admin/checkin-card/page.tsx)
- URL: /admin/checkin-card?bookingId={uuid}
- 예약자 한글이름(160px) / 영문이름 / Dream House / B17 L14 / MAY-15 / KE601 23:30
- @media print A4 landscape (가로 출력)
- 예약상세 픽업/체크인 탭에 🪧 체크인 카드 버튼 연결

### 체크인 디테일 Step 1 (app/admin/checkin-details/page.tsx)
- 픽업/체크인 탭 버튼 → /admin/checkin-details?bookingId={uuid}
- bookingId searchParams 자동 선택 로직 (useRef 1회 보장)
- Supabase checkin_details 테이블 SQL 제공 (수동 실행 필요)

### 픽드랍 관리 페이지 개선 (app/admin/pickups + API)
- bookings_new → bookings 전환 (테이블 오류 해결)
- 자동 추출: AIRPORT_PATTERN(공항/막탄/airport/cebu/MCIA) 매칭 + 취소 예약 제외
- 리스트 행마다 🪧 체크인 카드 버튼 (새 탭)
- 📋리스트 / 📅달력 토글
  · 달력 셀: ✈️IN N(초록) / ✈️OUT N(빨강) 카운트 배지
  · 셀 클릭 시 해당일 픽드랍 상세 패널 (예약자/시간/항공편/장소)
  · 이전달/다음달 네비

### 현재 우선순위 (미완료)
1. [P3] 인보이스 킨더 재료비 자동화 (SSP/교재비는 완료, 킨더 재료비 잔여)
2. [P4] 신규예약 모달 6가지 유형
3. 체크인 디테일 Step 2~4 (공개 URL, 손님 폼, 인보이스 연동)
4. Supabase checkin_details 테이블 SQL 실행 필요

## 2026-05-06 오후 세션 (체크인 시스템 + 픽드랍 + UX 수정)

### 체크인 피켓 카드 (app/admin/checkin-card/page.tsx) 신규
- URL: /admin/checkin-card?bookingId={uuid}
- 예약자 한글이름(120px)/영문이름/Dream House/B17 L14/MAY-15/KE601 표시
- @media print A4 landscape
- 예약상세 픽업/체크인 탭 🪧 체크인 카드 버튼 연결

### 체크인 디테일 시스템 (Step 1~4)
- Supabase checkin_details 테이블 생성 + 컬럼 추가
- /admin/checkin-details?bookingId={id} 자동 선택 (Step 1)
- 어드민 폼 7개 필드 + 💾저장 + 🔗손님폼링크복사 (Step 2)
- 손님 공개 폼 /checkin/[token] — 6가지 질문, prefill, 제출완료 메시지 (Step 3)
- API /api/checkin/[token] GET/POST (Step 4)
- 유심 질문 아래 Smart 유심 요금제 안내 박스 추가
- 예약상세 픽업/체크인 탭: 체크인 디테일 데이터 있어도 항상 버튼 표시

### 인보이스 버그 수정 (app/invoice/page.tsx)
- Room No. B17L10 하드코딩 4곳 → house_no||accom_room 정규화 (DH 접두어 제거)
- 이미지 저장 버튼 추가 (📷, html2canvas, guest/admin 인보이스 모두)
- 영문이름 폴백: booker_english 없으면 checkin_details.guest_names_en 첫 이름

### 픽드랍 관리 (app/admin/pickups)
- bookings_new → bookings 테이블 오류 수정
- 예약에서 자동 추출 54건 (공항 패턴 매칭)
- 리스트 뷰: ✈️IN/OUT 뱃지, 항공편, 🪧 체크인카드 버튼
- 달력 뷰 추가: ✈️IN 초록/✈️OUT 빨강 배지, 날짜 클릭 상세 패널

### 학생관리 달력
- A4 가로 인쇄 (@media print + 🖨️ 버튼)
- 킨더 학생 이름 앞 검정 굵은 K 표시

### 견적 탭 (P5 완료)
- 발행일 new Date() 자동갱신
- 체크인/체크아웃 날짜 출력물 표시

### 현재 미완료
- P3: 인보이스 킨더 재료비 자동화
- P4: 신규예약 모달 6가지 유형
- 체크인 디테일 인보이스 완전 자동화
