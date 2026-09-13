# 이야기 중심 개편

사용자 피드백: 현재 앱은 너무 단어·학습 중심이다. 도요새처럼 전체 이야기와 애니메이션이 학습을 이끌어야 한다.

최신 시각 제작 기준은 아래 **전체 앱의 입체적 시각 방향 (2026-09-13)** 을 따른다. 앞부분의 구현·검증 기록은 당시 작업 범위를 설명하며, 전체 앱의 그래픽 완성을 뜻하지 않는다.

## 확인한 공개 자료

- 교원 빨간펜 공식 영상: https://www.youtube.com/watch?v=YByCaMJFf34
- 도요새 스토리팝 X 리지의 스토리타임 [신데렐라 편]. 브라우저로 1:15 도입, 2:02~2:27 첫 표현의 이야기 상황, 7:12~7:22 두 번째 표현과 캐릭터 동작 장면을 확인했다. 전체 영상을 모두 시청했다는 뜻은 아니다.
- 시연에서 인물의 상황·감정·대사가 선행하고 이야기 속 표현을 다룬다는 점을 참고했다. 원본 캐릭터·영상·대사를 앱에 복제하지 않았다.
- 공식 소개: https://m.kyowon.co.kr/Media/News_detail?iscont=&nttId=735&searchword= — 3D 애니메이션과 인터랙티브북 설명.

## 구현 변경

- /learn/tree-house: 단어 워크시트 대신 9개 이야기 장면을 연결했다.
- 호기심: 나무집 창문 너머에는 무엇이 있을까?
- 도입 → 나무 위 집 발견 → 아빠와 사다리 오르기 → 문 세 번 두드리기 → 창문 열기 → 할아버지의 그림인 것을 발견 → 함께 책 펼치기 → 내 문장·손글씨·목소리 남기기 → 아빠와 안전하게 내려오며 작별.
- 교재의 인물·사건·정글 그림이라는 반전을 유지하고, 장면 전환을 위한 짧은 대사를 각색했다. 원문 전체와 기존 8단어 활동은 /learn/tree-house/practice에서 다시 볼 수 있다.
- 카메라 이동, 잎 움직임, 문 회전, 창문 여닫기, 책 표지 펼침, 장면 전환을 CSS로 구현. 움직임 끄기와 reduced-motion을 지원한다.
- 새 이야기 위치와 창작 내용은 별도의 IndexedDB 키에 저장하여 기존 단어 학습 기록을 보존한다.

## 구현 한계와 다음 제작 기준

현재 결과는 그림에 웹 인터랙션과 움직임을 결합한 이야기 초안이다. 도요새 시연처럼 캐릭터가 실제로 걷고 오르고 표정을 바꾸며 대화하는 완성 애니메이션은 아직 아니다. 이를 완료했다고 표현해서는 안 된다.

최종 제작에는 바비·미아·아빠·할아버지의 일관된 캐릭터 연기, 장면별 영상, 대사 녹음과 타이밍, 두드림·발걸음·창문·책장 효과음이 필요하다. 정지 그림 확대 이동만으로 이 제작 단계를 대체했다고 보지 않는다.

## 검증

브라우저에서 집 발견, 사다리 3회, 문 3회, 창문 열기, 붓 발견, 책 펼치기의 성공 반응과 다음 이야기 연결을 확인했다. 새 컴포넌트 ESLint 오류 0개. 음성은 기기 TTS이며 원어민 성우 녹음이 아니다.

## 사용자가 지정한 주 참고 영상
https://www.youtube.com/watch?v=JeUIspxOqGc — 도요새중국어 독서 마당 A, B과정 리뉴얼 소개 (Short ver.). 브라우저에서 0:20 테마별 서재, 0:41 작가·콘텐츠 소개, 0:54~1:00 애니메이션·반응형 전자책 등 콘텐츠 예시, 1:20 관심 도서 화면을 확인했다. 앞으로의 시각적 목표는 인물·세계관이 있는 이야기 경험이며, 현 웹 화면의 단순 카메라 이동을 완성 캐릭터 애니메이션으로 간주하지 않는다.
추가 사용자 요청으로 집 발견 버튼의 ‘저기! 작은 집!’ 한글 텍스트를 없애고 집 아이콘을 표시했다. 다른 한글 안내 전체 삭제 요청으로 확대 해석하지 않았다.


