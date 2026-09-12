import {readFileSync,writeFileSync} from 'node:fs';
const file=new URL('./build-student-care-guides.mjs',import.meta.url);
let s=readFileSync(file,'utf8');
const changes=[
 ['테스트 가이드 · 2026.09.12','직원 가이드 · 2026.09.12'],
 ['TEST GUIDE · 12 SEP 2026','STAFF GUIDE · 12 SEP 2026'],
 ['현재 테스트 대상의 사용 안내입니다. 실제 학생 자료를 입력하기 전, 관리자가 안내한 테스트 주소와 테스트 계정을 사용하세요. 운영 적용 여부는 별도 배포 안내를 확인해주세요.','학생 케어 기능을 운영 사이트에서 사용합니다. 처음에는 관리자가 학생 몇 명의 신원과 방문 기간을 확인하고 연결한 뒤 담당 선생님에게 안내해주세요. 저장한 내용은 실제 기록에 반영됩니다.'],
 ['This guide covers the current test release. Use the test URL and accounts provided by your administrator before entering any student information. A separate release notice will confirm production availability.','Student Care is available on the live website. Administrators should begin with a small number of verified students and visits, then inform their assigned teachers. Saved changes are real records.'],
 ['함께 확인할 테스트','초기 사용 점검'],['Test checklist','First-use checklist'],
 ['이번 테스트에서는 학습모드와 학생 케어를 중심으로 확인하고 실제 결제나 신청을 만들지 마세요.','기존 신청·예약 업무는 종전과 같이 이용합니다. 새 기능을 확인하기 위한 가짜 결제나 신청은 만들지 마세요.'],
 ['Focus this test on learning and student care; do not create real payments or applications.','Continue using existing application and booking tools as usual. Do not create dummy payments or applications to check the new features.'],
 ['테스트에는 개인 정보가 들어간 녹음을 사용하지 마세요.','녹음할 때는 불필요한 개인정보를 말하지 않도록 안내해주세요.'],
 ['Use recordings without personal information during testing.','Avoid unnecessary personal information in recordings.'],
 ['테스트 주소','접속 주소'],['test URL','page URL'],
 ['06 · 배포 전 함께 확인','06 · 초기 사용 점검'],['테스트 계정으로 한 번씩 진행하세요','관리자가 소수 학생부터 확인하세요'],
 ['테스트 학생을 연결하고, 재방문을 추가해도 이전 방문이 남는다.','확인한 학생을 연결하고, 실제 재방문을 추가해도 이전 방문이 남는다.'],
 ['06 · Test together','06 · First-use checks'],['Complete these checks with test accounts','Start with a small number of verified students'],
 ['A test student can be linked and a return visit added without replacing the first visit.','A verified student can be linked and an actual return visit added without replacing the first visit.'],
 ];
for(const [from,to] of changes)s=s.replaceAll(from,to);
writeFileSync(file,s);
