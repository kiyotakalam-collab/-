import {gradeChronology,validateChronology,type ChronologyCollection,type ChronologyNote,type PracticeEvent,type PracticeSession,type PracticeMode,type PracticeResult} from './chronology-errors';
export const PRACTICE_MODES:Record<PracticeMode,string>={due:'今日の復習',weak:'苦手集中',incorrect:'直近不正解のみ',random:'ランダム演習',range:'範囲指定演習',single:'個別演習',selected:'選択問題の演習',retry:'間違い直し'};
export const MASTERY_LABELS={unlearned:'未演習',initial:'定着初期',developing:'定着途中',stable:'安定',unknown:'再判定待ち'} as const;
export type Mastery=keyof typeof MASTERY_LABELS;
export interface PracticeFilter {query:string;region:string;era:string;cause:string;mastery:string;from:string;to:string;source:string;answerStatus:string}
export const EMPTY_PRACTICE_FILTER:PracticeFilter={query:'',region:'',era:'',cause:'',mastery:'',from:'',to:'',source:'',answerStatus:''};
const DAY=86400000;
export function notePractice(note:ChronologyNote,events:PracticeEvent[]=[]){
 const history=events.filter(e=>e.noteId===note.id).sort((a,b)=>a.answeredAt.localeCompare(b.answeredAt));
 let streak=0,missStreak=0;
 for(let i=history.length-1;i>=0&&history[i].result==='correct';i--)streak++;
 for(let i=history.length-1;i>=0&&history[i].result==='wrong';i--)missStreak++;
 const recent=history.slice(-10),last=history.at(-1),attempts=note.correctCount+note.wrongCount+(note.ambiguousCount??0);
 let mastery:Mastery=attempts===0?'unlearned':!last?'unknown':streak>=3?'developing':'initial';
 const trail=streak?history.slice(-streak):[];
 const spaced=trail.filter(e=>e.result==='correct'&&e.dueBefore!==null&&e.dueBefore<=e.answeredAt);
 if(streak>=3&&spaced.length>=2&&Date.parse(last!.answeredAt)-Date.parse(trail[0].answeredAt)>=7*DAY)mastery='stable';
 return {history,recent,last,streak,missStreak,mastery,attempts,recentAccuracy:recent.length?recent.filter(e=>e.result==='correct').length/recent.length:null};
}
export function lastPracticeResult(n:ChronologyNote,events:PracticeEvent[]=[]):PracticeResult|null {
 // Do not guess from cumulative counters: imported/legacy records have no last-answer status.
 return notePractice(n,events).last?.result??null;
}
export function filterPractice(s:ChronologyCollection,f:Partial<PracticeFilter>={},at=new Date().toISOString()):ChronologyNote[]{
 const q=(f.query??'').trim().normalize('NFKC').toLowerCase();
 return s.notes.filter(n=>n.active!==false&&n.verification!=='provisional'&&(!f.region||n.region===f.region)&&(!f.era||n.era===f.era)&&(!f.source||n.source===f.source)&&
  (!f.cause||(f.cause==='unrecorded'?n.cause==='':n.cause===f.cause))&&(!f.answerStatus||lastPracticeResult(n,s.practiceEvents)===f.answerStatus)&&(!f.mastery||notePractice(n,s.practiceEvents).mastery===f.mastery)&&
  (!q||[n.term,n.question,n.answer,n.explanation].join(' ').normalize('NFKC').toLowerCase().includes(q))&&
  (!f.from||japanDate(n.createdAt)>=f.from)&&(!f.to||japanDate(n.createdAt)<=f.to));
}
export function japanDate(iso:string){return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));}
export function weaknessScore(n:ChronologyNote,events:PracticeEvent[]=[],at=new Date().toISOString()){
 const p=notePractice(n,events),recent=p.recent;
 return (p.recentAccuracy===null?0:(1-p.recentAccuracy)*60)+p.missStreak*15+
  recent.reduce((sum,e,i)=>sum+(e.result==='wrong'?i+1:e.result==='ambiguous'?(i+1)*.7:0),0)+
  Math.min(n.wrongCount,10)*1.5+Math.min(n.ambiguousCount??0,5)*2-p.streak*6+
  (n.nextReviewAt&&n.nextReviewAt<=at?10:0);
}
export function shufflePractice<T>(values:T[],random:()=>number=Math.random):T[]{
 const out=[...values];for(let i=out.length-1;i>0;i--){const j=Math.floor(Math.max(0,Math.min(.999999,random()))*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;
}
export function selectPractice(s:ChronologyCollection,mode:PracticeMode,limit:number,filter:Partial<PracticeFilter>={},at=new Date().toISOString(),random:()=>number=Math.random,ids?:string[]){
 let rows=filterPractice(s,filter,at);
 if(ids){const set=new Set(ids);rows=rows.filter(n=>set.has(n.id));}
 if(mode==='due')rows=rows.filter(n=>n.nextReviewAt!==null&&n.nextReviewAt<=at).sort((a,b)=>a.nextReviewAt!.localeCompare(b.nextReviewAt!));
 else if(mode==='weak')rows=rows.filter(n=>n.wrongCount>0||(n.ambiguousCount??0)>0).sort((a,b)=>weaknessScore(b,s.practiceEvents,at)-weaknessScore(a,s.practiceEvents,at)||a.id.localeCompare(b.id));
 else if(mode==='incorrect')rows=rows.filter(n=>lastPracticeResult(n,s.practiceEvents)==='wrong').sort((a,b)=>{
  const la=notePractice(a,s.practiceEvents).last!.answeredAt,lb=notePractice(b,s.practiceEvents).last!.answeredAt;
  return lb.localeCompare(la)||a.id.localeCompare(b.id);
 });
 else rows=shufflePractice(rows,random);
 const unique=[...new Map(rows.map(n=>[n.id,n])).values()];return limit===0?unique:unique.slice(0,limit);
}
export function startPractice(s:ChronologyCollection,mode:PracticeMode,ids:string[],now=new Date().toISOString(),id:string=crypto.randomUUID()):ChronologyCollection{
 const valid=new Set(filterPractice(s).map(n=>n.id)),questionIds=[...new Set(ids)].filter(id=>valid.has(id));
 if(!questionIds.length)throw Error('対象の問題がありません。条件を解除してください。');
 if(s.practiceSessions?.some(x=>x.id===id))throw Error('演習IDが重複しています。');
 const session:PracticeSession={id,mode,questionIds,position:0,startedAt:now,updatedAt:now,finishedAt:null};
 const sessions=(s.practiceSessions??[]).map(x=>x.id===s.activePracticeId&&x.finishedAt===null?{...x,finishedAt:now,updatedAt:now}:x);
 return validateChronology({...s,practiceSessions:[...sessions,session],activePracticeId:id});
}
export function recordPractice(s:ChronologyCollection,sessionId:string,noteId:string,result:PracticeResult,now=new Date().toISOString()):ChronologyCollection{
 const session=s.practiceSessions?.find(x=>x.id===sessionId);
 if(!session||session.finishedAt||!session.questionIds.includes(noteId))throw Error('現在の演習問題ではありません。');
 const id=sessionId+':'+noteId,old=s.practiceEvents?.find(e=>e.id===id);
 if(old){if(old.result!==result)throw Error('採点済みです。再演習で確認してください。');return s;}
 const note=s.notes.find(n=>n.id===noteId);if(!note)throw Error('問題がありません。');
 let next:ChronologyCollection;
 if(result==='ambiguous')next={...s,notes:s.notes.map(n=>n.id===noteId?{...n,ambiguousCount:(n.ambiguousCount??0)+1,stage:0,lastReviewedAt:now,nextReviewAt:new Date(Date.parse(now)+10*60000).toISOString(),updatedAt:now}:n)};
 else next=gradeChronology(s,noteId,result==='correct',now);
 const event:PracticeEvent={id,sessionId,noteId,result,mode:session.mode,answeredAt:now,dueBefore:note.nextReviewAt};
 return validateChronology({...next,practiceEvents:[...(s.practiceEvents?structuredClone(s.practiceEvents):[]),event]});
}
export function updatePractice(s:ChronologyCollection,id:string,position:number,finish=false,now=new Date().toISOString()){
 if(!s.practiceSessions?.some(x=>x.id===id))throw Error('演習がありません。');
 return validateChronology({...s,practiceSessions:s.practiceSessions.map(x=>x.id===id?{...x,position:Math.max(0,Math.min(x.questionIds.length-1,position)),updatedAt:now,finishedAt:finish?(x.finishedAt??now):x.finishedAt}:x),...(finish&&s.activePracticeId===id?{activePracticeId:null}:{})});
}
export function sessionResults(s:ChronologyCollection,id:string){
 const session=s.practiceSessions?.find(x=>x.id===id),events=(s.practiceEvents??[]).filter(e=>e.sessionId===id);
 return {session,events,correct:events.filter(e=>e.result==='correct'),wrong:events.filter(e=>e.result==='wrong'),ambiguous:events.filter(e=>e.result==='ambiguous'),unanswered:(session?.questionIds??[]).filter(id=>!events.some(e=>e.noteId===id))};
}
