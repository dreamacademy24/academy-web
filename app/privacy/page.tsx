export const metadata = { title: "개인정보처리방침 · 드림아카데미" };

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 60px", fontFamily: "'Noto Sans KR',sans-serif", color: "#1a1a2e", lineHeight: 1.8 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 6 }}>개인정보처리방침</h1>
      <p style={{ fontSize: 13, color: "#6b7c93", marginBottom: 24 }}>드림아카데미(세부드림아카데미) · 시행일 2026-06-28</p>

      <Section n="1. 수집하는 개인정보 항목">
        예약·연수 진행을 위해 다음 정보를 수집합니다: 신청자(보호자) 성함·연락처·이메일, 자녀(학생) 성명·생년·영문이름, 예약·항공·숙소·체크인 정보, 셔틀/픽업/튜터 신청 내역, 결제 관련 정보(결제는 PayPal 등 외부 결제사를 통해 처리되며 카드정보는 당사가 저장하지 않습니다), 푸시 알림 수신을 위한 기기 토큰.
      </Section>
      <Section n="2. 개인정보의 이용 목적">
        예약 접수·확인·정산, 셔틀·픽업·튜터·화상영어 등 부가 서비스 신청 처리, 일정·공지 안내 및 알림 발송, 고객 문의 응대, 법령상 의무 이행을 위해 이용합니다.
      </Section>
      <Section n="3. 보유 및 이용 기간">
        수집 목적 달성 후 지체 없이 파기하며, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 안전하게 보관 후 파기합니다.
      </Section>
      <Section n="4. 제3자 제공">
        원칙적으로 개인정보를 외부에 제공하지 않습니다. 다만 결제 처리(PayPal), 현지 픽업·셔틀·숙소 운영 등 서비스 제공에 필요한 최소한의 범위에서 위탁·연계될 수 있으며, 법령에 근거가 있는 경우에 한해 제공될 수 있습니다.
      </Section>
      <Section n="5. 이용자의 권리">
        이용자는 언제든지 본인의 개인정보 열람·정정·삭제·처리정지를 요청할 수 있습니다. 요청은 아래 연락처로 접수해 주세요.
      </Section>
      <Section n="6. 개인정보 보호">
        개인정보는 접근 권한이 통제된 환경에서 관리되며, 안전한 전송·저장을 위해 노력합니다.
      </Section>
      <Section n="7. 문의처">
        이메일: admin@dreamacademyph.com · 카카오톡 채널: @세부드림아카데미
      </Section>
    </div>
  );
}

function Section({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 15.5, fontWeight: 700, marginBottom: 6 }}>{n}</h2>
      <p style={{ fontSize: 14, color: "#374151" }}>{children}</p>
    </div>
  );
}
