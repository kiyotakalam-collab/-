/** Separate year-quiz data and history. The culture database and its cards are never modified. */
export type YearDirection = 'event-year' | 'year-event';
export type YearStudyMode = 'all' | 'unseen' | 'mistakes' | 'due';
export type YearLevel = 1 | 2 | 3 | 4;
export interface YearItem {
  id: string;
  year: string; // e.g. "1453", "紀元前221", "1914〜1918"; preserve requested precision
  event: string;
  era: string;
  region: string;
  level: YearLevel;
  explanation: string;
  sources: {title: string; url: string}[];
  version: number;
  deleted: boolean;
}
export interface YearCatalog {
  schemaVersion: 1;
  version: number;
  updatedAt: string;
  items: YearItem[];
}
export interface YearReview {
  id: string;
  questionId: string; // stable item ID + direction, retained across catalogue edits
  correct: boolean;
  at: string;
  sessionId: string;
}
export interface YearSnapshot {
  catalog: YearCatalog;
  events: YearReview[];
  lastSyncAt: string | null;
}
export interface YearQuestion {
  id: string;
  item: YearItem;
  direction: YearDirection;
  prompt: string;
  answer: string;
}
export interface YearFilter {
  direction: YearDirection | 'both';
  mode: YearStudyMode;
  level: YearLevel | 'all';
  region: string;
  era: string;
}
export const YEARS_URL = 'https://raw.githubusercontent.com/kiyotakalam-collab/-/main/public/year-events.json';
export const EMPTY_YEARS: YearCatalog = {schemaVersion: 1, version: 1, updatedAt: '2026-11-09T00:00:00.000Z', items: []};

