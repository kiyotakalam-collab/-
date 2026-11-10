import { EMPTY_CATALOG, mergeCatalog, sameValue, validateBackup, validateCatalog, validateEvent, validateSettings } from './core';
import { DEFAULT_SETTINGS, type AppState, type Backup, type Catalog, type ReviewEvent, type Settings } from './types';
import type {ComparisonEvent,CultureRelations} from './culture-feature-types';
import {gradeComparison,prepareComparison,validateComparisonEvent} from './culture-compare';
import {resolveRelations,validateRelations} from './culture-relations';
import {localDateKey,reconcileDailyPlan,type DailyPlan} from './culture-daily';

export const DATABASE_VERSION = 3;
const DATABASE_NAME = 'cultural-history-master';
function request<T>(req: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error ?? new Error('端末内データを読み取れませんでした。')); }); }
function completion(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error ?? new Error('端末内データを保存できませんでした。')); tx.onabort = () => reject(tx.error ?? new Error('端末内データの変更を中止しました。')); }); }
function checkRelations(next:CultureRelations,catalog:Catalog,old?:CultureRelations){
  const checked=resolveRelations(next,{...catalog,items:catalog.items.map(item=>({...item,deleted:false}))});
  if(checked.diagnostics.length)throw Error('関係データの参照・対応が不正です。'+checked.diagnostics[0]);
  if(old){
    const edges=new Map(old.relations.map(r=>[r.id,r])),sets=new Map(old.comparisonSets.map(s=>[s.id,s]));
    for(const r of next.relations){const before=edges.get(r.id);if(before&&(before.fromId!==r.fromId||before.toId!==r.toId||before.type!==r.type))throw Error('関係IDの意味を変更することはできません。');}
    for(const s of next.comparisonSets){const before=sets.get(s.id);if(before&&before.direction!==s.direction)throw Error('比較セットIDの出題方向を変更することはできません。');}
  }
}

