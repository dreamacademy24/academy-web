# Dream Academy Philippines - 프로젝트 현황

## 기본 정보
- 스택: Next.js (App Router), Supabase, Vercel
- 도메인: dreamacademyph.com
- GitHub: dreamacademy24/academy-web
- 로컬: C:/Users/user/academy-web
- DB: Supabase (yiglafscjvjgkxpycevk.supabase.co)

## 어드민 계정
| 아이디 | 비번 | 역할 | staffId |
|--------|------|------|---------|
| admin-ceo | ceo1234 | admin | ceo |
| admin-jenna | jenna1234 | staff | jenna |
| admin-jamie | jamie1234 | staff | jamie |
| admin-yuna | yuna1234 | staff | yuna |
| admin-hanny | hanny1234 | staff | hanny |
| admin-sage | sage1234 | staff | sage |
| admin-eric | eric1234 | staff | eric |

## 직원 페이지
- public/team_manager3.html (iframe)
- app/staff/page.tsx → iframe src: /team_manager3.html?user=xxx
- ?user=xxx 파라미터로 자동 doLogin()

## Supabase 이전 현황 (team_manager3.html)
✅ 완료:
- sbFetch/sbGet/sbPost/sbPatch/sbDel 헬퍼 함수
- 채팅: sendChatMsg, renderMessages, markChatRead, getUnread, renderChatHeader
- 결재: submitApproval, processApproval, resubmitApproval, renderApprovalPage
- 의견요청: renderOpinionList, openOpinionDetail, submitOpinion, submitReply, deleteReply, deleteOpinion

⚠️ 미완료/버그:
- 결재/의견요청 페이지 로딩만 되고 내용 안 뜸 (sbGet 배열 보장 추가됨, 재확인 필요)
- 데일리 탭에 결재 상신 폼이 같이 뜨는 버그 (showEmpPage/setEF 함수 문제)
- 보고서(staff_reports) Supabase 이전 미완료

## Supabase 테이블
- staff_chat, staff_approvals, staff_opinions, staff_op_replies, staff_reports
- 모두 RLS 비활성화

## 컴퓨터 네트워크 문제
- CEO 컴퓨터 크롬/엣지에서 dreamacademyph.com ERR_CONNECTION_REFUSED
- 해결: hosts 파일에 76.76.21.21 dreamacademyph.com 추가 후 접속 가능
- hosts 파일 위치: C:\Windows\System32\drivers\etc\hosts

## 주요 규칙
- team_manager3.html 수정 후 반드시 new Function() 파싱 검증
- git push 전 파싱 OK 확인
- node 스크립트 일괄치환 금지 → SyntaxError 위험
- 새 대화: "드림아카데미 프로젝트 이어서 진행해줘"
