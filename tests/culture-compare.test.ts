import {describe,it,expect} from 'vitest';
import {comparisonProgress,gradeComparison,prepareComparison,validateComparisonEvent} from '../src/culture-compare';
import {featureFixture,comparisonBatch} from './culture-feature-fixtures';
import {TIME} from './fixtures';

describe('matching comparisons',()=>{
  it('uses three unique pairs with deterministic candidate order and can change answers before grading',()=>{
    const {catalog,relations}=featureFixture(),set=relations.comparisonSets[0];
    const before=JSON.stringify({catalog,relations});
    const p=prepareComparison(set,relations.relations,catalog,'session');
    expect(p.pairs).toHaveLength(3);
    expect(p.choices).toEqual(prepareComparison(set,relations.relations,catalog,'session').choices);
    expect(new Set(p.choices.map(c=>c.id)).size).toBe(3);
    const selected=Object.fromEntries(p.pairs.map(x=>[x.relationId,x.targetKnowledgeId]));
    selected['rel-a']='author-b';selected['rel-a']='author-a';
    const events=gradeComparison(p,selected,'session',TIME);
    expect(events.every(e=>e.correct)).toBe(true);
    expect(events.map(e=>e.sourceKnowledgeId)).toEqual(['work-a','work-b','work-c']);
    expect(events.map(e=>e.targetKnowledgeId)).toEqual(['author-a','author-b','author-c']);
    expect(JSON.stringify({catalog,relations})).toBe(before);
  });
  it('detects swapped matches and keeps accumulated confusion after later correct answers',()=>{
    const wrong=comparisonBatch('wrong',true),right=comparisonBatch('right',false,'2026-11-10T00:00:00.000Z');
    expect(wrong.map(e=>e.correct)).toEqual([false,false,true]);
    expect(comparisonProgress([...wrong,...right]).get('rel-a')).toMatchObject({wrong:1,correct:1,recent:[false,true]});
    expect(wrong.map(e=>e.id)).not.toEqual(right.map(e=>e.id));
  });
  it('does not allow partial answers, duplicate targets or targets outside the pool',()=>{
    const {catalog,relations}=featureFixture(),p=prepareComparison(relations.comparisonSets[0],relations.relations,catalog,'x');
    expect(()=>gradeComparison(p,{},'x',TIME)).toThrow(/全て/);
    expect(()=>gradeComparison(p,{'rel-a':'author-a','rel-b':'author-a','rel-c':'author-c'},'x',TIME)).toThrow(/重複/);
    expect(()=>gradeComparison(p,{'rel-a':'missing','rel-b':'author-b','rel-c':'author-c'},'x',TIME)).toThrow(/選択/);
  });
  it('rejects missing, deleted, non-one-to-one and ambiguous facts',()=>{
    const {catalog,relations}=featureFixture(),set=relations.comparisonSets[0];
    expect(()=>prepareComparison(set,relations.relations.slice(1),catalog,'x')).toThrow(/参照先/);
    const deleted=structuredClone(catalog);deleted.items.find(i=>i.id==='work-a')!.deleted=true;
    expect(()=>prepareComparison(set,relations.relations,deleted,'x')).toThrow(/参照先/);
    const repeated=relations.relations.map(r=>({...r,fromId:'author-a'}));
    expect(()=>prepareComparison(set,repeated,catalog,'x')).toThrow(/一対一/);
    const ambiguous=[...relations.relations,{...relations.relations[0],id:'extra',fromId:'author-b'}];
    expect(()=>prepareComparison(set,ambiguous,catalog,'x')).toThrow(/複数の正解/);
  });
  it('does not mistake another relation type for an alternate author answer',()=>{
    const {catalog,relations}=featureFixture();
    const extra={...relations.relations[0],id:'extra',fromId:'author-b',type:'associated_with' as const};
    expect(prepareComparison(relations.comparisonSets[0],[...relations.relations,extra],catalog,'x').pairs).toHaveLength(3);
  });
  it('requires 3–5 pairs of the same relation type and validates stored correctness',()=>{
    const {catalog,relations}=featureFixture(),set=relations.comparisonSets[0];
    expect(()=>prepareComparison({...set,relationIds:set.relationIds.slice(0,2)},relations.relations,catalog,'x')).toThrow(/3〜5/);
    expect(()=>prepareComparison({...set,relationIds:['rel-a','rel-a','rel-b']},relations.relations,catalog,'x')).toThrow(/重複/);
    expect(()=>prepareComparison(set,relations.relations.map((r,i)=>i? r:{...r,type:'associated_with'}),catalog,'x')).toThrow(/同じ種類/);
    const event=comparisonBatch()[0];expect(validateComparisonEvent(event)).toEqual(event);
    expect(()=>validateComparisonEvent({...event,correct:false})).toThrow(/正誤/);
    expect(()=>validateComparisonEvent({...event,reviewedAt:'not-a-date'})).toThrow(/日時/);
    expect(()=>validateComparisonEvent({...event,reviewedAt:'2026-02-30T00:00:00.000Z'})).toThrow(/日時/);
  });
});
