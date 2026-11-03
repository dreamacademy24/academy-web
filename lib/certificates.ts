export type CertificateLanguage = 'ko' | 'en';
export type CertificateActor = { username: string; role: string };
export const canUseCertificates = (s: CertificateActor | null | undefined) => !!s && (s.role === 'korean_admin' || (s.role === 'local_teacher' && ['admin-abby', 'admin-axl'].includes(s.username)));
export type CertificateData = {
  reference: string; issueDate: string; studentNameKo: string; studentNameEn: string;
  studentDob: string; guardianNameKo: string; guardianNameEn: string; guardianDob: string;
  programKo: string; programEn: string; startDate: string; endDate: string;
  gender: string; nationality: string; homeSchool: string; schedule: string;
};
export type CertificateField = { key: string; label: string; visible: boolean };
export type CertificateTemplate = {
  title: string; academy: string; address: string; contact: string; greeting: string;
  body: string; closing: string; referenceLabel: string; issueDateLabel: string;
  signatureLabel: string; stampLabel: string; signers: { name: string; position: string }[];
  fields: CertificateField[]; fontSize: number; watermark: boolean; watermarkOpacity: number;
};
export type CertificatePayload = { data: CertificateData; template: CertificateTemplate };
export const REQUIRED_FIELDS = ['studentName', 'studentDob', 'guardianName', 'guardianDob', 'program', 'period'];
export const TOKENS = ['studentName', 'studentDob', 'guardianName', 'guardianDob', 'program', 'startDate', 'endDate', 'reference', 'issueDate'];
export const todaySeoul = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
export function emptyCertificate(): CertificateData {
  return { reference: '', issueDate: todaySeoul(), studentNameKo: '', studentNameEn: '', studentDob: '', guardianNameKo: '', guardianNameEn: '', guardianDob: '', programKo: '', programEn: '', startDate: '', endDate: '', gender: '', nationality: '', homeSchool: '', schedule: '' };
}
export function defaultCertificateTemplate(language: CertificateLanguage): CertificateTemplate {
  const en = language === 'en';
  return {
    title: en ? 'LETTER OF ADMISSION' : '입학허가서', academy: 'Dream Academy',
    address: 'Marigondon, Lapu-Lapu City, Philippines', contact: 'dreamacademyph@gmail.com | www.dreamacademyph.com',
    referenceLabel: en ? 'Reference No.' : '발급번호', issueDateLabel: en ? 'Date of Issue' : '발급일',
    greeting: en ? 'To Whom It May Concern,' : '수신: 재학 학교 담당자',
    body: en ? 'This is to confirm that {{studentName}} has been accepted for enrollment in the {{program}} at Dream Academy in Cebu, Philippines, from {{startDate}} to {{endDate}}. The accompanying parent or guardian is {{guardianName}}.' : '드림아카데미는 {{studentName}} 학생의 {{program}} 입학을 허가합니다. 연수 기간은 {{startDate}}부터 {{endDate}}까지이며, 동반 보호자는 {{guardianName}}입니다.',
    closing: en ? 'This letter is issued at the request of the student or parent/guardian for submission to the student’s home school as confirmation of admission to the English language training program stated above.' : '본 서류는 학생 또는 보호자의 요청에 따라 재학 학교 제출용으로 발급하며, 드림아카데미의 상기 영어연수 과정 입학허가를 확인합니다.',
    signatureLabel: en ? 'Authorized Signatories' : '발급 담당자', stampLabel: en ? 'Official Academy Stamp' : '학원 직인',
    signers: [{ name: 'Axel', position: en ? 'Supervisor' : '슈퍼바이저' }, { name: 'Abby', position: en ? 'Head of Human Resources' : '인사 총괄' }],
    fields: [
      ['studentName', en ? 'Student Name' : '학생 성명'], ['studentDob', en ? 'Date of Birth' : '학생 생년월일'],
      ['guardianName', en ? 'Accompanying Parent or Guardian' : '동반 보호자 성명'], ['guardianDob', en ? 'Guardian Date of Birth' : '보호자 생년월일'],
      ['program', en ? 'Program' : '연수 과정'], ['period', en ? 'Training Period' : '연수 기간'],
      ['gender', en ? 'Gender' : '성별'], ['nationality', en ? 'Nationality' : '국적'],
      ['homeSchool', en ? 'Home School and Grade' : '재학 학교 및 학년'], ['schedule', en ? 'Class Schedule' : '수업 일정'],
    ].map(([key, label]) => ({ key, label, visible: REQUIRED_FIELDS.includes(key) })),
    fontSize: 11, watermark: true, watermarkOpacity: 0.035,
  };
}
const str = (v: unknown) => typeof v === 'string' ? v : '';
const dateValid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s;
export function validateCertificateData(d: CertificateData, language: CertificateLanguage): string | null {
  if (!d || Object.values(d).some(v => typeof v !== 'string' || v.length > 500)) return 'Invalid certificate fields.';
  for (const key of ['reference', language === 'en' ? 'studentNameEn' : 'studentNameKo', language === 'en' ? 'guardianNameEn' : 'guardianNameKo', language === 'en' ? 'programEn' : 'programKo'] as const) if (!d[key]?.trim()) return '학생·보호자 이름, 과정과 발급번호를 입력해주세요. / Enter names, program and reference number.';
  for (const key of ['studentDob', 'guardianDob', 'startDate', 'endDate', 'issueDate'] as const) if (!dateValid(d[key])) return '생년월일·연수 기간·발급일을 확인해주세요. / Check all dates.';
  if (d.endDate < d.startDate || d.studentDob > d.issueDate || d.guardianDob > d.issueDate) return '날짜 순서를 확인해주세요. / Check date order.';
  if (language === 'en' && [d.studentNameEn, d.guardianNameEn, d.programEn, d.reference, d.gender, d.nationality, d.homeSchool, d.schedule].some(v => /[가-힣]/.test(v))) return '영문 서류에는 영문 내용을 입력해주세요. / Use English in the English letter.';
  return null;
}
export function validateCertificateTemplate(t: CertificateTemplate, language: CertificateLanguage): string | null {
  if (!t || typeof t !== 'object' || !Array.isArray(t.fields) || !Array.isArray(t.signers)) return 'Invalid template.';
  const keys = ['title', 'academy', 'address', 'contact', 'greeting', 'body', 'closing', 'referenceLabel', 'issueDateLabel', 'signatureLabel', 'stampLabel'] as const;
  if (keys.some(k => typeof t[k] !== 'string' || t[k].length > (k === 'body' || k === 'closing' ? 1800 : 250))) return '양식 문구 길이를 확인해주세요. / Check template text length.';
  if (!t.title.trim() || !t.body.trim() || !t.academy.trim() || t.fields.length > 12 || t.signers.length !== 2 || t.signers.some(s => !s || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 80 || typeof s.position !== 'string' || !s.position.trim() || s.position.length > 100)) return '제목·본문·담당자 이름과 직책을 확인해주세요. / Complete title, body and signatories.';
  if (!Number.isFinite(t.fontSize) || t.fontSize < 9 || t.fontSize > 13 || typeof t.watermark !== 'boolean' || !Number.isFinite(t.watermarkOpacity) || t.watermarkOpacity < .02 || t.watermarkOpacity > .08) return 'Invalid layout settings.';
  const allowed = defaultCertificateTemplate(language).fields.map(f => f.key);
  if (t.fields.some(f => !f || !allowed.includes(f.key) || typeof f.label !== 'string' || !f.label.trim() || f.label.length > 100 || typeof f.visible !== 'boolean') || new Set(t.fields.map(f => f.key)).size !== t.fields.length || REQUIRED_FIELDS.some(k => !t.fields.some(f => f.key === k && f.visible))) return '학생·보호자·과정·기간 필수 항목은 유지해주세요. / Keep the required fields.';
  const matches = [t.body, t.closing].join(' ').matchAll(/\{\{(.*?)\}\}/g);
  for (const m of matches) if (!TOKENS.includes(m[1])) return '알 수 없는 자동입력 항목입니다. / Unknown merge field: ' + m[1];
  if (language === 'en' && /[가-힣]/.test(JSON.stringify(t))) return '영문 양식에는 영문만 입력해주세요. / Use English in the English template.';
  return null;
}
export function certificateDate(value: string, language: CertificateLanguage) {
  if (!dateValid(value)) return value || '—';
  const [y, m, d] = value.split('-');
  return language === 'ko' ? `${y}년 ${Number(m)}월 ${Number(d)}일` : `${d} ${['January','February','March','April','May','June','July','August','September','October','November','December'][Number(m)-1]} ${y}`;
}
export function certificateValues(d: CertificateData, language: CertificateLanguage): Record<string, string> {
  const en = language === 'en';
  return { ...d, studentName: en ? d.studentNameEn : d.studentNameKo, guardianName: en ? d.guardianNameEn : d.guardianNameKo, program: en ? d.programEn : d.programKo,
    studentDob: certificateDate(d.studentDob, language), guardianDob: certificateDate(d.guardianDob, language), issueDate: certificateDate(d.issueDate, language), startDate: certificateDate(d.startDate, language), endDate: certificateDate(d.endDate, language), period: `${certificateDate(d.startDate, language)} ${en ? 'to' : '~'} ${certificateDate(d.endDate, language)}`, gender: en ? d.gender : ({ Male: '남', Female: '여' }[d.gender] || d.gender) };
}
export const escapeCertificateText = (s: string) => str(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function certificateHtml(payload: CertificatePayload, language: CertificateLanguage, origin: string): string {
  const { data: d, template: t } = payload, vals = certificateValues(d, language), e = escapeCertificateText;
  const merge = (v: string) => e(v.replace(/\{\{(.*?)\}\}/g, (_, key) => vals[key] || '—')).replace(/\n/g, '<br>');
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><title>${e(t.title)} ${e(vals.studentName)} ${e(d.reference)}</title><style>
  *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#182635;font-family:Arial,'Malgun Gothic',sans-serif} @page{size:A4;margin:0}
  .sheet{width:210mm;min-height:297mm;position:relative;padding:17mm 19mm 15mm;background:#fffefb;isolation:isolate;font-size:${t.fontSize}pt;line-height:1.6;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .watermark{position:absolute;left:27mm;top:74mm;width:157mm;height:162mm;overflow:hidden;opacity:${t.watermark ? t.watermarkOpacity : 0};pointer-events:none;z-index:-1}
  .watermark img{position:absolute;max-width:none;width:1120mm;height:auto;left:-54mm;top:-105mm}
  header{display:flex;align-items:center;justify-content:space-between;gap:8mm;margin-bottom:9mm} .logo{width:43mm;height:auto;display:block}.contact{font-size:8pt;max-width:104mm;text-align:right;color:#5c6875;line-height:1.65;overflow-wrap:anywhere}
  h1{font-size:23pt;line-height:1.3;letter-spacing:.02em;font-weight:700;color:#132c43;margin:0 0 7mm} .meta{font-size:9pt;display:flex;justify-content:space-between;gap:6mm;margin-bottom:8mm;flex-wrap:wrap}.greeting{margin:0 0 3mm;font-weight:600}p{margin:0 0 6mm;overflow-wrap:anywhere}
  table{width:100%;border-collapse:collapse;margin:7mm 0;table-layout:fixed;font-size:${t.fontSize-1}pt}th,td{border-bottom:1px solid #d9dfe5;padding:2.7mm 3.5mm;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{width:37%;font-weight:600;background:rgba(233,240,244,.55)}tr:first-child>*{border-top:1px solid #9bacbb}
  .closing{font-size:${t.fontSize-1}pt;color:#455665;margin-top:6mm}.sign-title{font-size:9pt;font-weight:600;margin:9mm 0 3mm}.signers{display:grid;grid-template-columns:1fr 1fr;gap:20mm;break-inside:avoid}.signature{padding-top:10mm;border-bottom:1px solid #748493;margin-bottom:2mm}.name{font-weight:bold}.position{font-size:9pt}.stamp{font-size:8pt;color:#748493;margin-top:7mm;text-align:right}footer{margin-top:7mm;font-size:8pt;color:#748493;border-top:1px solid #e7e9e8;padding-top:2mm;display:flex;justify-content:space-between;gap:8mm}
  @media print{html,body{background:white}.sheet{margin:0;box-shadow:none}}
  </style></head><body><article class="sheet"><div class="watermark" aria-hidden="true"><img src="${e(origin)}/dream-academy-logo.png" alt=""></div><header><img class="logo" src="${e(origin)}/dream-academy-logo.png" alt="Dream Academy"><div class="contact"><strong>${e(t.academy)}</strong><br>${e(t.address)}<br>${e(t.contact)}</div></header><h1>${e(t.title)}</h1><div class="meta"><span>${e(t.referenceLabel)}: ${e(d.reference)}</span><span>${e(t.issueDateLabel)}: ${e(vals.issueDate)}</span></div><p class="greeting">${e(t.greeting)}</p><p>${merge(t.body)}</p><table><tbody>${t.fields.filter(f => f.visible).map(f => `<tr><th scope="row">${e(f.label)}</th><td>${e(vals[f.key] || '—')}</td></tr>`).join('')}</tbody></table><p class="closing">${merge(t.closing)}</p><section class="signers-wrap"><div class="sign-title">${e(t.signatureLabel)}</div><div class="signers">${t.signers.map(s => `<div><div class="signature"></div><div class="name">${e(s.name)}</div><div class="position">${e(s.position)}</div><div class="position">${e(t.academy)}</div></div>`).join('')}</div><div class="stamp">${e(t.stampLabel)}</div></section><footer><span>${e(t.academy)}</span><span>${e(d.reference)}</span></footer></article></body></html>`;
}

type Raw = Record<string, unknown>;
const obj = (v: unknown): Raw => v && typeof v === 'object' && !Array.isArray(v) ? v as Raw : {};
const list = (v: unknown): Raw[] => Array.isArray(v) ? v.map(obj) : [];
const first = (...v: unknown[]) => v.map(str).find(s => s.trim()) || '';
export function normalizeCertificateDob(v: unknown): string {
  const s = str(v).trim();
  const candidate = /^\d{8}$/.test(s) ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : s.slice(0,10);
  return dateValid(candidate) ? candidate : '';
}
export type CertificateBooking = { id: string; reservation: string; bookerKo: string; bookerEn: string; startDate: string; endDate: string; guardians: { nameKo: string; nameEn: string; dob: string }[]; students: { nameKo: string; nameEn: string; dob: string; programKo: string; programEn: string; startDate: string; endDate: string; invoiceEnd: string }[] };
export function normalizeCertificateBooking(raw: Raw): CertificateBooking {
  const invoice = obj(raw.invoice), booker = obj(invoice.booker);
  const bookerKo = first(raw.booker_name, booker.name), bookerEn = first(raw.booker_english, booker.englishName);
  const guardian = { nameKo: bookerKo, nameEn: bookerEn, dob: normalizeCertificateDob(first(booker.birthDate, booker.dob, booker.birthday, raw.booker_dob)) };
  const extra = list(raw.extra_guardians).map(g => ({ nameKo: first(g.name_kr,g.name,g.korName), nameEn: first(g.name_en,g.englishName,g.engName), dob: normalizeCertificateDob(first(g.birthDate,g.dob,g.birthday,g.age)) }));
  const stored = list(raw.students), saved = list(invoice.students);
  const candidates = stored.length ? stored : saved;
  const students = candidates.map(s => {
    const nameKo = first(s.name_kr, s.korName), nameEn = first(s.name_en, s.engName);
    const previous = saved.find(x => (nameKo && x.korName === nameKo) || (nameEn && x.engName === nameEn)) || {};
    const level = first(s.level, s.grade, previous.grade);
    const junior = /junior|주니어/i.test(level), kinder = /kinder|킨더/i.test(level);
    return { nameKo, nameEn, dob: normalizeCertificateDob(first(s.dob,s.birth_date,s.age,previous.age)), programKo: junior ? '주니어 영어연수 과정' : kinder ? '킨더 영어연수 과정' : level,
      programEn: junior ? 'Junior English Language Training Program' : kinder ? 'Kinder English Language Training Program' : /[가-힣]/.test(level) ? '' : level,
      startDate: first(s.academy_start,s.academyStart,raw.academy_start,previous.academyStart), endDate: first(s.academy_end,s.academyEnd,raw.academy_end,previous.academyEnd), invoiceEnd: first(previous.academyEnd) };
  });
  return { id: str(raw.id), reservation: str(raw.reservation_no), bookerKo, bookerEn, startDate: str(raw.academy_start), endDate: str(raw.academy_end), guardians: [guardian, ...extra], students };
}
