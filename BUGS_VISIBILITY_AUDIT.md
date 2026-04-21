# team_manager3.html — 관리자/직원 뷰 비대칭 버그 전수 감사 리포트

- 대상 파일: `public/team_manager3.html` (6418 lines)
- 감사 기준일: 2026-04-21
- 문제의식: 같은 엔터티(결재/업무/공지/의견요청/보고/데일리/프로젝트/채팅)에 대해 관리자용 렌더와 직원용 렌더가 **각각 따로 작성**되어 있어, 한쪽에 추가된 기능(첨부/댓글/체크리스트/공유/상태뱃지 등)이 다른 쪽에서 누락되는 구조적 버그가 반복되고 있음.

이미 수정된 사례:
- `60abb9a` — `_empApvShowMyList`에 `renderAttachments` 누락 → 추가
- `551bb63` — `_empApvShowMyList`에 댓글 블록 + `_apvLoadCmts` 호출 누락 → 추가

---

## 1. 결재 (Approval)

### [HIGH] 1-1. `renderApprovalPage` 전체에 댓글 블록이 전혀 없음

- **admin 경로:** `_empApvShowList` @ 3187 — 첨부 O, 댓글 블록 O, `_apvLoadCmts` O
- **user 경로 (사이드바 리스트):** `_empApvShowMyList` @ 3292 — 첨부 O, 댓글 블록 O, `_apvLoadCmts` O (551bb63로 수정됨)
- **결재 탭 전체 페이지:** `renderApprovalPage` @ 3738
  - "결재 대기" (approver용) 3759–3778: 첨부 O (3772), **댓글 블록 X**
  - "상신 내역" (submitter용) 3780–3803: 첨부 O (3788), **댓글 블록 X**
  - 함수 전체에 `apvCmts_` / `apvCmtInp_` / `_apvLoadCmts` 호출 **0건** (grep 확인됨)

**재현:**
1. Sage 로 로그인 → 개인 업무 공간 진입
2. 사이드바의 결재 탭(`setEF('approval')` @ 3726)을 클릭해 `renderApprovalPage` 경로로 진입하거나, `_empOpenApproval` @ 3649 로 진입
3. 본인이 상신한 결재(또는 승인 대기 결재)의 카드 열람
4. 결과: **댓글 입력창도, 기존 댓글 목록도 렌더되지 않음**
5. 같은 결재를 사이드바 하단 상태 리스트(`_empApvShowMyList`)에서 열면 댓글이 정상 표시됨

CEO가 `_empApvShowList`에서 단 댓글은 DB(`staff_approvals.comments` jsonb)에는 저장되지만, `renderApprovalPage` 경로에서는 UI가 존재하지 않아 영영 보이지 않음 — 유저 제보와 완전 일치.

**최소 수정안:**
- 3772 라인 아래(pending) 와 3788 라인 아래(mine)에 `_empApvShowMyList` 3315–3323 패턴 그대로 삽입:
  ```js
  html+='<div style="border-top:1px solid var(--border);margin-top:10px;padding-top:10px">';
  html+='<div id="apvCmts_'+a.id+'" style="margin-bottom:8px"></div>';
  html+='<div style="display:flex;gap:6px">';
  html+='<input id="apvCmtInp_'+a.id+'" placeholder="댓글 달기..." onkeydown="if(event.key===\'Enter\'){event.preventDefault();_apvAddCmt(\''+String(a.id)+'\')}" style="...">';
  html+='<button onclick="_apvAddCmt(\''+String(a.id)+'\')" style="...">전송</button>';
  html+='</div></div>';
  ```
- `wrap.innerHTML = html` 뒤에:
  ```js
  (rows||[]).forEach(function(a){ _apvLoadCmts(String(a.id)); });
  ```
- 추가로 `_empOpenApproval`(3649)에서 `renderApprovalPage`의 결과를 `_empApprovalSlot`에 복제한 후에도 `_apvLoadCmts`가 동작하도록, 복제 **뒤에** 로드 호출이 돌아야 함. 현재는 `renderApprovalPage` 내부에서 호출해야 ID 충돌이 없음.

### [MED] 1-2. 첨부 렌더 헬퍼 불일치

- `renderApprovalPage` pending(3772) + mine(3788): `renderAttachments` 사용
- `_empApvShowList`(3209) / `_empApvShowMyList`(3311): 같은 `renderAttachments` 사용 — OK
- 하지만 의견요청(`renderOpinionAttachments` @ 3848)과 업무(`renderTaskFiles` @ 3862)는 별도 구현. 결재에도 이미지/동영상 미리보기 기능이 의견요청에 들어간 최근 커밋(`38a3c5d`) 수준으로 확장되어 있지 않음. 현재는 이미지만 확대(lightbox), 동영상은 다운로드 링크로만 표시.

