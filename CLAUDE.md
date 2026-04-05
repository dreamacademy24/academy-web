# Dream Academy Philippines - 프로젝트 현황

## 기본 정보
- 프레임워크: Next.js (App Router)
- 호스팅: Vercel
- 도메인: dreamacademyph.com
- GitHub: dreamacademy24/academy-web
- DB: Supabase (yiglafscjvjgkxpycevk.supabase.co)
- 로컬 경로: C:/Users/user/academy-web

## 완료된 페이지
- `/` : 메인 (견적내보기 버튼, FAQ, 신뢰지표 섹션)
- `/estimate` : 손님용 견적계산기 (정가 기준)
- `/booking` : 손님 예약접수 폼
- `/invoice` : 인보이스 작성
- `/receipt` : 영수증 발행
- `/payment` : PayPal 결제 페이지
- `/admin` : 로그인 페이지 (아이디+비번 방식)
- `/admin/hub` : 관리자 허브 (예약관리/사이트관리/직원업무)
- `/admin/bookings` : 예약관리 (부킹리스트/인보이스/영수증/견적계산기 탭)
- `/admin/site` : 사이트관리 (공지/셔틀/필드트립/회원)
- `/staff` : 직원업무 페이지 (team_manager3.html iframe)
- `/guide` : 직원 가이드 (3탭: 전체업무흐름/이메일설정/직원관리사용법)
- `/dreamhouse-rooms` : 드림하우스 룸 캘린더
- `/summer` : 여름캠프 페이지
- `/junior`, `/kinder` : 커리큘럼
- `/package` : 올인원패키지
- `/accommodation/dreamhouse`, `/jpark`, `/cubenine` : 숙소 3개
- `/notice`, `/community` : 공지사항, 커뮤니티
- `/qr` : QR코드 페이지

## 어드민 계정 목록
| 아이디 | 비번 | 역할 | 이동 |
|--------|------|------|------|
| admin-may | may1234 | admin | /admin/hub |
| admin-ceo | ceo1234 | admin | /admin/hub |
| admin-jenna | jenna1234 | staff | /staff?user=jenna |
| admin-jamie | jamie1234 | staff | /staff?user=jamie |
| admin-yuna | yuna1234 | staff | /staff?user=yuna |
| admin-hanny | hanny1234 | staff | /staff?user=hanny |
| admin-sage | sage1234 | staff | /staff?user=sage |
| admin-eric | eric1234 | staff | /staff?user=eric |

## 인증 시스템
- lib/adminAuth.ts: isAdminAuthed(), getAdminInfo(), clearAdminAuth()
- localStorage: adminAuthed, adminRole, adminName, adminStaffId, adminExpiry
- 24시간 자동 로그인 유지
- 로그인 성공 → window.location.href = '/admin/hub'
- ⚠️ 현재 이슈: 중간에 재로그인 요청이 뜨는 버그 있음 (다음 세션에서 수정 필요)

## 직원 페이지 (team_manager3.html)
- public/team_manager3.html (기존 team_manager2_4.html 유지)
- localStorage 키: tm_t, tm_n, tm_tc, tm_p, tm_th, tm_pw, tm_daily, tm_tmpl, tm_goals, tm_read
- 직원: jenna, jamie, yuna, hanny, sage, eric, ceo
- 새 기능: 데일리 기본탭, 주간리포트, 포모도로, 템플릿, OKR, 공지읽음확인, 통합설정, 브라우저알림
- 권한: 본인 공간만 접근 가능 (admin도 타 직원 페이지 접근 불가)

## PayPal 결제
- PD Dream Academy Inc. 비즈니스 계정 생성 완료
- Sandbox Client ID: Vercel 환경변수 NEXT_PUBLIC_PAYPAL_CLIENT_ID 등록됨
- ⚠️ Live 모드 활성화 필요: 회사에서 신분증+사업자서류 제출 후 Live Client ID 발급

## 회사 이메일
- Namecheap Private Email (Pro, dreamacademyph.com)
- info@dreamacademyph.com
- admin@dreamacademyph.com  
- may@dreamacademyph.com
- Gmail POP3/SMTP 연동 완료 (mail.privateemail.com / 포트 995/587)

## Google Sheets
- SHEET3_ID: 10NOyxaffpofsTjpPBSUl_rXobjDl4kxlAgxfn32ql-U
- 서비스 계정: dreamacademy-sheets@dreamacademy-491008.iam.gserviceaccount.com
- SHEET1, SHEET2는 기존 레거시 (건드리지 말 것)

## 가격 데이터
- public/price.xlsx: 드림하우스/제이파크/큐브나인 정가/비수기/성수기 3단계
- SheetJS로 읽어서 어드민 견적계산기에 사용

## 다음 할 작업
1. ⚠️ 어드민 중복 로그인 버그 수정 (재로그인 요청 뜨는 현상)
2. PayPal Live 모드 활성화 (회사에서 서류 제출)
3. 드림하우스 룸 캘린더 개선
4. 다국어 지원 (한/영/일)
5. 카카오톡 알림 연동

## 주요 규칙
- Claude Code 명령어 앞에 / 절대 붙이지 말 것
- git push는 항상 마지막 단계
- localStorage는 typeof window !== 'undefined' 체크 필수
- GOOGLE_PRIVATE_KEY는 Vercel에서 실제 줄바꿈으로 입력
- 새 Google Sheet는 서비스 계정을 editor로 추가해야 함
- 새 대화 시작: "드림아카데미 프로젝트 이어서 진행해줘"
