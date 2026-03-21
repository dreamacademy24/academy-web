export interface Post {
  id: number;
  category: "free" | "review" | "question";
  title: string;
  author: string;
  date: string;
  views: number;
  comments: number;
  content: string;
}

export const posts: Post[] = [
  {
    id: 1,
    category: "review",
    title: "드림아카데미 한 달 후기 - 아이가 정말 달라졌어요!",
    author: "김○○",
    date: "2026.03.19",
    views: 342,
    comments: 12,
    content:
      "안녕하세요, 7세 아들과 함께 한 달 과정을 마치고 돌아온 엄마입니다.\n\n처음에는 아이가 영어를 한마디도 못 해서 걱정이 많았는데, 선생님들이 정말 잘 이끌어주셔서 2주차부터 간단한 문장을 말하기 시작했어요.\n\n특히 좋았던 점:\n- 1:1 수업이라 아이 수준에 맞춰 진행\n- 에프터스쿨 프로그램이 다양해서 아이가 지루해하지 않음\n- 드림하우스 숙소가 깨끗하고 편안함\n- 헬퍼 서비스 덕분에 생활이 정말 편했음\n\n다음 겨울방학에도 꼭 다시 올 예정입니다. 강력 추천합니다!",
  },
  {
    id: 2,
    category: "question",
    title: "제이파크 vs 큐브나인 어떤 숙소가 좋을까요?",
    author: "박○○",
    date: "2026.03.17",
    views: 189,
    comments: 8,
    content:
      "여름방학에 아이 둘(5세, 8세) 데리고 갈 예정인데요.\n\n제이파크와 큐브나인 사이에서 고민 중입니다.\n\n제이파크는 워터파크가 좋다고 하고, 큐브나인은 조용하고 오션뷰가 예쁘다고 하던데...\n\n아이들 연령대가 비슷한 분들 경험담 부탁드립니다!\n특히 수영장이나 아이들 놀거리 기준으로 어떤 게 나을지 궁금해요.",
  },
  {
    id: 3,
    category: "free",
    title: "세부 맛집 리스트 공유합니다 (현지 추천)",
    author: "이○○",
    date: "2026.03.15",
    views: 521,
    comments: 15,
    content:
      "3개월째 세부에서 지내고 있는 엄마입니다.\n그동안 다녀본 맛집들 정리해봤어요!\n\n■ 한식\n- 88식당: 제휴 할인 10%, 김치찌개 추천\n- 모리: 일식인데 한국인 입맛에 맞음, 제휴 10% 할인\n- 세부닭: 치킨이 맛있어요, 제휴 10% 할인\n\n■ 현지 맛집\n- Zubuchon: 레촌(통돼지구이) 맛집, 필수 방문\n- Lantaw: 오션뷰 레스토랑, 분위기 좋음\n- Casa Verde: 양 많고 맛있는 미국식 레스토랑\n\n■ 카페\n- The Snow Dessert Cafe (제이파크 내): 빙수 맛있어요\n- Abaca Baking Company: 빵이 진짜 맛있음\n\n더 궁금한 곳 있으시면 댓글 주세요!",
  },
  {
    id: 4,
    category: "review",
    title: "킨더 라인 수업 후기 (5세 아이)",
    author: "정○○",
    date: "2026.03.12",
    views: 156,
    comments: 6,
    content:
      "5세 딸아이와 2주 킨더 라인 수업을 받았습니다.\n\n솔직히 5세면 너무 어리지 않나 걱정했는데, 선생님이 놀이 위주로 수업을 진행해주셔서 아이가 정말 즐거워했어요.\n\n매일 알파벳 노래 부르고, 색칠하면서 영어 단어 배우고, 간단한 게임도 하더라구요.\n\n2주 만에 색깔, 숫자, 과일 이름 정도는 영어로 말할 수 있게 되었습니다.\n\n플레이드림 Making Line도 같이 했는데 만들기하면서 영어 쓰니까 일석이조였어요.\n\n킨더 라인 고민하시는 분들 참고하세요!",
  },
  {
    id: 5,
    category: "question",
    title: "SSP 비용 현장에서 바로 결제 가능한가요?",
    author: "최○○",
    date: "2026.03.08",
    views: 98,
    comments: 3,
    content:
      "다음 달에 출발 예정인데요.\n\nSSP(특별학습허가증) 비용을 미리 송금해야 하나요, 아니면 현장에서 결제 가능한가요?\n\n그리고 SSP-i card도 꼭 필요한 건지, 선택사항인지 궁금합니다.\n\n교재비도 현장 결제 가능한지 알려주세요.\n\n감사합니다!",
  },
];

export const categoryMap = {
  free: { label: "자유게시판", color: "#6b7c93", bg: "#f1f5f9", border: "#e2e8f0" },
  review: { label: "후기", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  question: { label: "질문", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
} as const;
