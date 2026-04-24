# 📋 드림아카데미 웹사이트 작업 To-Do

마지막 업데이트: 2026-04-24

---

## ✅ 완료된 작업

- [x] `/minedu` 공동구매 페이지 제작 (HTML 1개 파일)
- [x] 7개 탭 구성 (주니어/킨더 커리큘럼 · 드림하우스 · 제이파크 · 큐브나인 · 중요안내 · 예약신청)
- [x] 홈페이지 기존 이미지 자동 연동 (dreamhouse.jpg, jpark.png, cube9.png 등)
- [x] 제이파크 브로슈어 6장 페이지에 삽입
- [x] 큐브나인 브로슈어 8장 페이지에 삽입 (사용 6장 + 예비 2장)
- [x] 숙소별 패키지 포함 혜택을 공식 브로슈어 기준으로 통일

---

## 🚀 지금 할 일 — 민에듀 페이지 배포

### Step 1: `minedu/` 폴더 통째로 Vercel GitHub에 업로드

GitHub의 드림아카데미 저장소에서:

1. `public/` 폴더 안에 **`minedu`** 라는 새 폴더 만들기
2. 아래 파일 15개를 그 폴더에 전부 업로드:
   - `minedu.html` → **반드시 `index.html`로 파일명 변경해서 업로드** ⚠️
   - `jpark-about.jpg`
   - `jpark-waterpark.jpg`
   - `jpark-activities.jpg`
   - `jpark-room-deluxe.jpg`
   - `jpark-room-premier.jpg`
   - `jpark-room-mactan.jpg`
   - `cube9-about.jpg`
   - `cube9-overview.jpg`
   - `cube9-facilities.jpg`
   - `cube9-meals.jpg`
   - `cube9-room-deluxe-ocean.jpg`
   - `cube9-room-pool-access.jpg`
   - `cube9-cover.jpg` (예비)
   - `cube9-intro.jpg` (예비)

3. Commit 메시지: `Add /minedu landing page with brochure images`
4. Commit하면 Vercel이 자동 배포 → **www.dreamacademyph.com/minedu** 로 접속!

### Step 2: 배포 후 확인

- [ ] `www.dreamacademyph.com/minedu` 접속해서 모든 탭 정상 동작 확인
- [ ] 모바일에서도 레이아웃 깨짐 없는지 확인
- [ ] 7개 탭 사이 이동 테스트
- [ ] 예약 폼 submit 버튼 동작 확인 (현재는 프론트엔드만 작동 — 실제 제출 연결은 아래 Step 3)

### Step 3: 예약 폼 연결 (선택)

현재 폼 제출 시 "접수 완료" 메시지만 뜨고 실제로는 아무 데도 안 보내져요. 실제 연결하려면:
- **옵션 A**: Google Form으로 연결 (가장 쉬움)
- **옵션 B**: Notion Database API 연결
- **옵션 C**: 이메일 자동 발송 (Formspree, Web3Forms 등)

→ 원하는 옵션 정해지면 코드 수정해드릴 수 있어요.

---

## 📝 나중에 할 일 — 기존 숙소 본페이지 업데이트

민에듀 배포 마치고 여유 있을 때 진행할 작업입니다.

### 목표
- `www.dreamacademyph.com/accommodation/jpark` 본페이지를 새 브로슈어 6장으로 업데이트
- `www.dreamacademyph.com/accommodation/cubenine` 본페이지를 새 브로슈어 8장(또는 6장)으로 업데이트

### 필요한 것
현재 본페이지들이 **Next.js (React)** 컴포넌트로 작성되어 있어서, 제가 만든 순수 HTML 그대로 붙여넣을 수 없음. 기존 페이지 코드 파일이 필요:

- [ ] 제이파크 본페이지 소스 파일 준비 (보통 `app/accommodation/jpark/page.tsx` 형태)
- [ ] 큐브나인 본페이지 소스 파일 준비 (보통 `app/accommodation/cubenine/page.tsx` 형태)

### 진행 방법
위 소스 파일을 메이 → 클로드에게 전달하면:
1. 기존 구조 분석
2. 새 브로슈어 섹션을 기존 스타일과 자연스럽게 융합
3. 정확한 diff(수정 지점) 전달
4. 메이가 GitHub에 적용 → Vercel 자동 배포

### 이미지 위치 참고
- `public/images/` 폴더에 업로드하면 본페이지 + /minedu 모두에서 재사용 가능
- 본페이지 업데이트 시작할 때 이미지들을 `public/minedu/`에서 `public/images/`로도 복사하면 됨 (또는 추가 업로드)

---

## 💡 추가 개선 아이디어 (여유될 때)

- [ ] 주니어/킨더 커리큘럼 탭에 수업 현장 사진 추가
  - 현재 홈페이지의 "Class Photos" 섹션 사진을 Next.js Image 최적화 없이 직접 URL로 추출해서 넣기
  - 또는 새 사진을 `/public/images/junior-class-*.jpg` 형태로 업로드
- [ ] 민에듀 전용 할인 혜택 구체적 금액 삽입 (사이드바)
- [ ] 카카오톡 채널 아이디, 전화번호 등 실제 연락처 Footer에 채우기
- [ ] SEO 메타 태그 확인 (OG 이미지, 설명 등)

---

## 📂 파일 위치 정리

### 클로드가 만들어준 파일 (이 채팅 `outputs` 폴더)
- `minedu.html` — 로컬 미리보기용 (상대 경로 사용)
- `jpark-*.jpg` × 6
- `cube9-*.jpg` × 8

### Vercel에 업로드 후 구조
```
public/
├── minedu/
│   ├── index.html              ← minedu.html 이름 변경해서 업로드
│   ├── jpark-about.jpg
│   ├── jpark-waterpark.jpg
│   ├── ... (14장 전체)
└── images/
    ├── logo.png                ← 이미 있음
    ├── dreamhouse.jpg          ← 이미 있음
    ├── jpark.png               ← 이미 있음
    ├── cube9.png               ← 이미 있음
    └── ... (추후 본페이지 업데이트 시 새 브로슈어 이미지도 여기 복사)
```