export class HistoryDB {
  constructor(private readonly db: IDBDatabase) {}
  close(): void { this.db.close(); }
  private async transaction<T>(mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T>): Promise<T> {
    const tx = this.db.transaction(['meta', 'events', 'comparisonEvents'], mode);
    const done = completion(tx);
    try { const result = await work(tx); await done; return result; }
    catch (error) { try { tx.abort(); } catch { /* Already aborted/completed. */ } await done.catch(() => {}); throw error; }
  }
  async load(): Promise<AppState> {
    return this.transaction('readonly', async tx => {
      const meta = tx.objectStore('meta');
      const [catalog, settings, events,comparisonEvents] = await Promise.all([request(meta.get('catalog')), request(meta.get('settings')), request(tx.objectStore('events').getAll()),request(tx.objectStore('comparisonEvents').getAll())]);
      return {catalog: catalog ? validateCatalog(catalog) : structuredClone(EMPTY_CATALOG), settings: settings ? validateSettings(settings) : {...DEFAULT_SETTINGS}, events: events.map(validateEvent),comparisonEvents:comparisonEvents.map(validateComparisonEvent)};
    });
  }
  async applyCatalog(incoming: Catalog): Promise<void> {
    // Validate before opening a transaction; a failed batch never touches saved data.
    const parsed = validateCatalog(incoming, true);
    return this.transaction('readwrite', async tx => {
      const meta = tx.objectStore('meta');
      const current = await request(meta.get('catalog')) as Catalog | undefined;
      await request(meta.put(mergeCatalog(current ?? EMPTY_CATALOG, parsed), 'catalog'));
    });
  }
  async recordReview(cardId: string, correct: boolean, sessionId: string): Promise<ReviewEvent> {
    return this.transaction('readwrite', async tx => {
      const events = tx.objectStore('events');
      const [catalog, last] = await Promise.all([request(tx.objectStore('meta').get('catalog')) as Promise<Catalog | undefined>, request(events.index('reviewedAt').openCursor(null, 'prev'))]);
      const card = catalog?.cards.find(entry => entry.id === cardId && !entry.deleted);
      if (!card || !catalog?.items.some(entry => entry.id === card.knowledgeId && !entry.deleted)) throw new Error('このカードは削除済み、または見つかりません。');
      // A strictly increasing timestamp prevents ties even across multiple tabs.
      const reviewedAt = new Date(Math.max(Date.now(), last ? Date.parse((last.value as ReviewEvent).reviewedAt) + 1 : 0)).toISOString();
      const event = validateEvent({id: crypto.randomUUID(), cardId, correct, sessionId, reviewedAt});
      await request(events.add(event));
      return event;
    });
  }
  async updateSettings(changes: Partial<Settings>): Promise<void> {
    return this.transaction('readwrite', async tx => {
      const meta = tx.objectStore('meta');
      const old = await request(meta.get('settings')) as Settings | undefined;
      const next = validateSettings({...DEFAULT_SETTINGS, ...old, ...changes});
      await request(meta.put(next, 'settings'));
    });
  }
  async exportBackup(): Promise<Backup> {
    const state = await this.load();
    const relations=await this.loadRelations();
    return {format: 'cultural-history-master', schemaVersion: 2, exportedAt: new Date().toISOString(), ...state,...(relations?{relations}:{})};
  }
  async restoreBackup(input: unknown): Promise<void> {
    const backup = validateBackup(input);
    return this.transaction('readwrite', async tx => {
      const meta = tx.objectStore('meta'); const events = tx.objectStore('events');
      const [savedCatalog, savedSettings, savedEvents] = await Promise.all([request(meta.get('catalog')) as Promise<Catalog | undefined>, request(meta.get('settings')) as Promise<Settings | undefined>, request(events.getAll()) as Promise<ReviewEvent[]>]);
      const current = savedCatalog ?? structuredClone(EMPTY_CATALOG);
      // Backups are additive: restoring an older copy cannot undo newer content or events.
      const mergeLatest = <T extends {id: string; version: number}>(existing: T[], incoming: T[]): T[] => {
        const byId = new Map(existing.map(entry => [entry.id, entry]));
        for (const entry of incoming) {
          const old = byId.get(entry.id);
          if (old && 'knowledgeId' in old && 'knowledgeId' in entry && old.knowledgeId !== entry.knowledgeId) throw new Error(`カードIDを別の知識項目に付け替えることはできません: ${entry.id}`);
          if (!old || entry.version > old.version) byId.set(entry.id, entry);
          else if (entry.version === old.version && !sameValue(old, entry)) throw new Error(`バックアップの項目IDが競合しています: ${entry.id}`);
        }
        return [...byId.values()];
      };
      const catalog = validateCatalog({schemaVersion: 1, version: Math.max(current.version, backup.catalog.version), updatedAt: Date.parse(current.updatedAt) >= Date.parse(backup.catalog.updatedAt) ? current.updatedAt : backup.catalog.updatedAt, items: mergeLatest(current.items, backup.catalog.items), cards: mergeLatest(current.cards, backup.catalog.cards)});
      const byId = new Map(savedEvents.map(event => [event.id, event]));
      for (const event of backup.events) {
        const old = byId.get(event.id);
        if (old && !sameValue(old, event)) throw new Error(`バックアップの履歴IDが競合しています: ${event.id}`);
        if (!old) { await request(events.add(event)); byId.set(event.id, event); }
      }
      const comparisons=tx.objectStore('comparisonEvents');
      for(const event of backup.comparisonEvents??[]){
        const old=await request(comparisons.get(event.id)) as ComparisonEvent|undefined;
        if(old&&!sameValue(old,event))throw new Error(`バックアップの識別履歴IDが競合しています: ${event.id}`);
        if(!old)await request(comparisons.add(event));
      }
      if(backup.relations){const currentRelations=await request(meta.get('cultureRelations')) as CultureRelations|undefined;
        checkRelations(backup.relations,catalog,currentRelations);
        if(!currentRelations||backup.relations.version>currentRelations.version)await request(meta.put(backup.relations,'cultureRelations'));
        else if(backup.relations.version===currentRelations.version&&!sameValue(currentRelations,backup.relations))throw new Error('バックアップの関係データが競合しています。');
      }
      await request(meta.put(catalog, 'catalog'));
      // Preserve the current endpoint when this device was already configured.
      await request(meta.put(savedSettings ? {...backup.settings, ...savedSettings} : backup.settings, 'settings'));
    });
  }
  async loadRelations():Promise<CultureRelations|null>{
    return this.transaction('readonly',async tx=>{const value=await request(tx.objectStore('meta').get('cultureRelations'));return value?validateRelations(value):null;});
  }
  async applyRelations(input:CultureRelations):Promise<void>{
    const parsed=validateRelations(input);
    return this.transaction('readwrite',async tx=>{
      const meta=tx.objectStore('meta'),old=await request(meta.get('cultureRelations')) as CultureRelations|undefined;
      if(old&&parsed.version<old.version)throw Error('古い関係データです。保存済みの関係を利用します。');
      if(old&&parsed.version===old.version&&!sameValue(old,parsed))throw Error('同じバージョンの関係データが競合しています。');
      if(old&&Date.parse(parsed.updatedAt)<Date.parse(old.updatedAt))throw Error('関係データの更新日時が古くなっています。');
      const catalog=await request(meta.get('catalog')) as Catalog|undefined;
      if(!catalog)throw Error('文化史教材を先に取得してください。');
      checkRelations(parsed,catalog,old);
      await request(meta.put(parsed,'cultureRelations'));
    });
  }
  async recordComparisons(input:ComparisonEvent[]):Promise<void>{
    const events=input.map(validateComparisonEvent);
    return this.transaction('readwrite',async tx=>{
      if(!events.length)throw Error('識別演習の回答がありません。');
      const meta=tx.objectStore('meta'),store=tx.objectStore('comparisonEvents');
      const catalog=await request(meta.get('catalog')) as Catalog,relations=await request(meta.get('cultureRelations')) as CultureRelations|undefined;
      if(!catalog||!relations)throw Error('教材または関係データを読み込んでください。');
      const resolved=resolveRelations(relations,catalog),first=events[0],set=resolved.comparisonSets.find(s=>s.id===first.comparisonSetId);
      if(!set)throw Error('出題できる識別セットが見つかりません。');
      const prepared=prepareComparison(set,resolved.relations,catalog,first.sessionId);
      if(events.length!==prepared.pairs.length||new Set(events.map(e=>e.relationId)).size!==events.length)throw Error('全ての対応を採点してください。');
      const expected=gradeComparison(prepared,Object.fromEntries(events.map(e=>[e.relationId,e.selectedTargetId??''])),first.sessionId,first.reviewedAt);
      for(const e of expected){const provided=events.find(row=>row.relationId===e.relationId);if(!sameValue(e,provided))throw Error('識別演習の採点結果が不正です。');}
      for(const e of events){const old=await request(store.get(e.id)) as ComparisonEvent|undefined;if(old&&!sameValue(old,e))throw Error('識別履歴IDが競合しています。');if(!old)await request(store.add(e));}
    });
  }
  async getOrCreateDailyPlan(now:Date|number=Date.now()):Promise<DailyPlan>{
    return this.transaction('readwrite',async tx=>{
      const meta=tx.objectStore('meta'),key='dailyPlan:'+localDateKey(now);
      const [catalog,events,comparisons,old]=await Promise.all([request(meta.get('catalog')),request(tx.objectStore('events').getAll()),request(tx.objectStore('comparisonEvents').getAll()),request(meta.get(key))]);
      const plan=reconcileDailyPlan(old??null,catalog??EMPTY_CATALOG,events,comparisons,now);
      await request(meta.put(plan,key));return plan;
    });
  }
  async loadDailyPlan(dateKey=localDateKey()):Promise<DailyPlan|null>{return this.transaction('readonly',async tx=>(await request(tx.objectStore('meta').get('dailyPlan:'+dateKey)))??null);}
}

