import {ERROR_CAUSES,type ErrorCause} from './error-causes';

export const CHRONOLOGY_NOTE_KEY='world-history-chronology-errors-v1';
export type ChronologyNote={
 id:string;term?:string;active?:boolean;masterUpdatedAt?:string;question:string;answer:string;explanation:string;source:string;sourceDetail:string;
 region:string;era:string;cause:ErrorCause|'';createdAt:string;updatedAt:string;
 lastReviewedAt:string|null;nextReviewAt:string|null;stage:number;
 wrongCount:number;correctCount:number;
};
export type ChronologyCollection={version:1;notes:ChronologyNote[];sync?:{version:number;signature:string;lastSyncedAt:string}};
export const EMPTY_CHRONOLOGY:ChronologyCollection={version:1,notes:[]};
const INTERVALS=[1,3,7,14,30];
const DAY=86400000;
export const CHRONOLOGY_CAUSES=ERROR_CAUSES;
const text=(s:unknown,max=700)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const date=(s:unknown)=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
function validateNote(v:unknown):ChronologyNote{
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('誤答記録が不正です。');
 const x=v as Record<string,unknown>;
 if((x.term!==undefined&&!text(x.term,250))||(x.active!==undefined&&typeof x.active!=='boolean')||(x.masterUpdatedAt!==undefined&&!date(x.masterUpdatedAt))||!text(x.id,100)||!text(x.question)||!text(x.answer)||(x.source!==''&&!text(x.source,100))||
   !text(x.region,100)||!text(x.era,100)||(x.cause!==''&&!Object.hasOwn(ERROR_CAUSES,String(x.cause)))||
   (x.explanation!==''&&!text(x.explanation,1400))||
   (x.sourceDetail!==''&&!text(x.sourceDetail,250))||
   !date(x.createdAt)||!date(x.updatedAt)||
   (x.lastReviewedAt!==null&&!date(x.lastReviewedAt))||
   (x.nextReviewAt!==null&&!date(x.nextReviewAt))||
   !Number.isInteger(x.stage)||Number(x.stage)<0||Number(x.stage)>5||
   !Number.isSafeInteger(x.wrongCount)||Number(x.wrongCount)<0||
   !Number.isSafeInteger(x.correctCount)||Number(x.correctCount)<0)
   throw Error('誤答記録の項目・件数が不正です。');
 return x as unknown as ChronologyNote;
}
export function validateChronology(input:unknown):ChronologyCollection{
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('誤答ノートの形式が不正です。');
 const v=input as Record<string,unknown>;
 if(v.version!==1||!Array.isArray(v.notes)||v.notes.length>20000)throw Error('誤答ノートの形式または件数が不正です。');
 const notes=v.notes.map(validateNote),ids=new Set(notes.map(x=>x.id));
 if(ids.size!==notes.length)throw Error('記録IDが重複しています。');
 if(v.sync!==undefined){const m=v.sync as ChronologyCollection['sync'];if(!m||!Number.isSafeInteger(m.version)||m.version<1||typeof m.signature!=='string'||!date(m.lastSyncedAt))throw Error('同期情報が不正です。');}
 return {version:1,notes,...(v.sync?{sync:v.sync as NonNullable<ChronologyCollection['sync']>}:{})};
}
export function loadChronology(storage:Pick<Storage,'getItem'>):ChronologyCollection{
 const raw=storage.getItem(CHRONOLOGY_NOTE_KEY);
 return raw?validateChronology(JSON.parse(raw)):structuredClone(EMPTY_CHRONOLOGY);
}
export function canonicalHole(s:string):string{
 return s.normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu,'').toLowerCase();
}
export function addChronology(s:ChronologyCollection,raw:Omit<ChronologyNote,'id'|'createdAt'|'updatedAt'|'lastReviewedAt'|'nextReviewAt'|'stage'|'wrongCount'|'correctCount'>,now=new Date().toISOString()):ChronologyCollection{
 const question=raw.question.trim(),answer=raw.answer.trim();
 if(s.notes.some(n=>canonicalHole(n.question)===canonicalHole(question)&&canonicalHole(n.answer)===canonicalHole(answer)))
   throw Error('同じ知識の穴が登録済みです。既存の記録から誤答回数を更新してください。');
 const item=validateNote({...raw,question,answer,id:crypto.randomUUID(),createdAt:now,updatedAt:now,
   lastReviewedAt:null,nextReviewAt:new Date(Date.parse(now)+DAY).toISOString(),stage:0,wrongCount:1,correctCount:0});
 return validateChronology({...s,notes:[...s.notes,item]});
}
export function gradeChronology(s:ChronologyCollection,id:string,correct:boolean,now=new Date().toISOString()):ChronologyCollection{
 if(!date(now))throw Error('復習時刻が不正です。');
 let found=false;
 const notes=s.notes.map(n=>{
  if(n.id!==id)return n;found=true;
  const stage=correct?Math.min(5,n.stage+1):0;
  return {...n,stage,correctCount:n.correctCount+(correct?1:0),wrongCount:n.wrongCount+(correct?0:1),
    lastReviewedAt:now,nextReviewAt:new Date(Date.parse(now)+(correct?INTERVALS[stage-1]*DAY:10*60000)).toISOString(),updatedAt:now};
 });
 if(!found)throw Error('対象の記録がありません。');
 return validateChronology({...s,notes});
}
export function mergeChronology(local:ChronologyCollection,incoming:ChronologyCollection):ChronologyCollection{
 const byId=new Map(local.notes.map(n=>[n.id,n]));
 for(const n of incoming.notes){
  const old=byId.get(n.id);
  if(!old){byId.set(n.id,n);continue;}
  if((old.question!==n.question||old.answer!==n.answer)&&(!old.masterUpdatedAt||!n.masterUpdatedAt))throw Error('同じIDの知識内容が競合しています。');
  const latest=n.updatedAt>old.updatedAt?n:old;
  const master=old.masterUpdatedAt&&n.masterUpdatedAt?(n.masterUpdatedAt>old.masterUpdatedAt?n:old):latest;
  byId.set(n.id,{...latest,term:master.term,active:master.active,masterUpdatedAt:master.masterUpdatedAt,
   question:master.question,answer:master.answer,explanation:master.explanation,region:master.region,era:master.era,source:master.source,sourceDetail:master.sourceDetail,cause:master.cause,
   wrongCount:Math.max(old.wrongCount,n.wrongCount),correctCount:Math.max(old.correctCount,n.correctCount)});
 }
 const sync=!local.sync?incoming.sync:!incoming.sync?local.sync:incoming.sync.version>local.sync.version?incoming.sync:local.sync;
 return validateChronology({version:1,notes:[...byId.values()],...(sync?{sync}:{})});
}
export function dueChronology(s:ChronologyCollection,at=new Date().toISOString()):ChronologyNote[]{
 return s.notes.filter(x=>x.active!==false&&x.nextReviewAt&&x.nextReviewAt<=at);
}