**수정안:** 3848의 `renderOpinionAttachments` 로직(동영상/오디오 인라인 플레이어)을 `renderAttachments`에 통합하거나, 둘을 `renderFilesBlock(files, opts)` 하나로 합침. 당장 버그는 아니고 UX 정렬 수준.

### [LOW] 1-3. 상태 badge 라벨/색상 미세 불일치

- `_empApvShowList` (3192): `{pending:'⏳ 결재 대기', approved:'✅ 승인 완료', rejected:'❌ 반려'}`
- `_empApvShowMyList` (3296): `{pending:'⏳ 대기 중', approved:'✅ 승인된 결재', rejected:'❌ 반려된 결재'}`
- `renderApprovalPage` 3783: `stMap`은 `approve`/`reject`로 키가 되어 있어 실제 status 값(`approved`/`rejected`)과 불일치 → 현재도 `stMap[a.status]||stMap.pending`로 fallback 되면서 승인/반려가 전부 "대기중"으로 표시될 수 있음.

**재현:** 상신자가 결재 탭(`renderApprovalPage`)에서 승인 완료된 자기 결재의 status badge를 보면 **"대기중"**으로 잘못 표시될 가능성. 이미 `48ab885`에서 유사 오타를 고친 전례 있음.

**수정안:** `stMap` 키를 `approved`/`rejected`로 변경. 3783 → `{pending:{...}, approved:{label:'승인', ...}, rejected:{label:'반려', ...}}`.

---

## 2. 업무 (Tasks)

### [LOW] 2-1. 대체로 대칭. 사소한 차이만 존재

- `renderBoardTaskDetail` @ 2665 (관리자 보드) vs `renderEmpDetail` @ 3536 (직원 공간)
- 체크리스트: `renderEmpChecklist` @ 4676 vs `renderDetailChecklist` @ 4735 — 두 함수 모두 `{_sub:true, items:[...]}` 하위업무 구조 지원. 큰 구조적 누락 없음.
- 댓글: `renderInlineCmt` @ 4809 / `renderTaskCmtBody` @ 4893 — 공통 렌더. 관리자/직원 모두 같은 경로.

**MED 수준 이하로 판단** — 업무 영역은 이미 상당히 통일되어 있음.

### [MED] 2-2. 업무 상세에서 assignees(다중 담당) 표시 불일치 가능성

- `tasks` 레코드는 `assignee` (단일 string) + `assignees` (배열) 양쪽 컬럼을 가짐 (CLAUDE.md staff_tasks 스키마)
- 관리자 측 보드(`renderBoardTaskDetail`)는 멀티 담당 배지를 렌더하지만, 직원 사이드바 리스트(`renderEmpList` @ 4361)에서는 `t.assignee` 단일만 보고 필터/표시하는 경우가 있을 수 있음.

**검증 필요:** `assignees` 배열로만 공유된 업무를 단일 `assignee` 비어있는 상태로 저장했을 때, 직원 목록에 안 보이는 케이스가 존재할 수 있음. 재현 시나리오: CEO가 여러 담당자 지정(예: `assignees:['sage','eric']`, `assignee:''`) → Sage 직원 공간의 내 업무 탭에 표시되는지 확인.

---

## 3. 공지 (Notices)

### [LOW] 3-1. 단일 렌더 경로 — 비대칭 없음

- `renderNotices` @ 2325 하나만 존재. admin/user 분기 내부에서 처리.
- `require_read` 확인 필드는 작성자(admin) 체크박스 UI 렌더, 읽은 이는 동일 함수에서 "읽음" 상태만 다르게 표시.

**구조적 리스크 낮음.** 확정된 비대칭 버그 없음.

---

## 4. 의견요청 (Opinions)

### [MED] 4-1. 리스트 카드에 투표/첨부 인디케이터 누락

- `_renderOpListItems` @ 4035: 카드에 제목(4049) + 답글 수 뱃지(4050) + 작성자/날짜(4051)만 표시
- `openOpinionDetail` @ 4056: 투표 UI(4100, 4124, `_voteRender` @ 4127), 첨부(4099), 답변(4103–4104) 모두 풀 렌더
- **리스트 쪽 누락:** `op.type==='vote'` 표시, `op.files` 유무 아이콘, 투표 마감 D-day

**재현:** 관리자/직원 모두, 의견요청 리스트를 보고 어떤 글이 투표 게시글인지 클릭 전에 구분할 수 없음. 중요하지는 않음.

**수정안:** 4050 아래에 `if(op.type==='vote') html+='<span style="...">🗳</span>';` 및 `if(op.files&&op.files.length) html+='<span>📎</span>';`

