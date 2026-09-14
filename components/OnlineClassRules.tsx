import s from './OnlineClassRules.module.css';

export default function OnlineClassRules() {
  return <section className={s.rules} aria-label="화상영어 취소·변경 및 환불 규정">
    <h3>취소·변경 신청과 회차 차감</h3>
    <ul>
      <li><strong>수업일 4일 전까지 신청:</strong> 회차 차감 없이 일정 변경·보강이 가능합니다.</li>
      <li><strong className={s.warning}>수업일 3일 전부터 당일 취소:</strong> 해당 수업 1회가 차감됩니다.</li>
      <li><strong>사전 신청 없이 미접속:</strong> 해당 수업 1회가 차감됩니다.</li>
      <li>현지 정전 등 학원 사정으로 수업이 취소되면 회차 차감 없이 보강합니다.</li>
    </ul>
    <p className={s.example}><strong>예: 금요일 수업이라면</strong><br />월요일 밤 11시 59분까지 신청하면 차감 없이 조정합니다. 화요일부터 취소하면 1회가 차감됩니다. <span>(한국 시간 기준)</span></p>
    <p>취소·요일·시간 변경은 <strong>드림게스트 앱 → 화상영어</strong>에서 신청해주세요. 앱을 이용하기 어려우면 마감 전에 담당자에게 연락해주세요.</p>
    <h3>수강료 환불 규정</h3>
    <ul>
      <li><strong>수업 시작 전:</strong> 납부한 수강료 전액 환불</li>
      <li><strong>시작 후 총 수업 횟수의 1/3 경과 전:</strong> 납부한 수강료의 2/3 환불</li>
      <li><strong>총 수업 횟수의 1/2 경과 전:</strong> 납부한 수강료의 1/2 환불</li>
      <li><strong>총 수업 횟수의 1/2 이상 경과:</strong> 환불 불가</li>
    </ul>
    <p>이벤트로 제공된 무료 수업 회차는 환불 금액 산정에 포함되지 않습니다. 수강료 환불은 담당자에게 요청해주세요.</p>
  </section>;
}
