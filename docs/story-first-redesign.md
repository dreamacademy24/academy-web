# 이야기 중심 개편

사용자 피드백: 현재 앱은 너무 단어·학습 중심이다. 도요새처럼 전체 이야기와 애니메이션이 학습을 이끌어야 한다.

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
