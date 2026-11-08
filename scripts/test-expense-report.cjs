/* Run after compiling lib/expenses/report.ts: node scripts/test-expense-report.cjs /absolute/path/to/report.js */
const assert=require('node:assert/strict');
const built=process.argv[2];if(!built)throw new Error('Pass the compiled report.js path as the first argument.');
const {buildExpenseReport}=require(built);
const claim=(id,ledger_entry_id,overrides={})=>({id,status:'approved',ledger_entry_id,kind:'operating_expense',unit:'dreamhouse',category_id:'housing.utilities',amount:'30.00',currency:'PHP',house_scope:'multiple',house_ids:['H1','H2'],allocations:[{house_id:'H1',amount:'10.00'},{house_id:'H2',amount:'20.00'}],...overrides});
const rows=[
 {id:'income',book:'회사',type:'income',amount:'100.00',currency:'PHP'},
 {id:'legacy',book:'회사',type:'expense',amount:'20.00',currency:'PHP'},
 {id:'new-multi',book:'회사',type:'expense',amount:'30.00',currency:'PHP'},
 {id:'new-unallocated',book:'회사',type:'expense',amount:'40.00',currency:'PHP'},
 {id:'krw-legacy',book:'회사',type:'expense',amount:'230',currency:'KRW'},
 {id:'mori-accrual',book:'회사',type:'expense',division:'모리',source:'mori_accrue',amount:'5.00',currency:'PHP'},
 {id:'mori-settlement',book:'회사',type:'expense',division:'모리',source:'mori_settle',amount:'5.00',currency:'PHP'},
 {id:'personal',book:'집',type:'expense',amount:'999.00',currency:'PHP'}
];
const claims=[claim('c1','new-multi'),claim('c2','new-unallocated',{amount:'40.00',house_ids:['H3','H4'],allocations:[]}),claim('c3',null,{kind:'internal_transfer',unit:'academy',amount:'500',currency:'KRW',house_scope:'none',house_ids:[],allocations:[]}),claim('c4','mori-settlement',{kind:'mori_settlement',unit:'academy',amount:'5.00',currency:'PHP',house_scope:'none',house_ids:[],allocations:[]})];
const report=buildExpenseReport(rows,claims,23);
assert.equal(report.totals.revenue_php_cents,10000);
assert.equal(report.totals.expense_php_cents,10500); // personal and Mori settlement excluded
assert.equal(report.classified_approved_php_cents,7000);assert.equal(report.legacy_unattributed_php_cents,3500);
assert.equal(report.classified_approved_php_cents+report.legacy_unattributed_php_cents,report.totals.expense_php_cents);
assert.equal(report.houses.by_house.H1,1000);assert.equal(report.houses.by_house.H2,2000); // one 3000-cent row, allocated once
assert.equal(report.houses.multiple_unallocated_php_cents,4000);assert.equal(report.houses.by_house.H3,undefined); // no invented equal split
assert.deepEqual(report.excluded_movements.internal_transfer,{PHP:0,KRW:500}); // original currencies are separate, never added
assert.throws(()=>buildExpenseReport(rows,[claim('a','new-multi'),claim('b','new-multi')],23),/Duplicate ledger link/);
assert.throws(()=>buildExpenseReport(rows,[claim('missing',null)],23),/missing its posted ledger row/);
const fractional=[{id:'fractional',book:'회사',type:'expense',amount:'2300.50',currency:'KRW'}];
assert.equal(buildExpenseReport(fractional,[],23).totals.expense_php_cents,10002); // preserve 0.50 KRW before conversion
const threeWon=[1,2,3].map(id=>({id:'won-'+id,book:'회사',type:'expense',amount:'1',currency:'KRW'}));
assert.equal(buildExpenseReport(threeWon,[],23).totals.expense_php_cents,13); // aggregate first: never 3 x 4 cents
const invalidAllocation=claim('bad','new-multi',{allocations:[{house_id:'H1',amount:'10.00'},{house_id:'outside',amount:'20.00'}]});
assert.equal(buildExpenseReport(rows,[invalidAllocation],23).houses.multiple_unallocated_php_cents,3000);
console.log('expense report tests passed');
