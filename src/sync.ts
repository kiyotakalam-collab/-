import { validateCatalog } from './core';
import type { AppState, Catalog, Settings } from './types';

export interface SyncDatabase {
  applyCatalog(catalog: Catalog): Promise<void>;
  updateSettings(settings: Partial<Settings>): Promise<void>;
  load(): Promise<AppState>;
}
export interface SyncResult { version: number; itemCount: number; cardCount: number }

const pending = new WeakMap<SyncDatabase, Map<string, Promise<SyncResult>>>();
const MAX_BYTES = 15 * 1024 * 1024;

/** Only public read endpoints belong here. OAuth tokens and write keys never do. */
export function normalizeSyncUrl(value: string, origin = globalThis.location?.origin ?? 'http://localhost'): string {
  if (!value.trim()) throw new Error('Google Sheetsの公開読み取りURLを設定してください。');
  let url: URL;
  try { url = new URL(value.trim(), origin); }
  catch { throw new Error('同期URLの形式を確認してください。'); }
  if (url.username || url.password || url.hash) throw new Error('認証情報やフラグメントを含むURLは使用できません。');
  const sameOrigin = url.origin === origin;
  const localOrigin = /^http:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(origin);
  if (url.protocol !== 'https:' && !(sameOrigin && localOrigin && url.protocol === 'http:')) {
    throw new Error('同期にはHTTPSの公開URLを使用してください。開発時のみ同一localhostを使用できます。');
  }
  return url.href;
}

/** Coalesces repeated online/start/manual triggers. Failed validation never writes. */
export function synchronize(db: SyncDatabase, value: string): Promise<SyncResult> {
  let url: string;
  try { url = normalizeSyncUrl(value); }
  catch (error) { return Promise.reject(error); }
  let byUrl = pending.get(db);
  if (!byUrl) { byUrl = new Map(); pending.set(db, byUrl); }
  const existing = byUrl.get(url);
  if (existing) return existing;
  // If settings change during an in-flight request, serialize the next source.
  // Catalog version checks inside the IndexedDB transaction guard other tabs.
  const previous = [...byUrl.values()].at(-1);
  const task = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(() => runSync(db, url)).finally(() => {
    byUrl?.delete(url);
    if (byUrl?.size === 0) pending.delete(db);
  });
  byUrl.set(url, task);
  return task;
}

async function runSync(db: SyncDatabase, url: string): Promise<SyncResult> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 12_000);
  let catalog: Catalog;
  try {
    const response = await fetch(url, {
      signal: abort.signal, cache: 'no-store', credentials: 'omit',
      referrerPolicy: 'no-referrer', headers: { Accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`読み取り先がHTTP ${response.status}を返しました。`);
    if (Number(response.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('同期データが15MBを超えています。');
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > MAX_BYTES) throw new Error('同期データが15MBを超えています。');
    let parsed: unknown;
    try { parsed = JSON.parse(body); }
    catch { throw new Error('同期先がJSONを返していません。公開設定とApps Scriptの実行URLを確認してください。'); }
    // A Sheets publication is a versioned delta, not necessarily all seed rows.
    // The final combined catalog is checked atomically in HistoryDB.applyCatalog().
    catalog = validateCatalog(parsed, true);
  } catch (error) {
    if (abort.signal.aborted) throw new Error('同期がタイムアウトしました。保存済みのデータで学習できます。');
    if (error instanceof TypeError) throw new Error('同期先に接続できません。通信・公開設定・CORSを確認してください。保存済みデータは保持しています。');
    throw error;
  } finally { clearTimeout(timer); }

  await db.applyCatalog(catalog);
  await db.updateSettings({ lastSyncAt: new Date().toISOString() });
  const state = await db.load();
  const activeIds = new Set(state.catalog.items.filter(item => !item.deleted).map(item => item.id));
  return {
    version: state.catalog.version,
    itemCount: activeIds.size,
    cardCount: state.catalog.cards.filter(card => !card.deleted && activeIds.has(card.knowledgeId)).length,
  };
}
