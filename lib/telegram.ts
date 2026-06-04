// 텔레그램 그룹 알림 헬퍼 — 서버 전용. 클라이언트 컴포넌트에서 import 금지.
// 토큰은 절대 NEXT_PUBLIC_ 으로 노출하지 않는다 (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).

// HTML parse_mode 사용 → 사용자 입력의 <, >, & 이스케이프
export function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// 신청 시각 한 줄 (현지시간 = 필리핀 Asia/Manila). 실패 시 빈 문자열.
export function localTimeLine(): string {
  try {
    const t = new Date().toLocaleString("ko-KR", {
      timeZone: "Asia/Manila",
      dateStyle: "medium",
      timeStyle: "short",
    });
    return `🕒 신청 시각: ${t} (현지시간)`;
  } catch {
    return "";
  }
}

export async function sendTelegram(text: string): Promise<void> {
  try {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!token || !chatId) return; // 미설정 시 조용히 무시
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch (e) {
    // best-effort — 절대 throw 하지 않음
    console.error("[telegram] send failed:", e);
  }
}
