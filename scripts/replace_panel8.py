import re

with open('public/pdallday/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

new_panel8 = '''<section class="panel" id="panel-8">
  <div class="panel-head">
    <div>
      <div class="panel-eyebrow">IMPORTANT NOTICES · 반드시 확인</div>
      <h2 class="panel-title">주요 안내사항</h2>
    </div>
    <p class="panel-sub">예약 전 꼭 확인해 주셔야 할 결제·취소 규정 및 패키지별 안내입니다.</p>
  </div>

  <div style="max-width:900px;margin:0 auto;padding:0 20px 80px">

    <!-- 1. 예약 절차 -->
    <div style="margin-bottom:48px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:20px">📋</span><h3 style="font-size:20px;font-weight:800;color:#1f2937;margin:0">예약 절차</h3></div>
      <div style="width:40px;height:3px;background:#e8533f;border-radius:2px;margin-bottom:16px"></div>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px">아래 4단계로 진행되며, 모든 입금은 입실일 기준 2개월 전까지 완료되어야 합니다.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px">
          <div style="width:32px;height:32px;border-radius:50%;background:#e8533f;color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;margin-bottom:12px">1</div>
          <div style="font-weight:700;color:#1f2937;margin-bottom:6px;font-size:14px">예약 신청 &amp; 상담</div>
          <div style="color:#6b7280;font-size:13px;line-height:1.6">예약 신청서 작성 → 매니저가 1~2일 내 연락 → 일정·인원·숙소 확정</div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px">
          <div style="width:32px;height:32px;border-radius:50%;background:#e8533f;color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;margin-bottom:12px">2</div>
          <div style="font-weight:700;color:#1f2937;margin-bottom:6px;font-size:14px">예약금 납부</div>
          <div style="color:#6b7280;font-size:13px;line-height:1.6">입금 확인 후 등록 완료. 숙소별 금액 상이 (아래 ③ 항목 참조)</div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px">
          <div style="width:32px;height:32px;border-radius:50%;background:#e8533f;color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;margin-bottom:12px">3</div>
          <div style="font-weight:700;color:#1f2937;margin-bottom:6px;font-size:14px">잔금 납부</div>
          <div style="color:#6b7280;font-size:13px;line-height:1.6">입실일 기준 2개월 전까지 전액 납부. 미납 시 자동 취소될 수 있습니다.</div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px">
          <div style="width:32px;height:32px;border-radius:50%;background:#e8533f;color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;margin-bottom:12px">4</div>
          <div style="font-weight:700;color:#1f2937;margin-bottom:6px;font-size:14px">출국 &amp; 입실</div>
          <div style="color:#6b7280;font-size:13px;line-height:1.6">해외여행자 보험 가입 후 출국 → 공항 픽업 → 입실. 체크인 오후 3시 / 체크아웃 정오 12시. 수업은 매주 월요일에만 시작 (일요일 입실 권장)</div>
        </div>
      </div>
    </div>

    <!-- 2. 공통 유의사항 -->
    <div style="margin-bottom:48px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:20px">⚠️</span><h3 style="font-size:20px;font-weight:800;color:#1f2937;margin:0">공통 유의사항</h3></div>
      <div style="width:40px;height:3px;background:#e8533f;border-radius:2px;margin-bottom:16px"></div>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px">전 패키지 공통으로 적용되는 이용·참여 규정입니다.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:20px">
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px">
          <div style="font-weight:700;color:#1f2937;margin-bottom:12px;font-size:14px">🏠 숙소 이용</div>
          <ul style="color:#4b5563;font-size:13px;line-height:1.9;padding-left:16px;margin:0">
            <li>모든 숙소는 <strong>밤 10시 이후 정숙 유지</strong> 원칙</li>
            <li>타 가정 방문, 과도한 소음, 폭언·폭력 등 위반 시 즉시 퇴소 및 환불 불가</li>
            <li>드림하우스는 필리핀 현지 이웃과 함께 생활하는 빌리지로, 닭 울음·개 짖음·파티 등 생활 소음 가능성 있음 (문화 차이 이해 필수)</li>
            <li>얼리 체크인·레이트 체크아웃 시 추가 요금 발생</li>
          </ul>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px">
          <div style="font-weight:700;color:#1f2937;margin-bottom:12px;font-size:14px">👨‍👩‍👧 프로그램 참여</div>
          <ul style="color:#4b5563;font-size:13px;line-height:1.9;padding-left:16px;margin:0">
            <li>플레이드림 내 보호자 대기 공간이 없으며, 분리 수업으로 진행됩니다</li>
            <li>보호자 분들은 수업 공간 입실이 불가합니다</li>
            <li>30개월 이상, 분리 수업이 가능한 아동만 신청 가능합니다</li>
            <li>부모님과의 분리가 어렵거나 수업 참여가 어려운 경우 수업 진행이 어려울 수 있으며, 이로 인한 수업 취소 또는 중도 퇴실 시 환불은 불가합니다</li>
            <li>올데이 프로그램 수업 구성 변경 불가 / 당일 수업 도중 테마변경도 불가합니다</li>
            <li>수업 일정 변경은 수업일 <strong>4일전 인품 시에만</strong> 가능합니다</li>
          </ul>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px">
          <div style="font-weight:700;color:#1f2937;margin-bottom:12px;font-size:14px">🛡️ 보험 안내</div>
          <ul style="color:#4b5563;font-size:13px;line-height:1.9;padding-left:16px;margin:0">
            <li><strong>출국 전 해외여행자 보험 가입 필수 권장</strong></li>
            <li>미가입으로 인한 손해에 대해서는 학원에서 책임지지 않습니다</li>
            <li>여권 유효기간은 출국일 기준 6개월 이상이어야 함</li>
          </ul>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px">
          <div style="font-weight:700;color:#1f2937;margin-bottom:12px;font-size:14px">📌 기타 안내</div>
          <ul style="color:#4b5563;font-size:13px;line-height:1.9;padding-left:16px;margin:0">
            <li>객실/하우스 배정 및 수업 일정은 양측 사정에 따라 변경될 수 있습니다</li>
            <li>예약 내용, 포함 사항, 납부금, 이용 규정 등 모든 안내 확인은 고객의 책임입니다</li>
            <li>미확인으로 인한 불이익에 대해서는 당사에서 책임지지 않습니다</li>
            <li>본 규정은 <strong>등록 시 자동 동의된 것</strong>으로 간주됩니다</li>
            <li>드림컴퍼니는 운영상 필요에 따라 규정을 보완할 수 있습니다</li>
          </ul>
        </div>
      </div>
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:10px;padding:16px">
        <p style="color:#991b1b;font-size:13px;margin:0">💗 <strong>등록 및 환불 규정 미숙지로 인한 피해는 보상되지 않으므로,</strong> 모든 규정을 반드시 확인 후 신중히 결정해 주세요.</p>
      </div>
    </div>

    <!-- 3. 패키지별 예약금 & 정원 -->
    <div style="margin-bottom:48px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:20px">💳</span><h3 style="font-size:20px;font-weight:800;color:#1f2937;margin:0">패키지별 예약금 &amp; 정원</h3></div>
      <div style="width:40px;height:3px;background:#e8533f;border-radius:2px;margin-bottom:16px"></div>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px">숙소에 따라 예약금과 수용 인원이 다릅니다. 신중하게 선택해 주세요.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">
        <div style="background:white;border:2px solid #f97316;border-radius:14px;padding:22px">
          <div style="font-weight:800;color:#ea580c;margin-bottom:12px;font-size:15px">🏠 드림하우스 (3룸 독채)</div>
          <div style="color:#374151;font-size:13px;line-height:1.9">
            <div>예약금 <strong>1채당 100만원</strong> · 잔금 입실 2개월 전까지</div>
            <div style="margin:6px 0"><span style="background:#fef3c7;color:#92400e;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">📅 1월 4일 개강만 가능</span></div>
            <div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:6px">
              <div>패키지 정원: <strong>최대 6인</strong></div>
              <div>체크인 15:00 / 체크아웃 12:00</div>
              <div>보증금 8,000페소 (현지, 4주 기준)</div>
              <div>전기세·유료 서비스는 보증금에서 차감</div>
              <div>전기세 14페소/KW (실사용량 기준)</div>
            </div>
          </div>
        </div>
        <div style="background:white;border:2px solid #0ea5e9;border-radius:14px;padding:22px">
          <div style="font-weight:800;color:#0284c7;margin-bottom:12px;font-size:15px">🌊 제이파크 리조트</div>
          <div style="color:#374151;font-size:13px;line-height:1.9">
            <div>예약금 <strong>총 금액의 50%</strong> · 잔금 입실 2개월 전까지</div>
            <div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px">
              <div>패키지 정원: <strong>최대 4인</strong> (성인 최대 2인)</div>
              <div>체크인 15:00 / 체크아웃 12:00</div>
              <div>객실 확보를 위해 50% 선입금 필요</div>
              <div>리조트 기본 운영 규정 준수 필수</div>
            </div>
          </div>
        </div>
        <div style="background:white;border:2px solid #8b5cf6;border-radius:14px;padding:22px">
          <div style="font-weight:800;color:#7c3aed;margin-bottom:12px;font-size:15px">🌀 큐브나인 리조트</div>
          <div style="color:#374151;font-size:13px;line-height:1.9">
            <div>예약금 <strong>총 금액의 50%</strong> · 잔금 입실 2개월 전까지</div>
            <div style="border-top:1px solid #f3f4f6;padding-top:10px;margin-top:10px">
              <div>패키지 정원: <strong>최대 4인</strong> (성인 최대 2인)</div>
              <div>체크인 15:00 / 체크아웃 12:00</div>
              <div>객실 확보를 위해 50% 선입금 필요</div>
              <div>리조트 기본 운영 규정 준수 필수</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 4. 환불 및 변경 규정 -->
    <div style="margin-bottom:48px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:20px">🔄</span><h3 style="font-size:20px;font-weight:800;color:#1f2937;margin:0">환불 및 변경 규정 (전 패키지 공통)</h3></div>
      <div style="width:40px;height:3px;background:#e8533f;border-radius:2px;margin-bottom:16px"></div>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px">등록 후 환불·변경은 원칙적으로 불가하므로 신중히 결정 부탁드립니다.</p>
      <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:20px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f9fafb">
            <th style="padding:12px 20px;text-align:left;font-size:13px;color:#374151;font-weight:700;border-bottom:1px solid #e5e7eb">시점</th>
            <th style="padding:12px 20px;text-align:left;font-size:13px;color:#374151;font-weight:700;border-bottom:1px solid #e5e7eb">환불 가능 여부</th>
          </tr></thead>
          <tbody>
            <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:14px 20px;font-size:13px;color:#374151">출국 6주 전 취소</td><td style="padding:14px 20px;font-size:13px;color:#16a34a;font-weight:600">예약금 제외, 잔금의 50% 환불 가능</td></tr>
            <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:14px 20px;font-size:13px;color:#374151">출국 6주 이내 취소</td><td style="padding:14px 20px;font-size:13px;color:#dc2626;font-weight:600">환불 불가</td></tr>
            <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:14px 20px;font-size:13px;color:#374151">입실 후 중도 퇴실</td><td style="padding:14px 20px;font-size:13px;color:#dc2626;font-weight:600">환불 불가 (개인 사정 사유)</td></tr>
            <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:14px 20px;font-size:13px;color:#374151">일정 변경</td><td style="padding:14px 20px;font-size:13px;color:#dc2626;font-weight:600">등록 완료 후 불가 (불가항력 사유 제외)</td></tr>
            <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:14px 20px;font-size:13px;color:#374151">부분 변경·취소</td><td style="padding:14px 20px;font-size:13px;color:#dc2626;font-weight:600">불가 (예: 숙소만 / 수업만 / 식사 제외 등)</td></tr>
          </tbody>
        </table>
      </div>
      <div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;padding:20px;margin-bottom:20px">
        <div style="font-weight:700;color:#991b1b;margin-bottom:10px;font-size:14px">💸 전액 입금 후 취소 시 환불 안내</div>
        <p style="color:#7f1d1d;font-size:13px;margin:0 0 8px">예약금만 납부하셨든, 잔금까지 전액 납부하셨든 위 환불 규정이 동일하게 적용됩니다. 전액 입금 시점과 무관하게 <strong>취소 시점</strong>을 기준으로 차액이 환불됩니다.</p>
        <ul style="color:#7f1d1d;font-size:13px;line-height:1.9;padding-left:16px;margin:0 0 8px">
          <li>출국 6주 전 취소 → 예약금 제외, 잔금의 50% 환불 (전액 납부자도 동일)</li>
          <li>출국 6주 이내 취소 → 환불 불가 (전액 납부자도 동일)</li>
        </ul>
        <p style="color:#991b1b;font-size:12px;margin:0">예) 드림하우스 전액 입금 후 6주 전 취소: 예약금 100만원 + 잔금의 50%를 제외한 차액 환불</p>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
        <div style="background:white;border:1px solid #e5e7eb;border-left:4px solid #6b7280;border-radius:12px;padding:20px">
          <div style="font-weight:700;color:#374151;margin-bottom:10px;font-size:14px">🌪️ 자연재해 &amp; 불가항력 사유</div>
          <ul style="color:#4b5563;font-size:13px;line-height:1.9;padding-left:16px;margin:0">
            <li>태풍, 지진, 홍수, 항공편 결항 등으로 수업이 불가능한 경우 일정 조정 가능</li>
            <li>단, 숙소 및 학원이 정상 운영 가능한 경우 환불·변경 불가</li>
            <li>드림 측과 사전 협의 후 조율됩니다</li>
          </ul>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-left:4px solid #f59e0b;border-radius:12px;padding:20px">
          <div style="font-weight:700;color:#374151;margin-bottom:10px;font-size:14px">🏥 중대 질병·출국 불가 사유</div>
          <ul style="color:#4b5563;font-size:13px;line-height:1.9;padding-left:16px;margin:0">
            <li>적용 대상: 투숙인 본인 및 직계가족까지의 사유에 한해 인정</li>
            <li>암·수술 등 연수 기간 내 치료 불가 질환 (의사 소견서 제출)</li>
            <li>정부 명령·질병·입원 등으로 인한 출국 불가 증빙</li>
            <li>치료 기간이 연수 기간을 초과함을 증빙할 서류 제출</li>
            <li>위 조건 충족 시 일부 일정 조정 가능</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 5. 패키지별 추가 비용 -->
    <div style="margin-bottom:48px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:20px">💰</span><h3 style="font-size:20px;font-weight:800;color:#1f2937;margin:0">패키지별 추가 비용 (현지 지불)</h3></div>
      <div style="width:40px;height:3px;background:#e8533f;border-radius:2px;margin-bottom:16px"></div>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px">아래 비용은 패키지 금액에 포함되지 않습니다.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px">
          <div style="font-weight:700;color:#ea580c;margin-bottom:12px;font-size:14px">🏠 드림하우스 추가 비용</div>
          <ul style="color:#4b5563;font-size:13px;line-height:1.9;padding-left:16px;margin:0">
            <li>보증금: 독채 1채당 8,000페소 (4주 기준)</li>
            <li>전기세: 14페소/KW</li>
          </ul>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:20px">
          <div style="font-weight:700;color:#0284c7;margin-bottom:12px;font-size:14px">🌊 제이파크 / 🌀 큐브나인 추가 비용</div>
          <ul style="color:#4b5563;font-size:13px;line-height:1.9;padding-left:16px;margin:0">
            <li style="color:#9ca3af">※ 보증금·전기세는 리조트 패키지에 포함</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 6. 보호자 추가 인원 요금 -->
    <div style="margin-bottom:48px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:20px">👨‍👩‍👧</span><h3 style="font-size:20px;font-weight:800;color:#1f2937;margin:0">보호자 추가 인원 요금 (1인 1주일 기준)</h3></div>
      <div style="width:40px;height:3px;background:#e8533f;border-radius:2px;margin-bottom:16px"></div>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px">기본 패키지 인원 외에 보호자가 추가로 함께하실 경우 아래 요금이 적용됩니다.</p>
      <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;margin-bottom:16px">
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:#f9fafb">
            <th style="padding:12px 20px;text-align:left;font-size:13px;font-weight:700;color:#374151;border-bottom:1px solid #e5e7eb">숙소</th>
            <th style="padding:12px 20px;text-align:left;font-size:13px;font-weight:700;color:#374151;border-bottom:1px solid #e5e7eb">추가 보호자 1인 요금 (1주일 기준)</th>
            <th style="padding:12px 20px;text-align:left;font-size:13px;font-weight:700;color:#374151;border-bottom:1px solid #e5e7eb">비고</th>
          </tr></thead>
          <tbody>
            <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:14px 20px;font-size:13px;color:#374151;font-weight:600">🏠 드림하우스</td><td style="padding:14px 20px;font-size:13px;color:#e8533f;font-weight:700">170,000원</td><td style="padding:14px 20px;font-size:13px;color:#6b7280">정원 내 가능 · 동일 패키지 포함사항 이용 가능</td></tr>
            <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:14px 20px;font-size:13px;color:#374151;font-weight:600">🌊 제이파크</td><td style="padding:14px 20px;font-size:13px;color:#e8533f;font-weight:700">180,000원</td><td style="padding:14px 20px;font-size:13px;color:#6b7280">정원 내 가능 · 동일 패키지 포함사항 이용 가능</td></tr>
            <tr style="border-bottom:1px solid #f3f4f6"><td style="padding:14px 20px;font-size:13px;color:#374151;font-weight:600">🌀 큐브나인</td><td style="padding:14px 20px;font-size:13px;color:#e8533f;font-weight:700">150,000원</td><td style="padding:14px 20px;font-size:13px;color:#6b7280">정원 내 가능 · 동일 패키지 포함사항 이용 가능</td></tr>
          </tbody>
        </table>
      </div>
      <div style="background:#fef9f0;border:1px solid #fde68a;border-radius:10px;padding:16px">
        <div style="font-weight:700;color:#92400e;margin-bottom:8px;font-size:13px">📌 보호자 추가 인원 안내</div>
        <ul style="color:#78350f;font-size:13px;line-height:1.9;padding-left:16px;margin:0">
          <li>기본 패키지 인원 구성 외에 보호자가 1명 더 함께 오시는 경우의 요금입니다</li>
          <li>정원 내에서만 추가 가능합니다 (드림하우스 6인 / 제이파크·큐브나인 4인)</li>
          <li>추가 보호자도 셔틀 등 패키지 포함 사항을 그대로 이용하실 수 있습니다</li>
          <li>정확한 금액은 인원·기간·시즌에 따라 다를 수 있어 카카오 채널 상담을 통해 확인 부탁드립니다</li>
        </ul>
      </div>
    </div>

    <!-- 7. 선택 가능 유료 서비스 -->
    <div style="margin-bottom:48px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:20px">➕</span><h3 style="font-size:20px;font-weight:800;color:#1f2937;margin:0">선택 가능 유료 서비스</h3></div>
      <div style="width:40px;height:3px;background:#e8533f;border-radius:2px;margin-bottom:16px"></div>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px">필요 시 선택 가능한 추가 서비스 안내입니다.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px">
        <div style="background:white;border:1px solid #e5e7eb;border-top:3px solid #f97316;border-radius:12px;padding:20px">
          <div style="font-weight:800;color:#ea580c;margin-bottom:14px;font-size:14px">🏠 드림하우스</div>
          <div style="font-size:13px;color:#374151;line-height:1.9">
            <div style="font-weight:600;margin-bottom:4px">가족 추가 투숙 (1인 1박, 최대 4박)</div>
            <div style="color:#6b7280;margin-bottom:10px;padding-left:8px">· 평일: 1,000페소<br>· 주말: 1,500페소</div>
            <div style="font-weight:600;margin-bottom:4px">연장 수업 (튜터)</div>
            <div style="color:#6b7280;margin-bottom:10px;padding-left:8px">· 1:1 수업: 300페소<br>· 1:2 수업: 350페소</div>
            <div style="font-weight:600;margin-bottom:4px">비자연장</div>
            <div style="color:#6b7280;margin-bottom:10px;padding-left:8px">4,160페소 + 수수료 500페소</div>
            <div style="font-weight:600;margin-bottom:4px">공항 추가 픽드랍</div>
            <div style="color:#6b7280;padding-left:8px">픽업 ₩1,000 / 드랍 ₩800</div>
          </div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-top:3px solid #0ea5e9;border-radius:12px;padding:20px">
          <div style="font-weight:800;color:#0284c7;margin-bottom:14px;font-size:14px">🌊 제이파크</div>
          <div style="font-size:13px;color:#374151;line-height:1.9">
            <div style="font-weight:600;margin-bottom:4px">추가 숙박 (룸 당, 최대 3박)</div>
            <div style="color:#6b7280;margin-bottom:4px;padding-left:8px">· 디럭스: ₩260,000<br>· 프리미어: ₩300,000<br>· 막탄스위트: ₩370,000</div>
            <div style="color:#9ca3af;font-size:12px;margin-bottom:10px;padding-left:8px">※ 2인 기준, 성수기·인원·서차지에 따라 변동</div>
            <div style="font-weight:600;margin-bottom:4px">가족 추가 투숙 (최대 3박)</div>
            <div style="color:#6b7280;margin-bottom:10px;padding-left:8px">무료 / 셔틀 이용 불가</div>
            <div style="font-weight:600;margin-bottom:4px">연장 수업 (튜터)</div>
            <div style="color:#6b7280;margin-bottom:10px;padding-left:8px">· 1:1 수업: 300페소<br>· 1:2 수업: 350페소</div>
            <div style="font-weight:600;margin-bottom:4px">비자연장 / 공항 추가 픽드랍</div>
            <div style="color:#6b7280;padding-left:8px">비자연장 4,160+500페소<br>픽업 ₩1,000 / 드랍 ₩800</div>
          </div>
        </div>
        <div style="background:white;border:1px solid #e5e7eb;border-top:3px solid #8b5cf6;border-radius:12px;padding:20px">
          <div style="font-weight:800;color:#7c3aed;margin-bottom:14px;font-size:14px">🌀 큐브나인</div>
          <div style="font-size:13px;color:#374151;line-height:1.9">
            <div style="font-weight:600;margin-bottom:4px">추가 숙박 (룸 당, 최대 3박)</div>
            <div style="color:#6b7280;margin-bottom:4px;padding-left:8px">· 디럭스: ₩180,000<br>· 풀익세스: ₩230,000</div>
            <div style="color:#9ca3af;font-size:12px;margin-bottom:10px;padding-left:8px">※ 2인 기준, 성수기·인원·서차지에 따라 변동</div>
            <div style="font-weight:600;margin-bottom:4px">가족 추가 투숙 (최대 3박)</div>
            <div style="color:#6b7280;margin-bottom:10px;padding-left:8px">$10 조식 비용 / 셔틀 이용 불가</div>
            <div style="font-weight:600;margin-bottom:4px">연장 수업 (튜터)</div>
            <div style="color:#6b7280;margin-bottom:10px;padding-left:8px">· 1:1 수업: 300페소<br>· 1:2 수업: 350페소</div>
            <div style="font-weight:600;margin-bottom:4px">비자연장 / 공항 추가 픽드랍</div>
            <div style="color:#6b7280;padding-left:8px">비자연장 4,160+500페소<br>픽업 ₩1,000 / 드랍 ₩800</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 8. 2026 전체 휴무 일정 -->
    <div style="margin-bottom:48px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px"><span style="font-size:20px">📅</span><h3 style="font-size:20px;font-weight:800;color:#1f2937;margin:0">2026 전체 휴무 일정</h3></div>
      <div style="width:40px;height:3px;background:#e8533f;border-radius:2px;margin-bottom:16px"></div>
      <p style="color:#6b7280;font-size:14px;margin-bottom:20px">아래 일정에 센터 및 드림센터(헬퍼, 셔틀)가 휴무합니다. 출국일 계획 시 참고해 주세요.</p>
      <div style="display:flex;gap:20px;margin-bottom:20px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#374151"><span style="width:12px;height:12px;border-radius:50%;background:#fbbf24;display:inline-block"></span>센터 + 드림센터(헬퍼, 셔틀) 모두 휴무</div>
        <div style="display:flex;align-items:center;gap:6px;font-size:13px;color:#374151"><span style="width:12px;height:12px;border-radius:50%;background:#34d399;display:inline-block"></span>드림센터(헬퍼, 셔틀)만 추가 휴무</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;margin-bottom:20px">
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px"><div style="font-weight:800;font-size:14px;color:#1f2937;margin-bottom:10px">1월 <span style="color:#9ca3af;font-weight:400;font-size:12px">JAN</span></div><div style="font-size:13px;line-height:2"><div><span style="width:10px;height:10px;border-radius:50%;background:#fbbf24;display:inline-block;margin-right:6px"></span>1일 (목) <span style="color:#6b7280">신정</span></div><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>2일 (금)</div></div><div style="margin-top:8px;font-size:12px;color:#e8533f;font-weight:600">📌 센터 방학 ~1/3</div></div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px"><div style="font-weight:800;font-size:14px;color:#1f2937;margin-bottom:10px">2월 <span style="color:#9ca3af;font-weight:400;font-size:12px">FEB</span></div><div style="font-size:13px;color:#9ca3af;font-style:italic">휴무 없음</div></div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px"><div style="font-weight:800;font-size:14px;color:#1f2937;margin-bottom:10px">3월 <span style="color:#9ca3af;font-weight:400;font-size:12px">MAR</span></div><div style="font-size:13px;line-height:2"><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>20일 (금)</div></div></div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px"><div style="font-weight:800;font-size:14px;color:#1f2937;margin-bottom:10px">4월 <span style="color:#9ca3af;font-weight:400;font-size:12px">APR</span></div><div style="font-size:13px;line-height:2"><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>2일 (목)</div><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>3일 (금)</div><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>4일 (토)</div></div></div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px"><div style="font-weight:800;font-size:14px;color:#1f2937;margin-bottom:10px">5월 <span style="color:#9ca3af;font-weight:400;font-size:12px">MAY</span></div><div style="font-size:13px;line-height:2"><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>1일 (금) <span style="color:#6b7280">노동절</span></div><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>29일 (금)</div></div></div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px"><div style="font-weight:800;font-size:14px;color:#1f2937;margin-bottom:10px">6월 <span style="color:#9ca3af;font-weight:400;font-size:12px">JUN</span></div><div style="font-size:13px;line-height:2"><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>12일 (금)</div></div></div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px"><div style="font-weight:800;font-size:14px;color:#1f2937;margin-bottom:10px">7월 <span style="color:#9ca3af;font-weight:400;font-size:12px">JUL</span></div><div style="font-size:13px;color:#9ca3af;font-style:italic">휴무 없음</div></div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px"><div style="font-weight:800;font-size:14px;color:#1f2937;margin-bottom:10px">8월 <span style="color:#9ca3af;font-weight:400;font-size:12px">AUG</span></div><div style="font-size:13px;line-height:2"><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>9일 (일) <span style="color:#6b7280">아이언맨</span></div></div><div style="margin-top:8px;background:#fffbeb;border-radius:6px;padding:6px 8px;font-size:12px;color:#92400e">⚠️ 8/9 도로통제로 투어셔틀 X</div></div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px"><div style="font-weight:800;font-size:14px;color:#1f2937;margin-bottom:10px">9월 <span style="color:#9ca3af;font-weight:400;font-size:12px">SEP</span></div><div style="font-size:13px;line-height:2"><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>24일 (목)</div><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>25일 (금)</div><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>26일 (토)</div></div></div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px"><div style="font-weight:800;font-size:14px;color:#1f2937;margin-bottom:10px">10월 <span style="color:#9ca3af;font-weight:400;font-size:12px">OCT</span></div><div style="font-size:13px;line-height:2"><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>9일 (금) <span style="color:#6b7280">한글날</span></div><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>30일 (금)</div><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>31일 (토)</div></div></div>
        <div style="background:white;border:1px solid #e5e7eb;border-radius:12px;padding:16px"><div style="font-weight:800;font-size:14px;color:#1f2937;margin-bottom:10px">11월 <span style="color:#9ca3af;font-weight:400;font-size:12px">NOV</span></div><div style="font-size:13px;line-height:2"><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>27일 (금)</div></div></div>
        <div style="background:white;border:2px solid #fca5a5;border-radius:12px;padding:16px"><div style="font-weight:800;font-size:14px;color:#dc2626;margin-bottom:10px">12월 <span style="color:#9ca3af;font-weight:400;font-size:12px">DEC</span></div><div style="font-size:13px;line-height:2"><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>24일 (목)</div><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>25일 (금) <span style="color:#6b7280">크리스마스</span></div><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>26일 (토)</div><div><span style="width:10px;height:10px;border-radius:50%;background:#34d399;display:inline-block;margin-right:6px"></span>28~30일</div><div><span style="width:10px;height:10px;border-radius:50%;background:#fbbf24;display:inline-block;margin-right:6px"></span>31일 (목)</div></div><div style="margin-top:8px;font-size:12px;color:#e8533f;font-weight:600">📌 센터 방학 12/24~1/3</div></div>
      </div>
      <div style="background:#fef9f0;border:1px solid #fde68a;border-radius:12px;padding:20px">
        <div style="font-weight:700;color:#92400e;margin-bottom:10px;font-size:14px">📌 휴무 관련 중요 안내</div>
        <ul style="color:#78350f;font-size:13px;line-height:1.9;padding-left:16px;margin:0">
          <li>휴무 기간에는 수업, 투어셔틀, 헬퍼 서비스가 운영되지 않습니다</li>
          <li>식사는 기존 일정대로 정상 제공됩니다</li>
          <li style="color:#dc2626;font-weight:600">⚠️ 비수기 휴무에 대한 별도 환불이나 보강은 없습니다</li>
          <li>8월 9일 · 아이언맨 행사로 인한 도로통제 → 투어셔틀 운영 불가</li>
        </ul>
      </div>
    </div>

  </div>
</section>'''

# panel-8 섹션 교체 (section 태그 전체)
pattern = r'<section[^>]*id="panel-8"[^>]*>.*?</section>'
new_content = re.sub(pattern, new_panel8, content, flags=re.DOTALL)

if new_content == content:
    print("ERROR: panel-8 not found or replacement failed")
else:
    with open('public/pdallday/index.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("SUCCESS: panel-8 replaced")
