# 드림아카데미 프로젝트 (dreamacademyph.com)

## 기본 정보
- GitHub: dreamacademy24/academy-web
- 로컬: C:/Users/user/academy-web
- 배포: Vercel (git push → 자동 배포)
- DB: Supabase
- 관리자 비밀번호: dream2026!
- 카카오톡: http://pf.kakao.com/_Yuhxhn/chat

## 환경변수 (.env.local + Vercel)
- NEXT_PUBLIC_SUPABASE_URL=https://yiglafscjvjgkxpycevk.supabase.co
- NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_KNarM24AgrmjtLc-_-ytPA_Lgz7KBTP
- NEXT_PUBLIC_ADMIN_PASSWORD=dream2026!
- GOOGLE_SERVICE_ACCOUNT_EMAIL=dreamacademy-sheets@dreamacademy-491008.iam.gserviceaccount.com
- GOOGLE_PRIVATE_KEY=(실제 키 - .env.local 참고, 실제 줄바꿈으로 저장 필요)
- SHEET1_ID=1Yx1bHtzdpRbcdmE74OLHUTlWs3ImcWqrBCRJr0GUnJM (기존 드하 최종 예약현황 - 절대 건드리지 않음)
- SHEET2_ID=1CfSNhHEgilHdRlC__YSq3DJhSFsGgcYZUZ4khRZUNYc (기존 드림아카데미 - 절대 건드리지 않음)
- SHEET3_ID=10NOyxaffpofsTjpPBSUl_rXobjDl4kxlAgxfn32ql-U (신규 웹 전용 통합 시트)

## 구글 시트
- SHEET3 이름: 드림아카데미 예약현황 (웹)
- 서비스계정 공유 완료: dreamacademy-sheets@dreamacademy-491008.iam.gserviceaccount.com
- 컬럼: 상태|예약번호|담당자|예약자명|영문이름|체크인|체크아웃|숙소|하우스번호|투숙인원|학생이름(한글)|학생이름(영문)|나이|킨더/주니어|아카데미시작|아카데미종료|아카데미기간|오전/종일|항공편IN|항공편OUT|픽업장소|픽업|드롭|유학원|잔금일자|SSP|사진허용|패키지금액|할인|최종금액|특이사항|등록일자
- 주의: 영수증 페이지에서 [구글 시트 기록] 버튼을 직접 눌러야 기록됨 (자동 아님)

## Supabase 테이블: bookings
```sql
id, reservation_no, status, booker_name, booker_english,
reservation_date, balance_date, students(JSONB),
accom_type, accom_room, accom_weeks, checkin_date, checkout_date,
pickup, drop_off, pickup_place, flight_in, flight_out, house_no,
special_request, agency, ssp, assignee,
base_price, billing_items(JSONB), discounts(JSONB), locals(JSONB),
total_discount, final_price, created_at, updated_at
```

## 페이지 구조
- / : 메인 (상단 "관리자" 버튼 → /admin)
- /booking : 고객 예약 접수 폼 (공개)
- /admin : 관리자 허브 (localStorage 세션 유지, 비밀번호: dream2026!)
- /admin/bookings : 예약관리 (부킹리스트/인보이스/영수증 탭)
- /admin/site : 기존 사이트관리 (공지/셔틀/필드트립/회원)
- /invoice?id=xxx : 인보이스 작성
- /receipt?id=xxx : 영수증 발행
- /guide : 직원 가이드 (localStorage 인증)
- /estimate : 견적 페이지

## 전체 업무 흐름
1. 고객 /booking 접수 → DB 저장 (status: 접수)
2. /admin/bookings 부킹 리스트에서 담당자 지정 (May/Jamin/Yuna/Jena)
3. 행 클릭 → /invoice?id=xxx (고객정보 자동 로드)
4. 견적계산/금액입력 → [저장하기] (status: 인보이스발행)
5. [영수증 발행] → /receipt?id=xxx 새 탭
6. [구글 시트 기록] 버튼 클릭 → SHEET3에 기록
7. [이미지 저장] or [PDF 저장/인쇄]

## 네비게이션 연결
- 영수증 → 인보이스 → 어드민 뒤로가기 연결됨
- 어드민에서 각 예약 행에 [인보이스] [영수증] 버튼 있음

## 주요 자동계산
- 잔금일: 체크인 +2달 자동
- 드림하우스 보증금: 주수 × 2,000페소 자동
- 예약번호: DA-yyyyMMdd-3자리랜덤 자동생성
- 아카데미 종료일: 시작일 + 주수 자동

## 담당자
May / Jamin / Yuna / Jena
- 어드민 부킹 리스트에서 드롭다운으로 바로 선택 → 즉시 DB 저장

## 다음 작업 목록
1. 견적 페이지(/estimate) 현재 시스템과 연동 확인
2. 드림하우스 룸 예약 관리 (/dreamhouse-rooms)
   - 방: b16L19, b17L12, b17L11, b17L10, b17L9, b17L8, b17L7, b17L13, b17L18, 빅하우스, b21L1, b13L10
   - 월별 캘린더 UI, 더블예약 감지, 관리자 전용
3. 다국어 지원 (한/영/일)
4. 카카오톡 알림 연동
5. PayPal 결제 연동

## 주의사항
- GOOGLE_PRIVATE_KEY는 Vercel에 실제 줄바꿈으로 저장해야 함 (\\n 아님)
- SHEET1, SHEET2는 절대 건드리지 않음 (기존 수동 관리 시트)
- localStorage 사용 시 typeof window !== 'undefined' 체크 필수 (SSR 오류 방지)
- git push 하면 Vercel 자동 배포됨
