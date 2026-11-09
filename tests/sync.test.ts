import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase, type HistoryDB } from '../src/db';
import { normalizeSyncUrl, synchronize } from '../src/sync';
import type { Catalog } from '../src/types';

function sample(version = 1): Catalog {
  const updatedAt = '2026-11-09T00:00:00.000Z';
  return {
    schemaVersion: 1, version, updatedAt,
    items: [{ id: 'test-person', canonicalName: 'テスト人物', aliases: [], kind: 'person', field: '哲学', region: 'ギリシア', era: '古代', level: 1, relatedPeople: [], relatedWorks: [], description: '検証用', images: [], sources: [{title: 'テスト出典', url: 'https://example.org/reference'}], difficultyEvidence: '暫定分類', verification: 'provisional', updatedAt, version: 1, deleted: false }],
    cards: [{ id: 'test-card', knowledgeId: 'test-person', type: 'context', question: '検証問題', answer: '検証解答', explanation: '', updatedAt, version: 1, deleted: false }],
  };
}
const databases: HistoryDB[] = [];
async function makeDb(): Promise<HistoryDB> {
  const db = await openDatabase(`sync-test-${crypto.randomUUID()}`);
  databases.push(db);
  await db.applyCatalog(sample());
  await db.recordReview('test-card', false, 'test-session');
  return db;
}
function respond(catalog: Catalog) { return new Response(JSON.stringify(catalog), {headers: {'Content-Type': 'application/json'}}); }

afterEach(() => { databases.forEach(db => db.close()); databases.length = 0; vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('public sync endpoint safety', () => {
  it('accepts HTTPS Apps Script and same localhost only', () => {
    expect(normalizeSyncUrl('https://script.google.com/macros/s/example/exec')).toContain('https://');
    expect(normalizeSyncUrl('/catalog.json', 'http://localhost:4173')).toBe('http://localhost:4173/catalog.json');
    expect(() => normalizeSyncUrl('http://example.org/a')).toThrow('HTTPS');
    expect(() => normalizeSyncUrl('https://user:key@example.org/')).toThrow('認証情報');
    expect(() => normalizeSyncUrl('javascript:alert(1)')).toThrow('HTTPS');
    expect(() => normalizeSyncUrl('')).toThrow('設定');
  });
});

describe('catalog synchronization', () => {
  it('keeps all events on catalog additions, changes and explicit soft deletion', async () => {
    const db = await makeDb();
    const next = sample(2);
    next.items[0].description = '説明を更新'; next.items[0].level = 4; next.items[0].version = 2;
    next.items.push({...structuredClone(next.items[0]), id: 'new-person', canonicalName: '追加人物', aliases: []});
    next.cards.push({...structuredClone(next.cards[0]), id: 'new-card', knowledgeId: 'new-person'});
    const fetchMock = vi.fn().mockResolvedValueOnce(respond(next)); vi.stubGlobal('fetch', fetchMock);
    expect(await synchronize(db, 'https://example.org/catalog')).toEqual({version: 2, itemCount: 2, cardCount: 2});
    let state = await db.load();
    expect(state.events).toHaveLength(1); expect(state.events[0].correct).toBe(false);
    expect(state.catalog.items[0].level).toBe(4); expect(state.settings.lastSyncAt).toBeTruthy();
    expect(fetchMock.mock.calls[0][1]).toMatchObject({cache: 'no-store', credentials: 'omit'});
    const deleted = structuredClone(next); deleted.version = 3; deleted.items[0].deleted = true; deleted.items[0].version = 3;
    fetchMock.mockResolvedValueOnce(respond(deleted));
    expect(await synchronize(db, 'https://example.org/catalog')).toEqual({version: 3, itemCount: 1, cardCount: 1});
    state = await db.load(); expect(state.events).toHaveLength(1);
  });

  it('keeps data on HTTP/network/invalid JSON/invalid catalog failures and recovers online', async () => {
    const db = await makeDb();
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValueOnce(new Response('unavailable', {status: 503}))
      .mockResolvedValueOnce(new Response('<html>signin</html>'))
      .mockResolvedValueOnce(new Response(JSON.stringify({schemaVersion: 999})))
      .mockResolvedValueOnce(respond(sample(2)));
    vi.stubGlobal('fetch', fetchMock);
    const before = await db.load();
    for (let i = 0; i < 4; i++) {
      await expect(synchronize(db, 'https://example.org/catalog')).rejects.toThrow();
      expect(await db.load()).toEqual(before);
    }
    await expect(synchronize(db, 'https://example.org/catalog')).resolves.toMatchObject({version: 2});
    expect((await db.load()).events).toEqual(before.events);
    await db.recordReview('test-card', true, 'after-reconnect');
    expect((await db.load()).events).toHaveLength(2);
  });

  it('rejects stale snapshots and duplicate aliases without changes', async () => {
    const db = await makeDb();
    await db.applyCatalog(sample(5));
    const before = await db.load(); const duplicate = sample(6);
    duplicate.items.push({...structuredClone(duplicate.items[0]), id: 'duplicate', canonicalName: '別表記', aliases: ['テスト人物']});
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(respond(sample(2))).mockResolvedValueOnce(respond(duplicate)));
    await expect(synchronize(db, 'https://example.org/catalog')).rejects.toThrow();
    await expect(synchronize(db, 'https://example.org/catalog')).rejects.toThrow('重複');
    expect(await db.load()).toEqual(before);
  });

  it('coalesces repeated triggers and accepts the same unchanged version idempotently', async () => {
    const db = await makeDb(); const fetchMock = vi.fn().mockImplementation(async () => respond(sample(1)));
    vi.stubGlobal('fetch', fetchMock);
    const first = synchronize(db, 'https://example.org/catalog');
    const second = synchronize(db, 'https://example.org/catalog');
    expect(first).toBe(second); await Promise.all([first, second]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await synchronize(db, 'https://example.org/catalog');
    expect((await db.load()).events).toHaveLength(1);
  });

  it('times out without changing the saved catalog', async () => {
    const db = await makeDb(); const before = await db.load();
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, init) => new Promise((_resolve, reject) => {
      (init as RequestInit).signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const task = synchronize(db, 'https://example.org/catalog');
    const assertion = expect(task).rejects.toThrow('タイムアウト');
    await vi.advanceTimersByTimeAsync(12_001); await assertion;
    vi.useRealTimers();
    expect(await db.load()).toEqual(before);
  });
});
