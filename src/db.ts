import { EMPTY_CATALOG, mergeCatalog, sameValue, validateBackup, validateCatalog, validateEvent, validateSettings } from './core';
import { DEFAULT_SETTINGS, type AppState, type Backup, type Catalog, type ReviewEvent, type Settings } from './types';

export const DATABASE_VERSION = 2;
const DATABASE_NAME = 'cultural-history-master';
function request<T>(req: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error ?? new Error('端末内データを読み取れませんでした。')); }); }
function completion(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error ?? new Error('端末内データを保存できませんでした。')); tx.onabort = () => reject(tx.error ?? new Error('端末内データの変更を中止しました。')); }); }

export class HistoryDB {
  constructor(private readonly db: IDBDatabase) {}
  close(): void { this.db.close(); }
  private async transaction<T>(mode: IDBTransactionMode, work: (tx: IDBTransaction) => Promise<T>): Promise<T> {
    const tx = this.db.transaction(['meta', 'events'], mode);
    const done = completion(tx);
    try { const result = await work(tx); await done; return result; }
    catch (error) { try { tx.abort(); } catch { /* Already aborted/completed. */ } await done.catch(() => {}); throw error; }
  }
  async load(): Promise<AppState> {
    return this.transaction('readonly', async tx => {
      const meta = tx.objectStore('meta');
      const [catalog, settings, events] = await Promise.all([request(meta.get('catalog')), request(meta.get('settings')), request(tx.objectStore('events').getAll())]);
      return {catalog: catalog ? validateCatalog(catalog) : structuredClone(EMPTY_CATALOG), settings: settings ? validateSettings(settings) : {...DEFAULT_SETTINGS}, events: events.map(validateEvent)};
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
    return {format: 'cultural-history-master', schemaVersion: 1, exportedAt: new Date().toISOString(), ...state};
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
      await request(meta.put(catalog, 'catalog'));
      // Preserve the current endpoint when this device was already configured.
      await request(meta.put(savedSettings ? {...backup.settings, ...savedSettings} : backup.settings, 'settings'));
    });
  }
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
    };
    req.onerror = () => reject(req.error ?? new Error('端末内データベースを開けませんでした。'));
    req.onblocked = () => reject(new Error('別のタブが更新を妨げています。他のタブを閉じて再読み込みしてください。'));
    req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(new HistoryDB(req.result)); };
  });
}
