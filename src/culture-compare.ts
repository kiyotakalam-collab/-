import type {Catalog} from './types';
import type {ComparisonEvent, ComparisonSet, CultureRelation, PreparedComparison} from './culture-feature-types';

export function stableHash(value:string):number {
  let n=2166136261;for(const c of value){n^=c.codePointAt(0)!;n=Math.imul(n,16777619);}return n>>>0;
}
export function prepareComparison(set:ComparisonSet,relations:CultureRelation[],catalog:Catalog,seed:string):PreparedComparison {
  const items=new Map(catalog.items.filter(i=>!i.deleted).map(i=>[i.id,i]));
  const byId=new Map(relations.map(r=>[r.id,r]));
  if(set.relationIds.length<3||set.relationIds.length>5||new Set(set.relationIds).size!==set.relationIds.length)throw Error('比較セットは重複のない3〜5組にしてください。');
  const pairs=set.relationIds.map(id=>{
    const r=byId.get(id);if(!r||!items.has(r.fromId)||!items.has(r.toId))throw Error('比較セットの参照先が見つかりません。');
    const sourceKnowledgeId=set.direction==='reverse'?r.toId:r.fromId;
    const targetKnowledgeId=set.direction==='reverse'?r.fromId:r.toId;
    return {relationId:id,sourceKnowledgeId,targetKnowledgeId,prompt:items.get(sourceKnowledgeId)!.canonicalName,answer:items.get(targetKnowledgeId)!.canonicalName};
  });
  const type=byId.get(set.relationIds[0])!.type;
  if(set.relationIds.some(id=>byId.get(id)!.type!==type))throw Error('同じ種類の関係を比較してください。');
  if(new Set(pairs.map(p=>p.sourceKnowledgeId)).size!==pairs.length||new Set(pairs.map(p=>p.targetKnowledgeId)).size!==pairs.length)throw Error('一対一に対応しない比較セットです。');
  // Reject another fact within this candidate pool that would make an answer ambiguous.
  const sourceIds=new Set(pairs.map(p=>p.sourceKnowledgeId)),targetIds=new Set(pairs.map(p=>p.targetKnowledgeId));
  for(const r of relations){
    if(r.type!==type)continue;
    const source=set.direction==='reverse'?r.toId:r.fromId,target=set.direction==='reverse'?r.fromId:r.toId;
    if(sourceIds.has(source)&&targetIds.has(target)&&!pairs.some(p=>p.sourceKnowledgeId===source&&p.targetKnowledgeId===target))throw Error('候補内に複数の正解が成立する関係があります。');
  }
  const choices=pairs.map(p=>({id:p.targetKnowledgeId,label:p.answer})).sort((a,b)=>stableHash(seed+'|'+a.id)-stableHash(seed+'|'+b.id)||a.id.localeCompare(b.id));
  return {set,pairs,choices};
}
export function validateComparisonEvent(value:unknown):ComparisonEvent{
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('識別履歴の形式が不正です。');
  const v=value as Record<string,unknown>,keys=['id','comparisonSetId','relationId','sourceKnowledgeId','targetKnowledgeId','sessionId'] as const;
  for(const key of keys)if(typeof v[key]!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,399}$/.test(v[key] as string))throw Error('識別履歴のIDが不正です。');
  if(v.selectedTargetId!==null&&(typeof v.selectedTargetId!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,199}$/.test(v.selectedTargetId)))throw Error('識別履歴の選択先が不正です。');
  if(typeof v.correct!=='boolean'||v.correct!==(v.selectedTargetId===v.targetKnowledgeId)||typeof v.reviewedAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.reviewedAt)||!Number.isFinite(Date.parse(v.reviewedAt)))throw Error('識別履歴の正誤または日時が不正です。');
  if(new Date(v.reviewedAt as string).toISOString()!==v.reviewedAt)throw Error('識別履歴の日時が不正です。');
  return Object.fromEntries([...keys,'selectedTargetId','correct','reviewedAt'].map(key=>[key,v[key]])) as unknown as ComparisonEvent;
}
export function gradeComparison(prepared:PreparedComparison,selections:Record<string,string>,sessionId:string,at:string):ComparisonEvent[]{
  const selected=prepared.pairs.map(p=>selections[p.relationId]);
  const candidates=new Set(prepared.choices.map(c=>c.id));
  if(selected.some(id=>!id||!candidates.has(id))||new Set(selected).size!==selected.length)throw Error('全ての組み合わせを、重複なく選択してください。');
  return prepared.pairs.map(p=>({id:`${sessionId}::${p.relationId}`,comparisonSetId:prepared.set.id,relationId:p.relationId,
    sourceKnowledgeId:p.sourceKnowledgeId,targetKnowledgeId:p.targetKnowledgeId,selectedTargetId:selections[p.relationId],
    correct:selections[p.relationId]===p.targetKnowledgeId,reviewedAt:at,sessionId}));
}
export function comparisonProgress(events:ComparisonEvent[]){
  const map=new Map<string,{correct:number;wrong:number;lastAt:string;recent:boolean[]}>();
  for(const e of [...events].sort((a,b)=>a.reviewedAt.localeCompare(b.reviewedAt)||a.id.localeCompare(b.id))){
    const p=map.get(e.relationId)??{correct:0,wrong:0,lastAt:'',recent:[]};
    e.correct?p.correct++:p.wrong++;p.lastAt=e.reviewedAt;p.recent=[...p.recent.slice(-4),e.correct];map.set(e.relationId,p);
  }return map;
}
