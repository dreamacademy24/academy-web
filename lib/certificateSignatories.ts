import type { CertificateLanguage } from './certificates';
export type RegisteredSignatory = { id: string; label: string; nameKo: string; nameEn: string; alternateEn: string; positionKo: string; positionEn: string; note: string; active: boolean };
export type CertificateSignatory = { name: string; position: string; sourceId?: string; nameVariant?: 'primary' | 'alternate' };
export function defaultSignatoryDirectory(): RegisteredSignatory[] {
  return [
    { id:'ceo',label:'CEO',nameKo:'오초희',nameEn:'Chohee Oh',alternateEn:'May Oh',positionKo:'대표',positionEn:'CEO',note:'Chohee Oh / May Oh는 같은 사람의 영문 표기입니다.',active:true },
    { id:'director',label:'정미경 원장',nameKo:'정미경',nameEn:'Mick',alternateEn:'',positionKo:'원장',positionEn:'Academy Director',note:'Mick은 확인된 통용명입니다. 공식 영문 성명은 확인 후 수정해주세요.',active:true },
    { id:'abby',label:'Abby',nameKo:'Abby',nameEn:'Abigail Spedding',alternateEn:'Abby',positionKo:'행정·재무 매니저',positionEn:'Admin & Finance Manager',note:'HR 직원정보의 ADMIN & FINANCE MANAGER 직책을 반영했습니다.',active:true },
    { id:'axel',label:'Axel',nameKo:'Axel',nameEn:'Axl Bacala',alternateEn:'Axel',positionKo:'슈퍼바이저',positionEn:'Supervisor',note:'직책은 사용자 확인 승진 내용을 우선 적용했습니다.',active:true },
  ];
}
export function validateSignatoryDirectory(value: unknown): string | null {
  if(!Array.isArray(value)||value.length<1||value.length>30)return '서명 담당자는 1~30명으로 등록해주세요. / Register 1–30 signatories.';
  const seen=new Set<string>();
  for(const r of value){
    if(!r||typeof r!=='object'||typeof r.id!=='string'||!/^[a-zA-Z0-9-]{1,60}$/.test(r.id)||seen.has(r.id)||typeof r.active!=='boolean')return 'Invalid signatory ID or status.';
    seen.add(r.id);
    for(const key of ['label','nameKo','nameEn','alternateEn','positionKo','positionEn','note'])if(typeof r[key]!=='string'||r[key].length>(key==='note'?300:100))return '이름·직책 길이를 확인해주세요. / Check name and position length.';
    if(!r.label.trim()||!r.nameKo.trim()||!r.nameEn.trim()||!r.positionKo.trim()||!r.positionEn.trim())return '한글·영문 이름과 직책을 입력해주세요. / Enter Korean and English names and positions.';
    if(/[가-힣]/.test(r.nameEn+r.alternateEn+r.positionEn))return '영문 이름과 직책에는 영문만 입력해주세요. / Use English in English fields.';
  }
  if(!value.some(r=>r.active))return '사용할 서명 담당자가 최소 한 명 필요합니다. / Keep at least one active signatory.';
  return null;
}
export function resolveRegisteredSignatory(r: RegisteredSignatory,language: CertificateLanguage,variant:'primary'|'alternate'='primary'): CertificateSignatory {
  return {name:language==='ko'?r.nameKo:variant==='alternate'&&r.alternateEn?r.alternateEn:r.nameEn,position:language==='ko'?r.positionKo:r.positionEn,sourceId:r.id,nameVariant:variant};
}
export function findRegisteredSignatory(s:CertificateSignatory,rows:RegisteredSignatory[]):RegisteredSignatory|undefined{
  return rows.find(r=>s.sourceId?r.id===s.sourceId:[r.nameKo,r.nameEn,r.alternateEn,r.label].filter(Boolean).includes(s.name));
}
