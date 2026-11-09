import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { getProgress } from '../src/core';
import { HistoryDB, openDatabase } from '../src/db';
import { DEFAULT_SETTINGS } from '../src/types';
import { makeCard, makeCatalog, makeEvent, makeItem } from './fixtures';

const opened: HistoryDB[] = [];
async function database(name = crypto.randomUUID()) { const db = await openDatabase(name); opened.push(db); return db; }
afterEach(() => { for (const db of opened.splice(0)) db.close(); });

describe('IndexedDB history persistence', () => {
  it('records false/true correctly, persists across reopening and never erases cumulative mistakes', async () => {
    const name = crypto.randomUUID(); const db = await database(name);
    await db.applyCatalog(makeCatalog());
    await db.recordReview('socrates-question', false, 'session');
    await db.recordReview('socrates-question', true, 'session');
    db.close(); const reopened = await database(name); const state = await reopened.load();
    expect(getProgress(state.events).get('socrates-question')).toMatchObject({wrong: 1, correct: 1, attempts: 2, streak: 1});
    expect(state.events[0].reviewedAt).not.toBe(state.events[1].reviewedAt);
  });
  it('serializes concurrent clients without lost answers', async () => {
    const name = crypto.randomUUID(); const a = await database(name); const b = await database(name); await a.applyCatalog(makeCatalog());
    await Promise.all(Array.from({length: 12}, (_, i) => (i % 2 ? a : b).recordReview('socrates-question', i % 2 === 0, `session-${i}`)));
    const state = await b.load(); expect(state.events).toHaveLength(12);
    expect(new Set(state.events.map(e => e.reviewedAt)).size).toBe(12);
    expect(getProgress(state.events).get('socrates-question')).toMatchObject({correct: 6, wrong: 6});
  });
  it('keeps history when adding, editing or tombstoning catalog entries', async () => {
    const db = await database(); await db.applyCatalog(makeCatalog()); await db.recordReview('socrates-question', false, 'session');
    const next = makeCatalog(); next.version = 2; next.items[0].version = 2; next.items[0].level = 4;
    next.items.push(makeItem('plato', {canonicalName: 'プラトン'})); next.cards.push(makeCard('plato-question', {knowledgeId: 'plato', answer: 'プラトン'}));
    await db.applyCatalog(next); expect((await db.load()).events).toHaveLength(1);
    next.version = 3; next.cards[0].version = 2; next.cards[0].deleted = true; await db.applyCatalog(next);
    const saved = await db.load(); expect(saved.events).toHaveLength(1); expect(saved.catalog.cards[0].deleted).toBe(true);
    await expect(db.recordReview('socrates-question', true, 'session')).rejects.toThrow(/削除/);
  });
  it('rejects duplicates and failed sync atomically, retaining the original usable data', async () => {
    const db = await database(); await db.applyCatalog(makeCatalog());
    const invalid = makeCatalog(); invalid.version = 2; invalid.items.push(makeItem('duplicate', {canonicalName: 'ソクラテス'}));
    await expect(db.applyCatalog(invalid)).rejects.toThrow(/重複/);
    expect((await db.load()).catalog).toEqual(makeCatalog());
    await db.recordReview('socrates-question', true, 'session'); expect((await db.load()).events).toHaveLength(1);
  });
  it('validates settings and merges concurrent settings updates', async () => {
    const db = await database();
    await Promise.all([db.updateSettings({dailyGoal: 30}), db.updateSettings({syncUrl: 'https://example.org/catalog.json'})]);
    expect((await db.load()).settings).toEqual({...DEFAULT_SETTINGS, dailyGoal: 30, syncUrl: 'https://example.org/catalog.json'});
    await expect(db.updateSettings({syncUrl: 'javascript:alert(1)'})).rejects.toThrow();
  });
});

describe('JSON backup and additive restore', () => {
  it('fully restores history/settings/catalog on a new device, idempotently', async () => {
    const source = await database(); await source.applyCatalog(makeCatalog());
    await source.recordReview('socrates-question', false, 'session'); await source.recordReview('socrates-question', true, 'session'); await source.updateSettings({dailyGoal: 40});
    const backup = JSON.parse(JSON.stringify(await source.exportBackup()));
    const target = await database(); await target.restoreBackup(backup); await target.restoreBackup(backup);
    expect(await target.load()).toEqual(await source.load());
  });
  it('restores older backups without losing recent answers or newer content', async () => {
    const db = await database(); await db.applyCatalog(makeCatalog()); await db.recordReview('socrates-question', false, 'session'); const old = await db.exportBackup();
    await db.recordReview('socrates-question', true, 'session');
    const next = makeCatalog(); next.version = 2; next.items[0].version = 2; next.items[0].level = 4; await db.applyCatalog(next);
    await db.restoreBackup(old); const state = await db.load();
    expect(state.events).toHaveLength(2); expect(state.catalog.items[0].level).toBe(4);
  });
  it('rejects conflicting event IDs and rolls the whole restore back', async () => {
    const db = await database(); await db.applyCatalog(makeCatalog()); const existing = await db.recordReview('socrates-question', false, 'session'); const before = await db.load();
    const backup = await db.exportBackup(); backup.events = [makeEvent('new-event', true), {...existing, correct: true}];
    await expect(db.restoreBackup(backup)).rejects.toThrow(/競合/);
    expect(await db.load()).toEqual(before);
  });
  it('rejects newer backups that reassign an existing card ID to another term, preserving all current history', async () => {
    const db = await database(); await db.applyCatalog(makeCatalog());
    await db.recordReview('socrates-question', false, 'session');
    const before = await db.load(), backup = await db.exportBackup();
    backup.catalog.version = 2;
    backup.catalog.items.push(makeItem('plato', {canonicalName: 'プラトン'}));
    backup.catalog.cards[0] = makeCard('socrates-question', {knowledgeId: 'plato', version: 2});
    backup.events.push(makeEvent('new-backup-event', true));
    await expect(db.restoreBackup(backup)).rejects.toThrow(/付け替え/);
    expect(await db.load()).toEqual(before);
    expect(getProgress((await db.load()).events).get('socrates-question')).toMatchObject({wrong: 1, correct: 0});
  });
  it('rejects corrupt backups before changing stored data', async () => {
    const db = await database(); await db.applyCatalog(makeCatalog()); const before = await db.load();
    await expect(db.restoreBackup({schemaVersion: 999})).rejects.toThrow(/未対応/); expect(await db.load()).toEqual(before);
  });
});

describe('database upgrade', () => {
  it('migrates a real version-1 event store to v2 indexes without deleting history', async () => {
    const name = crypto.randomUUID(); const event = makeEvent('legacy-event', false);
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open(name, 1);
      req.onupgradeneeded = () => { req.result.createObjectStore('meta'); req.result.createObjectStore('events', {keyPath: 'id'}); };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const tx = req.result.transaction(['meta', 'events'], 'readwrite'); tx.objectStore('meta').put(makeCatalog(), 'catalog'); tx.objectStore('meta').put(DEFAULT_SETTINGS, 'settings'); tx.objectStore('events').add(event);
        tx.oncomplete = () => { req.result.close(); resolve(); }; tx.onerror = () => reject(tx.error);
      };
    });
    const db = await database(name); expect((await db.load()).events).toEqual([event]);
    await db.recordReview('socrates-question', true, 'session');
    expect(getProgress((await db.load()).events).get('socrates-question')).toMatchObject({correct: 1, wrong: 1});
  });
});
