import 'fake-indexeddb/auto';
import {describe,it,expect} from 'vitest';
import {getProgress} from '../src/core';
import {openDatabase} from '../src/db';
import {analysisRows,analysisStats,analysisGroups,analysisRegion,analysisEra,analysisField,type AnalysisRow} from '../src/weakness-analysis';
import {retentionFromEvidence,reviewUrgency} from '../src/retention';
import {saveErrorCause,validateErrorCauses} from '../src/error-causes';
import {makeCatalog,makeEvent} from './fixtures';
const epoch=Date.parse('2026-09-01T00:00:00.000Z');
const replay=(days:number[])=>days.map((day,i)=>({...makeEvent('e'+i,true),reviewedAt:new Date(epoch+day*86400000).toISOString()}));
describe('retention evidence and independent urgency',()=>{
 it('requires real on-due spaced success; overdue alone never lowers retention',()=>{
  const p=getProgress(replay([0,1,4,11])).get('socrates-question')!;
  expect(retentionFromEvidence(p.retention,p.attempts)).toBe('stable');
  expect(p.nextReviewAt).toBe(new Date(epoch+25*86400000).toISOString());
  expect(reviewUrgency(Date.parse(p.nextReviewAt!),true,epoch+100*86400000)).toBe('overdue');
  expect(retentionFromEvidence(p.retention,p.attempts)).toBe('stable');
  const cram=getProgress(replay([0,0,0])).get('socrates-question')!;expect(retentionFromEvidence(cram.retention,3)).toBe('initial');
  expect(retentionFromEvidence(undefined,10)).toBe('unknown');
 });
 it('uses Japan midnight and retains mistakes when correctness recovers',()=>{
  const due=Date.parse('2026-11-09T15:00:00.000Z');
  expect(reviewUrgency(due,true,due-1)).toBe('future');expect(reviewUrgency(due,true,due)).toBe('today');expect(reviewUrgency(due,true,due+86400000)).toBe('overdue');expect(reviewUrgency(due,false,due)).toBe('short');expect(reviewUrgency(null,false,due)).toBe('unscheduled');
  const events=[...replay([0,1,4,11]),{...makeEvent('wrong',false),reviewedAt:new Date(epoch+26*86400000).toISOString()},...replay([27]).map(e=>({...e,id:'recovered'}))];
  const p=getProgress(events).get('socrates-question')!;expect(p.wrong).toBe(1);expect(p.correct).toBe(5);expect(retentionFromEvidence(p.retention,6)).toBe('initial');
 });
});
describe('honest weakness denominators and tags',()=>{
 it('maps explicit tags only and preserves zero denominators',()=>{
  expect(analysisRegion('中国')).toBe('東アジア');expect(analysisEra('19世紀')).toBe('近代');expect(analysisField('戦争')).toBe('戦争史');expect(analysisField('未登録分類')).toBe('未分類');
  const rows=analysisRows({catalog:makeCatalog(),events:[],years:null,ambiguous:null,errorCauses:[]});expect(rows[0]).toMatchObject({region:'ヨーロッパ',era:'古代',field:'文化史',retention:'unseen'});
  const zero=analysisStats([],[]);expect(zero.accuracy).toBeNull();expect(zero.recentAccuracy).toBeNull();expect(zero.weakness).toBeNull();expect(analysisGroups(rows,'region',[]).find(g=>g.value==='東アジア')?.registered).toBe(0);
 });
 it('keeps same event IDs in different areas distinct and never guesses error causes',()=>{
  const base:AnalysisRow={area:'culture',id:'c',title:'戦争という名称でもタグは未分類',region:'未分類',era:'未分類',field:'未分類',rawTags:'',retention:'initial',urgency:'short',dueAt:0,events:[{id:'same',correct:false,at:'2026-11-01T00:00:00.000Z'}]};
  const rows=[base,{...base,area:'years' as const,id:'y'}];const stats=analysisStats(rows,[{area:'culture',eventId:'same',cause:'B',updatedAt:'2026-11-02T00:00:00.000Z'}]);expect(stats.causes).toMatchObject({B:1,unrecorded:1});expect(stats.sufficient).toBe(false);expect(stats.weakness).toBeNull();
  const many=Array.from({length:5},(_,i)=>({...base,id:String(i),events:Array.from({length:20},(_,j)=>({id:`${i}-${j}`,correct:j<10,at:new Date(epoch+j*86400000).toISOString()}))}));expect(analysisStats(many,[]).sufficient).toBe(true);expect(analysisStats(many,[]).recentAccuracy).toBe(0);
 });
});
describe('non-destructive error metadata backup',()=>{
 it('saves only actual mistakes and restores old/new backups without changing answer IDs or deadlines',async()=>{
  const source=await openDatabase();await source.applyCatalog(makeCatalog());const wrong=await source.recordReview('socrates-question',false,'test');await source.recordReview('socrates-question',true,'test');const old=await source.exportBackup(),before=(await source.load()).events;
  await saveErrorCause('culture',wrong.id,'B');const backup=await source.exportBackup();expect(backup.errorCauses?.[0].cause).toBe('B');expect((await source.load()).events).toEqual(before);await source.restoreBackup(old);expect((await source.load()).errorCauses).toEqual(backup.errorCauses);
  const target=await openDatabase(crypto.randomUUID());await target.restoreBackup(backup);await target.restoreBackup(backup);expect((await target.load()).events).toEqual(before);expect((await target.load()).errorCauses).toEqual(backup.errorCauses);
  const conflicting=structuredClone(backup);conflicting.errorCauses![0].cause='C';await expect(target.restoreBackup(conflicting)).rejects.toThrow(/競合/);expect((await target.load()).events).toEqual(before);
  await expect(saveErrorCause('culture',before.find(e=>e.correct)!.id,'A')).rejects.toThrow();await saveErrorCause('culture',wrong.id,null);expect((await source.load()).errorCauses![0].cause).toBeNull();source.close();target.close();
 });
 it('rejects duplicate metadata references',()=>{const a={area:'years',eventId:'x',cause:'A',updatedAt:'2026-11-10T00:00:00.000Z'};expect(()=>validateErrorCauses([a,a])).toThrow(/重複/);});
});

