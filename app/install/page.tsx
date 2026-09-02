import type { Metadata } from "next";
import InstallClient from "./InstallClient";

/* 앱별 manifest를 서버에서 처음부터 내려준다.
   (기존엔 클라이언트 JS가 늦게 교체 → Chrome이 기본 manifest를 먼저 읽고
    옛 'Dream Academy' 앱과 동일 앱으로 오인해 "이미 설치됨"이 뜨는 문제) */

const META: Record<string, { name: string; manifest: string }> = {
  guest: { name: "드림아카데미", manifest: "/manifest-guest.webmanifest" },
  admin: { name: "드림 관리자", manifest: "/manifest-admin.webmanifest" },
  staff: { name: "Dream Staff", manifest: "/manifest-staff.webmanifest" },
};

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<{ app?: string }> }
): Promise<Metadata> {
  const { app } = await searchParams;
  const key = app === "admin" ? "admin" : app === "staff" ? "staff" : "guest";
  const m = META[key];
  return {
    title: m.name,
    manifest: m.manifest,
    appleWebApp: { capable: true, title: m.name },
  };
}

export default function InstallPage() {
  return <InstallClient />;
}
