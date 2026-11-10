import type {Catalog,ReviewEvent} from '../src/types';
import type {CultureRelations,ComparisonEvent} from '../src/culture-feature-types';
import {prepareComparison,gradeComparison} from '../src/culture-compare';
import {makeCard,makeCatalog,makeItem,TIME} from './fixtures';

export function featureFixture(){
  const base=makeCatalog();
  const items=['a','b','c'].flatMap(id=>[
    makeItem('author-'+id,{canonicalName:'架空著者'+id}),
    makeItem('work-'+id,{kind:'work',canonicalName:'架空著作'+id}),
  ]);
  const catalog:Catalog={...base,items:[...base.items,...items],cards:[...base.cards,...items.map(item=>makeCard('card-'+item.id,{knowledgeId:item.id,question:item.canonicalName+'の知識は？',answer:item.canonicalName}))]};
  const relations:CultureRelations={schemaVersion:1,version:1,updatedAt:TIME,
    relations:['a','b','c'].map(id=>({id:'rel-'+id,fromId:'author-'+id,toId:'work-'+id,type:'authored',description:'架空のテスト対応'+id,verification:'provisional',sources:[{title:'テスト専用資料'}]})),
    comparisonSets:[{id:'set-authors',title:'架空著者と作品',description:'テスト専用の3組',relationIds:['rel-a','rel-b','rel-c'],direction:'reverse',level:2}]};
  return {catalog,relations};
}
export function comparisonBatch(session='compare-one',wrong=false,at=TIME):ComparisonEvent[]{
  const {catalog,relations}=featureFixture(),prepared=prepareComparison(relations.comparisonSets[0],relations.relations,catalog,session);
  const selected=Object.fromEntries(prepared.pairs.map(p=>[p.relationId,p.targetKnowledgeId]));
  if(wrong){selected['rel-a']='author-b';selected['rel-b']='author-a';}
  return gradeComparison(prepared,selected,session,at);
}
export function manyCards(n:number):Catalog {
  const items=Array.from({length:n},(_,i)=>makeItem('item-'+i,{canonicalName:'架空項目'+i}));
  return {schemaVersion:1,version:1,updatedAt:TIME,items,cards:items.map(i=>makeCard('card-'+i.id,{knowledgeId:i.id,question:i.canonicalName+'は？',answer:i.canonicalName}))};
}
export function review(id:string,cardId:string,correct:boolean,at:string):ReviewEvent{return {id,cardId,correct,reviewedAt:at,sessionId:'normal-test'};}
