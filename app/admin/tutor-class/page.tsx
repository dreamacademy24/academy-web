import { Suspense } from "react";
import TutorClassPage from "./TutorClassPage";

export const metadata = {
  title: "튜터 수업 관리 | 드림아카데미",
};
export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TutorClassPage />
    </Suspense>
  );
}
