# 공통 학생 케어 기반 조사 및 구조 결정

## 운영 DB 읽기 전용 조사 결과

환경의 Supabase 프로젝트 식별자와 연결된 프로젝트가 일치함을 확인했다. 개인정보 값이나 비밀번호를 복제하지 않고 스키마와 집계만 조회했다. 운영 자료/권한은 변경하지 않았다. 아래 수치는 조회 시점의 스냅샷이다.

| 항목 | 확인 값 |
|---|---:|
| 예약 | 297 |
| students 행 | 943 |
| 예약 students 값이 배열인 예약 | 115 |
| 예약 students 값이 JSON 문자열인 예약 | 182 |
| 문자열 해석 포함 예약 학생 항목 | 497 |
| 해석 후 배열이 아닌 예약 | 0 |
| 예약 JSON 항목 수와 별도 학생 행 수가 다른 예약 | 5 |
| 현재 bookings에 연결 대상이 없는 학생 행 | 30 |
| 같은 예약·한글 이름이 중복된 그룹 | 3 |
| 포털 계정이 연결된 예약 | 82 |
| JSON 학생 ID가 같은 예약의 students.id와 일치하는 항목 | 157 |
| JSON 학생 ID가 students에서 발견되지 않는 항목 | 321 |
| JSON 학생 ID가 없는 항목 | 19 |
| 여러 번 나타난 JSON 학생 ID 그룹 | 7 |

497는 고유 아이 수가 아니라 예약 안의 항목 수이며 보호자 자리표시 등이 포함될 수 있다. 321건의 ID 미일치는 임시 식별자 등일 수 있으므로 곧바로 오류/삭제 대상으로 판단하지 않는다. 30건도 다른 옛 자료와의 관계를 검토하기 전 삭제하지 않는다.

## 기존 자료 재사용

추가 집계: academy_enrollments 0행, online_class_enrollments 0행, online_enrollments 33행, tutor_lessons 85행, student_daily_logs 28행. 이름이 비슷한 테이블 중 실제 데이터가 있는 경로를 먼저 연결한다. 빈 테이블도 코드 의존 여부 확인 전 삭제하지 않는다.

- students: booking_id, 이름, 연령, level, class_type, academy_start/end 등. 현재 개인의 평생 ID 역할로 단정하지 않는다.
- academy_enrollments: student_id, level, class_type, start/end, weeks, notes. 실제 사용량과 연결 품질 확인 후 방문 수강 연결에 재사용한다.
- student_daily_logs: booking_id + student_idx, log_date, staff_id, 출결·컨디션·투약·메모. 현재 학생 배열 순서에 연결되므로 순서 변경 시 주의. 건강 관련 항목은 일반 공개 리포트와 분리한다.
- tutor_lessons: student_names 문자열, tutor_id, 교재 및 영역별 수준, 출결/메모 기록. student_names를 자동 분해해 개인에 귀속하지 않는다.
- online_class_enrollments와 online_enrollments 둘 다 존재한다. 후자는 customer_user_id, package_booking_id, 교사 및 tutor_notes 등을 갖는다. 서비스별 사용 경로 확인 후 연결한다.
- bookings_new는 이번 information_schema 조회 결과에 없었다. 일부 코드의 fallback 경로는 남아 있다.

## 확인한 변경 경로

| 경로 | 동작/전환 주의점 |
|---|---|
| app/admin/bookings/page.tsx | 신규 예약 시 students 저장 후 bookings.students 별도 저장. 일부 실패 시 불일치 가능 |
| app/api/bookings/[id]/route.ts | 학생 조회 fallback, 기간 변경 시 두 구조 갱신 |
| app/api/bookings/[id]/update-row/route.ts | 학생 행 수정 또는 예약 JSON만 수정 |
| app/api/portal/student-english/route.ts | 영문 이름을 학생 행과 JSON에 각각 갱신. 이름 기반 fallback 있음 |
| app/api/bookings/[id]/delete/route.ts | 예약 삭제 시 학생 및 수업 관련 삭제 경로 있음. 영속 학생/발행 리포트를 cascade로 물리 삭제하지 않게 재설계 필요 |
| app/admineng/student-calendar/page.tsx | 예약 JSON 기반, 예약 ID + 배열 순서로 표시 |
| app/api/portal/students/route.ts | 학생 테이블 우선, JSON fallback에서는 학생 ID가 null |

## 권한 조사 — 서비스 연결 전 우선 해결