describe('other-area backup isolation',()=>{
 it('restores year recall causes separately from ordering and preserves old backups',async()=>{
  const {openYearDatabase,EMPTY_YEARS}=await import('../src/years');
  const db=await openYearDatabase();const catalog={...structuredClone(EMPTY_YEARS),version:100,items:Array.from({length:4},(_,i)=>({id:'test-year-'+i,year:String(1900+i),event:'架空'+i,region:'試験地域',era:'試験時代',level:1 as const,explanation:'',sources:[],version:1,deleted:false}))};
  await db.applyCatalog(catalog);const event=await db.addReview('test-year-0::event-year',false,'test');await saveErrorCause('years',event.id,'C');const backup=JSON.parse(await db.exportBackup());const target=await openYearDatabase(crypto.randomUUID());await target.restoreBackup(JSON.stringify(backup));await target.restoreBackup(JSON.stringify({...backup,errorCauses:undefined}));expect((await target.load()).errorCauses).toEqual(backup.errorCauses);expect((await target.load()).events).toEqual(backup.events);expect((await target.load()).orderingEvents).toEqual([]);db.close();target.close();
 });
 it('preserves ambiguous causes with old and repeated backups',async()=>{
  const {openAmbiguousDatabase}=await import('../src/ambiguous-db');const {ambiguousFixture}=await import('./ambiguous-fixture');const db=await openAmbiguousDatabase();await db.applyCatalog(ambiguousFixture());const event=await db.grade('test-error','ac-test-recall','test',false,null);await saveErrorCause('ambiguous',event.id,'A');const backup=JSON.parse(await db.exportBackup());const target=await openAmbiguousDatabase(crypto.randomUUID());await target.restoreBackup(JSON.stringify(backup));await target.restoreBackup(JSON.stringify({...backup,errorCauses:undefined}));expect((await target.load()).errorCauses).toEqual(backup.errorCauses);expect((await target.load()).events).toEqual(backup.events);db.close();target.close();
 });
});

it('reuses existing year and ambiguous intervals for evidence without changing them',async()=>{
 const {yearProgress}=await import('../src/years');const {ambiguousProgress}=await import('../src/ambiguous');const e=replay([0,1,4,11]);
 const yp=yearProgress(e.map(v=>({id:v.id,questionId:'t::event-year',correct:v.correct,at:v.reviewedAt,sessionId:v.sessionId}))).get('t::event-year')!;
 const ap=ambiguousProgress(e.map(v=>({id:v.id,questionId:'q',groupId:'g',termIds:['t'],kind:'recall' as const,correct:v.correct,selectedTermId:null,at:v.reviewedAt,sessionId:v.sessionId}))).get('q')!;
 expect(retentionFromEvidence(yp.retention,yp.attempts)).toBe('stable');expect(retentionFromEvidence(ap.retention,ap.attempts)).toBe('stable');expect(yp.dueAt).toBe(Date.parse(ap.nextReviewAt));expect(yp.dueAt).toBe(epoch+25*86400000);
});