### [LOW] 4-2. 상세 모달과 리스트 카드 모두 동일 `sbGet` select — 비대칭 없음

- `renderOpinionList` 4025: `sbGet('staff_opinions','order=ts.desc&limit=50')` (전 컬럼)
- `openOpinionDetail` 4070: `sbGet('staff_opinions','id=eq.'+opId)` (전 컬럼)
- 필드 누락 리스크는 낮음. 기본적으로 대칭.

---

## 5. 보고 (Reports)

### [MED] 5-1. localStorage 기반이라 admin/user 비대칭 검증이 어려움

- `buildReportDashboard` @ 5705: `reports[projId]` (localStorage `tm_reports`) 기반 집계
- `openReportView` @ 5599, `openAllReports` @ 5621: 같은 local 소스 사용
- CLAUDE.md 기재: **"staff_reports: 보고 (localStorage tm_reports 사용 중 — Supabase 미이전)"**

**리스크:** 관리자 브라우저에서 본 보고와 직원 브라우저에서 본 보고가 **서로 다른 localStorage** 기반이라 완전히 분리됨. admin 뷰/user 뷰 문제라기보다 **기기 간 동기화 자체가 안 되는 근본 문제**.

**수정안:** 보고를 `staff_reports` 테이블로 이전하기 전까지는 구조적 비대칭 판정 불가. 이전 작업은 별도 태스크.

### [LOW] 5-2. `openReportView`에는 상태/체크리스트/파일 표시됨 — `openAllReports` 그리드와 일관됨

- 구조적으로는 한 소스에서 필터만 바꿔 보여주는 패턴이라 OK.

---

## 6. 데일리 (Daily)

### [MED] 6-1. 4개 렌더 경로 — 일부 기능 누락