- bookings: RLS는 켜져 있으나 public 대상 ALL true 정책과 anon/authenticated CRUD grant 확인.
- students: RLS는 켜져 있으나 anon/authenticated ALL true 정책과 CRUD grant 확인.
- tutor_lessons: RLS 꺼짐, anon/authenticated CRUD grant 확인.
- 실제 개인정보를 익명으로 조회하거나 수정하는 실험은 하지 않았다. 정책/권한 메타데이터를 근거로 판정했다.
- 현재 화면들이 브라우저에서 직접 조회/수정하므로 일괄 revoke는 서비스 장애를 낼 수 있다. 영향 경로를 서버 API로 전환한 다음 범위를 단계적으로 좁혀야 한다.
- 한국인 로그인 API는 서명된 HttpOnly 직원 쿠키를 발급하지만 현지 로그인 API는 이 쿠키를 발급하지 않는다. 기존 portalStaffIdentity는 korean_admin만 허용한다. 이를 단순히 모든 직원 허용으로 넓히면 예약 관리자 권한까지 열릴 수 있으므로 공통 신원 확인과 업무별 인가를 분리한다.

## 공통 데이터 구조 초안

1. **learner_profiles**: 예약과 독립적인 학생 UUID, 기본 이름/생년월일(확인된 경우만), 생성/보관 이력. 기존 나이로 생년월일을 추정하지 않는다.
2. **guardian_learner_links**: 검증된 보호자 계정 ID와 학생 ID, 관계, 연결 확인자/시각. 예약 소유자라는 이유만으로 모든 동명 학생을 연결하지 않는다.
3. **learning_visits**: learner_id, 예약 참조(선택), 수업 시작/종료, 상태. 예약 삭제가 방문 이력 삭제로 이어지지 않도록 한다. 방문 회차는 UI에서 정렬해 보여주며 번호를 학생 ID로 쓰지 않는다.
4. **legacy_student_links**: source 종류, 기존 행 ID 또는 예약 항목 위치, 원본 fingerprint, learner_id/visit_id, 검토자·확정 시각. 위치는 출처 표시용이며 영속 ID가 아니다. 원본 변경 시 재검토한다.
5. **visit_staff_assignments**: visit_id, 검증된 staff ID, 역할, 시작/종료일. 교사 교체 이력 보존.
6. **study_placements**: visit_id, 영어 수준, 공식 교재 단계, 교재 판본, 적용 기간. 반 분류(kinder/junior)와 분리.
7. **lesson_records / report_versions**: 방문과 수업/평가 연결, 작성자, 실제 수업 범위, 영역별 점수·의견, 공개 상태. 발행본은 당시 정보를 고정한다.

위 이름은 설계 후보이며 운영 테이블을 생성한 상태가 아니다. 기존 수강·출결 자료의 연결 가능성을 검토해 불필요한 신규 테이블을 줄인다.

## 역할별 권한 초안

| 역할 | 범위 | 허용 | 제외 |
|---|---|---|---|
| 예약 담당 | 담당/허용 예약 | 예약·보호자 연결, 공유할 사전 인계 작성 | 역할만으로 리포트 평가·교사 녹음 판정 권한 부여 안 함 |
| 학습 관리자 | 관리 학생 범위 | 배정, 교재·수준, 리포트 검토·발행 | 예약 재무는 별도 권한 필요 |
| 담당 교사 | 배정된 방문 및 인계로 허용한 이전 기록 | 수업 기록·초안 평가·과제 피드백 | 결제·비공개 상담, 비담당 학생 접근 |
| 현지 운영 | 맡은 운영 일정/학생 | 출결·운영상 필요한 정보 | 전체 학습 평가·녹음 기본 접근 없음 |
| 보호자 | 검증된 자녀 연결 | 복습 제출·발행 리포트·공개 피드백 | 내부 메모·다른 가족 자료 |

역할·배정 정보는 서버에서 조회한다. 브라우저에서 보내는 role, learner_id, booking_id를 권한 증거로 신뢰하지 않는다. 보관/공개 정책은 리포트·녹음 도입 전에 운영 기준과 함께 구체화한다.

## 구현 및 검증 상태

- lib/student-care/reconcile.ts: 읽기 전용 연결 후보 분류 코드 작성. 이름만으로 자동 병합하지 않는다.
- scripts/test-student-reconciliation.mjs: 배열/JSON 문자열, 형제자매, 동명이인, 잘못된 ID, 반복 ID, 이름 불일치, 비학생 자리표시 등 8개 테스트 통과.
- 운영 데이터 마이그레이션, 로그인/권한 변경, 새 학생 화면 배포는 아직 하지 않았다.
- 추가 수강 테이블 사용량 집계를 완료했다. student_daily_logs는 직원업무 HTML과 오늘 화면, online_enrollments는 현재 화상 API 경로가 사용한다.
- TypeScript 및 대상 ESLint 검사 통과.
- 남은 1단계: 배포 커밋 확인, 데이터 변경 경로 전수 확인, 추가 수강 테이블의 학생 연결 품질, 실제 매핑 검토 도구.
