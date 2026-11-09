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
});
function viStub(){
  // Fake IndexedDB is used only for this test; production opens a distinct database.
  Object.defineProperty(globalThis,'indexedDB',{value:indexedDB,configurable:true});
  Object.defineProperty(globalThis,'IDBKeyRange',{value:IDBKeyRange,configurable:true});
}