export function openDatabase(name = DATABASE_NAME): Promise<HistoryDB> {
  return new Promise((resolve, reject) => {
    if (!globalThis.indexedDB) { reject(new Error('このブラウザはIndexedDBを利用できません。Chromeの通常モードで開いてください。')); return; }
    const req = indexedDB.open(name, DATABASE_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Version 1 already used immutable events and meta records. Version 2 adds indexes.
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
      const events = db.objectStoreNames.contains('events') ? req.transaction!.objectStore('events') : db.createObjectStore('events', {keyPath: 'id'});
      if (!events.indexNames.contains('cardId')) events.createIndex('cardId', 'cardId', {unique: false});
      if (!events.indexNames.contains('reviewedAt')) events.createIndex('reviewedAt', 'reviewedAt', {unique: false});
      const comparisons=db.objectStoreNames.contains('comparisonEvents')?req.transaction!.objectStore('comparisonEvents'):db.createObjectStore('comparisonEvents',{keyPath:'id'});
      if(!comparisons.indexNames.contains('reviewedAt'))comparisons.createIndex('reviewedAt','reviewedAt',{unique:false});
      if(!comparisons.indexNames.contains('relationId'))comparisons.createIndex('relationId','relationId',{unique:false});
    };
    req.onerror = () => reject(req.error ?? new Error('端末内データベースを開けませんでした。'));
    req.onblocked = () => reject(new Error('別のタブが更新を妨げています。他のタブを閉じて再読み込みしてください。'));
    req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(new HistoryDB(req.result)); };
  });
}
