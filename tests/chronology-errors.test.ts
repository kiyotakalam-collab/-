import {describe,it,expect,vi} from 'vitest';
import {addChronology,gradeChronology,mergeChronology,dueChronology,validateChronology,EMPTY_CHRONOLOGY} from '../src/chronology-errors';

const hole={
 question:'ブリュメール18日のクーデタ後に成立した政府は？',answer:'統領政府',
 explanation:'総裁政府の後、ナポレオンが第一統領となる。',source:'慶應文学部過去問',
 sourceDetail:'2020年度 問4',region:'西ヨーロッパ',era:'18世紀末',cause:'C' as const
};
describe('通史誤答ノート',()=>{
 it('登録時に出典と誤答1回を保持し、同一知識の二重登録を防ぐ',()=>{
  vi.stubGlobal('crypto',{randomUUID:()=> 'hole-id'});
  const s=addChronology(structuredClone(EMPTY_CHRONOLOGY),hole,'2026-11-11T08:00:00.000Z');
  expect(s.notes).toHaveLength(1);
  expect(s.notes[0].wrongCount).toBe(1);
  expect(s.notes[0].source).toBe('慶應文学部過去問');
  expect(()=>addChronology(s,hole)).toThrow('同じ知識の穴');
  vi.unstubAllGlobals();
 });
 it('正誤で累積誤答を消さず復習期限を調整する',()=>{
  vi.stubGlobal('crypto',{randomUUID:()=> 'hole-id'});
  const s=addChronology(structuredClone(EMPTY_CHRONOLOGY),hole,'2026-11-11T08:00:00.000Z');
  const a=gradeChronology(s,'hole-id',true,'2026-11-12T08:00:00.000Z');
  expect(a.notes[0].wrongCount).toBe(1);
  expect(a.notes[0].correctCount).toBe(1);
  expect(a.notes[0].nextReviewAt).toBe('2026-11-13T08:00:00.000Z');
  const b=gradeChronology(a,'hole-id',false,'2026-11-13T08:00:00.000Z');
  expect(b.notes[0].wrongCount).toBe(2);
  expect(b.notes[0].stage).toBe(0);
  expect(b.notes[0].nextReviewAt).toBe('2026-11-13T08:10:00.000Z');
  expect(dueChronology(b,'2026-11-13T08:11:00.000Z')).toHaveLength(1);
  vi.unstubAllGlobals();
 });
 it('バックアップ統合はID別で重複しない・競合を拒否する',()=>{
  vi.stubGlobal('crypto',{randomUUID:()=> 'hole-id'});
  const s=addChronology(structuredClone(EMPTY_CHRONOLOGY),hole,'2026-11-11T08:00:00.000Z');
  expect(mergeChronology(s,s).notes).toHaveLength(1);
  const edited=structuredClone(s);
  edited.notes[0].answer='まったく別の答え';
  expect(()=>mergeChronology(s,edited)).toThrow('競合');
  expect(()=>validateChronology({version:2,notes:[]})).toThrow();
  vi.unstubAllGlobals();
 });
});
