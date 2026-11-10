import { describe, expect, it } from 'vitest';
import { indexedDB } from 'fake-indexeddb';
import { comparableYear, correctOrdering, orderingCandidates, orderingKey, orderingProgress, selectOrderingQuestions, timelineItems, timelineLayout, validateOrderingReview } from '../src/year-chronology';
import { openYearDatabase, validateYearCatalog, yearProgress, type YearCatalog, type YearReview } from '../src/years';
import type { OrderingFilter, OrderingReview } from '../src/year-chronology';

const catalog:YearCatalog={schemaVersion:1,version:2,updatedAt:'2026-11-10T00:00:00.000Z',items:Array.from({length:40},(_,i)=>({id:`test-${i}`,year:String(1800+Math.floor(i/2)),event:`試験専用の出来事${i}`,region:i%2?'試験地域B':'試験地域A',era:i<20?'試験時代A':'試験時代B',level:i%2?2:1,explanation:'テスト専用',sources:[],version:1,deleted:false}))};
const filter:OrderingFilter={level:'all',region:'all',era:'all',mode:'all'};
const ids=['test-0','test-2','test-4','test-6'];
const review=(correct:boolean,id='order-1'):OrderingReview=>({id,questionId:orderingKey(ids),itemIds:ids,submittedIds:correct?ids:[...ids].reverse(),correctOrderIds:ids,correct,at:'2026-11-10T00:00:00.000Z',sessionId:'test-session'});

