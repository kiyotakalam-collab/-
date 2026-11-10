import 'fake-indexeddb/auto';
import {afterEach,describe,expect,it} from 'vitest';
import {DATABASE_VERSION,HistoryDB,openDatabase} from '../src/db';
import {getProgress} from '../src/core';
import {comparisonProgress} from '../src/culture-compare';
import {completedDaily} from '../src/culture-daily';
import {buildCultureGraph} from '../src/culture-graph';
import {DEFAULT_SETTINGS,type Catalog,type ReviewEvent} from '../src/types';
import {featureFixture,comparisonBatch,review} from './culture-feature-fixtures';

const opened:HistoryDB[]=[];
async function open(name=crypto.randomUUID()){const db=await openDatabase(name);opened.push(db);return db;}
afterEach(()=>{for(const db of opened.splice(0))db.close();});
const req=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function createV2(name:string,catalog:Catalog,events:ReviewEvent[]){
  const request=indexedDB.open(name,2);
  request.onupgradeneeded=()=>{
    const db=request.result;db.createObjectStore('meta');const store=db.createObjectStore('events',{keyPath:'id'});
    store.createIndex('cardId','cardId');store.createIndex('reviewedAt','reviewedAt');
  };
  const database=await req(request),tx=database.transaction(['meta','events'],'readwrite');
  tx.objectStore('meta').put(catalog,'catalog');tx.objectStore('meta').put(DEFAULT_SETTINGS,'settings');
  for(const event of events)tx.objectStore('events').add(event);
  await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});database.close();
}
async function yearSnapshot(){
  const request=indexedDB.open('world-history-year-test',1);
  request.onupgradeneeded=()=>{request.result.createObjectStore('meta');request.result.createObjectStore('reviews',{keyPath:'id'});};
  const db=await req(request),tx=db.transaction(['meta','reviews'],'readonly');
  const result=await Promise.all([req(tx.objectStore('meta').getAll()),req(tx.objectStore('reviews').getAll())]);db.close();return result;
}
async function seedYear(){
  const request=indexedDB.open('world-history-year-test',1);
  request.onupgradeneeded=()=>{request.result.createObjectStore('meta');request.result.createObjectStore('reviews',{keyPath:'id'});};
  const db=await req(request),tx=db.transaction(['meta','reviews'],'readwrite');
  tx.objectStore('meta').put({version:99,items:[{id:'year-fixture',year:'9999'}]},'catalog');
  tx.objectStore('reviews').put({id:'year-review-fixture',correct:false,questionId:'year-fixture::event-year',at:'2026-11-09T00:00:00.000Z',sessionId:'year-session'});
  await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
}

