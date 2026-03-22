import { google } from "googleapis";

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const rawKey = process.env.GOOGLE_PRIVATE_KEY || "";
  const key = rawKey.replace(/\\n/g, "\n");
  return new google.auth.JWT({ email, key, scopes: ["https://www.googleapis.com/auth/spreadsheets"] });
}
function getSheets() { return google.sheets({ version: "v4", auth: getAuth() }); }

export interface StudentData {
  korName: string;
  engName: string;
  age: string;
  grade: string;       // 킨더 | 주니어
  classType: string;   // 오전 | 종일
  academyStart: string;
  academyEnd: string;
  academyWeeks: string;
  photo: string;       // O | X
}

export interface InvoiceSheetData {
  // 예약자
  name: string;
  englishName: string;
  reservationNo: string;
  reservationDate: string;
  balanceDate: string;
  // 숙소/일정
  accom: string;
  checkInDate: string;
  checkOutDate: string;
  people: string;
  houseNo: string;
  // 픽업
  pickup: string;
  drop: string;
  pickupPlace: string;
  flightIn: string;
  flightOut: string;
  // 결제
  packageType: string;
  basePrice: number;
  totalDiscount: number;
  finalPrice: number;
  // 학생 목록
  students: StudentData[];
  // 특이사항
  note: string;
  // 관리자 전용 (출력물 미표시)
  agency: string;
  ssp: string;
}

function pickdrop(accom: string): string {
  if (/드림하우스/i.test(accom)) return "드림하우스";
  if (/제이파크/i.test(accom)) return "제이파크";
  if (/큐브나인/i.test(accom)) return "큐브나인";
  return accom;
}

// 시트1: 패키지디테일 (예약 1건 = 1행)
export async function appendSheet1(data: InvoiceSheetData) {
  const sheets = getSheets();
  const studentNames = data.students.map(s => s.korName).join(", ");
  const pd = pickdrop(data.accom);
  const flightStr = (data.flightIn || data.flightOut)
    ? `IN:${data.flightIn || "미정"} / OUT:${data.flightOut || "미정"}`
    : "미정";
  const row = [
    "신규",           // 상태
    data.name,        // 예약자명
    data.checkInDate, // 체크인
    flightStr,        // 항공편
    data.pickupPlace || pd, // 픽업장소
    data.checkOutDate,// 체크아웃
    data.accom,       // 숙소
    studentNames,     // 학생이름
    data.people,      // 투숙인원
    data.students.map(s=>`${s.korName}(${s.academyWeeks})`).join(", "), // 아카데미기간
    data.agency,      // 유학원
    data.balanceDate, // 잔금일자
    data.note,        // 특이사항
  ];
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET1_ID,
    range: "패키지디테일!A:M",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

// 시트2: 디테일 (학생 수만큼 행 추가)
export async function appendSheet2(data: InvoiceSheetData) {
  const sheets = getSheets();
  const pd = pickdrop(data.accom);
  const today = new Date().toISOString().slice(0, 10);
  const rows = data.students.map(s => [
    s.academyStart,   // 시작
    s.academyEnd,     // 종료
    s.academyWeeks,   // 기간
    s.classType,      // 오전/종일
    s.grade,          // 킨더/주니어
    s.korName,        // 한글이름
    s.engName,        // 영어이름
    s.age,            // 나이
    data.packageType ? "O" : "X", // 패키지여부
    `픽업:${data.pickup} / 드롭:${data.drop}`, // 픽드롭
    "",               // 상세주소 (미사용)
    today,            // 등록일자
    data.note,        // 특이사항
    data.ssp,         // SSP
    s.photo,          // 사진허용
    data.agency,      // 유학원
    data.name,        // 예약자명
  ]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET2_ID,
    range: "디테일!A:Q",
    valueInputOption: "USER_ENTERED",
    requestBody: { values: rows },
  });
}
