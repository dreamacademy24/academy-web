import test from 'node:test';
import assert from 'node:assert/strict';
import {createLearningStorage,DEMO_SCOPE,initialDraft} from '../lib/learning/storage.ts';
import {createLearningRequestFence,matchLearningContext,parseLearningSelection} from '../lib/learning/context.ts';

// An asynchronous IndexedDB-shaped store exercises the real key and queue code.
const stores = new Map();
globalThis.indexedDB = {
  open() {
    const request = {};
    request.result = {
      createObjectStore(name) { if (!stores.has(name)) stores.set(name,new Map()); },
      close() {},
      transaction(name) {
        const transaction = {};
        transaction.objectStore = () => ({
          get(key) { const operation = {}; setTimeout(()=>{operation.result=structuredClone(stores.get(name).get(key));transaction.oncomplete?.();},0);return operation; },
          put(value,key) { const operation = {};setTimeout(()=>{stores.get(name).set(key,structuredClone(value));transaction.oncomplete?.();},0);return operation; },
        });
        return transaction;
      },
    };
    queueMicrotask(()=>{request.onupgradeneeded?.();request.onsuccess?.();});
    return request;
  },
};
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const V1='33333333-3333-4333-8333-333333333333',V2='44444444-4444-4444-8444-444444444444';
const scope=(learnerId,visitId)=>({kind:'learner',learnerId,visitId,unitId:'dsl-f2-w1-d1'});
const recording=text=>({blob:new Blob([text],{type:'audio/webm'}),text,seconds:2,savedAt:'2026-09-13T01:00:00.000Z',interrupted:false});

test('same word recording stays separate for siblings and each return visit; demo survives',async()=>{
  const demo=createLearningStorage(DEMO_SCOPE),a=createLearningStorage(scope(A,V1)),b=createLearningStorage(scope(B,V1)),aReturn=createLearningStorage(scope(A,V2));
  await Promise.all([demo.putRecording('word-tree',recording('demo')),a.putRecording('word-tree',recording('child A')),b.putRecording('word-tree',recording('child B')),aReturn.putRecording('word-tree',recording('return A'))]);
  assert.equal(await (await demo.getRecording('word-tree')).blob.text(),'demo');
  assert.equal(await (await a.getRecording('word-tree')).blob.text(),'child A');
  assert.equal(await (await b.getRecording('word-tree')).blob.text(),'child B');
  assert.equal(await (await aReturn.getRecording('word-tree')).blob.text(),'return A');
  assert.ok(stores.get('audio').has('dsl-f2-w1-d1-approved-v2:word-tree'));
});

test('learner drafts, story and mission never inherit anonymous work',async()=>{
  const demo=createLearningStorage(DEMO_SCOPE),fresh=createLearningStorage(scope(B,V2));
  await demo.putDraft({...initialDraft(),sentence:'anonymous story'});
  await demo.putAdventure({scene:8,sentence:'anonymous adventure',ink:[],missionOpen:true});
  await demo.putFinalMission({version:1,checkpoint:1,round:0,solved:false,matched:[],reviewWords:[],supportedWords:[],completedAt:null});
  assert.equal((await fresh.getDraft()).sentence,'');
  assert.equal(await fresh.getAdventure(),undefined);
  assert.equal(await fresh.getFinalMission(),undefined);
  assert.equal((await demo.getDraft()).sentence,'anonymous story');
  assert.ok(stores.get('drafts').has('treehouse-adventure-v1'));
  assert.ok(stores.get('drafts').has('treehouse-final-mission-v1'));
});

test('queued writes snapshot both learner identity and values at dispatch',async()=>{
  const mutableScope=scope(A,V1),a=createLearningStorage(mutableScope);
  const draft={...initialDraft(),sentence:'A first'};
  const first=a.putDraft(draft);
  draft.sentence='A second';const second=a.putDraft(draft);
  const immediatelyReopened=a.getDraft();
  mutableScope.learnerId=B;draft.sentence='do not save this';
  const b=createLearningStorage(scope(B,V1));await b.putDraft({...initialDraft(),sentence:'B only'});
  await Promise.all([first,second]);
  assert.equal((await immediatelyReopened).sentence,'A second');
  assert.equal((await a.getDraft()).sentence,'A second');
  assert.equal((await b.getDraft()).sentence,'B only');
});

const published={id:V1,levelCode:'DSL-F2',unitId:'dsl-f2-w1-d1',href:'/learn/tree-house',published:true};
const payload={children:[{learnerId:A,nameKr:'아이 A',visits:[{visitId:V1,assignment:published}]}]};
test('only exact owned child, visit and published assignment enter a learner scope',()=>{
  assert.equal(matchLearningContext(payload,parseLearningSelection(A,V1)).scope.learnerId,A);
  assert.equal(matchLearningContext(payload,parseLearningSelection(B,V1)),null);
  assert.equal(matchLearningContext(payload,parseLearningSelection(A,V2)),null);
  for(const assignment of [null,{...published,published:false},{...published,unitId:'other'},{...published,levelCode:'DR-F1'},{...published,href:'/elsewhere'}]){
    assert.equal(matchLearningContext({children:[{...payload.children[0],visits:[{visitId:V1,assignment}]}]},parseLearningSelection(A,V1)),null);
  }
  assert.equal(matchLearningContext({children:[...payload.children,...payload.children]},parseLearningSelection(A,V1)),null);
});
test('partial, empty or invalid learner selectors never become a demo',()=>{
  assert.equal(parseLearningSelection(null,null).kind,'demo');
  for(const pair of [[A,null],[null,V1],['',null],[A,'bad'],['bad',V1]])assert.equal(parseLearningSelection(...pair).kind,'invalid');
});
test('late child A or signed-out responses cannot reveal stale learner content',async()=>{
  const fence=createLearningRequestFence();let resolveA,visible=null;
  const delayedA=new Promise(resolve=>{resolveA=resolve;});
  const ticketA=fence.begin();
  const oldRequest=delayedA.then(value=>{if(fence.isCurrent(ticketA))visible=value;});
  const ticketB=fence.begin();
  if(fence.isCurrent(ticketB))visible='B';
  resolveA('A');await oldRequest;assert.equal(visible,'B');
  const signedIn=fence.begin();fence.cancel();
  assert.equal(fence.isCurrent(signedIn),false);
});