## Story-integrated practice (2026-09-12)
- Dialogue words and illustrated contextual word cards open the existing Player in place. Adventure remains mounted, preserving scene, interactions, sentence and ink; return restores focus to the originating word.
- Embedded Player retains shared IndexedDB evidence, spelling, handwriting and recordings; hides global navigation and returns to the story after speaking. Recording busy state prevents an in-app return while saving or capturing.
- Added a three-pair matching activity with distinct word and picture selections, retry feedback, completion evidence and keyboard-operable buttons. Available in standalone practice too.
- Spelling success reads the current story sentence. Contextual sentence playback remains visible above activities.
- Verified in browser: house from dialogue opens house, wrong match retries, three pairs complete, spelling submission, same-scene return with discovery state and keyboard focus preserved. TypeScript and targeted ESLint checked.
- New reference posts: https://www.threads.com/@dalkom__mom/post/DTXxPcUktvf and https://www.threads.com/@ammas__choice/post/DbqJAHIEQwX . Text retrieved; embedded video playback not verified. First describes letter sounds, word completion, sentence rearrangement and resulting animation. Do not represent these reference features as all implemented: phoneme audio, sentence rearrangement and full character animation remain separate production work.

## 후속 기획 결정
사용자가 제안한 게임과 높은 레벨 활용 원칙은 [게임 아이디어 기록](learning-game-ideas.md)을 따른다. 현재 초급 단원에 모든 게임을 넣지 않으며, 기본 학습 후 게임으로 이해를 확인하는 방향이다.

## 전체 앱의 입체적 시각 방향 (2026-09-13)

사용자의 핵심 정정은 게임 종류를 더 추가하는 것이 아니라, 앱 전체를 최신 3D 애니메이션 학습게임처럼 느끼게 만드는 것이다. 사용자가 말한 ‘4D 같은 느낌’은 화면 안에 들어간 듯한 깊이·생동감·반응성을 뜻한다. 전용 4D 장치, 입체안경, 물리적 촉각 효과를 제공한다는 약속으로 해석하지 않는다.

### 제작에 사용할 설명

> 망고 드림이와 고래상어 친구가 아이를 안내하는 밝고 따뜻한 시네마틱 3D 학습 모험. 화면 대부분을 깊이 있는 나무집과 숲의 공간으로 채우고, 앞쪽의 잎·중간의 캐릭터·뒤쪽의 집과 풍경이 서로 다른 거리에 보이게 한다. 캐릭터는 말랑한 장난감 같은 입체적 재질, 자연스러운 눈빛과 표정, 목적이 있는 몸짓을 가진다. 아이가 물체를 누르면 드림이가 그쪽을 보고 다가가며, 카메라·햇빛·그림자·물체의 움직임과 소리가 같은 행동에 맞춰 반응한다. 인트로, 아이 선택, 레벨 이동, 이야기, 듣기·말하기·쓰기, 마지막 확인 게임까지 같은 세계·캐릭터·조명·재질을 유지한다. 설명은 짧게, 다음 행동은 공간 속에서 분명하게 보여준다.

### 화면과 움직임의 공통 기준

- **공간:** 나무집·계단·숲을 실제 무대로 구성한다. 전경·중경·배경, 물체의 가림과 크기 차이, 접촉 그림자로 깊이를 만든다. 인터랙션 대상은 캐릭터와 같은 공간에 놓는다.
- **캐릭터:** 망고 드림이와 고래상어 친구를 유지한다. 드림이의 시선, 고개, 손짓, 걷기·멈추기, 기대·격려·기쁨을 연결하고 고래상어도 시선과 지느러미·꼬리로 함께 반응한다. 기존 교재의 인물과 사건은 학습 이야기의 내용으로 보존한다.
- **반응:** 터치 → 캐릭터가 알아차림 → 해당 물체로 시선·몸이 향함 → 물체와 빛·소리의 반응 → 다음 행동으로 이어지는 순서를 설계한다. 카메라 이동은 행동을 보여주는 데 사용하고 정답을 고르는 동안 화면은 안정적으로 유지한다.
- **전 과정의 일관성:** 인트로에서 본 캐릭터의 비율·재질·색·빛을 아이 선택과 레벨 이동에도 이어간다. 스토리에서 만난 나무·문·글자 등의 물체가 학습과 마지막 게임에도 같은 모습으로 등장하도록 한다. 글자와 조작부는 읽기 쉬운 크기와 위치를 유지한다.
- **학습 보존:** 이야기 속 단어 짚기, 느린 영어 읽기, 단어 찾기·매칭·철자 조합, 직접 입력·터치 필기, 단어·문장 녹음, 마지막 게임 확인을 유지한다. 새 업무 메뉴나 별도 앱 메뉴를 늘리는 요구가 아니다. 아이·방문별 배정과 기록 분리도 유지한다.

### 현재 코드에서 확인한 출발점과 남은 간격

2026-09-13 소스 확인 기준이며, 아래 내용만으로 새 시각 방향이 구현·배포되었다고 안내하지 않는다.

