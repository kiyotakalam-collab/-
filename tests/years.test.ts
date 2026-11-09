import { describe, expect, it } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import {
  EMPTY_YEARS, mergeYearCatalog, openYearDatabase, questionId, selectYearQuestions,
  validateYearCatalog, yearProgress, type YearCatalog, type YearFilter,
} from '../src/years';

const fixture: YearCatalog = {
  schemaVersion:1, version:2, updatedAt:'2026-11-09T12:00:00.000Z',
  items:[{id:'fixture-a',year:'100',event:'架空の出来事',region:'架空地域',era:'架空時代',level:2,
    explanation:'テスト専用の架空データ。アプリには登録しない。',sources:[{title:'テスト用',url:'https://example.org/test'}],version:1,deleted:false}],
};
const filter:YearFilter={direction:'event-year',mode:'all',level:'all',region:'all',era:'all'};

describe('separate year quiz scaffolding',()=>{
  it('has an empty first catalog; no historical years inserted without owner instructions',()=>{
    expect(EMPTY_YEARS.items).toEqual([]);
    expect(selectYearQuestions(EMPTY_YEARS,[],filter)).toEqual([]);
  });
  it('supports both question directions with independent IDs',()=>{
    const out=selectYearQuestions(fixture,[],{...filter,direction:'both'});
    expect(out).toHaveLength(2);
    expect(out[0].prompt).toContain('架空の出来事');
    expect(out[0].answer).toBe('100');
    expect(out[1].prompt).toContain('100');
    expect(out[1].answer).toBe('架空の出来事');
    expect(out[0].id).not.toBe(out[1].id);
  });
  it('groups year-to-event answers that share a year and region without ambiguous duplicate prompts',()=>{
    const catalog={...fixture,items:[
      fixture.items[0],
      {...fixture.items[0],id:'fixture-b',event:'同年の別の架空出来事'},
      {...fixture.items[0],id:'fixture-c',event:'別地域の架空出来事',region:'別地域'},
    ]};
    const reverse=selectYearQuestions(catalog,[],{...filter,direction:'year-event'});
    expect(reverse).toHaveLength(2);
    const local=reverse.find(q=>q.item.region==='架空地域')!;
    expect(local.prompt).toContain('架空地域');
    expect(local.answer).toContain('架空の出来事');
    expect(local.answer).toContain('同年の別の架空出来事');
    expect(reverse[0].id).not.toBe(reverse[1].id);
    expect(selectYearQuestions(catalog,[],{...filter,direction:'event-year'})).toHaveLength(3);
  });
  it('filters by level, region and modes without resetting cumulative mistakes',()=>{
    const id=questionId('fixture-a','event-year');
    const reviews=[
      {id:'review1',questionId:id,correct:false,at:'2026-11-01T00:00:00.000Z',sessionId:'one'},
      {id:'review2',questionId:id,correct:true,at:'2026-11-02T00:00:00.000Z',sessionId:'two'},
    ];
    const p=yearProgress(reviews).get(id)!;
    expect(p.wrong).toBe(1);expect(p.correct).toBe(1);
    expect(selectYearQuestions(fixture,reviews,{...filter,mode:'mistakes'})).toHaveLength(1);
    expect(selectYearQuestions(fixture,reviews,{...filter,mode:'unseen'})).toHaveLength(0);
    expect(selectYearQuestions(fixture,reviews,{...filter,level:3})).toHaveLength(0);
    expect(selectYearQuestions(fixture,reviews,{...filter,region:'別地域'})).toHaveLength(0);
    expect(selectYearQuestions(fixture,reviews,{...filter,mode:'due'},Date.parse('2026-11-12T00:00:00.000Z'))).toHaveLength(1);
  });
  it('schedules a failed direction soon and keeps the reverse direction unlearned',()=>{
    const at='2026-11-09T01:00:00.000Z';
    const reviews=[{id:'wrong',questionId:questionId('fixture-a','event-year'),correct:false,at,sessionId:'one'}];
    const progress=yearProgress(reviews).get(reviews[0].questionId)!;
    expect(progress).toMatchObject({attempts:1,wrong:1,streak:0,recent:[false]});
    expect(progress.dueAt).toBe(Date.parse(at)+600000);
    const unseen=selectYearQuestions(fixture,reviews,{...filter,direction:'both',mode:'unseen'});
    expect(unseen.map(q=>q.direction)).toEqual(['year-event']);
  });
  it('prioritizes a recent failure over a recovered question with more lifetime mistakes',()=>{
    const catalog={...fixture,items:[fixture.items[0],{...fixture.items[0],id:'fixture-b',event:'架空の出来事B'}]};
    const at=Date.parse('2026-11-09T12:00:00.000Z');
    const reviews=Array.from({length:20},(_,i)=>({id:'old-'+i,questionId:questionId('fixture-a','event-year'),correct:false,at:new Date(at-86400000-i*1000).toISOString(),sessionId:'one'}));
    reviews.push(...Array.from({length:5},(_,i)=>({id:'right-'+i,questionId:questionId('fixture-a','event-year'),correct:true,at:new Date(at-5000+i*1000).toISOString(),sessionId:'two'})));
    reviews.push({id:'recent-wrong',questionId:questionId('fixture-b','event-year'),correct:false,at:new Date(at).toISOString(),sessionId:'three'});
    expect(selectYearQuestions(catalog,reviews,{...filter,mode:'weak'},at)[0].item.id).toBe('fixture-b');
    expect(yearProgress(reviews).get(questionId('fixture-a','event-year'))).toMatchObject({wrong:20,correct:5,streak:5});
  });
  it('rejects duplicate IDs and only merges newer entries; preserves previously registered years',()=>{
    const valid=validateYearCatalog(fixture);
    expect(valid.items).toHaveLength(1);
    expect(mergeYearCatalog(valid,{...valid,version:3,items:[]})).toMatchObject({version:3,items:valid.items});
    expect(()=>validateYearCatalog({...valid,items:[...valid.items,...valid.items]})).toThrow(/重複/);
    expect(()=>mergeYearCatalog(valid,{...valid,version:3,items:[{...valid.items[0],event:'変更'}]})).toThrow(/競合/);
  });
  it('uses an independent IndexedDB database and additive backup recovery',async()=>{
    viStub();
    const db=await openYearDatabase();
    await db.applyCatalog(fixture);
    expect((await db.load()).catalog.items).toHaveLength(1);
    expect((await db.load()).events).toHaveLength(0);
    const backup=await db.exportBackup();
    expect(JSON.parse(backup).format).toBe('world-history-years');
    await db.restoreBackup(backup);
    expect((await db.load()).catalog.items).toHaveLength(1);
    expect((await db.load()).events).toHaveLength(0);
    db.close();
  });
  it('keeps both direction histories, timestamps and cumulative mistakes after repeated backup restore',async()=>{
    viStub();const db=await openYearDatabase('years-directions-'+crypto.randomUUID());
    try{
      await db.applyCatalog(fixture);
      await Promise.all([db.addReview(questionId('fixture-a','event-year'),false,'one'),db.addReview(questionId('fixture-a','year-event'),true,'two')]);
      const before=await db.load(), backup=await db.exportBackup();
      expect(before.events.map(e=>e.at).sort()[0]).not.toBe(before.events.map(e=>e.at).sort()[1]);
      await db.restoreBackup(backup);await db.restoreBackup(backup);
      const after=await db.load();expect(after.events).toEqual(before.events);
      expect(yearProgress(after.events).get(questionId('fixture-a','event-year'))?.wrong).toBe(1);
      expect(yearProgress(after.events).get(questionId('fixture-a','year-event'))?.correct).toBe(1);
      await expect(db.addReview(questionId('missing','event-year'),true,'three')).rejects.toThrow(/見つかりません/);
    }finally{db.close();}
  });
  it('rolls back the entire restore when a later imported event conflicts',async()=>{
    viStub();const db=await openYearDatabase('years-rollback-'+crypto.randomUUID());
    try{
      await db.applyCatalog(fixture);await db.addReview(questionId('fixture-a','event-year'),false,'one');
      const before=await db.load(), backup=JSON.parse(await db.exportBackup());
      backup.catalog.version++;
      backup.catalog.items.push({...fixture.items[0],id:'fixture-new',event:'新しい架空の出来事'});
      backup.events=[{...before.events[0],id:'new-event'}, {...before.events[0],correct:true}];
      await expect(db.restoreBackup(JSON.stringify(backup))).rejects.toThrow(/競合/);
      expect(await db.load()).toEqual(before);
    }finally{db.close();}
  });
  it('rejects malformed direction IDs and foreign backup formats before changing saved data',async()=>{
    viStub();const db=await openYearDatabase('years-validation-'+crypto.randomUUID());
    try{
      await db.applyCatalog(fixture);const before=await db.load(),backup=JSON.parse(await db.exportBackup());
      backup.events=[{id:'bad-id',questionId:'fixture-a::wrong',correct:true,at:'2026-11-09T01:00:00.000Z',sessionId:'one'}];
      await expect(db.restoreBackup(JSON.stringify(backup))).rejects.toThrow(/問題ID/);
      await expect(db.restoreBackup(JSON.stringify({...backup,format:'cultural-history-master'}))).rejects.toThrow(/バックアップではありません/);
      expect(await db.load()).toEqual(before);
    }finally{db.close();}
  });
});
function viStub(){
  // Fake IndexedDB is used only for this test; production opens a distinct database.
  Object.defineProperty(globalThis,'indexedDB',{value:indexedDB,configurable:true});
  Object.defineProperty(globalThis,'IDBKeyRange',{value:IDBKeyRange,configurable:true});
}
