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