| 영역 | 확인한 현재 구현 | 새 방향에서 추가로 검증할 것 |
| --- | --- | --- |
| 캐릭터 | `lib/learning/dreamy-models.mjs`의 실제 Three.js 망고·고래상어 메시와 애니메이션, `components/learning/Dreamy.tsx`의 이미지 표시 및 선택적 실시간 캔버스 | 세계 안에서 물체를 보고 이동·접촉하는 연기, 두 친구 사이의 상호 반응 |
| 시작과 아이 선택 | `app/learn/page.tsx`는 `LearningWelcome` 다음에 `LearnerHome`을 표시한다. `LearnerHome.tsx`는 아이 선택 버튼과 교재 이미지·시작 버튼을 사용한다. | 소개 이후에도 같은 입체 공간과 캐릭터가 이어지는 경험 |
| 이야기 | `components/learning/Adventure.tsx`는 `scene.webp`와 `story.webp` 그림, 단어 버튼, 장면별 인터랙션을 사용한다. | 이야기 전체 환경의 입체감, 장면 속 인물 연기와 행동에 연동된 카메라·물체 반응 |
| 마지막 게임 | `components/learning/FinalMission.tsx`는 나무집 이미지, 그림·매칭·철자 활동과 실시간 드림이를 함께 사용한다. | 캐릭터와 게임 대상이 같은 공간에 존재하고 행동 결과가 그 공간을 바꾸는 표현 |

실제 3D 캐릭터와 소개 영상이 있다는 것과 전체 앱이 연속된 3D 세계라는 것은 서로 다른 구현 범위다. 현재의 학습 기능을 유지하며 위 간격을 좁힌다.

### 먼저 확인할 20~30초 대표 플레이

전체 화면을 한 번에 교체하기 전에, 기존 첫 단원 안에서 나무집 앞 한 장면을 실제로 조작할 수 있게 제작해 시각 기준을 확인하는 방안을 제안한다. 다음 시간은 예시이며 아이의 응답을 재촉하는 제한 시간이 아니다.

1. **0~5초:** 드림이와 고래상어가 나무집 앞에서 아이를 맞는다. 공간의 깊이, 햇빛, 발밑 그림자, 캐릭터의 시선이 한 화면에 보인다.
2. **5~12초:** 나무를 터치하면 드림이가 바라보고 가리킨다. 잎이 반응하고 `tree`를 천천히 읽는다. 카메라는 같은 공간 안에서 대상을 보여준다.
3. **12~20초:** 아이가 들은 단어를 짚거나 글자를 조합한다. 조작 중에는 카메라를 안정시키고, 성공·재시도 반응을 캐릭터와 물체로 보여준다. 녹음은 기존 기능으로 연결하며, 음성 인식 정답 판정이 구현됐다고 간주하지 않는다.
4. **20~30초:** 배운 단어로 작은 마지막 확인을 마치면 친구들이 기뻐하고 나무집의 다음 길이 열린다. 다음 이야기로 넘어갈 목표가 공간에 드러난다.

검증은 정지 화면의 예쁨뿐 아니라 ‘아이가 누른 행동을 캐릭터와 공간이 알아차리는가’, ‘인트로와 같은 캐릭터로 느껴지는가’, ‘학습 내용과 다음 목표가 분명한가’를 포함한다. 실제 사용 휴대전화·태블릿에서 터치 반응, 읽기와 음성 타이밍, 로딩과 움직임, 작은 화면 가독성을 확인한다. 움직임 감소 설정에서도 단서와 학습을 유지한다. 이 대표 플레이를 확인한 뒤 같은 기준을 아이 선택·레벨 이동과 나머지 장면에 확장한다.

### 콘셉트 이미지와 실제 구현의 구분

이번에 내장 이미지 생성으로 만든 망고 드림이·파란 고래상어·나무집·계단·햇빛·접촉 그림자의 대표 장면은 **시각 방향 확인용 정지 콘셉트**다. 사용자에게 미리보기로 제시했으며 앱 자산으로 연결하지 않았다. 실제 앱의 화면, 재생 가능한 애니메이션, 터치에 반응하는 구현의 완성을 의미하지 않는다.

콘셉트에서 승인할 것은 캐릭터 인상, 공간 깊이, 재질·조명, 화면에서 세계가 차지하는 비중이다. 이후 실제 플레이에서 확인할 것은 캐릭터 연기, 입력 반응, 카메라와 물체의 움직임, 소리와 학습의 연결이다. 정지 콘셉트를 움직이는 것처럼 설명하거나 기존 영상·캔버스 구현을 이 새 콘셉트의 완성판으로 안내하지 않는다.

이미 사용할 수 있는 내장 도구와 현재 구현을 우선 활용한다. 이 방향 기록은 외부 유료 서비스 구독, GPU 구매, 게임 엔진 전환을 결정하거나 추가 비용을 승인하는 문서가 아니다.
