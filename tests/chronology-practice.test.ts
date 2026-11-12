import {describe,it,expect} from 'vitest';
import feed from '../public/chronology-errors.json';
import {applyChronologyFeed,validateChronologyFeed} from '../src/chronology-sync';
import {gradeChronology,mergeChronology,validateChronology,type ChronologyCollection} from '../src/chronology-errors';
import {startPractice,recordPractice,updatePractice,sessionResults,notePractice,selectPractice,filterPractice,lastPracticeResult,weaknessScore,japanDate} from '../src/chronology-practice';
const now='2026-11-20T00:00:00.000Z',base=()=>applyChronologyFeed({version:1,notes:[]},feed,now);
const ids=()=>feed.problems.slice(0,5).map(n=>n.id);
function answer(s:ChronologyCollection,id:string,result:'correct'|'wrong'|'ambiguous',at=now,sessionId:string=crypto.randomUUID()){
 s=startPractice(s,'single',[id],at,sessionId);s=recordPractice(s,sessionId,id,result,at);return updatePractice(s,sessionId,0,true,at);
}
describe('通史演習・既存93問と履歴の保護',()=>{
 it('旧形式の回数・期限を保持し、新規配信は未演習である',()=>{
  let s=base();const id=ids()[0];s=gradeChronology(s,id,false,now);s=gradeChronology(s,id,true,now);
  const old=structuredClone(s.notes[0]);expect(notePractice(old).mastery).toBe('unknown');
  s=startPractice(s,'random',ids(),now,'session');expect(s.notes[0]).toEqual(old);
  expect(notePractice(s.notes[1]).mastery).toBe('unlearned');
  expect(applyChronologyFeed(s,feed,now)).toEqual(s);
 });
 it('採点だけが追記され、二重採点・前後移動・途中終了は加算しない',()=>{
  let s=startPractice(base(),'selected',[...ids(),ids()[0]],now,'session');expect(s.practiceSessions![0].questionIds).toHaveLength(5);
  s=recordPractice(s,'session',ids()[0],'wrong',now);const once=structuredClone(s);
  expect(recordPractice(s,'session',ids()[0],'wrong',now)).toEqual(once);
  expect(()=>recordPractice(s,'session',ids()[0],'correct',now)).toThrow('採点済み');
  s=updatePractice(s,'session',3);s=updatePractice(s,'session',0,true);
  expect(s.notes).toEqual(once.notes);expect(s.practiceEvents).toEqual(once.practiceEvents);
  expect(sessionResults(s,'session').unanswered).toHaveLength(4);
  expect(()=>recordPractice(s,'session',ids()[1],'correct',now)).toThrow();
 });
 it('曖昧は正答・誤答と別に残り、連続正答を止め10分後へ回す',()=>{
  let s=answer(base(),ids()[0],'wrong');s=answer(s,ids()[0],'correct','2026-11-21T00:00:00.000Z');
  const old=s.notes[0];s=answer(s,ids()[0],'ambiguous','2026-11-22T00:00:00.000Z');
  expect(s.notes[0]).toMatchObject({wrongCount:old.wrongCount,correctCount:old.correctCount,ambiguousCount:1,stage:0,nextReviewAt:'2026-11-22T00:10:00.000Z'});
  expect(notePractice(s.notes[0],s.practiceEvents).streak).toBe(0);
  expect(sessionResults(s,s.practiceSessions!.at(-1)!.id).ambiguous).toHaveLength(1);
 });
 it('期限到来のみ・5/10/20/全問・地域・時代・日付・原因・定着度を抽出し重複しない',()=>{
  let s=answer(base(),ids()[0],'wrong');
  expect(selectPractice(s,'due',0,{},'2026-11-20T00:09:59.000Z')).toHaveLength(0);
  expect(selectPractice(s,'due',0,{},'2026-11-20T00:10:00.000Z').map(n=>n.id)).toEqual([ids()[0]]);
  for(const n of [5,10,20,0]){const rows=selectPractice(s,'random',n,{},now,()=>.2);expect(rows).toHaveLength(n||feed.problems.length);expect(new Set(rows.map(n=>n.id)).size).toBe(rows.length);}
  const f={region:s.notes[0].region,era:s.notes[0].era,query:s.notes[0].answer,cause:'unrecorded',mastery:'initial',from:'2026-11-20',to:'2026-11-20'};
  expect(filterPractice(s,f).map(n=>n.id)).toContain(ids()[0]);expect(filterPractice(s,{...f,to:'2026-11-19'})).toHaveLength(0);
  expect(japanDate('2026-11-19T15:00:00.000Z')).toBe('2026-11-20');
 });
 it('直近の連続誤答は、昔の誤答が多く最近は正答の問題より優先される',()=>{
  let s=base();s.notes[0].wrongCount=10;
  for(let i=0;i<5;i++)s=answer(s,ids()[0],'correct',`2026-11-${20+i}T00:00:00.000Z`);
  s=answer(s,ids()[1],'wrong','2026-11-24T01:00:00.000Z');s=answer(s,ids()[1],'wrong','2026-11-24T01:20:00.000Z');
  expect(weaknessScore(s.notes[1],s.practiceEvents)).toBeGreaterThan(weaknessScore(s.notes[0],s.practiceEvents));
  expect(selectPractice(s,'weak',5)[0].id).toBe(ids()[1]);expect(s.notes[0].wrongCount).toBe(10);
 });
 it('直近不正解のみ：正解で除外・再失点で復帰し、曖昧/未回答/旧履歴は混ぜない',()=>{
  let s=base();
  const [a,b,c,d,e]=ids();
  s=answer(s,a,'wrong','2026-11-20T00:01:00.000Z');
  s=answer(s,b,'wrong','2026-11-20T00:02:00.000Z');
  s=answer(s,b,'correct','2026-11-20T00:03:00.000Z');
  s=answer(s,c,'wrong','2026-11-20T00:04:00.000Z');
  s=answer(s,c,'ambiguous','2026-11-20T00:05:00.000Z');
  s=answer(s,d,'correct','2026-11-20T00:06:00.000Z');
  s.notes.find(n=>n.id===e)!.wrongCount=7; // Legacy accumulated mistakes have no last-result evidence.
  expect(selectPractice(s,'incorrect',0).map(n=>n.id)).toEqual([a]);
  expect(filterPractice(s,{answerStatus:'wrong'}).map(n=>n.id)).toEqual([a]);
  expect(lastPracticeResult(s.notes.find(n=>n.id===b)!,s.practiceEvents)).toBe('correct');
  expect(selectPractice(s,'weak',0).map(n=>n.id)).toContain(b); // Historical weakness stays available.
  s=answer(s,b,'wrong','2026-11-20T00:07:00.000Z');
  expect(selectPractice(s,'incorrect',0).map(n=>n.id)).toEqual([b,a]);
  s=answer(s,b,'correct','2026-11-20T00:08:00.000Z');
  expect(selectPractice(s,'incorrect',0).map(n=>n.id)).toEqual([a]);
  const round=startPractice(s,'incorrect',[a],'2026-11-20T00:09:00.000Z','incorrect-session');
  expect(validateChronology(JSON.parse(JSON.stringify(round))).practiceSessions!.at(-1)?.mode).toBe('incorrect');
  expect(round.notes.find(n=>n.id===b)!.wrongCount).toBe(2);
 });
 it('短時間の繰り返しは安定にならず、実際の間隔と期限後正答を必要とする',()=>{
  let s=base();for(let i=0;i<4;i++)s=answer(s,ids()[0],'correct',`2026-11-20T00:00:0${i}.000Z`);
  expect(notePractice(s.notes[0],s.practiceEvents).mastery).toBe('developing');
  s=base();for(const day of [20,21,24,31])s=answer(s,ids()[0],'correct',day===31?'2026-12-01T00:00:00.000Z':`2026-11-${day}T00:00:00.000Z`);
  expect(notePractice(s.notes[0],s.practiceEvents).mastery).toBe('stable');
  expect(notePractice(s.notes[0],s.practiceEvents).mastery).toBe('stable'); // expiration is not mastery evidence
  s=answer(s,ids()[0],'wrong','2026-12-02T00:00:00.000Z');expect(notePractice(s.notes[0],s.practiceEvents).mastery).toBe('initial');
 });
 it('途中の演習・モード別履歴は同期とバックアップで保持され、再復元で増えない',()=>{
  const old=base();old.notes[0].wrongCount=3;old.notes[0].correctCount=2;
  let s=startPractice(old,'range',ids(),now,'session');s=recordPractice(s,'session',ids()[0],'wrong',now);s=updatePractice(s,'session',2);
  const restored=validateChronology(JSON.parse(JSON.stringify(s)));expect(restored).toEqual(s);
  expect(mergeChronology(restored,restored)).toEqual(restored);
  expect(mergeChronology(restored,old).notes[0]).toEqual(s.notes[0]);
  const synced=applyChronologyFeed(s,feed,now);expect(synced.practiceEvents).toEqual(s.practiceEvents);expect(synced.practiceSessions).toEqual(s.practiceSessions);
  expect(synced.activePracticeId).toBe('session');expect(synced.notes[0].wrongCount).toBe(4);expect(synced.notes[0].correctCount).toBe(2);
 });
 it('新しい端末で先に同期した教材の登録日時が新しくても、バックアップの復習予定を消さない',()=>{
  const saved=answer(base(),ids()[0],'wrong',now);
  const fresh=applyChronologyFeed({version:1,notes:[]},feed,'2026-11-21T00:00:00.000Z');
  const restored=mergeChronology(fresh,saved);
  expect(restored.notes).toEqual(saved.notes);expect(restored.practiceEvents).toEqual(saved.practiceEvents);
  expect(restored.notes[0].nextReviewAt).toBe('2026-11-20T00:10:00.000Z');
 });
 it('バックアップの異なる回答を追加統合し、同じ回答IDの改変を拒否する',()=>{
  const s=startPractice(base(),'selected',ids(),now,'session');
  const a=recordPractice(s,'session',ids()[0],'wrong',now),b=recordPractice(s,'session',ids()[1],'correct',now);
  const merged=mergeChronology(a,b);expect(merged.practiceEvents).toHaveLength(2);expect(merged.notes[0].wrongCount).toBe(1);expect(merged.notes[1].correctCount).toBe(1);
  expect(mergeChronology(merged,b)).toEqual(merged);
  const bad=structuredClone(a);bad.practiceEvents![0].result='correct';expect(()=>mergeChronology(a,bad)).toThrow('競合');
  expect(()=>validateChronology(bad)).toThrow('矛盾');
 });
 it('検証済みの複数問を固定知識IDへ紐付け、未検証の問いは出さない',()=>{
  const f=structuredClone(feed) as any;f.version++;f.problems[0].knowledge_id='knowledge-fixture';f.problems[0].question_type='basic';f.problems[0].verification='verified';f.problems[0].verification_sources=[{title:'試験用の検証資料'}];
  f.problems[1].knowledge_id='knowledge-fixture';f.problems[1].question_type='distinction';f.problems[1].verification='provisional';
  const s=applyChronologyFeed(base(),f,now);expect(s.notes[0].knowledgeId).toBe(s.notes[1].knowledgeId);
  const changed=structuredClone(s);changed.notes[0].knowledgeId='different-knowledge';expect(()=>mergeChronology(s,changed)).toThrow('固定知識ID');
  expect(filterPractice(s).map(n=>n.id)).not.toContain(ids()[1]);expect(()=>startPractice(s,'single',[ids()[1]])).toThrow();
  delete f.problems[0].verification_sources;expect(()=>validateChronologyFeed(f)).toThrow('確認資料');delete f.problems[0].verification;expect(()=>validateChronologyFeed(f)).toThrow('検証状態');
 });
});
