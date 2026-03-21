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

export const categoryMap = {
  free: { label: "자유게시판", color: "#6b7c93", bg: "#f1f5f9", border: "#e2e8f0" },
  review: { label: "후기", color: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  question: { label: "질문", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
} as const;
