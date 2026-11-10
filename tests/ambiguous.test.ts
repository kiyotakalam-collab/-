import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { indexedDB } from 'fake-indexeddb';
import { activeAmbiguous, aggregateAmbiguousMastery, ambiguousMastery, ambiguousProgress, ambiguousSchedule, ambiguousStatus, DEFAULT_AMB_FILTER, EMPTY_AMBIGUOUS, mergeAmbiguousCatalog, selectAmbiguousCards, validateAmbiguousCatalog, type AmbReview } from '../src/ambiguous';
import { openAmbiguousDatabase } from '../src/ambiguous-db';
import { ambiguousFixture, AMB_TIME } from './ambiguous-fixture';

describe('ambiguous content schema and safe updates',()=>{
  it('accepts empty and shipped JSON; shares terms between groups including six-term comparisons',()=>{
    expect(validateAmbiguousCatalog(EMPTY_AMBIGUOUS).cards).toEqual([]);
    expect(()=>validateAmbiguousCatalog(JSON.parse(readFileSync(new URL('../public/ambiguous-terms.json',import.meta.url),'utf8')))).not.toThrow();
    const c=ambiguousFixture();expect(c.terms).toHaveLength(6);expect(c.groups[0].termIds).toHaveLength(6);expect(c.groups[1].termIds[0]).toBe(c.groups[0].termIds[0]);expect(activeAmbiguous(c).cards).toHaveLength(4);
  });
  it('validates the complete fictional example in the registration guide',()=>{
    const text=readFileSync(new URL('../docs/AMBIGUOUS_TERMS_SCHEMA.md',import.meta.url),'utf8'),example=text.match(/```json\n([\s\S]*?)\n```/)![1];expect(validateAmbiguousCatalog(JSON.parse(example)).cards).toHaveLength(3);
  });
  it('rejects duplicate IDs, aliases and dangling/out-of-group references',()=>{
    const c=ambiguousFixture();expect(()=>validateAmbiguousCatalog({...c,terms:[...c.terms,c.terms[0]]})).toThrow(/重複/);
    expect(()=>validateAmbiguousCatalog({...c,terms:[...c.terms,{...c.terms[0],id:'at-other',name:'違う表記',aliases:[c.terms[0].name]}]})).toThrow(/重複/);
    const bad=structuredClone(c);bad.groups[0].termIds.push('missing');expect(()=>validateAmbiguousCatalog(bad)).toThrow(/存在しない/);
    const card=structuredClone(c);card.cards[0].groupId='missing';expect(()=>validateAmbiguousCatalog(card)).toThrow(/参照先/);
  });
  it('handles valid IDs that match object property names without inherited lookup',()=>{
    const c=ambiguousFixture(),old=c.terms[0].id;c.terms[0].id='constructor';for(const g of c.groups){g.termIds=g.termIds.map(id=>id===old?'constructor':id);for(const row of g.comparison){row.values['constructor']=row.values[old];delete row.values[old];}for(const edge of g.relationships){if(edge.fromId===old)edge.fromId='constructor';}}for(const card of c.cards){card.termIds=card.termIds.map(id=>id===old?'constructor':id);card.optionTermIds=card.optionTermIds.map(id=>id===old?'constructor':id);if(card.correctTermId===old)card.correctTermId='constructor';}expect(()=>validateAmbiguousCatalog(c)).not.toThrow();
  });
  it('requires explicit verified distractors and supports only real two/three/four-choice pools',()=>{
    for(const n of [2,3,4]){const c=ambiguousFixture(),choice=c.cards[2];choice.optionTermIds=c.terms.slice(0,n).map(t=>t.id);choice.distractors=choice.optionTermIds.slice(1).map(termId=>({...choice.distractors[0],termId}));expect(validateAmbiguousCatalog(c).cards[2].optionTermIds).toHaveLength(n);}
    const c=ambiguousFixture();c.cards[2].distractors=[];expect(()=>validateAmbiguousCatalog(c)).toThrow(/検証根拠/);
    c.cards[2].optionTermIds=['at-test-a'];expect(()=>validateAmbiguousCatalog(c)).toThrow(/2〜4/);
  });
  it('preserves fixed semantics, rejects same-version changes, and keeps omitted rows',()=>{
    const c=ambiguousFixture(),next=structuredClone(c);next.version++;next.cards[0].version++;next.cards[0].explanation='修正したテスト用解説';
    expect(mergeAmbiguousCatalog(c,next).cards[0].id).toBe(c.cards[0].id);expect(()=>mergeAmbiguousCatalog(c,{...next,version:c.version})).toThrow(/同じ教材/);
    next.cards[0].termIds=['at-test-b'];expect(()=>mergeAmbiguousCatalog(c,next)).toThrow(/意味/);
    expect(mergeAmbiguousCatalog(c,{...c,version:3,cards:[]} ).cards).toHaveLength(4);
    const tombstone=structuredClone(c);tombstone.terms[0].deleted=true;expect(activeAmbiguous(tombstone).cards).toHaveLength(0);
  });
  it('filters all conditions on the same term, never fabricates cards and exposes zero/unseen',()=>{
    const c=ambiguousFixture();expect(selectAmbiguousCards(c,[],{...DEFAULT_AMB_FILTER,kind:'recall',region:'架空地域A',field:'架空分野A',era:'架空時代',cause:'名称類似',groupId:'ag-test-six'}).map(q=>q.id)).toEqual(['ac-test-recall']);
    expect(selectAmbiguousCards(c,[],{...DEFAULT_AMB_FILTER,region:'架空地域A',field:'架空分野B'})).toEqual([]);
    expect(selectAmbiguousCards(c,[],{...DEFAULT_AMB_FILTER,kind:'compare'})).toHaveLength(1);expect(selectAmbiguousCards(c,[],{...DEFAULT_AMB_FILTER,mode:'due'})).toEqual([]);
  });
});
describe('separate immutable ambiguous history, backup and repetition',()=>{
  const open=async()=>{Object.defineProperty(globalThis,'indexedDB',{value:indexedDB,configurable:true});const name='amb-test-'+crypto.randomUUID(),db=await openAmbiguousDatabase(name);await db.applyCatalog(ambiguousFixture());return {db,name};};
  it('stores only submitted answers, auto-grades choices, deduplicates taps and retains cumulative errors',async()=>{
    const {db,name}=await open();try{
      expect((await db.load()).events).toEqual([]);await db.grade('wrong','ac-test-choice','session',null,'at-test-b');await db.grade('wrong','ac-test-choice','session',null,'at-test-b');await db.grade('right','ac-test-choice','session',null,'at-test-a');
      await db.grade('recall','ac-test-recall','session',true,null);await db.grade('compare','ac-test-compare','session',false,null);
      const state=await db.load();expect(state.events).toHaveLength(4);expect(ambiguousProgress(state.events).get('ac-test-choice')).toMatchObject({correct:1,wrong:1,attempts:2});
      await expect(db.grade('bad','ac-test-choice','session',true,'missing')).rejects.toThrow();expect((await db.load()).events).toHaveLength(4);
      db.close();const reopened=await openAmbiguousDatabase(name);try{expect((await reopened.load()).events).toEqual(state.events);}finally{reopened.close();}
    }finally{db.close();}
  });
  it('uses 1/3/7/14/30/60-day intervals and ten minutes on errors without erasing mistakes',()=>{
    const c=ambiguousFixture(),card=c.cards[0];let events:AmbReview[]=[];
    for(let i=0;i<7;i++){const at=new Date(Date.parse(AMB_TIME)+i*86400000).toISOString();events.push({id:'r-'+i,questionId:card.id,groupId:card.groupId,termIds:card.termIds,kind:card.kind,correct:true,selectedTermId:null,at,sessionId:'session'});expect(Date.parse(ambiguousProgress(events).get(card.id)!.nextReviewAt)-Date.parse(at)).toBe([1,3,7,14,30,60,60][i]*86400000);}
    events.push({...events.at(-1)!,id:'error',correct:false,at:'2027-01-01T00:00:00.000Z'});const p=ambiguousProgress(events).get(card.id)!;expect(Date.parse(p.nextReviewAt)-Date.parse(p.lastAt)).toBe(600000);expect(p.wrong).toBe(1);expect(ambiguousSchedule(c,events)[0].questionId).toBe(card.id);
  });
  it('keeps term recall and group discrimination distinct; a comparison mistake prevents stable groups',async()=>{
    const {db}=await open();try{for(let i=0;i<3;i++)await db.grade('r'+i,'ac-test-recall','s',true,null);await db.grade('compare-wrong','ac-test-compare','s',false,null);const state=await db.load(),p=ambiguousProgress(state.events),status=ambiguousStatus(state.catalog,state.events);expect(status.terms.get('at-test-a')).toBe('initial');expect(status.groups.get('ag-test-six')).toBe('initial');expect(status.groups.get('ag-test-shared')).toBe('unseen');expect(aggregateAmbiguousMastery([],p)).toBe('unseen');expect(ambiguousMastery(undefined)).toBe('unseen');}finally{db.close();}
  });
  it('merges backups additively, rejects foreign formats and rolls all changes back on conflicts',async()=>{
    const {db}=await open(),target=await openAmbiguousDatabase('amb-restore-'+crypto.randomUUID());try{
      await db.grade('e1','ac-test-recall','s',false,null);const backup=await db.exportBackup();await target.restoreBackup(backup);await target.restoreBackup(backup);const before=await target.load();expect(before.events).toHaveLength(1);
      const wrong=JSON.parse(backup);wrong.format='world-history-years';await expect(target.restoreBackup(JSON.stringify(wrong))).rejects.toThrow(/専用/);
      const conflict=JSON.parse(backup);conflict.catalog.version++;conflict.catalog.terms[0].version++;conflict.catalog.terms[0].description='変更されてはならない値';conflict.events=[{...conflict.events[0],id:'new'}, {...conflict.events[0],correct:true}];await expect(target.restoreBackup(JSON.stringify(conflict))).rejects.toThrow(/競合/);expect(await target.load()).toEqual(before);
      const next=ambiguousFixture();next.version=3;next.cards[0].version=2;next.cards[0].explanation='更新後';await target.applyCatalog(next);await target.restoreBackup(backup);expect((await target.load()).catalog.cards[0].explanation).toBe('更新後');expect((await target.load()).events).toEqual(before.events);
      const invalid=ambiguousFixture();invalid.groups[0].termIds.push('missing');await expect(target.applyCatalog(invalid)).rejects.toThrow();expect((await target.load()).events).toEqual(before.events);
    }finally{db.close();target.close();}
  });
});
