// 공개 페이지 URL 목록 (단일 소스) — /admin/pages 와 자료모음 '운영 정보' 탭이 공유
export const BASE_URL = "https://www.dreamacademyph.com";

export interface PublicPage { url: string; label: string; desc: string; }

export const PUBLIC_PAGES: PublicPage[] = [
  { url: "/", label: "메인 홈", desc: "드림아카데미 메인 랜딩 페이지" },
  { url: "/summer", label: "여름 캠프", desc: "여름 프로그램 소개 페이지" },
  { url: "/booking", label: "올인원 예약", desc: "패키지 예약 접수 폼" },
  { url: "/booking2", label: "비패키지 예약", desc: "자유 일정 예약 접수 폼" },
  { url: "/accommodation", label: "숙소 안내", desc: "숙소 종류 및 요금 안내" },
  { url: "/dreamhouse-rooms", label: "드림하우스 룸", desc: "드림하우스 룸 상세 안내" },
  { url: "/playdream", label: "PlayDream", desc: "PlayDream 브랜드 페이지" },
  { url: "/pdallday", label: "PlayDream 올데이", desc: "PlayDream 올데이 프로그램" },
  { url: "/junior", label: "주니어 프로그램", desc: "주니어 영어 수업 안내" },
  { url: "/kinder", label: "킨더 프로그램", desc: "킨더 영어 수업 안내" },
  { url: "/package", label: "패키지 안내", desc: "전체 패키지 요금 안내" },
  { url: "/products", label: "결제 (상품)", desc: "상품 카드 스토어 · 결제" },
  { url: "/after-school-fieldtrip", label: "방과후/필드트립", desc: "방과후 수업 및 필드트립 안내" },
  { url: "/community", label: "커뮤니티", desc: "커뮤니티 게시판" },
  { url: "/notice", label: "공지사항", desc: "공지사항 페이지" },
  { url: "/guide", label: "가이드", desc: "이용 가이드 안내" },
  { url: "/tutor-apply", label: "튜터 지원", desc: "튜터 채용 지원 폼" },
  { url: "/install", label: "앱 설치", desc: "PWA 설치 안내 페이지" },
  { url: "/qr", label: "QR 페이지", desc: "QR 코드 랜딩" },
  { url: "/minedu", label: "민에듀", desc: "민에듀 전용 랜딩 (/mf-2025 리다이렉트)" },
];
