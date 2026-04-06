# Dream Academy Philippines - 프로젝트 현황

## 기본 정보
- 프레임워크: Next.js (App Router)
- 호스팅: Vercel
- 도메인: dreamacademyph.com
- GitHub: dreamacademy24/academy-web
- DB: Supabase (yiglafscjvjgkxpycevk.supabase.co)
- 로컬 경로: C:/Users/user/academy-web

## 완료된 페이지
- `/` : 메인
- `/estimate` : 견적계산기
- `/booking` : 예약접수 폼
- `/invoice` : 인보이스 작성
- `/receipt` : 영수증 (지불내역 입력, 입금구분 선택, 인보이스 정보 연동)
- `/payment` : PayPal 결제
- `/admin` : 로그인 (아이디+비번)
- `/admin/hub` : 관리자 허브
- `/admin/bookings` : 예약관리
- `/admin/site` : 사이트관리
- `/staff` : 직원업무 (team_manager_v2.html iframe, ?user=xxx 자동 로그인)
- `/guide` : 직원 가이드
- `/dreamhouse-rooms` : 드림하우스 룸 캘린더
- `/summer` : 여름캠프

## 어드민 계정
| 아이디 | 비번 | 역할 | staffId |
|--------|------|------|---------|
| admin-may | may1234 | admin | may |
| admin-ceo | ceo1234 | admin | ceo |
| admin-jenna | jenna1234 | staff | jenna |
| admin-jamie | jamie1234 | staff | jamie |
| admin-yuna | yuna1234 | staff | yuna |
| admin-hanny | hanny1234 | staff | hanny |
| admin-sage | sage1234 | staff | sage |
| admin-eric | eric1234 | staff | eric |

## 인증 시스템
- lib/adminAuth.ts: isAdminAuthed(), getAdminInfo(), clearAdminAuth()
- 24시간 자동 로그인 유지
- admin-xxx → staffId에서 admin- 제거 후 team_manager에 전달

## 직원 페이지 (team_manager_v2.html)
- public/team_manager_v2.html (team_manager3.html과 동일, CDN 캐시 우회용)
- app/staff/page.tsx에서 iframe src로 사용
- localStorage 기반 (tm_t, tm_p, tm_n 등)
- 직원: jenna, jamie, yuna, hanny, sage, eric, ceo
- URL ?user=xxx 파라미터로 자동 doLogin()

### team_manager 기능 목록
1. 홈, 전체업무(보드), 달력, 프로젝트, 의견요청, 채팅
2. 개인업무 공간 (데일리/진행중/완료/전체/결재 탭)
3. 프로젝트: 담당자 다중선택, 담당자별 보고 대시보드
4. 미배정 업무 "내 업무로" 가져가기
5. 업무 담당자 다중선택 칩 UI
6. 결재: 상신/승인/반려/재상신 (CEO+Jenna 결재자)
7. 의견요청: 글쓰기/답변/삭제 별도 페이지
8. 채팅: 채널별(전체/공지/잡담/업무), @멘션, 읽음처리
9. 업데이트 알림: 로그인 후 1초+5분마다 결재/의견/채팅 감지 → 우하단 배너
10. 달력 날짜 타임존 버그 수정 (parseLocalDate)

## ⚠️ 다음 할 작업
1. **Supabase 이전** (채팅/결재/의견/보고 직원간 실시간 공유)
   - Supabase 테이블 생성 완료: staff_chat, staff_approvals, staff_opinions, staff_op_replies, staff_reports
   - team_manager_v2.html에서 localStorage → Supabase API로 교체 필요
   - 주의: node 스크립트로 치환 시 SyntaxError 발생했었음 → str_replace로 함수별 교체할 것
2. **팝업 알림 B안** 확인 (iframe→Next.js postMessage)
3. **달력 날짜 오류** - parseLocalDate 적용됨, 확인 필요

## PayPal
- PD Dream Academy Inc. 비즈니스 계정
- Sandbox Client ID 등록됨
- ⚠️ Live 모드 활성화 필요

## Google Sheets
- SHEET3_ID: 10NOyxaffpofsTjpPBSUl_rXobjDl4kxlAgxfn32ql-U
- SHEET1, SHEET2 건드리지 말 것

## 주요 규칙
- git push는 항상 마지막 단계
- localStorage는 typeof window !== 'undefined' 체크 필수
- GOOGLE_PRIVATE_KEY는 Vercel에서 실제 줄바꿈으로 입력
- 새 대화 시작: "드림아카데미 프로젝트 이어서 진행해줘"
- team_manager 수정 시 반드시 Node.js new Function()으로 파싱 검증 후 push
