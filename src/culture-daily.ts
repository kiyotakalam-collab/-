import {getProgress,priority,selectCards} from './core';
import {DEFAULT_FILTER,type Catalog,type ReviewEvent} from './types';
import type {ComparisonEvent} from './culture-feature-types';
import {stableHash} from './culture-compare';

export type DailyCategory='due'|'weak'|'unseen'|'fill';
export interface DailyPlan {
  dateKey:string; generatedAt:string; catalogVersion:number; cardIds:string[];
  categories:Record<string,DailyCategory>;
}
export function localDateKey(at:Date|number=Date.now()):string{return new Date(at).toLocaleDateString('sv-SE');}
function confusionBoost(events:ComparisonEvent[],now:number){
  const latest=new Map<string,ComparisonEvent[]>();
  for(const e of [...events].sort((a,b)=>a.reviewedAt.localeCompare(b.reviewedAt))) {const rows=latest.get(e.relationId)??[];rows.push(e);latest.set(e.relationId,rows.slice(-5));}
  const boosts=new Map<string,number>();
  for(const rows of latest.values()){
    const last=rows.at(-1)!;if(now-Date.parse(last.reviewedAt)>30*86400000)continue;
    const weight=Math.min(4,rows.filter(e=>!e.correct).length*.8)*(last.correct?.35:1);
    for(const e of rows.filter(e=>!e.correct))for(const id of [e.sourceKnowledgeId,e.targetKnowledgeId,e.selectedTargetId].filter(Boolean) as string[])boosts.set(id,Math.min(4,(boosts.get(id)??0)+weight));
  }return boosts;
}
export function generateDailyPlan(catalog:Catalog,events:ReviewEvent[],comparisons:ComparisonEvent[],now:Date|number=Date.now()):DailyPlan{
  const at=Number(now),dateKey=localDateKey(at),cards=selectCards(catalog,events,structuredClone(DEFAULT_FILTER),at);
  const progress=getProgress(events),boosts=confusionBoost(comparisons,at);
  const rank=(id:string,knowledgeId:string)=>priority(progress.get(id),at)+(boosts.get(knowledgeId)??0);
  const tie=(id:string)=>stableHash(dateKey+'|'+id);
  const sorted=[...cards].sort((a,b)=>rank(b.id,b.knowledgeId)-rank(a.id,a.knowledgeId)||tie(a.id)-tie(b.id)||a.id.localeCompare(b.id));
  const due=sorted.filter(c=>{const p=progress.get(c.id);return p?.nextReviewAt&&Date.parse(p.nextReviewAt)<=at;});
  const dueIds=new Set(due.map(c=>c.id));
  const weak=sorted.filter(c=>{const p=progress.get(c.id);return !dueIds.has(c.id)&&((p?.recent.includes(false)??false)||(boosts.get(c.knowledgeId)??0)>0);});
  const unseen=sorted.filter(c=>!progress.has(c.id));
  const categories:Record<string,DailyCategory>={},cardIds:string[]=[];
  const take=(rows:typeof cards,n:number,category:DailyCategory)=>{let added=0;for(const c of rows){if(cardIds.length>=20||added>=n)break;if(categories[c.id])continue;cardIds.push(c.id);categories[c.id]=category;added++;}};
  take(due,10,'due');take(weak,6,'weak');take(unseen,4,'unseen');
  take(due,20,'due');take(weak,20,'weak');take(unseen,20,'unseen');take(sorted,20,'fill');
  return {dateKey,generatedAt:new Date(at).toISOString(),catalogVersion:catalog.version,cardIds,categories};
}
export function reconcileDailyPlan(old:DailyPlan|null,catalog:Catalog,events:ReviewEvent[],comparisons:ComparisonEvent[],now:Date|number=Date.now()):DailyPlan{
  const fresh=generateDailyPlan(catalog,events,comparisons,now);
  if(!old||old.dateKey!==fresh.dateKey)return fresh;
  const valid=new Set(selectCards(catalog,events,structuredClone(DEFAULT_FILTER),Number(now)).map(c=>c.id));
  const ids=[...new Set(old.cardIds)].filter(id=>valid.has(id)).slice(0,20),categories:Record<string,DailyCategory>={};
  for(const id of ids)categories[id]=old.categories?.[id]??'fill';
  for(const id of fresh.cardIds){if(ids.length>=Math.min(20,valid.size))break;if(!ids.includes(id)){ids.push(id);categories[id]=fresh.categories[id];}}
  return {...old,catalogVersion:catalog.version,cardIds:ids,categories};
}
export function completedDaily(plan:DailyPlan,events:ReviewEvent[],now:Date|number=Date.now()):Set<string>{
  const ids=new Set(plan.cardIds),date=localDateKey(now);
  return new Set(events.filter(e=>ids.has(e.cardId)&&localDateKey(new Date(e.reviewedAt))===date&&date===plan.dateKey).map(e=>e.cardId));
}
