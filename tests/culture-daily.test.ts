import {describe,it,expect} from 'vitest';
import {completedDaily,generateDailyPlan,localDateKey,reconcileDailyPlan} from '../src/culture-daily';
import {getProgress} from '../src/core';
import type {ComparisonEvent,} from '../src/culture-feature-types';
import type {ReviewEvent} from '../src/types';
import {manyCards,review} from './culture-feature-fixtures';

const now=new Date('2026-11-09T12:00:00.000Z');
describe('persistent daily recommendation selection',()=>{
  it('selects 20 unique cards, aiming for 10 overdue, 6 recent weaknesses and 4 unseen',()=>{
    const catalog=manyCards(40);
    const due=catalog.cards.slice(0,12).map((c,i)=>review('due-'+i,c.id,false,'2026-11-01T00:00:00.000Z'));
    const weak=catalog.cards.slice(12,20).map((c,i)=>review('weak-'+i,c.id,false,'2026-11-09T11:59:00.000Z'));
    const input=[...due,...weak],before=JSON.stringify(input);
    const plan=generateDailyPlan(catalog,input,[],now);
    expect(plan.cardIds).toHaveLength(20);expect(new Set(plan.cardIds).size).toBe(20);
    expect(Object.values(plan.categories).filter(c=>c==='due')).toHaveLength(10);
    expect(Object.values(plan.categories).filter(c=>c==='weak')).toHaveLength(6);
    expect(Object.values(plan.categories).filter(c=>c==='unseen')).toHaveLength(4);
    expect(plan.cardIds.slice(0,10).every(id=>due.some(e=>e.cardId===id))).toBe(true);
    expect(generateDailyPlan(catalog,input,[],now)).toEqual(plan);
    expect(JSON.stringify(input)).toBe(before);
  });
  it('fills short buckets without duplicating cards and handles fewer than 20 or zero cards',()=>{
    const catalog=manyCards(30),events=[review('one-overdue',catalog.cards[0].id,false,'2026-11-01T00:00:00.000Z')];
    const plan=generateDailyPlan(catalog,events,[],now);
    expect(plan.cardIds).toHaveLength(20);expect(plan.cardIds[0]).toBe(catalog.cards[0].id);
    expect(Object.values(plan.categories).filter(c=>c==='due')).toHaveLength(1);
    expect(Object.values(plan.categories).filter(c=>c==='unseen')).toHaveLength(19);
    expect(generateDailyPlan(manyCards(5),[],[],now).cardIds).toHaveLength(5);
    expect(generateDailyPlan(manyCards(0),[],[],now).cardIds).toEqual([]);
    const allStudied=catalog.cards.map((c,i)=>review('right-'+i,c.id,true,'2026-11-09T11:00:00.000Z'));
    expect(generateDailyPlan(catalog,allStudied,[],now).cardIds).toHaveLength(20);
  });
  it('ranks a recent failure before a recovered high-lifetime-error card, even with bounded comparison boosts',()=>{
    const catalog=manyCards(30),a=catalog.cards[0].id,b=catalog.cards[1].id;
    const events=Array.from({length:10},(_,i)=>review('old-'+i,a,false,new Date(now.getTime()-100*86400000+i*1000).toISOString()));
    events.push(...Array.from({length:5},(_,i)=>review('recovery-'+i,a,true,new Date(now.getTime()-60000+i*1000).toISOString())));
    events.push(review('recent',b,false,'2026-11-09T11:59:00.000Z'));
    const comparisons:ComparisonEvent[]=Array.from({length:100},(_,i)=>({id:'c-'+i,comparisonSetId:'set',relationId:'rel-'+i,sourceKnowledgeId:'item-0',targetKnowledgeId:'item-28',selectedTargetId:'item-29',correct:false,reviewedAt:now.toISOString(),sessionId:'session-'+i}));
    const plan=generateDailyPlan(catalog,events,comparisons,now);
    expect(plan.cardIds.indexOf(b)).toBeLessThan(plan.cardIds.indexOf(a));
    expect(getProgress(events).get(a)).toMatchObject({wrong:10,correct:5,streak:5});
    expect(events).toHaveLength(16);
  });
  it('uses comparison mistakes as recommendation signals without creating normal review history',()=>{
    const catalog=manyCards(30),events:ReviewEvent[]=[];
    const comparisons:ComparisonEvent[]=[{id:'c',comparisonSetId:'set',relationId:'rel',sourceKnowledgeId:'item-0',targetKnowledgeId:'item-1',selectedTargetId:'item-2',correct:false,reviewedAt:now.toISOString(),sessionId:'s'}];
    const plan=generateDailyPlan(catalog,events,comparisons,now);
    for(const id of ['card-item-0','card-item-1','card-item-2'])expect(plan.cardIds).toContain(id);
    expect(getProgress(events).size).toBe(0);expect(events).toEqual([]);
  });
  it('keeps today’s saved order after new answers and generates a fresh plan tomorrow',()=>{
    const catalog=manyCards(40),first=generateDailyPlan(catalog,[],[],now);
    const changed=[review('later',first.cardIds.at(-1)!,false,now.toISOString())];
    const same=reconcileDailyPlan(first,catalog,changed,[],new Date('2026-11-09T13:00:00.000Z'));
    expect(same.cardIds).toEqual(first.cardIds);expect(same.generatedAt).toBe(first.generatedAt);
    const tomorrow=reconcileDailyPlan(first,catalog,[],[],new Date('2026-11-10T12:00:00.000Z'));
    expect(tomorrow.dateKey).not.toBe(first.dateKey);
    expect(tomorrow.cardIds).not.toEqual(first.cardIds);
  });
  it('removes stopped cards and replenishes without reordering the remaining current-day cards',()=>{
    const catalog=manyCards(30),first=generateDailyPlan(catalog,[],[],now),stopped=first.cardIds[0];
    const updated=structuredClone(catalog);updated.version=2;updated.cards.find(c=>c.id===stopped)!.deleted=true;
    const plan=reconcileDailyPlan(first,updated,[],[],now);
    expect(plan.cardIds).not.toContain(stopped);expect(plan.cardIds).toHaveLength(20);
    expect(plan.cardIds.slice(0,19)).toEqual(first.cardIds.slice(1));
    expect(new Set(plan.cardIds).size).toBe(20);
  });
  it('counts unique plan cards answered today in any session, not the number of answer events',()=>{
    const catalog=manyCards(30),plan=generateDailyPlan(catalog,[],[],now),id=plan.cardIds[0];
    const events=[review('a',id,false,now.toISOString()),review('b',id,true,now.toISOString()),review('c',id,true,now.toISOString()),review('old',plan.cardIds[1],true,'2026-11-08T00:00:00.000Z'),review('outside','not-in-plan',true,now.toISOString())];
    expect([...completedDaily(plan,events,now)]).toEqual([id]);
    expect(completedDaily(plan,events,new Date('2026-11-10T12:00:00.000Z')).size).toBe(0);
  });
  it('uses the local Japanese day at midnight rather than the UTC date',()=>{
    const old=process.env.TZ;process.env.TZ='Asia/Tokyo';
    try{
      expect(localDateKey(new Date('2026-11-09T14:59:59.000Z'))).toBe('2026-11-09');
      expect(localDateKey(new Date('2026-11-09T15:00:00.000Z'))).toBe('2026-11-10');
      const catalog=manyCards(25),jstMidnight=new Date('2026-11-09T15:00:01.000Z'),plan=generateDailyPlan(catalog,[],[],jstMidnight);
      expect(plan.dateKey).toBe('2026-11-10');
      const events=[review('before',plan.cardIds[0],true,'2026-11-09T14:59:59.000Z'),review('after',plan.cardIds[1],true,'2026-11-09T15:00:00.000Z')];
      expect([...completedDaily(plan,events,jstMidnight)]).toEqual([plan.cardIds[1]]);
    }finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
  });
});
