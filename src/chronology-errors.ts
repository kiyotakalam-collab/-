import {ERROR_CAUSES,type ErrorCause} from './error-causes';

export const CHRONOLOGY_NOTE_KEY='world-history-chronology-errors-v1';
export type PracticeResult='correct'|'wrong'|'ambiguous';
export type PracticeMode='due'|'weak'|'incorrect'|'random'|'range'|'single'|'selected'|'retry';
export interface PracticeEvent {id:string;sessionId:string;noteId:string;result:PracticeResult;mode:PracticeMode;answeredAt:string;dueBefore:string|null}
export interface PracticeSession {id:string;mode:PracticeMode;questionIds:string[];position:number;startedAt:string;updatedAt:string;finishedAt:string|null}
export interface ChronologyVerificationSource {title:string;url?:string}
export type ChronologyNote={
 id:string;verificationSources?:ChronologyVerificationSource[];knowledgeId?:string;questionType?:'basic'|'distinction'|'related';verification?:'verified'|'provisional';ambiguousCount?:number;term?:string;active?:boolean;masterUpdatedAt?:string;question:string;answer:string;explanation:string;source:string;sourceDetail:string;
 region:string;era:string;cause:ErrorCause|'';createdAt:string;updatedAt:string;
 lastReviewedAt:string|null;nextReviewAt:string|null;stage:number;
 wrongCount:number;correctCount:number;
};
export type ChronologyCollection={version:1;notes:ChronologyNote[];practiceEvents?:PracticeEvent[];practiceSessions?:PracticeSession[];activePracticeId?:string|null;sync?:{version:number;signature:string;lastSyncedAt:string}};
export const EMPTY_CHRONOLOGY:ChronologyCollection={version:1,notes:[]};
const INTERVALS=[1,3,7,14,30];
const DAY=86400000;
export const CHRONOLOGY_CAUSES=ERROR_CAUSES;
const text=(s:unknown,max=700)=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
const date=(s:unknown)=>typeof s==='string'&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString()===s;
function validateNote(v:unknown):ChronologyNote{
 if(!v||typeof v!=='object'||Array.isArray(v))throw Error('誤答記録が不正です。');
 const x=v as Record<string,unknown>;
 if((x.verificationSources!==undefined&&(!Array.isArray(x.verificationSources)||x.verificationSources.length<1||x.verificationSources.length>30||x.verificationSources.some(s=>!s||!text(s.title,500)||(s.url!==undefined&&(typeof s.url!=='string'||!/^https?:\/\/[^\s]+$/.test(s.url))))))||(x.knowledgeId!==undefined&&!text(x.knowledgeId,100))||(x.questionType!==undefined&&!['basic','distinction','related'].includes(String(x.questionType)))||(x.verification!==undefined&&!['verified','provisional'].includes(String(x.verification)))||(x.ambiguousCount!==undefined&&(!Number.isSafeInteger(x.ambiguousCount)||Number(x.ambiguousCount)<0))||(x.term!==undefined&&!text(x.term,250))||(x.active!==undefined&&typeof x.active!=='boolean')||(x.masterUpdatedAt!==undefined&&!date(x.masterUpdatedAt))||!text(x.id,100)||!text(x.question)||!text(x.answer)||(x.source!==''&&!text(x.source,100))||
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
 const practice=validatePracticeData(v,notes);
 return {version:1,notes,...practice,...(v.sync?{sync:v.sync as NonNullable<ChronologyCollection['sync']>}:{})};
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
 const events=new Map((local.practiceEvents??[]).map(e=>[e.id,e]));
 for(const e of incoming.practiceEvents??[]){const old=events.get(e.id);if(old&&(['id','sessionId','noteId','result','mode','answeredAt','dueBefore'] as const).some(k=>old[k]!==e[k]))throw Error('同じ回答IDの内容が競合しています。');events.set(e.id,e);}
 const sessions=new Map((local.practiceSessions??[]).map(e=>[e.id,e]));
 for(const x of incoming.practiceSessions??[]){const old=sessions.get(x.id);if(old&&(old.mode!==x.mode||JSON.stringify(old.questionIds)!==JSON.stringify(x.questionIds)||old.startedAt!==x.startedAt))throw Error('演習IDが競合しています。');if(!old||x.updatedAt>old.updatedAt)sessions.set(x.id,x);}
 const count=(rows:PracticeEvent[]|undefined,id:string,result:PracticeResult)=>(rows??[]).filter(e=>e.noteId===id&&e.result===result).length;
 const byId=new Map(local.notes.map(n=>[n.id,n]));
 for(const n of incoming.notes){
  const old=byId.get(n.id);
  if(!old){byId.set(n.id,n);continue;}
  if(old.knowledgeId&&n.knowledgeId&&old.knowledgeId!==n.knowledgeId)throw Error('固定知識IDが競合しています。');
  if((old.question!==n.question||old.answer!==n.answer)&&(!old.masterUpdatedAt||!n.masterUpdatedAt))throw Error('同じIDの知識内容が競合しています。');
  const learned=(x:ChronologyNote)=>x.lastReviewedAt??(x.correctCount+x.wrongCount+(x.ambiguousCount??0)>0?x.updatedAt:'');
  const a=learned(old),b=learned(n);
  const latest=b>a?n:b<a?old:!a?(n.createdAt<old.createdAt?n:old):n.updatedAt>old.updatedAt?n:old;
  const master=old.masterUpdatedAt&&n.masterUpdatedAt?(n.masterUpdatedAt>old.masterUpdatedAt?n:old):latest;
  byId.set(n.id,{...latest,createdAt:old.createdAt<n.createdAt?old.createdAt:n.createdAt,verificationSources:master.verificationSources,knowledgeId:master.knowledgeId,questionType:master.questionType,verification:master.verification,term:master.term,active:master.active,masterUpdatedAt:master.masterUpdatedAt,
   question:master.question,answer:master.answer,explanation:master.explanation,region:master.region,era:master.era,source:master.source,sourceDetail:master.sourceDetail,cause:master.cause,
   wrongCount:Math.max(old.wrongCount-count(local.practiceEvents,n.id,'wrong'),n.wrongCount-count(incoming.practiceEvents,n.id,'wrong'))+count([...events.values()],n.id,'wrong'),correctCount:Math.max(old.correctCount-count(local.practiceEvents,n.id,'correct'),n.correctCount-count(incoming.practiceEvents,n.id,'correct'))+count([...events.values()],n.id,'correct'),...((old.ambiguousCount!==undefined||n.ambiguousCount!==undefined)?{ambiguousCount:Math.max((old.ambiguousCount??0)-count(local.practiceEvents,n.id,'ambiguous'),(n.ambiguousCount??0)-count(incoming.practiceEvents,n.id,'ambiguous'))+count([...events.values()],n.id,'ambiguous')}:{})});
 }
 const sync=!local.sync?incoming.sync:!incoming.sync?local.sync:incoming.sync.version>local.sync.version?incoming.sync:local.sync;
 const active=[local.activePracticeId,incoming.activePracticeId].find(id=>id&&sessions.get(id)?.finishedAt===null)??null;
 return validateChronology({version:1,notes:[...byId.values()],...((local.practiceEvents||incoming.practiceEvents)?{practiceEvents:[...events.values()],practiceSessions:[...sessions.values()],activePracticeId:active}:{}),...(sync?{sync}:{})});
}
export function dueChronology(s:ChronologyCollection,at=new Date().toISOString()):ChronologyNote[]{
 return s.notes.filter(x=>x.active!==false&&x.nextReviewAt&&x.nextReviewAt<=at);
}

const MODES=['due','weak','incorrect','random','range','single','selected','retry'];
function validatePracticeData(v:Record<string,unknown>,notes:ChronologyNote[]){
 const events=v.practiceEvents as PracticeEvent[]|undefined,sessions=v.practiceSessions as PracticeSession[]|undefined;
 if(events===undefined&&sessions===undefined&&v.activePracticeId===undefined)return {};
 if(!Array.isArray(events??[])||!Array.isArray(sessions??[])||(events?.length??0)>500000||(sessions?.length??0)>20000)throw Error('演習履歴の形式が不正です。');
 const known=new Set(notes.map(n=>n.id)),sessionMap=new Map<string,PracticeSession>(),eventIds=new Set<string>();
 for(const x of sessions??[]){if(!x||!text(x.id,100)||sessionMap.has(x.id)||!MODES.includes(x.mode)||!Array.isArray(x.questionIds)||!x.questionIds.length||new Set(x.questionIds).size!==x.questionIds.length||x.questionIds.some(id=>!known.has(id))||!Number.isInteger(x.position)||x.position<0||x.position>=x.questionIds.length||!date(x.startedAt)||!date(x.updatedAt)||(x.finishedAt!==null&&!date(x.finishedAt)))throw Error('演習セッションが不正です。');sessionMap.set(x.id,x);}
 const counts=new Map<string,{correct:number;wrong:number;ambiguous:number}>();
 for(const e of events??[]){const session=sessionMap.get(e?.sessionId);if(!e||!session||e.id!==e.sessionId+':'+e.noteId||eventIds.has(e.id)||!session.questionIds.includes(e.noteId)||e.mode!==session.mode||!['correct','wrong','ambiguous'].includes(e.result)||!date(e.answeredAt)||(e.dueBefore!==null&&!date(e.dueBefore)))throw Error('演習回答が不正・重複しています。');eventIds.add(e.id);const c=counts.get(e.noteId)??{correct:0,wrong:0,ambiguous:0};c[e.result]++;counts.set(e.noteId,c);}
 for(const n of notes){const c=counts.get(n.id);if(c&&(c.correct>n.correctCount||c.wrong>n.wrongCount||c.ambiguous>(n.ambiguousCount??0)))throw Error('演習履歴と累積回数が矛盾しています。');}
 if(v.activePracticeId!==undefined&&v.activePracticeId!==null&&(!sessionMap.has(String(v.activePracticeId))||sessionMap.get(String(v.activePracticeId))?.finishedAt!==null))throw Error('途中の演習が不正です。');
 return {practiceEvents:events??[],practiceSessions:sessions??[],activePracticeId:v.activePracticeId as string|null|undefined};
}
