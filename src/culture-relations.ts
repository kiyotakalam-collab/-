import type { Catalog, KnowledgeItem, Source } from './types';
import type { ComparisonSet, CultureRelation, CultureRelations, RelationType } from './culture-feature-types';

export const RELATIONS_URL = 'https://raw.githubusercontent.com/kiyotakalam-collab/-/main/public/culture-relations.json';
export const EMPTY_RELATIONS: CultureRelations = {schemaVersion:1,version:0,updatedAt:'1970-01-01T00:00:00.000Z',relations:[],comparisonSets:[]};
export const RELATION_LABELS: Record<RelationType,string> = {
  authored:'著作・編纂', founded:'創始した', advocated:'唱えた', influenced:'影響を与えた',
  criticized:'批判した', developed:'発展させた', contrasted_with:'比較される', associated_with:'関連する',
};
const relationTypes = new Set(Object.keys(RELATION_LABELS));
const MAX_RELATIONS = 50_000;
function invalid(message:string):never { throw new Error('関係データ：'+message); }
function record(value:unknown,label:string):Record<string,unknown>{
  if(!value||typeof value!=='object'||Array.isArray(value))invalid(label+'の形式が不正です。');
  return value as Record<string,unknown>;
}
function text(value:unknown,label:string,max=4000):string{
  if(typeof value!=='string'||!value.trim()||value.length>max)invalid(label+'が不正です。');
  return value;
}
function identifier(value:unknown,label:string):string{
  const result=text(value,label,200);
  if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(result))invalid(label+'の固定IDが不正です。');
  return result;
}
function list<T>(value:unknown,label:string,parse:(entry:unknown,label:string)=>T,max:number):T[]{
  if(!Array.isArray(value)||value.length>max)invalid(label+'の配列が不正です。');
  return value.map((entry,index)=>parse(entry,`${label}[${index}]`));
}
function source(input:unknown,label:string):Source{
  const value=record(input,label),result:Source={title:text(value.title,label+'.title')};
  if(value.url!==undefined){
    const url=text(value.url,label+'.url');
    let parsed:URL;try{parsed=new URL(url);}catch{return invalid(label+'の出典URLが不正です。');}
    if(!['http:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)invalid(label+'の出典URLが不正です。');
    result.url=url;
  }
  if(value.note!==undefined){if(typeof value.note!=='string'||value.note.length>8000)invalid(label+'の出典メモが不正です。');result.note=value.note;}
  return result;
}
function unique<T>(values:T[],key:(value:T)=>string,label:string):void{
  const seen=new Set<string>();for(const value of values){const id=key(value);if(seen.has(id))invalid(label+'が重複しています：'+id);seen.add(id);}
}
function relation(input:unknown,label:string):CultureRelation{
  const value=record(input,label);
  if(!relationTypes.has(String(value.type)))invalid(label+'の関係の種類が不正です。');
  if(!['verified','provisional'].includes(String(value.verification)))invalid(label+'の検証状態が不正です。');
  const result:CultureRelation={id:identifier(value.id,label+'.id'),fromId:identifier(value.fromId,label+'.fromId'),toId:identifier(value.toId,label+'.toId'),type:value.type as RelationType,description:text(value.description,label+'.description'),verification:value.verification as CultureRelation['verification'],sources:list(value.sources,label+'.sources',source,50)};
  if(result.fromId===result.toId)invalid(label+'で同じ項目同士は接続できません。');
  if(!result.sources.length)invalid(label+'には出典が必要です。');
  return result;
}
function comparison(input:unknown,label:string):ComparisonSet{
  const value=record(input,label);
  if(!['forward','reverse'].includes(String(value.direction)))invalid(label+'の出題方向が不正です。');
  const relationIds=list(value.relationIds,label+'.relationIds',identifier,5);
  if(relationIds.length<3)invalid(label+'の組み合わせは3〜5個にしてください。');
  unique(relationIds,x=>x,label+'の関係ID');
  if(value.level!==undefined&&![1,2,3,4].includes(Number(value.level)))invalid(label+'の難易度が不正です。');
  if(value.level!==undefined&&typeof value.level!=='number')invalid(label+'の難易度が不正です。');
  return {id:identifier(value.id,label+'.id'),title:text(value.title,label+'.title'),description:text(value.description,label+'.description'),relationIds,direction:value.direction as ComparisonSet['direction'],...(value.level===undefined?{}:{level:value.level as ComparisonSet['level']})};
}

/** Structural errors reject the entire received file before persistence. */
export function validateRelations(input:unknown):CultureRelations{
  const value=record(input,'ファイル');
  if(value.schemaVersion!==1||!Number.isSafeInteger(value.version)||(value.version as number)<0)invalid('未対応の形式またはバージョンです。');
  const updatedAt=text(value.updatedAt,'updatedAt',40);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(updatedAt)||!Number.isFinite(Date.parse(updatedAt))||new Date(updatedAt).toISOString()!==updatedAt)invalid('更新日時はUTCのISO日時にしてください。');
  const relations=list(value.relations,'relations',relation,MAX_RELATIONS),comparisonSets=list(value.comparisonSets,'comparisonSets',comparison,10_000);
  unique(relations,x=>x.id,'関係ID');
  unique(relations,x=>{
    const ends=x.type==='contrasted_with'?[x.fromId,x.toId].sort():[x.fromId,x.toId];
    return `${ends[0]}|${x.type}|${ends[1]}`;
  },'同一の関係');
  unique(comparisonSets,x=>x.id,'比較セットID');
  return {schemaVersion:1,version:value.version as number,updatedAt,relations,comparisonSets};
}

export interface ResolvedRelations { relations:CultureRelation[]; comparisonSets:ComparisonSet[]; diagnostics:string[] }

/** The pair orientation is for matching only; it never changes the stored edge. */
export function comparisonEndpoints(relation:CultureRelation,direction:ComparisonSet['direction']):{sourceId:string;targetId:string}{
  return direction==='reverse'?{sourceId:relation.toId,targetId:relation.fromId}:{sourceId:relation.fromId,targetId:relation.toId};
}
function semanticIssue(relation:CultureRelation,from:KnowledgeItem,to:KnowledgeItem):string|null{
  if(relation.type==='authored'&&(from.kind!=='person'||to.kind!=='work'))return '著者と作品の種類が一致しません';
  if(relation.type==='founded'&&(from.kind!=='person'||!['concept','building'].includes(to.kind)))return '創始者と対象の種類が一致しません';
  if(relation.type==='advocated'&&(from.kind!=='person'||to.kind!=='concept'))return '提唱者と思想の種類が一致しません';
  return null;
}

/** Resolve references against the current live catalogue, without guessing facts. */
export function resolveRelations(data:CultureRelations,catalog:Catalog):ResolvedRelations{
  const items=new Map(catalog.items.map(item=>[item.id,item]));
  const diagnostics:string[]=[],relations:CultureRelation[]=[];
  for(const entry of data.relations){
    const from=items.get(entry.fromId),to=items.get(entry.toId);
    if(!from||!to){diagnostics.push(`${entry.id}：参照先がありません。`);continue;}
    if(from.deleted||to.deleted){diagnostics.push(`${entry.id}：出題停止の項目を除外しました。`);continue;}
    const issue=semanticIssue(entry,from,to);
    if(issue){diagnostics.push(`${entry.id}：${issue}。`);continue;}
    relations.push(entry);
  }
  const byId=new Map(relations.map(entry=>[entry.id,entry]));
  const forward=new Map<RelationType,Map<string,Set<string>>>(),reverse=new Map<RelationType,Map<string,Set<string>>>();
  const addAnswer=(index:Map<RelationType,Map<string,Set<string>>>,type:RelationType,source:string,target:string)=>{
    const map=index.get(type)??new Map<string,Set<string>>(),values=map.get(source)??new Set<string>();
    values.add(target);map.set(source,values);index.set(type,map);
  };
  for(const entry of relations){addAnswer(forward,entry.type,entry.fromId,entry.toId);addAnswer(reverse,entry.type,entry.toId,entry.fromId);}
  const comparisonSets:ComparisonSet[]=[];
  for(const set of data.comparisonSets){
    const entries=set.relationIds.map(id=>byId.get(id));
    if(entries.some(x=>!x)){diagnostics.push(`${set.id}：比較に必要な関係がありません。`);continue;}
    const resolved=entries as CultureRelation[],types=new Set(resolved.map(entry=>entry.type));
    if(types.size!==1){diagnostics.push(`${set.id}：異なる種類の対応を混在させることはできません。`);continue;}
    const pairs=resolved.map(entry=>comparisonEndpoints(entry,set.direction));
    const sourceIds=new Set(pairs.map(pair=>pair.sourceId)),targetIds=new Set(pairs.map(pair=>pair.targetId));
    if(sourceIds.size!==pairs.length||targetIds.size!==pairs.length){diagnostics.push(`${set.id}：対応が一対一になっていません。`);continue;}
    const known=(set.direction==='reverse'?reverse:forward).get(resolved[0].type)!;
    if(pairs.some(pair=>{const answers=known.get(pair.sourceId);return !answers?.has(pair.targetId)||[...answers].filter(id=>targetIds.has(id)).length!==1;})){diagnostics.push(`${set.id}：複数の正解が成立するため除外しました。`);continue;}
    comparisonSets.push(set);
  }
  return {relations,comparisonSets,diagnostics};
}

export interface RelationIndex extends ResolvedRelations {
  byId:Map<string,CultureRelation>;
  byKnowledgeId:Map<string,CultureRelation[]>;
  setsByKnowledgeId:Map<string,ComparisonSet[]>;
}
/** Build once per data/catalogue update, then use the maps while browsing. */
export function createRelationIndex(data:CultureRelations,catalog:Catalog):RelationIndex{
  const resolved=resolveRelations(data,catalog),byId=new Map(resolved.relations.map(entry=>[entry.id,entry]));
  const byKnowledgeId=new Map<string,CultureRelation[]>(),setsByKnowledgeId=new Map<string,ComparisonSet[]>();
  for(const relation of resolved.relations)for(const id of [relation.fromId,relation.toId]){const rows=byKnowledgeId.get(id)??[];rows.push(relation);byKnowledgeId.set(id,rows);}
  for(const set of resolved.comparisonSets){const ids=new Set(set.relationIds.flatMap(id=>{const relation=byId.get(id)!;return [relation.fromId,relation.toId];}));for(const id of ids){const rows=setsByKnowledgeId.get(id)??[];rows.push(set);setsByKnowledgeId.set(id,rows);}}
  return {...resolved,byId,byKnowledgeId,setsByKnowledgeId};
}

export async function fetchRelationsData():Promise<CultureRelations>{
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12_000);
  try{
    const response=await fetch(`${RELATIONS_URL}?t=${Date.now()}`,{signal:controller.signal,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error(`関係データを取得できませんでした（HTTP ${response.status}）。`);
    if(Number(response.headers.get('content-length')??0)>3*1024*1024)throw new Error('関係データが大きすぎます。');
    const body=await response.text();if(new TextEncoder().encode(body).length>3*1024*1024)throw new Error('関係データが大きすぎます。');
    return validateRelations(JSON.parse(body));
  }finally{clearTimeout(timer);}
}
