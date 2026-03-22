import { google } from "googleapis";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  const key = rawKey.replace(/\\n/g, "\n");

  return new google.auth.JWT(email, undefined, key, [
    "https://www.googleapis.com/auth/spreadsheets",
  ]);
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

// 숙소 → 픽드롭 매핑
function pickdrop(accom: string): string {
  if (/드림하우스/i.test(accom)) return "드림하우스";
  if (/제이파크/i.test(accom)) return "제이파크";
  if (/큐브나인/i.test(accom)) return "큐브나인";
  return accom;
}

export interface ReceiptData {
  // 고객 정보
  name: string;            // 예약자명
  englishName: string;     // 영문이름
  checkInDate: string;     // 체크인
  checkOutDate: string;    // 체크아웃
  flightIn: string;        // 항공편 IN
  flightOut: string;       // 항공편 OUT
  accom: string;           // 숙소
  packageType: string;     // 패키지 종류
  people: string;          // 인원 구성
  pickup: string;          // 픽업 여부
  drop: string;            // 드롭 여부

  // 학생 정보
  studentName: string;     // 학생 한글이름
  studentEnglish: string;  // 학생 영어이름
  studentAge: string;      // 나이/생년월일
  studentType: string;     // 킨더/주니어
  amOrFull: string;        // 오전/종일
  academyWeeks: string;    // 아카데미 기간
  peopleCount: string;     // 투숙 인원
  houseNo: string;         // 상세주소 (하우스번호)

  // 기타
  agency: string;          // 유학원
  balanceDate: string;     // 잔금일자
  note: string;            // 특이사항
  ssp: string;             // SSP
  photoPermit: string;     // 사진 허용
  registrationDate: string;// 등록일자
}

// 시트1: 패키지디테일 탭
export async function appendSheet1(data: ReceiptData) {
  const sheets = getSheets();
  const pd = pickdrop(data.accom);
  const row = [
    "신규",                // 상태
    data.name,            // 예약자명
    data.checkInDate,     // 체크인
    `IN: ${data.flightIn} / OUT: ${data.flightOut}`, // 항공편
    pd,                   // 픽업장소
    data.checkOutDate,    // 체크아웃
    data.accom,           // 숙소
    data.studentName,     // 학생이름
    data.peopleCount,     // 투숙인원
    data.academyWeeks,    // 아카데미기간
    data.agency,          // 유학원
    data.balanceDate,     // 잔금일자
    data.note,            // 특이사항
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET1_ID,
    range: "패키지디테일!A:M",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

// 시트2: 디테일 탭
export async function appendSheet2(data: ReceiptData) {
  const sheets = getSheets();
  const pd = pickdrop(data.accom);
  const row = [
    data.checkInDate,     // 시작
    data.checkOutDate,    // 종료
    data.academyWeeks,    // 기간
    data.amOrFull,        // 오전/종일
    data.studentType,     // 킨더/주니어
    data.studentName,     // 한글이름
    data.studentEnglish,  // 영어이름
    data.studentAge,      // 나이/생년월일
    data.packageType ? "O" : "X", // 패키지여부
    pd,                   // 픽드롭
    data.houseNo,         // 상세주소
    data.registrationDate || new Date().toISOString().slice(0, 10), // 등록일자
    data.note,            // 특이사항
    data.ssp,             // SSP
    data.photoPermit,     // 사진허용
    data.agency,          // 유학원
    data.name,            // 예약자명
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET2_ID,
    range: "디테일!A:Q",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}
