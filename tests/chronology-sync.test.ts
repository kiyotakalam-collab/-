import {describe,it,expect,vi} from 'vitest';
import feed from '../public/chronology-errors.json';
import {applyChronologyFeed,fetchChronologyFeed,validateChronologyFeed,InvalidChronologyFeedError} from '../src/chronology-sync';
import {EMPTY_CHRONOLOGY,addChronology,gradeChronology,loadChronology,mergeChronology,CHRONOLOGY_NOTE_KEY,validateChronology} from '../src/chronology-errors';
const now='2026-11-11T10:00:00.000Z';
const empty=()=>structuredClone(EMPTY_CHRONOLOGY);
describe('通史Sheets配信と履歴の分離',()=>{
 it('実シート読み戻し18件・空の出典と原因を検証し、登録を回答として扱わない',()=>{
  const checked=validateChronologyFeed(feed),s=applyChronologyFeed(empty(),checked,now);
  expect(checked.problems).toHaveLength(feed.problems.length);
  expect(checked.problems.every(p=>p.source===''&&p.source_detail===''&&p.cause==='')).toBe(true);
  expect(s.notes.every(n=>n.wrongCount===0&&n.correctCount===0&&n.nextReviewAt===null&&n.lastReviewedAt===null)).toBe(true);
 });
 it('再同期・本文修正・停止・削除行の同期でも既存回数と復習予定を保持する',()=>{
  let s=applyChronologyFeed(empty(),feed,now),id=s.notes[0].id;
  for(let i=0;i<3;i++)s=gradeChronology(s,id,false,now);
  for(let i=0;i<2;i++)s=gradeChronology(s,id,true,now);
  const original=structuredClone(s.notes[0]);
  expect(applyChronologyFeed(s,feed,now).notes).toEqual(s.notes);
  const changed=structuredClone(feed);changed.version++;changed.problems[0].answer+='（表記修正）';changed.problems[0].active=false;
  changed.problems[0].updated_at=now;changed.problems.pop();
  const updated=applyChronologyFeed(s,changed,now);
  expect(updated.notes).toHaveLength(feed.problems.length);
  expect(updated.notes[0]).toMatchObject({...original,answer:changed.problems[0].answer,active:false,masterUpdatedAt:now});
  expect(updated.notes[0].wrongCount).toBe(3);expect(updated.notes[0].correctCount).toBe(2);
  expect(updated.notes[0].nextReviewAt).toBe(original.nextReviewAt);
 });
 it('不正行・重複ID・巻き戻り・同一バージョンの内容変更を全体拒否する',()=>{
  const s=applyChronologyFeed(empty(),feed,now),original=structuredClone(s);
  for(const edit of [
   (x:any)=>x.problems.push(x.problems[0]),(x:any)=>x.problems[1].active='false',
   (x:any)=>x.problems[1].updated_at='昨日',(x:any)=>x.problems[1].question='',
   (x:any)=>x.problems[1].answer='同じ版を改ざん', (x:any)=>x.version=0,
  ]){const bad=structuredClone(feed);edit(bad);expect(()=>applyChronologyFeed(s,bad,now)).toThrow();expect(s).toEqual(original);}
 });
 it('問題追加後も既存の回数・復習期限を保持し、同じ追加を複製しない',()=>{
  const s=gradeChronology(applyChronologyFeed(empty(),feed,now),feed.problems[0].id,false,now);
  const added=structuredClone(feed);added.version++;
  added.problems.push({...added.problems[0],id:'fixture-new-id',term:'試験専用用語',question:'試験専用の問い'});
  const next=applyChronologyFeed(s,added,now);
  expect(next.notes).toHaveLength(s.notes.length+1);expect(next.notes[0]).toEqual(s.notes[0]);
  expect(applyChronologyFeed(next,added,now).notes).toEqual(next.notes);
 });
 it('本文改訂前のバックアップを統合しても、新本文と累積誤答を巻き戻さない',()=>{
  const old=applyChronologyFeed(empty(),feed,now);
  const newer=structuredClone(feed);newer.version++;newer.problems[0].answer+='（修正）';newer.problems[0].updated_at=now;
  const current=gradeChronology(applyChronologyFeed(old,newer,now),old.notes[0].id,false,now);
  const restored=mergeChronology(current,old);
  expect(restored.notes).toEqual(current.notes);expect(restored.sync).toEqual(current.sync);
 });
 it('旧形式・手動登録・新バックアップを保持し、再復元で件数や誤答を増減しない',()=>{
  const old=addChronology(empty(),{question:'既存の問い',answer:'既存の答え',source:'模試',sourceDetail:'',cause:'B',region:'地域',era:'時代',explanation:''},now);
  const s=applyChronologyFeed(old,feed,now);
  expect(s.notes[0]).toEqual(old.notes[0]);
  const restored=validateChronology(JSON.parse(JSON.stringify(s)));
  expect(mergeChronology(restored,old).notes).toEqual(s.notes);
  expect(mergeChronology(restored,restored)).toEqual(restored);
  const storage={getItem:vi.fn((k:string)=>k===CHRONOLOGY_NOTE_KEY?JSON.stringify(s):null)};
  expect(loadChronology(storage)).toEqual(s);
 });
 it('取得は認証情報を送らず、不正JSON・ログインHTML・HTTP失敗を拒否する',async()=>{
  const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify(feed)));
  expect(await fetchChronologyFeed('https://example.org/feed',fetcher)).toEqual(feed);
  expect(fetcher.mock.calls[0][1]).toMatchObject({cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});
  fetcher.mockResolvedValue(new Response('<html>Login</html>'));
  await expect(fetchChronologyFeed('https://example.org/feed',fetcher)).rejects.toBeInstanceOf(InvalidChronologyFeedError);
  fetcher.mockResolvedValue(new Response('',{status:403}));
  await expect(fetchChronologyFeed('https://example.org/feed',fetcher)).rejects.toThrow('403');
 });
});
