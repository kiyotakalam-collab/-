import { describe, expect, it } from 'vitest';
import { classifyMastery, dueSummary, japanDateKey, learningRows, masteryCounts, masteryGroups, monthDays, reviewCalendar, shiftMonth, type InsightsSource } from '../src/learning-insights';
import { getProgress } from '../src/core';
import { yearProgress, EMPTY_YEARS } from '../src/years';
import { makeCard, makeCatalog, makeEvent, makeItem } from './fixtures';

const now=Date.parse('2026-11-10T03:00:00.000Z'),DAY=86400000;
const source=():InsightsSource=>({catalog:makeCatalog(),events:[],years:{catalog:{...EMPTY_YEARS,items:[{id:'year-a',year:'100',event:'試験専用の出来事',region:'試験地域',era:'試験時代',level:2,explanation:'',sources:[],version:1,deleted:false}]},events:[],orderingEvents:[],lastSyncAt:null}});
describe('Japan-time review calendar',()=>{
  it('uses JST midnight, including month/year boundaries regardless of the device timezone',()=>{
    expect(japanDateKey('2026-11-09T14:59:59.999Z')).toBe('2026-11-09');expect(japanDateKey('2026-11-09T15:00:00.000Z')).toBe('2026-11-10');
    expect(japanDateKey('2026-12-31T15:00:00.000Z')).toBe('2027-01-01');
    expect(shiftMonth('2026-12',1)).toBe('2027-01');expect(shiftMonth('2027-01',-1)).toBe('2026-12');
    expect(monthDays('2028-02').filter(Boolean)).toHaveLength(29);expect(monthDays('2026-11')[0]).toBe('2026-11-01');expect(()=>monthDays('2026-13')).toThrow();
  });
  it('reuses both existing schedules exactly and does not schedule unlearned cards',()=>{
    const s=source();s.events=[{...makeEvent('c',true),reviewedAt:'2026-11-09T03:00:00.000Z'}];s.years!.events=[{id:'y',questionId:'year-a::event-year',correct:false,at:'2026-11-09T14:55:00.000Z',sessionId:'test'}];
    const rows=learningRows(s,now);
    expect(rows[0].dueAt).toBe(Date.parse(getProgress(s.events).get(rows[0].id)!.nextReviewAt!));
    expect(rows[1].dueAt).toBe(yearProgress(s.years!.events).get(rows[1].id)!.dueAt);
    const calendar=reviewCalendar(rows,s);expect(calendar.scheduled.get('2026-11-10')).toEqual({culture:1,years:1,total:2});expect(calendar.actual.get('2026-11-09')).toEqual({culture:1,years:1,total:2});
    const empty=source(),unseen=learningRows(empty,now);expect(unseen.every(x=>x.mastery==='unseen'&&x.dueAt===null)).toBe(true);expect(reviewCalendar(unseen,empty).scheduled.size).toBe(0);
  });
  it('separates previous-day overdue dates from today-due and later-today schedules',()=>{
    const base=learningRows(source(),now)[0];const rows=[
      {...base,id:'old',dueAt:Date.parse('2026-11-09T14:59:59.000Z')},
      {...base,id:'today',dueAt:now},
      {...base,id:'later',dueAt:now+1000},
      {...base,id:'unseen',dueAt:null},
    ];expect(dueSummary(rows,now)).toEqual({due:2,overdue:1,todayDue:1,today:2});
  });
  it('moves only the latest schedule after an answer while retaining every real answer day',()=>{
    const s=source();s.events=[{...makeEvent('first',true),reviewedAt:'2026-11-09T03:00:00.000Z'}];
    expect(reviewCalendar(learningRows(s,now),s).scheduled.get('2026-11-10')?.culture).toBe(1);
    s.events.push({...makeEvent('second',true),reviewedAt:'2026-11-10T03:00:00.000Z'});
    const after=reviewCalendar(learningRows(s,now),s);expect(after.scheduled.has('2026-11-10')).toBe(false);expect(after.scheduled.get('2026-11-13')?.culture).toBe(1);expect(after.actual.get('2026-11-09')?.culture).toBe(1);expect(after.actual.get('2026-11-10')?.culture).toBe(1);
  });
});
describe('mastery is a read-only classification, not a replacement repetition algorithm',()=>{
  const learned={attempts:1,recent:[true],streak:1,lastAt:now-1000,dueAt:now+DAY};
  it('does not invent long-term retention from aggregate counts without interval evidence',()=>{
    expect(classifyMastery({...learned,attempts:0},now)).toBe('unseen');
    expect(classifyMastery(learned,now)).toBe('unknown');
    expect(classifyMastery({...learned,streak:100,recent:[true,true,true],dueAt:now-1},now)).toBe('unknown');
  });
  it('does not call rapid recovered answers stable and does not delete lifetime mistakes',()=>{
    const s=source();s.events=Array.from({length:20},(_,i)=>({...makeEvent('wrong-'+i,false),reviewedAt:new Date(now-(30-i)*DAY).toISOString()}));
    s.events.push(...Array.from({length:3},(_,i)=>({...makeEvent('right-'+i,true),reviewedAt:new Date(now-(3-i)*1000).toISOString()})));
    expect(learningRows(s,now)[0]).toMatchObject({mastery:'initial',correct:3,wrong:20,streak:3});
  });
  it('keeps area namespaces separate and excludes ordering and old reverse answers from normal statistics',()=>{
    const s=source();s.catalog.cards=[makeCard('year-a::event-year')];s.events=[makeEvent('c',false,9,'year-a::event-year')];
    s.years!.events=[{id:'old-reverse',questionId:'year-a::year-event',correct:true,at:'2026-11-09T03:00:00.000Z',sessionId:'test'}];
    s.years!.orderingEvents=[{id:'order',questionId:'test',itemIds:[],submittedIds:[],correctOrderIds:[],correct:false,at:'2026-11-09T03:00:00.000Z',sessionId:'test'}];
    const before=JSON.stringify(s),rows=learningRows(s,now);
    expect(rows[0]).toMatchObject({area:'culture',mastery:'initial',wrong:1});expect(rows[1]).toMatchObject({area:'years',mastery:'unseen',attempts:0});expect(reviewCalendar(rows,s).actual.get('2026-11-09')).toEqual({culture:1,years:0,total:1});expect(JSON.stringify(s)).toBe(before);
  });
  it('counts and sorts weaker ranges first, with broad culture regions and exact year classifications',()=>{
    const s=source();s.catalog.items.push(makeItem('roman',{region:'ローマ',level:4}));s.catalog.cards.push(makeCard('roman-card',{knowledgeId:'roman'}));
    const rows=learningRows(s,now);expect(masteryCounts(rows)).toEqual({unseen:3,initial:0,learning:0,stable:0,unknown:0});
    expect(masteryGroups(rows.filter(row=>row.area==='culture'),'region')).toMatchObject([{value:'ヨーロッパ',total:2}]);
    expect(masteryGroups(rows.filter(row=>row.area==='years'),'era')[0].value).toBe('試験時代');
    const mixed=rows.map((row,i)=>({...row,region:i?'strong':'weak',mastery:i?'stable' as const:'initial' as const}));expect(masteryGroups(mixed,'region')[0].value).toBe('weak');
  });
  it('excludes deleted knowledge/cards from future schedules, retains actual past answers, and tolerates an unloaded year DB',()=>{
    const s=source();s.events=[makeEvent('old',false)];s.catalog.items[0].deleted=true;s.years=null;
    expect(learningRows(s,now)).toEqual([]);expect(reviewCalendar([],s).actual.get('2026-11-09')?.culture).toBe(1);
    s.catalog.items[0].deleted=false;s.catalog.cards[0].deleted=true;expect(learningRows(s,now)).toEqual([]);
  });
});
