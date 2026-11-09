/** Separate year-quiz data and history. The culture database and its cards are never modified. */
export type YearDirection = 'event-year' | 'year-event';
export type YearStudyMode = 'all' | 'unseen' | 'mistakes' | 'due' | 'weak';
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
export interface YearProgress {
  correct:number; wrong:number; attempts:number; streak:number;
  lastAt:string|null; dueAt:number; recent:boolean[];
}
export function yearProgress(events:YearReview[]) {
  const map = new Map<string,YearProgress>();
  for(const ev of [...events].sort((a,b)=>Date.parse(a.at)-Date.parse(b.at)||a.id.localeCompare(b.id))) {
    const value=map.get(ev.questionId)||{correct:0,wrong:0,attempts:0,streak:0,lastAt:null,dueAt:0,recent:[]};
    value.attempts++;
    if(ev.correct){value.correct++;value.streak++;}else{value.wrong++;value.streak=0;}
    value.recent=[...value.recent.slice(-4),ev.correct];
    const intervals=[1,3,7,14,30,60,120,180];
    value.dueAt=Date.parse(ev.at)+(ev.correct?intervals[Math.min(value.streak-1,intervals.length-1)]*86400000:600000);
    value.lastAt=ev.at;
    map.set(ev.questionId,value);
  }
  return map;
}
/** Recent mistakes, overdue time and streak outweigh bounded lifetime errors. */
export function yearPriority(progress:YearProgress|undefined, at=Date.now()):number {
  if(!progress)return 2;
  const recentFailure=1-progress.recent.filter(Boolean).length/Math.max(1,progress.recent.length);
  const overdue=Math.max(0,(at-progress.dueAt)/86400000);
  const idle=progress.lastAt?Math.max(0,(at-Date.parse(progress.lastAt))/86400000):0;
  return recentFailure*10+Math.min(20,overdue)+Math.min(5,idle/14)+Math.min(1,progress.wrong/20)-Math.min(3,progress.streak*.4);
}
function regionId(region:string):string {
  // Stable ASCII identifier for a geographic group; never depends on array order.
  return [...new TextEncoder().encode(region)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}
export function selectYearQuestions(catalog:YearCatalog, reviews:YearReview[], filter:YearFilter, at=Date.now()):YearQuestion[] {
  const progress=yearProgress(reviews);
  const available=catalog.items.filter(item=>!item.deleted
    && (filter.level==='all'||item.level===filter.level)
    && (filter.region==='all'||item.region===filter.region)
    && (filter.era==='all'||item.era===filter.era));
  const questions:YearQuestion[]=[];
  const include=(id:string)=>{
    const p=progress.get(id);
    return !(filter.mode==='unseen'&&p || filter.mode==='mistakes'&&(!p||!p.wrong) || filter.mode==='due'&&(!p||p.dueAt>at));
  };
  if(filter.direction==='event-year'||filter.direction==='both'){
    for(const item of available){
      const id=questionId(item.id,'event-year');
      if(include(id))questions.push({id,item,direction:'event-year',prompt:item.event+' は何年？',answer:item.year});
    }
  }
  if(filter.direction==='year-event'||filter.direction==='both'){
    // A date can have many valid events. Group by year + region to avoid
    // identical questions claiming one of multiple equally correct answers.
    const groups=new Map<string,YearItem[]>();
    for(const item of available) {
      const key=item.year+'|'+item.region;
      const group=groups.get(key)||[];
      group.push(item);
      groups.set(key,group);
    }
    for(const members of groups.values()){
      const item=members[0];
      const id=questionId('group-'+item.year+'-'+regionId(item.region),'year-event');
      if(!include(id))continue;
      const answers=[...new Set(members.map(x=>x.event))];
      questions.push({id,item,direction:'year-event',prompt:item.year+'年（'+item.region+'）に起きた出来事を1つ答えよ',answer:answers.join(' ／ ')});
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
  private async write<T>(action:(transaction:IDBTransaction)=>Promise<T>):Promise<T>{
    const transaction=this.tx('readwrite');
    const completion=new Promise<void>((resolve,reject)=>{
      transaction.oncomplete=()=>resolve();
      transaction.onabort=()=>reject(transaction.error||Error('年号データの変更を取り消しました。'));
      transaction.onerror=()=>{/* onabort reports the final transaction outcome */};
    });
    try{const result=await action(transaction);await completion;return result;}
    catch(error){try{transaction.abort();}catch{/* already aborted */}await completion.catch(()=>undefined);throw error;}
  }
  async load():Promise<YearSnapshot>{
    const t=this.tx('readonly');
    const [c,e,at]=await Promise.all([this.req<YearCatalog|undefined>(t.objectStore('meta').get('catalog')),this.req<YearReview[]>(t.objectStore('reviews').getAll()),this.req<string|null|undefined>(t.objectStore('meta').get('lastSyncAt'))]);
    return {catalog:c??structuredClone(EMPTY_YEARS),events:e,lastSyncAt:at??null};
  }
  async applyCatalog(input:YearCatalog):Promise<void>{
    const incoming=validateYearCatalog(input);
    await this.write(async t=>{
      const store=t.objectStore('meta');
      const old=await this.req<YearCatalog|undefined>(store.get('catalog'));
      const merged=mergeYearCatalog(old??structuredClone(EMPTY_YEARS),incoming);
      await this.req(store.put(merged,'catalog'));
      await this.req(store.put(new Date().toISOString(),'lastSyncAt'));
    });
  }
  async addReview(questionId:string,correct:boolean,sessionId:string):Promise<void>{
    const itemId=questionItemId(questionId);
    if(typeof correct!=='boolean'||!validId(sessionId))throw Error('年号回答が不正です。');
    await this.write(async t=>{
      const meta=t.objectStore('meta'),reviews=t.objectStore('reviews');
      const catalog=await this.req<YearCatalog|undefined>(meta.get('catalog'));
      if(!catalog?.items.some(item=>item.id===itemId&&!item.deleted))throw Error('出題できる年号が見つかりません。');
      let latest=await this.req<string|undefined>(meta.get('lastReviewAt'));
      if(!latest){const old=await this.req<YearReview[]>(reviews.getAll());latest=old.reduce((max,event)=>event.at>max?event.at:max,'');}
      const at=new Date(Math.max(Date.now(),latest?Date.parse(latest)+1:0)).toISOString();
      await this.req(reviews.add({id:crypto.randomUUID(),questionId,correct,at,sessionId} satisfies YearReview));
      await this.req(meta.put(at,'lastReviewAt'));
    });
  }
  async exportBackup():Promise<string>{
    const state=await this.load();
    return JSON.stringify({format:'world-history-years',schemaVersion:1,exportedAt:new Date().toISOString(),...state},null,2);
  }
  async restoreBackup(text:string):Promise<void>{
    const parsed:unknown=JSON.parse(text);
    if(!isRecord(parsed)||parsed.format!=='world-history-years'||parsed.schemaVersion!==1||!Array.isArray(parsed.events)||parsed.events.length>1000000)throw Error('年号テストのバックアップではありません。');
    const catalog=validateYearCatalog(parsed.catalog);
    const itemIds=new Set(catalog.items.map(item=>item.id)),eventIds=new Set<string>();
    const events:YearReview[]=parsed.events.map((v:unknown)=>{
      if(!isRecord(v)||!validId(v.id)||typeof v.questionId!=='string'||typeof v.correct!=='boolean'||!isIso(v.at)||!validId(v.sessionId))throw Error('年号履歴が不正です。');
      if(!itemIds.has(questionItemId(v.questionId))||eventIds.has(v.id as string))throw Error('年号履歴の参照先またはIDが不正です。');
      eventIds.add(v.id as string);
      return {id:v.id as string,questionId:v.questionId,correct:v.correct,at:v.at as string,sessionId:v.sessionId as string};
    });
    // Merge imported records; never reset counts by overwriting reviews.
    await this.write(async t=>{
      const meta=t.objectStore('meta'),reviews=t.objectStore('reviews');
      const old=await this.req<YearCatalog|undefined>(meta.get('catalog'))??structuredClone(EMPTY_YEARS);
      const merged=mergeYearCatalog(old,{...catalog,version:Math.max(old.version,catalog.version),updatedAt:Date.parse(old.updatedAt)>Date.parse(catalog.updatedAt)?old.updatedAt:catalog.updatedAt});
      await this.req(meta.put(merged,'catalog'));
      let latest=await this.req<string|undefined>(meta.get('lastReviewAt'));
      if(!latest){const saved=await this.req<YearReview[]>(reviews.getAll());latest=saved.reduce((max,event)=>event.at>max?event.at:max,'');}
      for(const event of events){
        const existing=await this.req<YearReview|undefined>(reviews.get(event.id));
        if(!existing)await this.req(reviews.add(event));
        else if(JSON.stringify(existing)!==JSON.stringify(event))throw Error('年号履歴が競合しています。');
        if(!latest||Date.parse(event.at)>Date.parse(latest))latest=event.at;
      }
      if(latest)await this.req(meta.put(latest,'lastReviewAt'));
    });
  }
}
function questionItemId(value:string):string{
  const match=/^([a-zA-Z0-9][a-zA-Z0-9_.:-]{0,199})::(event-year|year-event)$/.exec(value);
  if(!match)throw Error('年号問題IDが不正です。');
  return match[1];
}
export function openYearDatabase(name=DB_NAME):Promise<YearDB>{
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(name,1);
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
