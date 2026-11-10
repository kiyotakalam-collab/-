/** Independent content and pure learning rules for the ambiguous-terms area. */
export const AMBIGUOUS_CAUSES=['名称類似','同一戦争・同一事件','同一国家','年代近接','同一地域','内容・役割類似','因果関係・前後関係','その他'] as const;
export type AmbiguousKind='recall'|'identify'|'compare';
export type Verification='verified'|'provisional'|'needs-review';
export interface AmbSource {title:string;url?:string;note?:string}
interface Managed {id:string;version:number;updatedAt:string;deleted:boolean;verification:Verification;sources:AmbSource[]}
export interface AmbTerm extends Managed {name:string;aliases:string[];date:string;region:string;era:string;field:string;description:string;relatedEvents:string[]}
export interface AmbGroup extends Managed {
  name:string;termIds:string[];causes:string[];registrationReason:string;essentialPoint:string;orderingNotes:string;description:string;
  comparison:{key:string;label:string;values:Record<string,string>}[];
  relationships:{fromId:string;toId:string;type:'before'|'causes'|'related';description:string;sources:AmbSource[];verification:Verification}[];
}
export interface AmbCard extends Managed {
  kind:AmbiguousKind;groupId:string;termIds:string[];prompt:string;answer:string;explanation:string;
  optionTermIds:string[];optionLabels:Record<string,string>;correctTermId:string|null;
  distractors:{termId:string;explanation:string;sources:AmbSource[];verification:'verified'}[];
}
export interface AmbCatalog {schemaVersion:1;version:number;updatedAt:string;terms:AmbTerm[];groups:AmbGroup[];cards:AmbCard[]}
export interface AmbReview {id:string;questionId:string;groupId:string;termIds:string[];kind:AmbiguousKind;correct:boolean;selectedTermId:string|null;at:string;sessionId:string}
export interface AmbSnapshot {catalog:AmbCatalog;events:AmbReview[];lastSyncAt:string|null}
export const EMPTY_AMBIGUOUS:AmbCatalog={schemaVersion:1,version:1,updatedAt:'2026-11-10T00:00:00.000Z',terms:[],groups:[],cards:[]};
export const AMBIGUOUS_URL='https://raw.githubusercontent.com/kiyotakalam-collab/-/main/public/ambiguous-terms.json';
const record=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
export const ambId=(x:unknown):x is string=>typeof x==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(x);
function fail(message:string):never{throw Error('曖昧用語：'+message);}
const str=(x:unknown,label:string,empty=false)=>typeof x==='string'&&(empty||x.trim())&&x.length<=6000?x.trim():fail(label+'が不正です');
const iso=(x:unknown):string=>typeof x==='string'&&/^\d{4}-\d\d-\d\dT/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x?x:fail('日時はUTCのISO形式で指定してください');
const positive=(x:unknown)=>Number.isSafeInteger(x)&&Number(x)>0?Number(x):fail('バージョンが不正です');
function array(x:unknown,max=10000):unknown[]{return Array.isArray(x)&&x.length<=max?x:fail('配列が不正です');}
function strings(x:unknown,label:string,max=100):string[]{const out=array(x,max).map(v=>str(v,label));if(new Set(out).size!==out.length)fail(label+'が重複しています');return out;}
function ids(x:unknown,label:string,min=0){const out=strings(x,label);if(out.length<min||!out.every(ambId))fail(label+'が不正です');return out;}
function sources(x:unknown):AmbSource[]{return array(x,30).map(v=>{if(!record(v))fail('出典が不正です');const title=str(v.title,'出典名'),source:AmbSource={title};if(v.url!==undefined){const url=str(v.url,'出典URL');let u:URL;try{u=new URL(url);}catch{fail('出典URLが不正です');}if(!['http:','https:'].includes(u!.protocol)||u!.username||u!.password)fail('出典URLが不正です');source.url=url;}if(v.note!==undefined)source.note=str(v.note,'出典注記',true);return source;});}
function verification(x:unknown):Verification{if(x==='verified'||x==='provisional'||x==='needs-review')return x;return fail('検証状態が不正です');}
function managed(v:Record<string,unknown>):Managed{if(!ambId(v.id)||typeof v.deleted!=='boolean')fail('固定IDまたは出題停止状態が不正です');const source=sources(v.sources);if(!v.deleted&&!source.length)fail('公開する項目には出典が必要です');return {id:v.id as string,version:positive(v.version),updatedAt:iso(v.updatedAt),deleted:v.deleted as boolean,verification:verification(v.verification),sources:source};}
const norm=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('ja').replace(/[\s・＝=「」『』]/g,'');
const distinct=<T extends {id:string}>(values:T[],label:string)=>{if(new Set(values.map(v=>v.id)).size!==values.length)fail(label+'のIDが重複しています');};
export function validateAmbiguousCatalog(input:unknown):AmbCatalog {
  if(!record(input)||input.schemaVersion!==1)fail('教材スキーマが不正です');
  const terms=array(input.terms).map(entry=>{if(!record(entry))fail('用語が不正です');return {...managed(entry),name:str(entry.name,'用語名'),aliases:strings(entry.aliases,'別表記'),date:str(entry.date,'年代',true),region:str(entry.region,'地域'),era:str(entry.era,'時代'),field:str(entry.field,'分野'),description:str(entry.description,'用語説明'),relatedEvents:strings(entry.relatedEvents,'関連出来事')};});
  const groups=array(input.groups).map(entry=>{
    if(!record(entry))fail('グループが不正です');const termIds=ids(entry.termIds,'グループの用語ID',2),causes=strings(entry.causes,'混同原因');if(!causes.length||causes.some(cause=>!(AMBIGUOUS_CAUSES as readonly string[]).includes(cause)))fail('混同原因が不正です');
    const comparison=array(entry.comparison,30).map(value=>{if(!record(value)||!ambId(value.key)||!record(value.values))fail('比較項目が不正です');const values:Record<string,string>={};for(const [key,text]of Object.entries(value.values as object)){if(!termIds.includes(key))fail('比較項目にグループ外の用語があります');values[key]=str(text,'比較値',true);}return {key:value.key as string,label:str(value.label,'比較項目名'),values};});distinct(comparison.map(v=>({id:v.key})),'比較項目');
    const relationships=array(entry.relationships,100).map(value=>{if(!record(value)||!termIds.includes(String(value.fromId))||!termIds.includes(String(value.toId))||value.fromId===value.toId||!['before','causes','related'].includes(String(value.type)))fail('関係の参照先または種類が不正です');const refs=sources(value.sources);if(!refs.length)fail('関係には出典が必要です');return {fromId:String(value.fromId),toId:String(value.toId),type:value.type as 'before'|'causes'|'related',description:str(value.description,'関係の説明'),sources:refs,verification:verification(value.verification)};});
    if(new Set(relationships.map(r=>JSON.stringify([r.fromId,r.toId,r.type]))).size!==relationships.length)fail('関係が重複しています');
    return {...managed(entry),name:str(entry.name,'グループ名'),termIds,causes,registrationReason:str(entry.registrationReason,'登録理由',true),essentialPoint:str(entry.essentialPoint,'最重要識別ポイント'),orderingNotes:str(entry.orderingNotes,'前後関係の説明',true),description:str(entry.description,'グループ説明'),comparison,relationships};
  });
  const cards=array(input.cards,30000).map(entry=>{
    if(!record(entry)||!['recall','identify','compare'].includes(String(entry.kind))||!ambId(entry.groupId))fail('問題形式またはグループIDが不正です');
    const termIds=ids(entry.termIds,'問題の用語ID',1),optionTermIds=ids(entry.optionTermIds,'選択肢ID');
    const distractors=array(entry.distractors,3).map(value=>{if(!record(value)||!ambId(value.termId)||value.verification!=='verified')fail('誤答選択肢の検証が必要です');const refs=sources(value.sources);if(!refs.length)fail('誤答選択肢には根拠の出典が必要です');return {termId:value.termId as string,explanation:str(value.explanation,'誤答になる根拠'),sources:refs,verification:'verified' as const};});
    const base=managed(entry),kind=entry.kind as AmbiguousKind,correctTermId=entry.correctTermId;
    const optionLabels:Record<string,string>={};if(entry.optionLabels!==undefined){if(!record(entry.optionLabels))fail('選択肢ラベルが不正です');for(const [id,label]of Object.entries(entry.optionLabels)){if(!optionTermIds.includes(id))fail('選択肢外のラベルがあります');optionLabels[id]=str(label,'選択肢ラベル');}}
    if(kind==='recall'&&termIds.length!==1)fail('一問一答は1用語を指定してください');
    if(kind==='compare'&&termIds.length<2)fail('比較問題は2用語以上を指定してください');
    if(kind==='identify'){
      if(!ambId(correctTermId)||termIds.length!==1||termIds[0]!==correctTermId||optionTermIds.length<2||optionTermIds.length>4||!optionTermIds.includes(correctTermId)||base.verification!=='verified')fail('識別問題は検証済みの正答と2〜4個の選択肢が必要です');
      const wrong=optionTermIds.filter(id=>id!==correctTermId);if(distractors.length!==wrong.length||new Set(distractors.map(d=>d.termId)).size!==wrong.length||distractors.some(d=>!wrong.includes(d.termId)))fail('全ての誤答選択肢に検証根拠が必要です');
    }else if(optionTermIds.length||distractors.length||correctTermId!==null)fail('自己採点問題には選択肢を設定しないでください');
    return {...base,kind,groupId:entry.groupId as string,termIds,prompt:str(entry.prompt,'問題文'),answer:str(entry.answer,'正答'),explanation:str(entry.explanation,'解説'),optionTermIds,optionLabels,correctTermId:correctTermId as string|null,distractors};
  });
  distinct(terms,'用語');distinct(groups,'グループ');distinct(cards,'問題');
  const allIds=[...terms,...groups,...cards].map(v=>v.id);if(new Set(allIds).size!==allIds.length)fail('用語・グループ・問題のIDは別々にしてください');
  const byTerm=new Map(terms.map(term=>[term.id,term])),byGroup=new Map(groups.map(group=>[group.id,group]));
  for(const group of groups)if(group.termIds.some(id=>!byTerm.has(id)))fail('グループに存在しない用語IDがあります');
  for(const card of cards){const group=byGroup.get(card.groupId);if(!group||card.termIds.some(id=>!byTerm.has(id))||card.optionTermIds.some(id=>!byTerm.has(id)))fail('問題の参照先が存在しません');if(card.kind==='identify'&&new Set(card.optionTermIds.map(id=>norm(Object.hasOwn(card.optionLabels,id)?card.optionLabels[id]:byTerm.get(id)!.name))).size!==card.optionTermIds.length)fail('選択肢の表示名が同じです。optionLabelsで区別してください');if(!card.deleted&&[...card.termIds,...card.optionTermIds].some(id=>!group.termIds.includes(id)))fail('問題・選択肢にグループ外の用語があります');}
  const names=new Map<string,string>();for(const term of terms.filter(t=>!t.deleted))for(const name of [term.name,...term.aliases]){const key=JSON.stringify([norm(name),norm(term.date),norm(term.region)]),old=names.get(key);if(old&&old!==term.id)fail('別表記を含む同一用語の重複候補：'+term.name);names.set(key,term.id);}
  const prompts=new Set<string>();for(const card of cards.filter(c=>!c.deleted)){const key=JSON.stringify([card.groupId,card.kind,norm(card.prompt)]);if(prompts.has(key))fail('同じグループ・形式の問題文が重複しています');prompts.add(key);}
  return {schemaVersion:1,version:positive(input.version),updatedAt:iso(input.updatedAt),terms,groups,cards};
}
export function mergeAmbiguousCatalog(current:AmbCatalog,incoming:AmbCatalog):AmbCatalog {
  if(incoming.version<current.version)return current;
  if(incoming.version===current.version){if(JSON.stringify(incoming)!==JSON.stringify(current))fail('同じ教材バージョンの内容が異なります');return current;}
  const merge=<T extends Managed>(old:T[],next:T[])=>{const map=new Map(old.map(v=>[v.id,v]));for(const v of next){const previous=map.get(v.id);if(previous){if(v.version<previous.version)fail('行のバージョンを戻せません');if(v.version===previous.version&&JSON.stringify(v)!==JSON.stringify(previous))fail('同じ行バージョンの内容が異なります');}map.set(v.id,v);}return [...map.values()];};
  const cards=merge(current.cards,incoming.cards),oldCards=new Map(current.cards.map(card=>[card.id,card]));
  for(const card of cards){const old=oldCards.get(card.id);if(old&&(old.kind!==card.kind||old.groupId!==card.groupId||JSON.stringify(old.termIds)!==JSON.stringify(card.termIds)||old.correctTermId!==card.correctTermId||JSON.stringify([...old.optionTermIds].sort())!==JSON.stringify([...card.optionTermIds].sort())))fail('問題IDの意味は変更できません。新しいIDを使用してください');}
  return validateAmbiguousCatalog({...incoming,terms:merge(current.terms,incoming.terms),groups:merge(current.groups,incoming.groups),cards});
}
export function activeAmbiguous(catalog:AmbCatalog){
  const terms=new Map(catalog.terms.filter(t=>!t.deleted).map(t=>[t.id,t]));
  const groups=new Map(catalog.groups.filter(g=>!g.deleted&&g.termIds.every(id=>terms.has(id))).map(g=>[g.id,g]));
  const cards=catalog.cards.filter(c=>!c.deleted&&groups.has(c.groupId)&&[...c.termIds,...c.optionTermIds].every(id=>terms.has(id)));
  return {terms,groups,cards};
}
export interface AmbProgress {correct:number;wrong:number;attempts:number;streak:number;recent:boolean[];lastAt:string;nextReviewAt:string}
export function ambiguousProgress(events:AmbReview[]){
  const map=new Map<string,AmbProgress>();for(const event of [...events].sort((a,b)=>a.at.localeCompare(b.at)||a.id.localeCompare(b.id))){const p=map.get(event.questionId)??{correct:0,wrong:0,attempts:0,streak:0,recent:[],lastAt:'',nextReviewAt:''};p.attempts++;if(event.correct){p.correct++;p.streak++;}else{p.wrong++;p.streak=0;}p.recent=[...p.recent.slice(-4),event.correct];p.lastAt=event.at;p.nextReviewAt=new Date(Date.parse(event.at)+(event.correct?[1,3,7,14,30,60][Math.min(5,p.streak-1)]*86400000:600000)).toISOString();map.set(event.questionId,p);}return map;
}
export type AmbMastery='unseen'|'review'|'learning'|'stable';
export const AMB_MASTERY_LABELS:Record<AmbMastery,string>={unseen:'未学習',review:'要復習',learning:'定着途中',stable:'安定'};
export function ambiguousMastery(p:AmbProgress|undefined,now=Date.now()):AmbMastery {
  if(!p)return 'unseen';const age=Math.max(0,now-Date.parse(p.lastAt)),recent=p.recent.slice(-3);
  if(Date.parse(p.nextReviewAt)<=now||p.recent.at(-1)===false||recent.filter(v=>!v).length>=2||age>=30*86400000&&p.streak<3)return 'review';
  return p.streak>=3&&recent.length===3&&recent.every(Boolean)&&age<30*86400000?'stable':'learning';
}
export function aggregateAmbiguousMastery(cards:AmbCard[],progress:Map<string,AmbProgress>,now=Date.now()):AmbMastery {
  const states=cards.map(card=>ambiguousMastery(progress.get(card.id),now));if(!states.length||states.every(s=>s==='unseen'))return 'unseen';if(states.includes('review'))return 'review';return states.every(s=>s==='stable')?'stable':'learning';
}
export function ambiguousStatus(catalog:AmbCatalog,events:AmbReview[],now=Date.now()){
  const active=activeAmbiguous(catalog),p=ambiguousProgress(events),terms=new Map<string,AmbMastery>(),groups=new Map<string,AmbMastery>();
  const byTerm=new Map<string,AmbCard[]>(),byGroup=new Map<string,AmbCard[]>();
  for(const card of active.cards){if(card.kind==='recall'){for(const id of card.termIds){const rows=byTerm.get(id)??[];rows.push(card);byTerm.set(id,rows);}}else{const rows=byGroup.get(card.groupId)??[];rows.push(card);byGroup.set(card.groupId,rows);}}
  for(const term of active.terms.values())terms.set(term.id,aggregateAmbiguousMastery(byTerm.get(term.id)??[],p,now));
  for(const group of active.groups.values())groups.set(group.id,aggregateAmbiguousMastery(byGroup.get(group.id)??[],p,now));
  return {terms,groups};
}
export function ambiguousSchedule(catalog:AmbCatalog,events:AmbReview[]){const p=ambiguousProgress(events);return activeAmbiguous(catalog).cards.flatMap(card=>{const state=p.get(card.id);return state?[{questionId:card.id,groupId:card.groupId,termIds:[...card.termIds],kind:card.kind,nextReviewAt:state.nextReviewAt}]:[];});}
export interface AmbFilter {kind:AmbiguousKind|'all';region:string;era:string;field:string;cause:string;groupId:string;mode:'all'|'unseen'|'mistakes'|'due'|'weak'|'random'}
export const DEFAULT_AMB_FILTER:AmbFilter={kind:'all',region:'all',era:'all',field:'all',cause:'all',groupId:'all',mode:'all'};
export function selectAmbiguousCards(catalog:AmbCatalog,events:AmbReview[],filter:AmbFilter,now=Date.now()){
  const active=activeAmbiguous(catalog),p=ambiguousProgress(events);
  const result=active.cards.filter(card=>{const group=active.groups.get(card.groupId)!,state=p.get(card.id);return(filter.kind==='all'||card.kind===filter.kind)&&(filter.groupId==='all'||card.groupId===filter.groupId)&&(filter.cause==='all'||group.causes.includes(filter.cause))&&card.termIds.some(id=>{const term=active.terms.get(id)!;return(filter.region==='all'||term.region===filter.region)&&(filter.era==='all'||term.era===filter.era)&&(filter.field==='all'||term.field===filter.field);})&&!(filter.mode==='unseen'&&state||filter.mode==='mistakes'&&!state?.wrong||filter.mode==='due'&&(!state||Date.parse(state.nextReviewAt)>now));});
  if(filter.mode==='weak'){const score=(id:string)=>{const v=p.get(id);return v?(1-v.recent.filter(Boolean).length/v.recent.length)*10+Math.min(20,Math.max(0,(now-Date.parse(v.nextReviewAt))/86400000))+Math.min(1,v.wrong/20)-Math.min(3,v.streak*.4):2;};result.sort((a,b)=>score(b.id)-score(a.id)||a.id.localeCompare(b.id));}return result;
}
export function validateAmbiguousReview(input:unknown,catalog:AmbCatalog):AmbReview {
  if(!record(input)||!ambId(input.id)||!ambId(input.questionId)||!ambId(input.groupId)||!ambId(input.sessionId)||typeof input.correct!=='boolean')fail('履歴が不正です');
  const card=catalog.cards.find(c=>c.id===input.questionId),termIds=ids(input.termIds,'履歴の用語ID',1),selected=input.selectedTermId;
  if(!card||card.groupId!==input.groupId||card.kind!==input.kind||JSON.stringify(termIds)!==JSON.stringify(card.termIds))fail('履歴と固定問題IDの参照が一致しません');
  if(card.kind==='identify'){if(!ambId(selected)||!card.optionTermIds.includes(selected)||input.correct!==(selected===card.correctTermId))fail('選択式の採点結果が不正です');}else if(selected!==null)fail('自己採点には選択肢を記録しません');
  return {id:input.id,questionId:card.id,groupId:card.groupId,termIds,kind:card.kind,correct:input.correct as boolean,selectedTermId:selected as string|null,at:iso(input.at),sessionId:input.sessionId};
}
