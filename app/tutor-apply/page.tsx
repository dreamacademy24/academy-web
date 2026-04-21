import type { Metadata } from "next";
import TutorApplyForm from "./TutorApplyForm";

export const metadata: Metadata = {
  title: "튜터 수업 신청 — 드림아카데미",
  description: "드림하우스 투숙객 튜터 수업 신청 (방문 수업)",
};

export default function Page() {
  return <TutorApplyForm />;
}