describe('feature storage and old history protection',()=>{
  it('migrates a real v2 database through comparison, daily practice, graph, reopen, sync and backup recovery',async()=>{
    const {catalog,relations}=featureFixture(),name=crypto.randomUUID();
    const original=Array.from({length:5},(_,i)=>review('immutable-'+i,'socrates-question',i>=3,`2026-11-01T00:0${i}:00.000Z`));
    await createV2(name,catalog,original);await seedYear();const yearBefore=await yearSnapshot();
    let db=await open(name);expect(DATABASE_VERSION).toBe(3);
    expect((await db.load()).events).toEqual(original);expect((await db.load()).comparisonEvents).toEqual([]);
    await db.applyRelations(relations);const wrong=comparisonBatch('compare-wrong',true);await db.recordComparisons(wrong);
    const now=new Date(),plan=await db.getOrCreateDailyPlan(now),dailyCard=plan.cardIds.find(id=>id!=='socrates-question')!;
    await db.recordReview(dailyCard,true,'daily-session');
    const beforeGraph=await db.load();buildCultureGraph(beforeGraph.catalog,relations.relations,'author-a',2);
    expect(await db.load()).toEqual(beforeGraph);
    db.close();db=await open(name);expect((await db.getOrCreateDailyPlan(now)).cardIds).toEqual(plan.cardIds);
    expect(completedDaily(plan,(await db.load()).events,now).has(dailyCard)).toBe(true);
    await db.applyCatalog({...catalog,version:2,updatedAt:'2026-11-10T00:00:00.000Z'});
    const state=await db.load();
    expect(getProgress(state.events).get('socrates-question')).toMatchObject({wrong:3,correct:2,attempts:5});
    expect(state.events.filter(e=>e.cardId==='socrates-question')).toEqual(original);
    expect(state.events).toHaveLength(6);expect(state.comparisonEvents).toEqual(wrong);
    const backup=await db.exportBackup();expect(backup.schemaVersion).toBe(2);
    const other=await open();await other.restoreBackup(backup);await other.restoreBackup(backup);
    expect((await other.load()).events).toEqual(state.events);expect((await other.load()).comparisonEvents).toEqual(wrong);
    expect(await other.loadRelations()).toEqual(relations);
    expect(await yearSnapshot()).toEqual(yearBefore);
  });

  it('stores only a complete official grade, atomically deduplicates retries and retains old confusion',async()=>{
    const {catalog,relations}=featureFixture(),db=await open();await db.applyCatalog(catalog);await db.applyRelations(relations);
    const wrong=comparisonBatch('wrong',true);await expect(db.recordComparisons(wrong.slice(0,2))).rejects.toThrow(/全て/);
    expect((await db.load()).comparisonEvents).toEqual([]);
    await Promise.all([db.recordComparisons(wrong),db.recordComparisons(wrong)]);
    expect((await db.load()).comparisonEvents).toHaveLength(3);
    await db.recordComparisons(comparisonBatch('right',false,'2026-11-10T00:00:00.000Z'));
    const state=await db.load();expect(state.events).toEqual([]);
    expect(comparisonProgress(state.comparisonEvents!).get('rel-a')).toMatchObject({wrong:1,correct:1});
    const conflicts=structuredClone(wrong);conflicts[0].reviewedAt='2026-11-11T00:00:00.000Z';
    await expect(db.recordComparisons(conflicts)).rejects.toThrow();expect((await db.load()).comparisonEvents).toEqual(state.comparisonEvents);
  });

  it('accepts a legacy schema-1 backup without clearing new comparison events or relation cache',async()=>{
    const {catalog,relations}=featureFixture(),db=await open();await db.applyCatalog(catalog);await db.applyRelations(relations);
    await db.recordReview('socrates-question',false,'old-normal');const oldState=await db.load();
    const legacy={format:'cultural-history-master',schemaVersion:1,exportedAt:new Date().toISOString(),catalog,events:oldState.events,settings:DEFAULT_SETTINGS};
    await db.recordComparisons(comparisonBatch('new-comparison',true));const before=await db.load();
    await db.restoreBackup(legacy);expect(await db.load()).toEqual(before);expect(await db.loadRelations()).toEqual(relations);
  });

  it('rolls back catalogue, normal events and newly added comparison records when a later history ID conflicts',async()=>{
    const {catalog,relations}=featureFixture(),db=await open();await db.applyCatalog(catalog);await db.applyRelations(relations);
    await db.recordReview('socrates-question',false,'old-normal');await db.recordComparisons(comparisonBatch());
    const before=await db.load(),backup=structuredClone(await db.exportBackup());
    backup.catalog.version++;
    backup.events.push({...before.events[0],id:'new-normal-event'});
    const first=backup.comparisonEvents![0];
    backup.comparisonEvents=[{...first,id:'new-comparison-event'},{...first,selectedTargetId:'author-b',correct:false}];
    await expect(db.restoreBackup(backup)).rejects.toThrow(/識別履歴IDが競合/);
    expect(await db.load()).toEqual(before);expect(await db.loadRelations()).toEqual(relations);
  });

  it('preserves good cached relations after malformed, unknown-reference, old or conflicting updates',async()=>{
    const {catalog,relations}=featureFixture(),db=await open();await db.applyCatalog(catalog);await db.applyRelations(relations);
    await expect(db.applyRelations({...relations,relations:[{...relations.relations[0],toId:'missing'}]})).rejects.toThrow();
    await expect(db.applyRelations({...relations,version:2,relations:[...relations.relations,{...relations.relations[0],id:'duplicate'}]})).rejects.toThrow(/重複/);
    const unknown=structuredClone(relations);unknown.version=2;unknown.relations[0].toId='missing';
    await expect(db.applyRelations(unknown)).rejects.toThrow(/参照/);
    await expect(db.applyRelations({...relations,version:0})).rejects.toThrow(/古い/);
    await expect(db.applyRelations({...relations,comparisonSets:[]})).rejects.toThrow(/競合/);
    await expect(db.applyRelations({...relations,version:2,comparisonSets:[],relations:relations.relations.map((r,i)=>i?r:{...r,toId:'work-c'})})).rejects.toThrow(/関係|ID|変更/);
    expect(await db.loadRelations()).toEqual(relations);
  });

  it('does not grade deleted targets or lose already saved comparison history',async()=>{
    const {catalog,relations}=featureFixture(),db=await open();await db.applyCatalog(catalog);await db.applyRelations(relations);
    await db.recordComparisons(comparisonBatch('before-deletion'));
    const updated=structuredClone(catalog);updated.version=2;const item=updated.items.find(i=>i.id==='work-a')!;item.deleted=true;item.version++;
    await db.applyCatalog(updated);
    await expect(db.recordComparisons(comparisonBatch('after-deletion'))).rejects.toThrow(/見つかりません/);
    expect((await db.load()).comparisonEvents).toHaveLength(3);
    const restored=await open();await restored.restoreBackup(await db.exportBackup());expect((await restored.load()).comparisonEvents).toHaveLength(3);
  });

  it('rejects a restored relation cache with broken references and preserves the existing cache',async()=>{
    const {catalog,relations}=featureFixture(),db=await open();await db.applyCatalog(catalog);await db.applyRelations(relations);
    await db.recordReview('socrates-question',false,'existing');
    const before=await db.load(),backup=structuredClone(await db.exportBackup());
    backup.relations!.version++;backup.relations!.relations[0].toId='missing-backup-target';
    backup.events.push({...before.events[0],id:'should-not-be-restored'});
    await expect(db.restoreBackup(backup)).rejects.toThrow(/関係|参照/);
    expect(await db.load()).toEqual(before);expect(await db.loadRelations()).toEqual(relations);
  });

  it('persists a same-day recommendation across reopening and stores another plan for the next local day',async()=>{
    const {catalog}=featureFixture(),name=crypto.randomUUID();let db=await open(name);await db.applyCatalog(catalog);
    const day=new Date('2026-11-09T12:00:00.000Z'),first=await db.getOrCreateDailyPlan(day);
    db.close();db=await open(name);const reopened=await db.getOrCreateDailyPlan(day);
    expect(reopened).toEqual(first);
    const next=await db.getOrCreateDailyPlan(new Date('2026-11-10T12:00:00.000Z'));
    expect(next.dateKey).not.toBe(first.dateKey);expect(await db.loadDailyPlan(first.dateKey)).toEqual(first);
  });
});
