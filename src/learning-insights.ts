import { getProgress } from './core';
import { REGION_GROUPS, regionGroup } from './culture-scope';
import { questionId, yearProgress, type YearSnapshot } from './years';
import type { Catalog, ReviewEvent } from './types';

export type LearningArea='culture'|'years';
export type Mastery='unseen'|'review'|'learning'|'stable';
export const MASTERY_LABELS:Record<Mastery,string>={unseen:'未学習',review:'要復習',learning:'定着途中',stable:'安定'};
export const MASTERY_RULES=[
  '未学習：この問題の回答履歴がない。',
  '要復習：期限到来、直近が誤答、直近3回答で2回以上誤答、または最終回答から30日以上経過し連続正答が3未満。',
  '安定：上記に該当せず、連続正答3回以上・直近3回答がすべて正答・最終回答から30日未満・復習期限は未来。',
  '定着途中：学習済みで、要復習にも安定にも該当しない。',
];
const DAY=86400000;
const jstFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'});
export function japanDateKey(at:number|string|Date=Date.now()):string {
  const parts=jstFormatter.formatToParts(new Date(at)),get=(type:string)=>parts.find(p=>p.type===type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function japanDateTime(at:number){return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(at);}
export function monthDays(month:string):(string|null)[]{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('月の形式が不正です。');
  const [year,m]=month.split('-').map(Number),first=new Date(Date.UTC(year,m-1,1)),days=new Date(Date.UTC(year,m,0)).getUTCDate();
  return [...Array<null>(first.getUTCDay()).fill(null),...Array.from({length:days},(_,i)=>`${month}-${String(i+1).padStart(2,'0')}`)];
}
export function shiftMonth(month:string,offset:number){
  monthDays(month);const [year,m]=month.split('-').map(Number),date=new Date(Date.UTC(year,m-1+offset,1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth()+1).padStart(2,'0')}`;
}
interface LearningState {attempts:number;recent:boolean[];streak:number;lastAt:number|null;dueAt:number|null}
export function classifyMastery(p:LearningState,now=Date.now()):Mastery {
  if(!p.attempts)return 'unseen';
  const age=p.lastAt===null?Infinity:Math.max(0,now-p.lastAt),recent=p.recent.slice(-3);
  if(p.dueAt!==null&&p.dueAt<=now || p.recent.at(-1)===false || recent.filter(x=>!x).length>=2 || age>=30*DAY&&p.streak<3)return 'review';
  if(p.streak>=3&&recent.length===3&&recent.every(Boolean)&&age<30*DAY&&p.dueAt!==null&&p.dueAt>now)return 'stable';
  return 'learning';
}
export interface LearningRow extends LearningState {
  area:LearningArea; id:string; title:string; name:string; region:string; era:string; level:number;
  correct:number;wrong:number;mastery:Mastery;
}
export interface InsightsSource {catalog:Catalog;events:ReviewEvent[];years:YearSnapshot|null}
export function learningRows(source:InsightsSource,now=Date.now()):LearningRow[]{
  const progress=getProgress(source.events),items=new Map(source.catalog.items.filter(x=>!x.deleted).map(x=>[x.id,x]));
  const rows:LearningRow[]=[];
  for(const card of source.catalog.cards){
    const item=items.get(card.knowledgeId);if(card.deleted||!item)continue;
    const p=progress.get(card.id),state:LearningState={attempts:p?.attempts??0,recent:p?.recent??[],streak:p?.streak??0,lastAt:p?.lastStudiedAt?Date.parse(p.lastStudiedAt):null,dueAt:p?.nextReviewAt?Date.parse(p.nextReviewAt):null};
    rows.push({...state,area:'culture',id:card.id,title:card.question,name:item.canonicalName,region:REGION_GROUPS.find(group=>group.id===regionGroup(item))?.label??item.region,era:item.era,level:item.level,correct:p?.correct??0,wrong:p?.wrong??0,mastery:classifyMastery(state,now)});
  }
  if(source.years){
    const progress=yearProgress(source.years.events);
    for(const item of source.years.catalog.items){
      if(item.deleted)continue;const id=questionId(item.id,'event-year'),p=progress.get(id);
      const state:LearningState={attempts:p?.attempts??0,recent:p?.recent??[],streak:p?.streak??0,lastAt:p?.lastAt?Date.parse(p.lastAt):null,dueAt:p?p.dueAt:null};
      rows.push({...state,area:'years',id,title:item.event,name:item.event,region:item.region,era:item.era,level:item.level,correct:p?.correct??0,wrong:p?.wrong??0,mastery:classifyMastery(state,now)});
    }
  }
  return rows;
}
export function dueSummary(rows:LearningRow[],now=Date.now()){
  const today=japanDateKey(now);
  return {due:rows.filter(row=>row.dueAt!==null&&row.dueAt<=now).length,
    overdue:rows.filter(row=>row.dueAt!==null&&japanDateKey(row.dueAt)<today).length,
    todayDue:rows.filter(row=>row.dueAt!==null&&row.dueAt<=now&&japanDateKey(row.dueAt)===today).length,
    today:rows.filter(row=>row.dueAt!==null&&japanDateKey(row.dueAt)===today).length};
}
export interface CalendarDay {culture:number;years:number;total:number}
const increment=(map:Map<string,CalendarDay>,date:string,area:LearningArea)=>{const day=map.get(date)??{culture:0,years:0,total:0};day[area]++;day.total++;map.set(date,day);};
export function reviewCalendar(rows:LearningRow[],source:InsightsSource,area:LearningArea|'all'='all'){
  const scheduled=new Map<string,CalendarDay>(),actual=new Map<string,CalendarDay>();
  for(const row of rows)if(row.dueAt!==null&&(area==='all'||row.area===area))increment(scheduled,japanDateKey(row.dueAt),row.area);
  if(area!=='years')for(const event of source.events)increment(actual,japanDateKey(event.reviewedAt),'culture');
  if(area!=='culture')for(const event of source.years?.events??[])if(event.questionId.endsWith('::event-year'))increment(actual,japanDateKey(event.at),'years');
  return {scheduled,actual};
}
export function masteryCounts(rows:LearningRow[]){
  const counts:Record<Mastery,number>={unseen:0,review:0,learning:0,stable:0};for(const row of rows)counts[row.mastery]++;return counts;
}
export type Dimension='region'|'era'|'level';
export function masteryGroups(rows:LearningRow[],dimension:Dimension){
  const groups=new Map<string,LearningRow[]>();for(const row of rows){const key=String(row[dimension]);const values=groups.get(key)??[];values.push(row);groups.set(key,values);}
  return [...groups].map(([value,rows])=>{const counts=masteryCounts(rows);return {value,total:rows.length,counts,weakness:(counts.review*2+counts.unseen+counts.learning*.5)/(2*rows.length)};})
    .sort((a,b)=>b.weakness-a.weakness||b.counts.review-a.counts.review||b.total-a.total||a.value.localeCompare(b.value,'ja'));
}