- `renderDailyPage` @ 5852 → `renderEmpDailyChecklist` @ 5853: 풀 UI (헤더/프로그레스/아이템/**add 입력 포함**)
- `renderEmpDailyMini` @ 3686 (사이드바): 아이템 + `CU.id===empId`일 때만 입력창 (3703) — 본인 전용, 정상
- `renderEmpDailyTab` @ 3331: 체크리스트 + **본인일 때만 입력창 (3373)** — 정상
- 실제로는 4경로가 기능적으로 동등함. 사이드바 미니의 경우 입력창 조건이 있지만 본인 자기 보기에서는 뜸.

**재확인:** 에이전트가 "tab view에 입력 없음"이라 보고했으나, 3372–3377에 `CU&&CU.id===empId` 조건부 입력창이 실제로 존재. **오판정. 비대칭 없음.**

### [LOW] 6-2. 데이터 소스는 여전히 localStorage (`tm_daily_`, `tm_fixed_`)

- DB 동기화 없음 — 기기 간 불일치. 보고와 같은 카테고리의 제약.

---

## 7. 프로젝트 (Projects)

### [MED] 7-1. 리스트는 멤버 필터, 상세는 필터 없음

- `renderProjList` @ 5210 (정확히는 5214): `isAdmin()? projects : projects.filter(p.members.includes(CU.id))` — 비관리자는 본인이 멤버인 프로젝트만 목록에 표시
- `renderProjDetail` @ 5273: `var p = projects.find(...)` 후 멤버 체크 없이 바로 hero + tabs + tasks 전부 렌더

**재현:** 비관리자 사용자가 `showProjDetail('<다른 프로젝트 id>')` 를 직접 호출(콘솔이나 조작된 링크로)하면 본인이 멤버가 아닌 프로젝트의 업무 피드가 전부 표시됨. 관리자/멤버/비멤버 동일한 뷰.

**심각도:** 접근 제어 이슈이지 정확히 admin/user 렌더 비대칭은 아님. HIGH보다는 MED.

**수정안:** 5275 `if(!p)return;` 다음에
```js
if(!isAdmin() && CU && !p.members.includes(CU.id)){
  wrap.innerHTML='<div class="empty-state">이 프로젝트에 접근할 수 없습니다</div>';
  return;
}
```

### [LOW] 7-2. 프로젝트 스레드(`buildThread` @ 5796) 는 관리자/멤버 공통. 편집 버튼만 `isAdmin()` 분기(5287)

- 댓글/보고/파일 탭 모두 동일 함수로 렌더됨. 비대칭 없음.

---

## 8. 채팅 (Chat)

### [LOW] 8-1. 단일 렌더 경로 — 비대칭 없음

- `renderChatPage` @ 5942, `renderChannelList` @ 5954, `renderChatHeader` @ 5970, `renderChatMsgs` @ 5981, `renderChatInput` @ 6016 — 모두 역할 분기 없음.
- 채팅은 의도적으로 전원 공용이라 구조적 리스크 없음.

---

## Realtime 구독 감사

- `sb.channel(...)` / `.subscribe(...)` 전체 grep 결과 → **채팅만 realtime 구독**, 나머지(결재/업무/의견요청/공지/보고)는 **30초 폴링**(`pollForUpdates` + `showSyncBadge`)으로만 동기화. CLAUDE.md에도 명시됨.
- admin/user 모두 같은 폴링을 공유하므로 이 부분에서 구조적 비대칭은 없음.
- **리스크:** 폴링 중간(최대 30초 지연) 동안 댓글/상태 변화가 안 보이지만, 이건 admin/user 모두 동일.

---

## 섹션별 요약

| 섹션 | HIGH | MED | LOW |
|------|------|-----|-----|
| 결재 (Approval) | **1** | 1 | 1 |
| 업무 (Tasks) | 0 | 1 | 1 |
| 공지 (Notices) | 0 | 0 | 1 |
| 의견요청 (Opinions) | 0 | 1 | 1 |
| 보고 (Reports) | 0 | 1 | 1 |
| 데일리 (Daily) | 0 | 1 | 1 |
| 프로젝트 (Projects) | 0 | 1 | 1 |
| 채팅 (Chat) | 0 | 0 | 1 |
| **합계** | **1** | **6** | **8** |

HIGH 건은 단 1건이지만 **가장 자주 제보되는 경로에서의 기능 완전 누락**이므로 즉시 조치 필요.

---

## 구조적 리팩터링 제안

현재 버그 패턴은 "관리자 뷰와 직원 뷰를 각각 독립적으로 손대다 보니 한쪽에 추가한 기능을 반대쪽에 반영 잊음"으로 압축됨. 이를 구조적으로 막으려면:

### (a) 공통 카드 렌더 헬퍼 추출

각 엔터티별로 admin/user 공통 카드 렌더 함수를 분리:
```js
// 결재 카드 (상태별 조건부 UI는 옵션으로)
function renderApprovalCard(a, opts){
  // opts.showApproveActions: 승인/반려 버튼
  // opts.showRejectReasonEditor: 재상신 버튼
  // opts.showComments: 댓글 블록 (기본 true)
  // opts.showAttachments: 첨부 (기본 true)
  // → 항상 모든 공통 요소가 포함되도록 강제
}
```
`_empApvShowList` / `_empApvShowMyList` / `renderApprovalPage` 모두 이 헬퍼 하나만 호출하면, 첨부/댓글이 한곳만 수정되어도 세 경로에 일괄 반영됨.

### (b) 댓글 블록 일반화 — `renderCommentThread(entityType, entityId, container)`

현재 별도 구현되어 있는:
- `_apvLoadCmts` (결재)
- `renderInlineCmt` + `sendTaskCmt` (업무)
- `_opdRenderReplies` + `_opdSubmitReply` (의견요청)
- (아직 없음) 보고 댓글, 공지 댓글

를 단일 `comment-thread` 컴포넌트로 통합. entityType→(table, fk_column) 매핑 하나만 넘기면 로드/저장/알림까지 일관된 구현으로 처리.

### (c) 첨부 블록 일반화 — `renderFilesBlock(files, opts)`

현재 3종 공존:
- `renderAttachments` @ 3844 (결재/보고 공용)
- `renderOpinionAttachments` @ 3848 (의견요청 — 동영상/오디오 인라인 플레이어 포함)
- `renderTaskFiles` @ 3862 (업무 — 2-col grid + 삭제 버튼)

→ `renderFilesBlock(files, {mode:'inline'|'grid'|'media', allowDelete, onDelete})` 하나로 병합.

### (d) "쌍(pair)" 렌더 테스트

관리자/직원 dual path가 필요한 엔터티는 각 path의 출력에 필수 포함되어야 하는 요소 목록을 코드 안에 명시:
```js
const REQUIRED_SECTIONS = {
  approvalCard: ['header', 'body', 'attachments', 'comments', 'actions'],
  taskDetail: ['header', 'meta', 'checklist', 'attachments', 'comments'],
};
```
렌더 함수에 sentinel 주석(`// required: attachments`)을 붙이고 PR 체크리스트에 "양 경로 모두 REQUIRED_SECTIONS를 포함하는가?"를 추가.

### (e) 우선순위 순 적용 제안

1. **즉시:** `renderApprovalPage`에 댓글 블록/로더 추가 (HIGH 1-1). 15줄 내외 패치.
2. **다음 스프린트:** `renderApprovalCard` 헬퍼 추출 → 3경로 통합.
3. **중기:** 댓글/첨부 공통 헬퍼. 의견요청의 동영상 미리보기가 결재/업무에도 자연히 적용됨.
4. **장기:** 보고 Supabase 이전 후 admin/user 뷰 통합.
