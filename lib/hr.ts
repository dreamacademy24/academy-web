// HR ERP 공통 상수/헬퍼 (SSOT) — Abby 'ACADEMY EMPLOYEE DATABASE' Source Data 기반
// 값은 편집 가능(자유입력 + datalist 제안). 목록이 불완전해도 입력 막지 않음.

export const HR_GENDER = ["Male", "Female"];
export const HR_CIVIL_STATUS = ["Single", "Married", "Widowed", "Separated", "Solo Parent"];
export const HR_EMP_STATUS = ["Probationary", "Regular", "Contractual", "On Call"]; // Employment Status
export const HR_ACTIVE_STATUS = ["Active", "Inactive"];
export const HR_SALARY_TYPE = ["Monthly", "Daily"];
export const HR_JOB_LEVEL = ["Executive", "Senior Management", "Management", "Supervisory", "Rank & File"];
export const HR_DIVISIONS = [
  "Executive Division", "Human Resources", "Finance & Accounting", "Operations Division",
];
export const HR_DEPARTMENTS = [
  "Executive Office", "Corporate/Facility", "Admin & Finance", "Recruitment & HR",
  "Academy", "Dream House", "Communications", "Teaching",
];
export const HR_SHIFTS = [
  { label: "Day (8:30 AM ~ 5:00 PM)", value: "Day", time_in: "8:30 AM", time_out: "5:00 PM" },
  { label: "Mid (12:30 PM ~ 8:30 PM)", value: "Mid", time_in: "12:30 PM", time_out: "8:30 PM" },
];
export const HR_TAX_STATUS = ["S", "S1", "S2", "S3", "S4", "ME", "ME1", "ME2", "ME3", "ME4", "Z"];
export const HR_COST_CENTER = ["아카데미", "드림하우스"]; // 손익 인건비 부문
export const HR_COMPANIES = ["아카데미", "드림하우스", "모리", "88"]; // 회사 (HR 접근 권한 단위)

// 입사 서류 체크리스트 (Application / Onboarding & Requirements Tracker)
export const HR_REQUIREMENTS: { key: string; label: string }[] = [
  { key: "psa", label: "PSA / Birth Certificate" },
  { key: "gov_id", label: "Government ID" },
  { key: "nbi", label: "NBI Clearance" },
  { key: "police", label: "Police Clearance" },
  { key: "barangay", label: "Barangay Clearance" },
  { key: "sss", label: "SSS Number" },
  { key: "philhealth", label: "PhilHealth Number" },
  { key: "pagibig", label: "Pag-IBIG (HDMF)" },
  { key: "tin", label: "TIN Number" },
  { key: "diploma", label: "College / HS Diploma" },
  { key: "tor", label: "Transcript of Records" },
  { key: "marriage", label: "Marriage Certificate" },
  { key: "solo_parent", label: "Solo Parent ID" },
  { key: "bir_2305", label: "BIR Form 2305" },
  { key: "bir_form", label: "Latest BIR Form" },
  { key: "coe", label: "Certificate of Employment (prev.)" },
];

export interface HrEmployee {
  id: string;
  employee_id?: string;
  biometrics_id?: string;
  cost_center?: string;
  company?: string;
  last_name?: string; first_name?: string; middle_name?: string; suffix?: string;
  name_display?: string;
  photo_url?: string;
  gender?: string; civil_status?: string; date_of_birth?: string; place_of_birth?: string;
  nationality?: string; religion?: string;
  contact_number?: string; personal_email?: string; company_email?: string;
  current_address?: string; permanent_address?: string;
  emergency_contact_name?: string; emergency_contact_number?: string;
  emergency_contact_address?: string; emergency_relationship?: string;
  status?: string;
  position?: string; division?: string; department?: string; job_level?: string;
  date_hired?: string; eval_3month?: string; eval_6month?: string;
  regularization_date?: string; separation_date?: string;
  contract_start?: string; contract_end?: string; next_salary_review?: string;
  work_location?: string; shift_schedule?: string; time_in?: string; time_out?: string;
  reporting_to?: string; employment_status?: string;
  salary_type?: string; basic_salary?: number; tax_status?: string;
  allow_position?: number; allow_transpo?: number; allow_tutorial?: number; allow_load?: number;
  bank_name?: string; bank_account?: string; bank_status?: string;
  sss_no?: string; philhealth_no?: string; pagibig_no?: string; tin?: string;
  application_no?: string; position_applied?: string; date_of_application?: string;
  application_status?: string; date_submitted?: string; requirement_status?: string;
  onboarding_date?: string;
  requirements?: Record<string, boolean>;
  documents?: { name: string; url: string; uploaded_at?: string }[];
  notes?: string;
  created_at?: string; updated_at?: string;
}

// "LASTNAME, Firstname Middle" 표시명
export function displayName(e: Partial<HrEmployee>): string {
  const last = (e.last_name || "").toUpperCase();
  const rest = [e.first_name, e.middle_name].filter(Boolean).join(" ");
  if (last && rest) return `${last}, ${rest}`;
  return e.name_display || rest || last || "(이름 없음)";
}

// 사원번호 생성: YYYY-MMDD-seq (입사일 기준). seq는 같은 날 순번.
export function makeEmployeeId(dateHired: string | undefined, sameDayCount: number): string {
  const d = dateHired ? new Date(dateHired + "T00:00:00") : new Date();
  const y = d.getFullYear();
  const md = `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${y}-${md}-${sameDayCount + 1}`;
}

// 월 급여 총지급(공제 전) = 기본급(월) + 수당. Daily는 월 환산 별도(급여모듈에서).
export function grossMonthly(e: Partial<HrEmployee>): number {
  const base = e.salary_type === "Daily" ? 0 : Number(e.basic_salary) || 0; // Daily는 근무일수 필요 → 급여모듈
  return base + (Number(e.allow_position) || 0) + (Number(e.allow_transpo) || 0) +
    (Number(e.allow_tutorial) || 0) + (Number(e.allow_load) || 0);
}

