import {createClient} from '@supabase/supabase-js';
const base='https://www.dreamacademyph.com';
const response=await fetch(base+'/api/staff/session',{method:'POST',signal:AbortSignal.timeout(20000)});
if(response.status!==401||!response.headers.get('cache-control')?.includes('no-store'))throw new Error('Session release is not ready');
if(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname!=='yiglafscjvjgkxpycevk.supabase.co')throw new Error('Unexpected project');
const db=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const id='student-care-session-menu-20260912';
const title='[수정 안내] 로그인 유지·학생관리 메뉴 통합 / Sign-in & Student Menu';
const {data:existing,error:readError}=await db.from('staff_notices').select('id,title,require_read').or(`id.eq.${id},title.eq.${title}`);
if(readError)throw readError;
if(!existing.length){
 const text='<h3>학생 업무를 한곳에서 확인하세요 / Find student tools in one menu</h3><p>왼쪽 상위 메뉴 <b>학생관리</b>를 열면 <b>학생관리 · 학생케어 / 방문 이력 · 튜터 · 화상영어 · 학생케어 사용 가이드</b>가 나옵니다. 예약·정산 업무는 예약·아카데미 메뉴에서 사용합니다.</p><p>Open <b>학생관리 (Student Management)</b> in the sidebar for the student directory, Student Care / Visit History, tutor classes, online English and the care guide. Booking and settlement tools remain under 예약·아카데미.</p><ol><li><b>학생 찾기:</b> 학생관리 → 학생케어 · 방문 이력 → 이름 검색 → 이번 방문 확인 → 담당 선생님 배정.<br><b>Find a student:</b> Student Management → Student Care / Visit History → search by name → check the visit → assign the teacher.</li><li><b>로그인 유지:</b> 관리자 업무·Teacher Hub·학생케어 화면을 사용 중이면 서버 로그인을 주기적으로 갱신합니다. 일시적인 연결 오류에는 ‘다시 확인 / Retry’를 눌러주세요.<br><b>Stay signed in:</b> The admin workspace, Teacher Hub and Student Care renew an active server session. Use Retry for temporary connection errors.</li><li><b>이미 만료된 로그인:</b> ‘로그인하고 돌아오기’를 눌러 한 번 로그인하면 보던 학생 화면으로 돌아옵니다. 기존 로그인 표시만 남았을 때 관리자 홈과 로그인 화면 사이를 반복하던 동작을 수정했습니다.<br><b>Already expired:</b> Select Sign in and return. After signing in, you return to the page you were viewing. The repeated redirect caused by stale browser sign-in information has been fixed.</li></ol><p>현지 선생님은 Teacher Hub → My Students에서 배정받은 방문을 확인합니다. 기존 학생·방문·담당자 이력과 공지 읽음 상태는 유지됩니다.<br>Local teachers use Teacher Hub → My Students for assigned visits. Student records, visit and assignment history, and existing notice-read states are preserved.</p><p><a href="https://www.dreamacademyph.com/admin/view?src=%2Fstaff%2Fstudents">학생케어 열기 / Open Student Care</a> · <a href="https://www.dreamacademyph.com/staff-guides/student-care/ko.html">한글 가이드</a> · <a href="https://www.dreamacademyph.com/staff-guides/student-care/en.html">English guide</a></p>';
 const {error}=await db.from('staff_notices').insert({id,title,text,date:new Date().toISOString(),require_read:false,done:false,files:[]});
 if(error)throw error;
}
const {data:notice,error}=await db.from('staff_notices').select('id,title,require_read').eq('id',id).maybeSingle();
if(error)throw error;
console.log(JSON.stringify({notice:notice||existing[0],inserted:!existing.length,existingStatesPreserved:true}));
