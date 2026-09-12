import test from 'node:test';
import assert from 'node:assert/strict';
import {issueConfirmation,verifyConfirmation,validVisitDates} from '../lib/student-care/confirmation.ts';
const source={bookingId:'booking',index:0,students:[{id:'student',korName:'샘플'}],student:{id:'student',booking_id:'booking',name_kr:'샘플',name_en:null}};
const key='test-only-confirmation-key',now=1900000000000;
test('same source and actor can confirm, JSON object key order is irrelevant',()=>{
 const token=issueConfirmation(source,'actor',key,now);
 assert.equal(verifyConfirmation(token,{...source,students:[{korName:'샘플',id:'student'}]},'actor',key,now),true);
});
test('changed names, order, index or student row invalidate the reviewed snapshot',()=>{
 const token=issueConfirmation(source,'actor',key,now);
 for(const changed of [{...source,index:1},{...source,students:[{id:'other'}]},{...source,student:{...source.student,name_kr:'변경'}}])assert.equal(verifyConfirmation(token,changed,'actor',key,now),false);
});
test('different actor, expired and tampered proofs are rejected',()=>{
 const token=issueConfirmation(source,'actor',key,now);
 assert.equal(verifyConfirmation(token,source,'other',key,now),false);
 assert.equal(verifyConfirmation(token,source,'actor',key,now+900000),false);
 assert.equal(verifyConfirmation(token+'x',source,'actor',key,now),false);
});
test('visit periods require real calendar dates and correct order',()=>{
 assert.equal(validVisitDates('2028-02-29','2028-03-01'),true);
 for(const dates of [['2026-02-29','2026-03-01'],['2026-03-10','2026-03-01'],['','2026-03-01'],['2026-02-30','2026-03-01']])assert.equal(validVisitDates(...dates),false);
});
