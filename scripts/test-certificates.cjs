const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),ts=require('typescript');
const root=path.join(__dirname,'..');
function load(file){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require,Buffer,TextEncoder,Intl,Date,Set});return exports;}
const c=load('lib/certificates.ts'),pdf=load('lib/certificatePdf.ts');
const sign=load('lib/certificateSignatories.ts'),directory=sign.defaultSignatoryDirectory();
assert.equal(sign.validateSignatoryDirectory(directory),null);
assert(sign.validateSignatoryDirectory([...directory,directory[0]]));
assert(sign.validateSignatoryDirectory(directory.map(r=>({...r,active:false}))));
assert(sign.validateSignatoryDirectory([{...directory[0],nameEn:'오초희'}]));
assert.equal(sign.resolveRegisteredSignatory(directory[0],'en','alternate').name,'May Oh');
assert.equal(sign.resolveRegisteredSignatory(directory[0],'ko','alternate').name,'오초희');
assert.equal(sign.findRegisteredSignatory({name:'Abby',position:'old title'},directory).id,'abby');
const snapshot={name:'Abby',position:'Head of Human Resources'};
const changed=sign.resolveRegisteredSignatory(directory[2],'en');assert.equal(changed.position,'Admin & Finance Manager');assert.equal(snapshot.position,'Head of Human Resources');
assert.equal(c.validateCertificateTemplate({...c.defaultCertificateTemplate('en'),signers:[sign.resolveRegisteredSignatory(directory[0],'en')]},'en'),null);
assert.equal(c.validateCertificateTemplate({...c.defaultCertificateTemplate('en'),signers:[sign.resolveRegisteredSignatory(directory[0],'en'),sign.resolveRegisteredSignatory(directory[1],'en')]},'en'),null);
assert(c.validateCertificateTemplate({...c.defaultCertificateTemplate('en'),signers:[]},'en'));
assert(c.validateCertificateTemplate({...c.defaultCertificateTemplate('en'),signers:directory.map(r=>sign.resolveRegisteredSignatory(r,'en'))},'en'));
for(const [role,username,want] of [['korean_admin','admin-ceo',true],['local_teacher','admin-abby',true],['local_teacher','admin-axl',true],['local_teacher','admin-bella',false],['local_teacher','admin-axel',false],['local_teacher','admin-abby-fake',false],['korean_staff','admin-other',false]])assert.equal(c.canUseCertificates({role,username}),want);
assert.equal(c.canUseCertificates(null),false);
const data={...c.emptyCertificate(),reference:'TEST-ADM-EN',issueDate:'2026-11-03',studentNameKo:'학생',studentNameEn:'TEST STUDENT',studentDob:'2015-03-01',guardianNameKo:'보호자',guardianNameEn:'TEST GUARDIAN',guardianDob:'1980-12-20',programKo:'영어연수',programEn:'English Language Training',startDate:'2027-01-04',endDate:'2027-01-29'};
for(const language of ['ko','en']){
 const template=c.defaultCertificateTemplate(language);assert.equal(c.validateCertificateTemplate(template,language),null);assert.equal(c.validateCertificateData(data,language),null);
 const html=c.certificateHtml({data,template},language,'https://example.com');assert(html.includes('1980'));assert(html.includes('2015'));assert(html.includes('dream-academy-logo.png'));assert(html.includes('watermark'));if(language==='en')assert(!/[가-힣]/.test(html));
}
assert(c.validateCertificateData({...data,guardianDob:''},'en'));
assert(c.validateCertificateData({...data,endDate:'2027-01-01'},'en'));
assert(c.validateCertificateData({...data,studentDob:'2015-02-30'},'en'));
assert(c.validateCertificateData({...data,schedule:'월요일'},'en'));
assert(c.validateCertificateTemplate({...c.defaultCertificateTemplate('en'),body:'{{notSupported}}'},'en'));
assert(c.validateCertificateTemplate({...c.defaultCertificateTemplate('en'),fields:[null]},'en'));
assert(c.validateCertificateTemplate({...c.defaultCertificateTemplate('en'),fields:c.defaultCertificateTemplate('en').fields.map(x=>({...x,visible:false}))},'en'));
const html=c.certificateHtml({data:{...data,studentNameEn:'<img src=x onerror=alert(1)>'},template:c.defaultCertificateTemplate('en')},'en','https://example.com');assert(!html.includes('<img src=x'));assert(html.includes('&lt;img'));
const booking=c.normalizeCertificateBooking({id:'test',reservation_no:'DA-test',booker_name:'보호자',booker_english:'TEST GUARDIAN',academy_start:'2027-01-04',academy_end:'2027-01-29',students:[{name_kr:'학생',name_en:'TEST STUDENT',age:'20150301',level:'junior',academy_end:'2027-01-27'}],invoice:{students:[{korName:'학생',academyEnd:'2027-01-29'}]}});
assert.equal(booking.students[0].dob,'2015-03-01');assert.equal(booking.students[0].endDate,'2027-01-27');assert.equal(booking.students[0].invoiceEnd,'2027-01-29');assert.equal(booking.guardians[0].dob,'');assert.equal(c.normalizeCertificateDob('11'),'');
const generated=pdf.certificatePdf(new Uint8Array([255,216,255,217]),10,10),raw=Buffer.from(generated).toString('latin1');assert(raw.startsWith('%PDF-1.4'));const xref=Number(raw.match(/startxref\n(\d+)/)[1]);assert.equal(raw.slice(xref,xref+4),'xref');
console.log('Certificate checks passed: access, bilingual fields, guardian DOB, dates, safe HTML, original date preservation and PDF structure.');
