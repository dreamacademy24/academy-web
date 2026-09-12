import test from 'node:test';
import assert from 'node:assert/strict';
import {reconcileStudents} from '../lib/student-care/reconcile.ts';
const rows=[{id:'s1',booking_id:'b1',name_kr:'가람',name_en:'Garam'},{id:'s2',booking_id:'b1',name_kr:'나래'},{id:'s3',booking_id:'b2',name_kr:'가람'}];
const run=(students)=>reconcileStudents([{id:'b1',students}],rows);
test('arrays and encoded arrays give the same review; input is unchanged',()=>{
 const input=[{id:'s1',korName:'가람'},{id:'s2',name_kr:'나래'}];const before=JSON.stringify(input);
 assert.deepEqual(run(input),run(JSON.stringify(input)));assert.equal(JSON.stringify(input),before);
 assert.deepEqual(run(input).items.map(i=>i.status),['id_candidate','id_candidate']);
});
test('malformed and scalar payloads remain visible issues',()=>{
 assert.equal(run('{').issues[0].reason,'invalid_json');assert.equal(run('null').issues[0].reason,'not_an_array');
 assert.equal(run([null]).issues[0].reason,'invalid_entry:0');
});
test('names never automatically join return visits',()=>{
 const r=run([{korName:'가람'}]);assert.equal(r.items[0].status,'name_review');assert.deepEqual(r.items[0].candidateIds,['s1']);
});
test('an ID from another booking blocks name fallback',()=>{
 assert.equal(run([{id:'s3',korName:'가람'}]).items[0].status,'conflict');
});
test('repeated IDs and mismatched names are conflicts',()=>{
 assert.ok(run([{id:'s1',korName:'가람'},{id:'s1',korName:'가람'}]).items.every(i=>i.status==='conflict'));
 assert.equal(run([{id:'s1',korName:'나래'}]).items[0].status,'conflict');
});
test('unrecognized IDs are retained; placeholders are not enrolled',()=>{
 const r=run([{id:'legacy-8',korName:'가람'},{korName:'-',engName:'-'}]);
 assert.equal(r.items[0].sourceId,'legacy-8');assert.equal(r.items[0].status,'name_review');assert.equal(r.items[1].status,'placeholder');
});
test('duplicate names require review, conflicting identifier fields are blocked',()=>{
 const r=reconcileStudents([{id:'b1',students:[{korName:'가람'}]}],[...rows,{id:'s4',booking_id:'b1',name_kr:'가람'}]);
 assert.equal(r.items[0].reasons[0],'ambiguous_name');
 assert.equal(run([{id:'s1',student_id:'s2',korName:'가람'}]).items[0].status,'conflict');
});
test('duplicate booking input is reported instead of duplicating candidates',()=>{
 const r=reconcileStudents([{id:'b1',students:[{id:'s1',korName:'가람'}]},{id:'b1',students:[]}],rows);
 assert.equal(r.issues[0].reason,'duplicate_booking_input');assert.equal(r.items.length,1);
});