const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const validId = (x: unknown) => typeof x === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199}$/.test(x);
const isIso = (x: unknown) => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(x) && Number.isFinite(Date.parse(x));
function stringField(x: unknown, n: string): string {
  if (typeof x !== 'string' || !x.trim() || x.length > 3000) throw Error(n + 'が不正です。');
  return x.trim();
}
export function validateYearCatalog(value: unknown): YearCatalog {
  if (!isRecord(value) || value.schemaVersion !== 1 || !Number.isSafeInteger(value.version) || (value.version as number) < 1 || !isIso(value.updatedAt) || !Array.isArray(value.items) || value.items.length > 10000) throw Error('年号データの形式が不正です。');
  const ids = new Set<string>();
  const items: YearItem[] = value.items.map((entry: unknown) => {
    if (!isRecord(entry) || !validId(entry.id)) throw Error('年号IDが不正です。');
    const id = entry.id as string;
    if (ids.has(id)) throw Error('年号IDが重複しています: ' + id);
    ids.add(id);
    if (!Number.isInteger(entry.level) || Number(entry.level)<1 || Number(entry.level)>4) throw Error('年号の難易度が不正です。');
    if (!Number.isSafeInteger(entry.version) || Number(entry.version)<1 || typeof entry.deleted !== 'boolean') throw Error('年号の管理情報が不正です。');
    if (!Array.isArray(entry.sources) || entry.sources.length>20) throw Error('年号の出典が不正です。');
    const sources = entry.sources.map((src: unknown) => {
      if (!isRecord(src)) throw Error('出典が不正です。');
      const title = stringField(src.title,'出典名'), url = stringField(src.url, '出典URL');
      const u = new URL(url);
      if (!['http:','https:'].includes(u.protocol) || u.username || u.password) throw Error('出典URLが不正です。');
      return {title,url};
    });
    return {id, year:stringField(entry.year,'年号'),event:stringField(entry.event,'出来事'),era:stringField(entry.era,'時代'),region:stringField(entry.region,'地域'),level:entry.level as YearLevel,explanation:typeof entry.explanation === 'string' && entry.explanation.length <= 3000 ? entry.explanation : '', sources,version:entry.version as number,deleted:entry.deleted as boolean};
  });
  return {schemaVersion:1,version:value.version as number,updatedAt:value.updatedAt as string,items};
}
export function mergeYearCatalog(current: YearCatalog, incoming: YearCatalog): YearCatalog {
  if (incoming.version < current.version) return current;
  const map = new Map(current.items.map(x=>[x.id,x]));
  for (const next of incoming.items) {
    const old = map.get(next.id);
    if (!old || next.version > old.version) map.set(next.id,next);
    else if (next.version === old.version && JSON.stringify(next) !== JSON.stringify(old)) throw Error('年号IDの変更が競合しています: ' + next.id);
  }
  return {schemaVersion:1, version:incoming.version, updatedAt:incoming.updatedAt,items:[...map.values()]};
}
export function questionId(id:string, direction:YearDirection):string {return id + '::' + direction;}
export function yearProgress(events:YearReview[]) {
  const map = new Map<string,{correct:number;wrong:number;streak:number;lastAt:string|null;dueAt:number}>();
  for(const ev of [...events].sort((a,b)=>a.at.localeCompare(b.at))) {
    const value=map.get(ev.questionId)||{correct:0,wrong:0,streak:0,lastAt:null,dueAt:0};
    if(ev.correct){value.correct++;value.streak++;}else{value.wrong++;value.streak=0;}
    const intervals=[1,3,7,14,30];
    value.dueAt=Date.parse(ev.at)+intervals[Math.min(value.streak,intervals.length-1)]*86400000;
    value.lastAt=ev.at;
    map.set(ev.questionId,value);
  }
  return map;
}
export function selectYearQuestions(catalog:YearCatalog, reviews:YearReview[], filter:YearFilter, at=Date.now()):YearQuestion[] {
  const progress=yearProgress(reviews);
  const questions:YearQuestion[]=[];
  for(const item of catalog.items){
    if(item.deleted || (filter.level!=='all' && item.level!==filter.level) || (filter.region!=='all' && item.region!==filter.region) || (filter.era!=='all' && item.era!==filter.era))continue;
    for(const direction of (filter.direction==='both'?['event-year','year-event']:[filter.direction]) as YearDirection[]){
      const id=questionId(item.id,direction),p=progress.get(id);
      if(filter.mode==='unseen'&&p||filter.mode==='mistakes'&&(!p||!p.wrong)||filter.mode==='due'&&(!p||p.dueAt>at))continue;
      questions.push({id,item,direction,prompt:direction==='event-year'?item.event+' は何年？':item.year+'：'+item.region+'・'+item.era+'で起きた出来事は？',answer:direction==='event-year'?item.year:item.event});
    }
  }
  return questions;
}
const DB_NAME='world-history-year-test'; // separate from cultural-history-master
export class YearDB {
  constructor(private database:IDBDatabase){}
  close(){this.database.close();}
  private req<T>(req:IDBRequest<T>):Promise<T> {return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('年号データを保存できません。'));});}
  private tx(mode:IDBTransactionMode){return this.database.transaction(['meta','reviews'],mode);}
  async load():Promise<YearSnapshot>{
    const t=this.tx('readonly');
    const [c,e,at]=await Promise.all([this.req<YearCatalog|undefined>(t.objectStore('meta').get('catalog')),this.req<YearReview[]>(t.objectStore('reviews').getAll()),this.req<string|null|undefined>(t.objectStore('meta').get('lastSyncAt'))]);
    return {catalog:c??structuredClone(EMPTY_YEARS),events:e,lastSyncAt:at??null};
  }
  async applyCatalog(input:YearCatalog):Promise<void>{
    const incoming=validateYearCatalog(input);
    const t=this.tx('readwrite');const store=t.objectStore('meta');
    const old=await this.req<YearCatalog|undefined>(store.get('catalog'));
    const merged=mergeYearCatalog(old??structuredClone(EMPTY_YEARS),incoming);
    await this.req(store.put(merged,'catalog'));
    await this.req(store.put(new Date().toISOString(),'lastSyncAt'));
  }
  async addReview(questionId:string,correct:boolean,sessionId:string):Promise<void>{
    if(!/^[a-zA-Z0-9_.:-]+::(event-year|year-event)$/.test(questionId))throw Error('年号問題IDが不正です。');
    const t=this.tx('readwrite'), reviews=t.objectStore('reviews');
    const id=crypto.randomUUID();
    await this.req(reviews.put({id,questionId,correct,at:new Date().toISOString(),sessionId} satisfies YearReview));
  }
  async exportBackup():Promise<string>{
    const state=await this.load();
    return JSON.stringify({format:'world-history-years',schemaVersion:1,exportedAt:new Date().toISOString(),...state},null,2);
  }
  async restoreBackup(text:string):Promise<void>{
    const parsed:unknown=JSON.parse(text);
    if(!isRecord(parsed)||parsed.format!=='world-history-years'||parsed.schemaVersion!==1||!Array.isArray(parsed.events))throw Error('年号テストのバックアップではありません。');
    const catalog=validateYearCatalog(parsed.catalog);
    const events:YearReview[]=parsed.events.map((v:unknown)=>{
      if(!isRecord(v)||!validId(v.id)||typeof v.questionId!=='string'||!v.questionId.includes('::')||typeof v.correct!=='boolean'||!isIso(v.at)||typeof v.sessionId!=='string')throw Error('年号履歴が不正です。');
      return {id:v.id as string,questionId:v.questionId,correct:v.correct,at:v.at as string,sessionId:v.sessionId};
    });
    // Merge imported records; never reset counts by overwriting reviews.
    const t=this.tx('readwrite'),meta=t.objectStore('meta'),reviews=t.objectStore('reviews');
    const old=await this.req<YearCatalog|undefined>(meta.get('catalog'));
    await this.req(meta.put(mergeYearCatalog(old??structuredClone(EMPTY_YEARS),catalog),'catalog'));
    for(const event of events){const existing=await this.req<YearReview|undefined>(reviews.get(event.id));if(!existing)await this.req(reviews.put(event));else if(JSON.stringify(existing)!==JSON.stringify(event))throw Error('年号履歴が競合しています。');}
  }
}
export function openYearDatabase():Promise<YearDB>{
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{
      const d=req.result;
      if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta');
      if(!d.objectStoreNames.contains('reviews'))d.createObjectStore('reviews',{keyPath:'id'});
    };
    req.onsuccess=()=>{req.result.onversionchange=()=>req.result.close();resolve(new YearDB(req.result));};
    req.onerror=()=>reject(req.error||Error('年号テストの保存領域を開けません。'));
    req.onblocked=()=>reject(Error('年号テストの保存領域が別のタブで使用されています。'));
  });
}
export async function fetchYearCatalog(db:YearDB):Promise<YearSnapshot>{
  if(!navigator.onLine)throw Error('オフラインです。保存済みの年号だけ利用できます。');
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const res=await fetch(YEARS_URL+'?t='+Date.now(),{signal:controller.signal,cache:'no-store'});
    if(!res.ok)throw Error('年号データの取得に失敗しました: HTTP '+res.status);
    const parsed=validateYearCatalog(await res.json());
    await db.applyCatalog(parsed);
    return db.load();
  }finally{clearTimeout(timeout);}
}
