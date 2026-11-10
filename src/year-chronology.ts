import type { YearCatalog, YearItem, YearLevel } from './years';

export interface ChronologyFilter { level: YearLevel | 'all'; region: string; era: string }
export interface OrderingFilter extends ChronologyFilter { mode: 'all' | 'unseen' | 'weak' }
export interface OrderingQuestion { id: string; items: YearItem[] }
export interface OrderingReview {
  id: string; questionId: string; itemIds: string[]; submittedIds: string[]; correctOrderIds: string[];
  correct: boolean; at: string; sessionId: string;
}
/** Only exact years are comparable. Ranges, decades and estimates remain untouched in the catalogue. */
export function comparableYear(raw: string): number | null {
  const text = raw.normalize('NFKC').replace(/\s/g,'');
  let match = /^(?:紀元前|前|BC|BCE)([1-9]\d*)(?:年)?$/i.exec(text);
  if (!match) match = /^([1-9]\d*)(?:年)?(?:BC|BCE)$/i.exec(text);
  const value = match ? -Number(match[1]) : /^(?:西暦|AD|CE)?[1-9]\d*(?:年)?$/i.test(text) ? Number(text.replace(/^(?:西暦|AD|CE)/i,'').replace(/年$/,'')) : /^-[1-9]\d*$/.test(text) ? Number(text) : NaN;
  return Number.isSafeInteger(value) && Math.abs(value) <= 100000 ? value : null;
}
export const yearLabel = (year: number) => year < 0 ? `紀元前${-year}年` : `${year}年`;
export function chronologyItems(catalog: YearCatalog, filter: ChronologyFilter) {
  return catalog.items.filter(item => !item.deleted && (filter.level === 'all' || item.level === filter.level)
    && (filter.region === 'all' || item.region === filter.region) && (filter.era === 'all' || item.era === filter.era));
}
export const orderingKey = (ids: string[]) => JSON.stringify([...ids].sort());
export function orderingProgress(reviews: OrderingReview[]) {
  const map = new Map<string, {correct:number;wrong:number;recent:boolean[];lastAt:string}>();
  for (const review of [...reviews].sort((a,b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))) {
    const p = map.get(review.questionId) ?? {correct:0,wrong:0,recent:[],lastAt:''};
    if (review.correct) p.correct++; else p.wrong++;
    p.recent = [...p.recent.slice(-4),review.correct]; p.lastAt = review.at; map.set(review.questionId,p);
  }
  return map;
}
export function orderingCandidates(catalog: YearCatalog, reviews: OrderingReview[], filter: OrderingFilter): OrderingQuestion[] {
  const items = chronologyItems(catalog,filter).filter(item => comparableYear(item.year) !== null)
    .sort((a,b) => comparableYear(a.year)! - comparableYear(b.year)! || a.id.localeCompare(b.id));
  const progress = orderingProgress(reviews), result: OrderingQuestion[] = [];
  // Each oldest event is combined with three of its next five neighbours. This bounds work to O(n).
  for (let a = 0; a < items.length-3; a++) {
    for (let b=a+1;b<Math.min(a+6,items.length);b++) for (let c=b+1;c<Math.min(a+6,items.length);c++) for (let d=c+1;d<Math.min(a+6,items.length);d++) {
      const group = [items[a],items[b],items[c],items[d]], years = group.map(item => comparableYear(item.year)!);
      if (new Set(years).size !== 4 || years[3]-years[0] > 200) continue;
      const id = orderingKey(group.map(item => item.id));
      if (filter.mode === 'unseen' && progress.has(id)) continue;
      result.push({id,items:group});
    }
  }
  return result;
}
export function selectOrderingQuestions(catalog: YearCatalog, reviews: OrderingReview[], filter: OrderingFilter, count: number, random = Math.random) {
  const questions = shuffle(orderingCandidates(catalog,reviews,filter),random), progress = orderingProgress(reviews);
  if (filter.mode === 'weak') {
    const score = (id:string) => { const p=progress.get(id); return p ? p.recent.filter(x=>!x).length/Math.max(1,p.recent.length)*10 + Math.min(1,p.wrong/20) : 0; };
    questions.sort((a,b) => score(b.id)-score(a.id));
  }
  return questions.slice(0,count).map(question => {
    let items = shuffle(question.items,random);
    if (items.every((item,i) => item.id === question.items[i].id)) items = [...items.slice(1),items[0]];
    return {...question,items};
  });
}
function shuffle<T>(values:T[],random:()=>number) {
  const result=[...values]; for(let i=result.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(random()*(i+1))));[result[i],result[j]]=[result[j],result[i]];} return result;
}
export function correctOrdering(items: YearItem[]): string[] {
  const dates=items.map(item=>comparableYear(item.year));
  if (items.length!==4 || dates.some(x=>x===null) || new Set(dates).size!==4 || new Set(items.map(x=>x.id)).size!==4) throw Error('異なる比較可能な4年の出来事が必要です。');
  return [...items].sort((a,b)=>comparableYear(a.year)!-comparableYear(b.year)!).map(item=>item.id);
}
export function validateOrderingReview(value: unknown): OrderingReview {
  if (!value || typeof value!=='object') throw Error('整序履歴が不正です。');
  const v=value as OrderingReview, valid=(id:unknown)=>typeof id==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/.test(id);
  const array=(a:unknown):a is string[]=>Array.isArray(a)&&a.length===4&&a.every(valid)&&new Set(a).size===4;
  if (!valid(v.id)||!valid(v.sessionId)||!array(v.itemIds)||!array(v.submittedIds)||!array(v.correctOrderIds)
    || orderingKey(v.itemIds)!==v.questionId || orderingKey(v.submittedIds)!==v.questionId || orderingKey(v.correctOrderIds)!==v.questionId
    || typeof v.at!=='string'||!/^\d{4}-\d\d-\d\dT/.test(v.at)||!Number.isFinite(Date.parse(v.at))||new Date(v.at).toISOString()!==v.at
    || typeof v.correct!=='boolean'||v.correct!==v.submittedIds.every((id,i)=>id===v.correctOrderIds[i])) throw Error('整序履歴が不正です。');
  return {id:v.id,questionId:v.questionId,itemIds:[...v.itemIds],submittedIds:[...v.submittedIds],correctOrderIds:[...v.correctOrderIds],correct:v.correct,at:v.at,sessionId:v.sessionId};
}
export function timelineItems(catalog:YearCatalog, filter:ChronologyFilter & {regions:string[];start:number;end:number}) {
  return chronologyItems(catalog,{...filter,region:'all'}).filter(item => {
    const year=comparableYear(item.year); return year!==null && year>=filter.start && year<=filter.end && (!filter.regions.length||filter.regions.includes(item.region));
  }).sort((a,b)=>comparableYear(a.year)!-comparableYear(b.year)!||a.region.localeCompare(b.region,'ja')||a.id.localeCompare(b.id));
}
/** Place event cards in separate rows whenever their time positions would overlap. */
export function timelineLayout(items:YearItem[],start:number,scale:number,cardWidth=200) {
  const ends:number[]=[];
  const positions=items.map(item=>{const x=(comparableYear(item.year)!-start)*scale;let row=ends.findIndex(end=>end+12<=x);if(row<0)row=ends.length;ends[row]=x+cardWidth;return {item,x,row};});
  return {positions,rows:ends.length};
}