describe('exact chronology and ordering',()=>{
  it('compares CE and BCE numerically; rejects ranges, estimates, zero and unsafe values',()=>{
    for(const [value,year] of [['1402',1402],['999年',999],['紀元前221',-221],['前５００年',-500],['221 BCE',-221],['AD 10',10],['-100',-100]] as const) expect(comparableYear(value)).toBe(year);
    for(const value of ['1914〜1918','前221〜前206','約1500年','1500年頃','19世紀','0','99999999999999999'])expect(comparableYear(value)).toBeNull();
    const items=catalog.items.slice(0,4).map((item,i)=>({...item,year:['10','紀元前221','999','前500'][i]}));
    expect(correctOrdering(items)).toEqual(['test-3','test-1','test-0','test-2']);
    expect(()=>correctOrdering(catalog.items.slice(0,4))).toThrow();
  });
  it('selects 5/10/20 unique questions with four different nearby years and a shuffled initial order',()=>{
    for(const count of [5,10,20]){
      const questions=selectOrderingQuestions(catalog,[],filter,count,()=>.5);
      expect(questions).toHaveLength(count);expect(new Set(questions.map(q=>q.id)).size).toBe(count);
      for(const q of questions){expect(new Set(q.items.map(x=>x.year)).size).toBe(4);expect(q.items.map(x=>x.id)).not.toEqual(correctOrdering(q.items));}
    }
    expect(orderingCandidates({...catalog,items:catalog.items.slice(0,3)},[],filter)).toEqual([]);
    expect(orderingCandidates({...catalog,items:catalog.items.slice(0,4).map((x,i)=>({...x,year:String(i*1000+1)}))},[],filter)).toEqual([]);
  });
  it('filters level, region, era and excluded dates without mutating source data',()=>{
    const before=JSON.stringify(catalog), questions=selectOrderingQuestions(catalog,[],{...filter,level:1,region:'試験地域A',era:'試験時代A'},20);
    expect(questions.length).toBeGreaterThan(0);expect(questions.flatMap(q=>q.items).every(x=>x.level===1&&x.region==='試験地域A'&&x.era==='試験時代A')).toBe(true);
    const c={...catalog,items:catalog.items.map((x,i)=>i<6?{...x,deleted:true}:i<10?{...x,year:'年代不明'}:x)};
    expect(selectOrderingQuestions(c,[],filter,20).flatMap(q=>q.items).every(x=>!x.deleted&&comparableYear(x.year)!==null)).toBe(true);
    expect(JSON.stringify(catalog)).toBe(before);
  });
  it('grades exact orders and preserves old mistakes independently of ordinary reviews',()=>{
    expect(validateOrderingReview(review(true)).correct).toBe(true);expect(validateOrderingReview(review(false)).correct).toBe(false);
    expect(()=>validateOrderingReview({...review(false),correct:true})).toThrow();
    expect(()=>validateOrderingReview({...review(true),submittedIds:[ids[0],ids[0],ids[2],ids[3]]})).toThrow();
    const events=[review(false),{...review(true,'order-2'),at:'2026-11-11T00:00:00.000Z'}];
    expect(orderingProgress(events).get(orderingKey(ids))).toMatchObject({correct:1,wrong:1,recent:[false,true]});
    const q=orderingCandidates(catalog,[],filter)[0], wrong={...review(false),questionId:q.id,itemIds:q.items.map(x=>x.id),submittedIds:q.items.map(x=>x.id).reverse(),correctOrderIds:q.items.map(x=>x.id)};
    expect(selectOrderingQuestions(catalog,[wrong],{...filter,mode:'unseen'},20).every(x=>x.id!==q.id)).toBe(true);
    expect(selectOrderingQuestions(catalog,[wrong],{...filter,mode:'weak'},20)[0].id).toBe(q.id);
  });
});
describe('parallel timeline',()=>{
  it('sorts numerically, retains simultaneous events and filters every display condition',()=>{
    const all=timelineItems(catalog,{...filter,regions:[],start:1800,end:1819});expect(all).toHaveLength(40);
    expect(all.filter(x=>x.year==='1800')).toHaveLength(2);
    const selected=timelineItems(catalog,{...filter,level:1,regions:['試験地域A'],era:'試験時代A',start:1803,end:1807});
    expect(selected).toHaveLength(5);expect(selected.every(x=>x.region==='試験地域A'&&x.level===1&&Number(x.year)>=1803&&Number(x.year)<=1807)).toBe(true);
    expect(timelineItems(catalog,{...filter,regions:['試験地域A','試験地域B'],start:1800,end:1800})).toHaveLength(2);
  });
  it('assigns separate rows to simultaneous or overlapping cards at the same scale',()=>{
    const {positions}=timelineLayout(catalog.items,1800,12);
    for(const a of positions)for(const b of positions)if(a!==b&&a.row===b.row)expect(a.x+212<=b.x||b.x+212<=a.x).toBe(true);
    expect(positions[0].x).toBe(0);expect(positions[1].x).toBe(0);expect(positions[0].row).not.toBe(positions[1].row);
  });
});
describe('year DB v1 migration and additive schema2 backups',()=>{
  it('retains old 3 errors and 2 correct IDs across ordering, reopen, sync and restore; conflicts roll back',async()=>{
    Object.defineProperty(globalThis,'indexedDB',{value:indexedDB,configurable:true});
    const name='old-years-'+crypto.randomUUID();
    const events:YearReview[]=[false,false,false,true,true].map((correct,i)=>({id:`old-${i}`,questionId:'test-0::event-year',correct,at:`2026-11-09T00:0${i}:00.000Z`,sessionId:'old-session'}));
    await new Promise<void>((resolve,reject)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>{r.result.createObjectStore('meta');r.result.createObjectStore('reviews',{keyPath:'id'});};r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction(['meta','reviews'],'readwrite');t.objectStore('meta').put(validateYearCatalog(catalog),'catalog');t.objectStore('meta').put('keep','sentinel');events.forEach(e=>t.objectStore('reviews').add(e));t.oncomplete=()=>{db.close();resolve();};};});
    let db=await openYearDatabase(name);const before=await db.load();
    await db.addOrderingReview('new-wrong',ids,[...ids].reverse(),'session');await db.addOrderingReview('new-wrong',ids,[...ids].reverse(),'session');await db.addOrderingReview('new-right',ids,ids,'session');
    expect((await db.load()).orderingEvents).toHaveLength(2);expect((await db.load()).events).toEqual(before.events);
    db.close();db=await openYearDatabase(name);await db.applyCatalog({...catalog,version:3});
    const backup=JSON.parse(await db.exportBackup());expect(backup.schemaVersion).toBe(2);
    expect(yearProgress(backup.events).get('test-0::event-year')).toMatchObject({correct:2,wrong:3});
    const target=await openYearDatabase('restored-'+crypto.randomUUID());
    try{
      await target.restoreBackup(JSON.stringify(backup));await target.restoreBackup(JSON.stringify(backup));
      expect((await target.load()).events).toEqual(before.events);expect((await target.load()).orderingEvents).toHaveLength(2);
      await target.restoreBackup(JSON.stringify({...backup,schemaVersion:1,orderingEvents:undefined}));expect((await target.load()).orderingEvents).toHaveLength(2);
      const saved=await target.load(),conflict=structuredClone(backup);conflict.catalog.version=4;conflict.events.push({...events[0],id:'should-rollback'});conflict.orderingEvents[0]={...conflict.orderingEvents[0],sessionId:'conflicting-session'};
      await expect(target.restoreBackup(JSON.stringify(conflict))).rejects.toThrow(/競合/);expect(await target.load()).toEqual(saved);
      const malformed=structuredClone(backup);malformed.orderingEvents[0].itemIds[0]='missing';await expect(target.restoreBackup(JSON.stringify(malformed))).rejects.toThrow();expect(await target.load()).toEqual(saved);
    }finally{target.close();db.close();}
  });
});
