const { google } = require('googleapis');
require('dotenv').config({ path: '.env.local' });

async function main() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

  const headers = [
    '상태','예약번호','담당자','예약자명','영문이름',
    '체크인','체크아웃','숙소','하우스번호','투숙인원',
    '학생이름(한글)','학생이름(영문)','나이','킨더/주니어',
    '아카데미시작','아카데미종료','아카데미기간','오전/종일',
    '항공편IN','항공편OUT','픽업장소','픽업','드롭',
    '유학원','잔금일자','SSP','사진허용',
    '패키지금액','할인','최종금액','특이사항','등록일자'
  ];

  // 기존 1행 전체 삭제 후 새로 입력
  await sheets.spreadsheets.values.clear({
    spreadsheetId: process.env.SHEET3_ID,
    range: '시트1!A1:AF1',
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: process.env.SHEET3_ID,
    range: '시트1!A1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [headers] },
  });

  console.log('✅ 헤더 입력 완료!', headers.length, '개 컬럼');
}

main().catch(console.error);
