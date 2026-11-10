import { getProgress } from './core';
import { yearProgress, type YearSnapshot } from './years';
import { activeAmbiguous, ambiguousProgress, type AmbSnapshot } from './ambiguous';
import { retentionFromEvidence, reviewUrgency, type Retention, type Urgency } from './retention';
import { type ErrorAnnotation, type CauseArea, type ErrorCause } from './error-causes';
import type { Catalog, ReviewEvent } from './types';

export const ANALYSIS_AREAS:Record<CauseArea,string>={culture:'文化史',years:'年号一問一答',ordering:'年代整序',ambiguous:'曖昧用語'};
export const REGIONS=['ヨーロッパ','東アジア','東南アジア','南アジア','西アジア','アフリカ','アメリカ','その他','未分類'];
export const ERAS=['古代','中世','近世','近代','現代','未分類'];
export const FIELDS=['政治史','外交史','戦争史','経済・社会史','宗教史','文化史','その他','未分類'];
/** Exact display aliases only. Never infer a field from a question/event name. */
export const REGION_ALIASES:Record<string,string>={ヨーロッパ:'ヨーロッパ',欧州:'ヨーロッパ',西ヨーロッパ:'ヨーロッパ',ギリシア:'ヨーロッパ',ギリシャ:'ヨーロッパ',ローマ:'ヨーロッパ',ヘレニズム:'ヨーロッパ',イギリス:'ヨーロッパ',フランス:'ヨーロッパ',ドイツ:'ヨーロッパ',イタリア:'ヨーロッパ',中国:'東アジア',中国周辺:'東アジア',東アジア:'東アジア',日本:'東アジア',朝鮮:'東アジア',東南アジア:'東南アジア',南アジア:'南アジア',インド:'南アジア',西アジア:'西アジア',イラン:'西アジア',メソポタミア:'西アジア',アフリカ:'アフリカ',エジプト:'アフリカ',アメリカ:'アメリカ',北アメリカ:'アメリカ',南アメリカ:'アメリカ',オセアニア:'その他',世界:'その他',アジア:'その他','アジア・アフリカ':'その他',イスラーム世界:'その他',東地中海:'その他',その他:'その他'};
export const ERA_ALIASES:Record<string,string>={古代:'古代',古代ギリシア:'古代',ヘレニズム:'古代',古代ローマ:'古代',中世西ヨーロッパ:'中世',ビザンツ帝国:'未分類',中世:'中世',近世:'近世',近代:'近代',現代:'現代','古代〜漢':'古代','宋・元':'中世','15世紀':'未分類','16世紀':'近世','17世紀':'近世','18世紀':'近世','19世紀':'近代','20世紀':'現代','21世紀':'現代','ルネサンス':'近世','ルネサンス・宗教改革':'近世','明・清':'未分類','魏晋南北朝〜唐':'未分類'};
export const FIELD_ALIASES:Record<string,string>={政治史:'政治史',政治:'政治史',外交史:'外交史',外交:'外交史',条約:'外交史','条約・外交':'外交史',戦争史:'戦争史',戦争:'戦争史','経済・社会史':'経済・社会史',経済史:'経済・社会史',社会史:'経済・社会史',宗教史:'宗教史',宗教:'宗教史',仏教:'宗教史',文化史:'文化史',文学:'文化史',哲学:'文化史','哲学・思想':'文化史',思想:'文化史',美術:'文化史',建築:'文化史',科学:'文化史',音楽:'文化史',歴史学:'文化史',その他:'その他',地理学:'文化史',法学:'文化史',教育:'文化史',文化運動:'文化史',政治思想:'文化史',自然科学:'文化史',彫刻:'文化史',医学:'文化史','儒学・思想':'文化史','文学・文字':'文化史','美術・建築':'文化史','建築・美術':'文化史','科学・医学':'文化史','科学・技術':'文化史','科学・数学':'文化史','文字・言語':'文化史','言語・美術':'文化史','文化交流・言語':'文化史','科学・文化交流':'文化史','東西文化交流':'文化史','諸子百家':'文化史','諸子百家・文学':'文化史','大編纂事業':'文化史','元代文学・工芸・科学':'文化史','六朝の文学・美術・学術':'文化史','唐の文学・芸術':'文化史','小説・実学・美術':'文化史','歴史学・地理学':'文化史','魏晋南北朝の文化':'文化史','史学・美術・技術':'文化史','漢代の文字・宗教':'その他','漢代の学問・宗教':'その他','宗教・思想':'その他','宗教・文学':'その他','宗教・歴史':'その他','宗教・言語':'その他','ヒンドゥー教・文学':'その他','仏教・美術':'その他','唐の儒学・宗教':'その他','建築・教育':'文化史','政治・文化保護':'その他'};
const map=(value:string,aliases:Record<string,string>)=>Object.hasOwn(aliases,value.normalize('NFKC').trim())?aliases[value.normalize('NFKC').trim()]:'未分類';
export const analysisRegion=(value:string)=>map(value,REGION_ALIASES);
export const analysisEra=(value:string)=>map(value,ERA_ALIASES);
export const analysisField=(value:string)=>map(value,FIELD_ALIASES);
export interface AnalysisEvent {id:string;correct:boolean;at:string}
export interface AnalysisRow {area:CauseArea;id:string;title:string;region:string;era:string;field:string;rawTags:string;events:AnalysisEvent[];retention:Retention;urgency:Urgency;dueAt:number|null}
export interface AnalysisSource {catalog:Catalog;events:ReviewEvent[];years:YearSnapshot|null;ambiguous:AmbSnapshot|null;errorCauses:ErrorAnnotation[]}
const bucket=<T>(values:T[],key:(value:T)=>string)=>{const map=new Map<string,T[]>();for(const value of values){const id=key(value),rows=map.get(id)??[];rows.push(value);map.set(id,rows);}return map;};
function tags(items:{region:string;era:string;field?:string}[]){
  const merge=(values:string[],mixed:string)=>{const unique=[...new Set(values)];return unique.length===1?unique[0]:unique.length?mixed:'未分類';};
  return {region:merge(items.map(item=>analysisRegion(item.region)),'その他'),era:merge(items.map(item=>analysisEra(item.era)),'未分類'),field:merge(items.map(item=>analysisField(item.field??'')),'その他'),rawTags:[...new Set(items.map(item=>`${item.region} ／ ${item.era} ／ ${item.field||'分野タグなし'}`))].join('、')};
}
export function analysisRows(source:AnalysisSource,now=Date.now()):AnalysisRow[]{
  const rows:AnalysisRow[]=[],items=new Map(source.catalog.items.filter(i=>!i.deleted).map(i=>[i.id,i])),cultureEvents=bucket(source.events,e=>e.cardId),cp=getProgress(source.events);
  for(const card of source.catalog.cards){const item=items.get(card.knowledgeId);if(card.deleted||!item)continue;const events=(cultureEvents.get(card.id)??[]).map(e=>({id:e.id,correct:e.correct,at:e.reviewedAt})),p=cp.get(card.id),due=p?.nextReviewAt?Date.parse(p.nextReviewAt):null;rows.push({area:'culture',id:card.id,title:card.question,...tags([item]),events,retention:retentionFromEvidence(p?.retention,p?.attempts),urgency:reviewUrgency(due,p?.recent.at(-1),now),dueAt:due});}
  if(source.years){const c=source.years.catalog,events=bucket(source.years.events,e=>e.questionId),p=yearProgress(source.years.events),terms=new Map(c.items.filter(t=>!t.deleted).map(t=>[t.id,t]));
    for(const item of terms.values()){const id=item.id+'::event-year',progress=p.get(id),history=(events.get(id)??[]).map(e=>({id:e.id,correct:e.correct,at:e.at})),due=progress?.dueAt??null;rows.push({area:'years',id,title:item.event,...tags([item]),events:history,retention:retentionFromEvidence(progress?.retention,progress?.attempts),urgency:reviewUrgency(due,progress?.recent.at(-1),now),dueAt:due});}
    for(const [id,history]of bucket(source.years.orderingEvents,e=>e.questionId)){const termsInSet=history[0].itemIds.map(id=>terms.get(id));if(termsInSet.some(t=>!t))continue;rows.push({area:'ordering',id,title:termsInSet.map(t=>t!.event).join(' ／ '),...tags(termsInSet as NonNullable<typeof termsInSet[number]>[]),events:history.map(e=>({id:e.id,correct:e.correct,at:e.at})),retention:'unknown',urgency:'unscheduled',dueAt:null});}
  }
  if(source.ambiguous){const {catalog,events}=source.ambiguous,active=activeAmbiguous(catalog),history=bucket(events,e=>e.questionId),progress=ambiguousProgress(events);for(const card of active.cards){const p=progress.get(card.id),due=p?Date.parse(p.nextReviewAt):null;rows.push({area:'ambiguous',id:card.id,title:card.prompt,...tags(card.termIds.map(id=>active.terms.get(id)!)),events:(history.get(card.id)??[]).map(e=>({id:e.id,correct:e.correct,at:e.at})),retention:retentionFromEvidence(p?.retention,p?.attempts),urgency:reviewUrgency(due,p?.recent.at(-1),now),dueAt:due});}}
  return rows;
}
export function analysisStats(rows:AnalysisRow[],annotations:ErrorAnnotation[],now=Date.now()){
  const annotated=new Map(annotations.map(a=>[a.area+':'+a.eventId,a.cause]));
  const events=rows.flatMap(row=>row.events.map(e=>({...e,area:row.area}))).sort((a,b)=>b.at.localeCompare(a.at)||a.id.localeCompare(b.id));
  const recent=events.slice(0,20),attempts=events.length,correct=events.filter(e=>e.correct).length,wrong=attempts-correct;
  const retention:Record<Retention,number>={unseen:0,initial:0,learning:0,stable:0,unknown:0},urgency:Record<Urgency,number>={future:0,today:0,overdue:0,short:0,unscheduled:0},causes:Record<ErrorCause|'unrecorded',number>={A:0,B:0,C:0,D:0,E:0,unrecorded:0};
  for(const row of rows){retention[row.retention]++;urgency[row.urgency]++;}for(const e of events)if(!e.correct)causes[annotated.get(e.area+':'+e.id)??'unrecorded']++;
  const learned=rows.filter(row=>row.events.length).length,sufficient=rows.length>=5&&learned>=5&&attempts>=20&&recent.length>=10;
  const accuracy=attempts?correct/attempts:null,recentAccuracy=recent.length?recent.filter(e=>e.correct).length/recent.length:null;
  const weakness=sufficient?(1-recentAccuracy!)*.6+(retention.initial+retention.learning*.5+retention.unknown*.5)/Math.max(1,learned)*.3+(1-accuracy!)*.1:null;
  return {registered:rows.length,learned,attempts,wrong,accuracy,recentAttempts:recent.length,recentAccuracy,retention,urgency,causes,sufficient,weakness,due:rows.filter(row=>row.dueAt!==null&&row.dueAt<=now).length,events};
}
export function analysisGroups(rows:AnalysisRow[],dimension:'region'|'era'|'field',annotations:ErrorAnnotation[],now=Date.now()){
  const values=dimension==='region'?REGIONS:dimension==='era'?ERAS:FIELDS;
  return values.map(value=>({value,...analysisStats(rows.filter(row=>row[dimension]===value),annotations,now)})).sort((a,b)=>Number(b.sufficient)-Number(a.sufficient)||(b.weakness??-1)-(a.weakness??-1)||a.value.localeCompare(b.value,'ja'));
}
