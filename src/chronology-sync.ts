import {validateChronology,type ChronologyCollection,type ChronologyNote} from './chronology-errors';

export class InvalidChronologyFeedError extends Error {}
export const CHRONOLOGY_FEED_URL='https://raw.githubusercontent.com/kiyotakalam-collab/-/main/public/chronology-errors.json';
export const SHEET_COLUMNS=['id','term','question','answer','explanation','region','era','source','source_detail','cause','active','updated_at'] as const;
export type SheetProblem={id:string;term:string;question:string;answer:string;explanation:string;region:string;era:string;source:string;source_detail:string;cause:''|'A'|'B'|'C'|'D'|'E';active:boolean;updated_at:string};
export type ChronologyFeed={schemaVersion:1;version:number;problems:SheetProblem[]};
export function validateChronologyFeed(input:unknown):ChronologyFeed{
 if(!input||typeof input!=='object')throw Error('問題データの形式が不正です。');
 const x=input as ChronologyFeed;
 if(x.schemaVersion!==1||!Number.isSafeInteger(x.version)||x.version<1||!Array.isArray(x.problems)||x.problems.length>20000)throw Error('問題データのバージョン・件数が不正です。');
 const ids=new Set<string>();
 const problems=x.problems.map(p=>{
  if(!p||typeof p!=='object'||SHEET_COLUMNS.some(k=>k==='active'?typeof p[k]!=='boolean':typeof p[k]!=='string')||
   !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,99}$/.test(p.id)||ids.has(p.id)||!p.term.trim()||p.term.length>250||
   !p.question.trim()||p.question.length>700||!p.answer.trim()||p.answer.length>700||p.explanation.length>1400||
   !p.region.trim()||p.region.length>100||!p.era.trim()||p.era.length>100||p.source.length>100||p.source_detail.length>250||
   !['','A','B','C','D','E'].includes(p.cause)||!Number.isFinite(Date.parse(p.updated_at))||new Date(p.updated_at).toISOString()!==p.updated_at)
    throw Error('問題の必須項目・固定ID・日時が不正、またはIDが重複しています。');
  ids.add(p.id);
  return Object.fromEntries(SHEET_COLUMNS.map(k=>[k,p[k]])) as SheetProblem;
 });
 return {schemaVersion:1,version:x.version,problems};
}
export function applyChronologyFeed(local:ChronologyCollection,input:unknown,now=new Date().toISOString()):ChronologyCollection{
 const feed=validateChronologyFeed(input),signature=JSON.stringify([...feed.problems].sort((a,b)=>a.id.localeCompare(b.id)));
 if(local.sync&&(feed.version<local.sync.version||(feed.version===local.sync.version&&signature!==local.sync.signature)))throw Error('古いバージョン、または同一バージョンの内容変更を拒否しました。');
 const notes=new Map(local.notes.map(n=>[n.id,n]));
 for(const p of feed.problems){
  const old=notes.get(p.id);
  if(old&&!old.masterUpdatedAt)throw Error('端末の手動登録と固定IDが競合しています。');
  if(old?.masterUpdatedAt&&p.updated_at<old.masterUpdatedAt)throw Error('問題の更新日時が巻き戻っています。');
  // Master columns and local learning counters have separate owners. Import is not an answer.
  const fresh:ChronologyNote={id:p.id,createdAt:now,updatedAt:now,lastReviewedAt:null,nextReviewAt:null,stage:0,wrongCount:0,correctCount:0,question:'',answer:'',explanation:'',source:'',sourceDetail:'',cause:'',region:'',era:''};
  notes.set(p.id,{...(old??fresh),term:p.term,question:p.question,answer:p.answer,explanation:p.explanation,
   region:p.region,era:p.era,source:p.source,sourceDetail:p.source_detail,cause:p.cause,active:p.active,masterUpdatedAt:p.updated_at});
 }
 // An omitted row is retained; only explicit active:false stops a question.
 return validateChronology({version:1,notes:[...notes.values()],sync:{version:feed.version,signature,lastSyncedAt:now}});
}
export async function fetchChronologyFeed(url=CHRONOLOGY_FEED_URL,fetcher:typeof fetch=fetch):Promise<ChronologyFeed>{
 const response=await fetcher(url,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw Error(`問題データを取得できません（${response.status}）。`);
 const body=await response.text();if(body.length>8*1024*1024)throw new InvalidChronologyFeedError('問題データが大きすぎます。');
 try{return validateChronologyFeed(JSON.parse(body));}catch(error){throw new InvalidChronologyFeedError(String(error));}
}
