// 한글 초성 → 로마자 변환
export function getKoreanInitials(name: string): string {
  const choList = ['G','K','N','D','T','R','M','B','P','S','S','','J','J','C','K','T','P','H'];
  const jungVowels = ['A','YA','EO','YEO','O','YO','U','YU','EU','I','AE','E','WA','WAE','OE','WO','WE','WI','UI','EI','I'];
  let result = '';
  for (const char of name) {
    const code = char.charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3) {
      const offset = code - 0xAC00;
      const choIdx = Math.floor(offset / (21 * 28));
      const jungIdx = Math.floor((offset % (21 * 28)) / 28);
      if (choIdx === 11) { // ㅇ → 뒤 모음 첫 글자
        result += (jungVowels[jungIdx] || 'A')[0];
      } else {
        result += choList[choIdx] || '';
      }
    }
  }
  return result.toUpperCase();
}

// 포털 아이디 자동생성: 이니셜 + 예약번호 뒷4자리
export function generatePortalId(bookerName: string, reservationNo: string): string {
  const initials = getKoreanInitials(bookerName);
  const suffix = (reservationNo || '').replace(/\D/g, '').slice(-4);
  return (initials + suffix).slice(0, 8);
}

// 임시 비번 자동생성: Dream + 4자리 랜덤
export function generateTempPassword(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `Dream${num}!`;
}
