import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { getProgress, validateCatalog } from '../src/core';
import { openDatabase, type HistoryDB } from '../src/db';
import { seedCatalog } from '../src/seed';
import type { Catalog } from '../src/types';

const opened: HistoryDB[] = [];
afterEach(() => { for (const db of opened.splice(0)) db.close(); });

describe('reviewed introductory questions', () => {
  it('includes every registered photo section without reassigning existing cards or duplicating terms', () => {
    const catalog = validateCatalog(seedCatalog);
    expect(catalog.version).toBe(8);
    expect(catalog.items).toHaveLength(334);
    expect(catalog.cards).toHaveLength(413);
    expect(catalog.cards.find(card => card.id === 'gr-homer-iliad-author')).toMatchObject({knowledgeId: 'gr-homer', version: 2});
    expect(catalog.cards.find(card => card.id === 'gr-homer-odyssey-author')).toMatchObject({knowledgeId: 'gr-homer', version: 1});
    expect(catalog.items.find(item => item.id === 'gr-sophocles')?.sources[0]).toMatchObject({title: expect.stringContaining('スタンダード世界史探究')});
    expect(catalog.items.find(item => item.id === 'gr-sophocles')?.sources[0].url).toBeUndefined();
  });

  it('preserves v2 mistakes when photo cards are installed', async () => {
    const db = await openDatabase(`photo-upgrade-${crypto.randomUUID()}`); opened.push(db);
    const v2 = structuredClone(seedCatalog);
    v2.version = 2;
    v2.updatedAt = '2026-11-09T08:02:29.000Z';
    v2.items = v2.items.filter(item => !item.sources.some(source => !source.url));
    v2.cards = v2.cards.filter(card => v2.items.some(item => item.id === card.knowledgeId));
    await db.applyCatalog(v2);
    const wrong = await db.recordReview('gr-homer-iliad-author', false, 'before-photo');
    await db.applyCatalog(seedCatalog);
    const state = await db.load();
    expect(state.events).toEqual([wrong]);
    expect(getProgress(state.events).get(wrong.cardId)?.wrong).toBe(1);
    expect(state.catalog.cards.some(card => card.id === 'gr-sophocles-oedipus-author')).toBe(true);
  });

  it('keeps author and work prompts as distinct directions for the same fact', () => {
    const catalog = validateCatalog(seedCatalog);
    const fromWork = catalog.cards.find(card => card.id === 'gr-plato-republic-author')!;
    const fromPerson = catalog.cards.find(card => card.id === 'gr-plato-republic-work')!;
    expect(fromWork).toMatchObject({knowledgeId: 'gr-plato', type: 'work-author', answer: 'プラトン'});
    expect(fromPerson).toMatchObject({knowledgeId: 'gr-plato', type: 'person-work', answer: '国家'});
    expect(fromWork.question).toContain('国家');
    expect(fromPerson.question).toContain('プラトン');
    expect(fromWork.id).not.toBe(fromPerson.id);
  });

  it('replaces the real first-edition prompt without losing its accumulated mistake', async () => {
    // The first public release's unchanged Homer item and original question.
    const firstEdition: Catalog = {
      schemaVersion: 1, version: 1, updatedAt: '2026-11-09T00:00:00.000Z',
      items: [structuredClone(seedCatalog.items.find(item => item.id === 'gr-homer')!)],
      cards: [{
        id: 'gr-homer-iliad-author', knowledgeId: 'gr-homer', type: 'work-author',
        question: '叙事詩『イリアス』の作者と伝統的にされる古代ギリシアの詩人は？',
        answer: 'ホメロス', explanation: '作品は口承の伝統から成立した。ホメロス個人の生涯や作者問題には議論がある。',
        version: 1, updatedAt: '2026-11-09T00:00:00.000Z', deleted: false,
      }],
    };
    const db = await openDatabase(`seed-upgrade-${crypto.randomUUID()}`); opened.push(db);
    await db.applyCatalog(firstEdition);
    const wrong = await db.recordReview('gr-homer-iliad-author', false, 'first-edition');
    await db.applyCatalog(seedCatalog);
    const updated = await db.load();
    expect(updated.events).toEqual([wrong]);
    const card = updated.catalog.cards.find(card => card.id === wrong.cardId)!;
    expect(card).toMatchObject({knowledgeId: 'gr-homer', answer: 'ホメロス', version: 2});
    expect(card.question).not.toBe(firstEdition.cards[0].question);
    expect(updated.catalog.cards.some(card => card.id === 'gr-plato-republic-author')).toBe(true);
    await db.recordReview(card.id, true, 'second-edition');
    expect(getProgress((await db.load()).events).get(card.id)).toMatchObject({wrong: 1, correct: 1, attempts: 2});
  });
});
