import { describe, expect, it } from 'vitest';
import { EMPTY_CATALOG, getProgress, mergeCatalog, normalizeName, priority, selectCards, spreadSessionCards, validateBackup, validateCatalog } from '../src/core';
import { DEFAULT_FILTER, DEFAULT_SETTINGS } from '../src/types';
import { makeCard, makeCatalog, makeEvent, makeItem, TIME } from './fixtures';

describe('catalog identity and validation', () => {
  it('accepts complete seed-like content and strips unknown properties', () => {
    expect(validateCatalog({...makeCatalog(), unexpected: 'ignored'})).toEqual(makeCatalog());
    expect(mergeCatalog(EMPTY_CATALOG, makeCatalog())).toEqual(makeCatalog());
  });
  it('detects canonical names, aliases, Unicode widths and punctuation duplicates', () => {
    const catalog = makeCatalog();
    catalog.items[0].aliases = ['ＳＯＣＲＡＴＥＳ'];
    catalog.items.push(makeItem('other', {canonicalName: 'Socrates'}));
    expect(() => validateCatalog(catalog)).toThrow(/重複/);
    expect(normalizeName(' 「マルクス・アウレリウス」 ')).toBe(normalizeName('マルクス アウレリウス'));
  });
  it('rejects orphan references, image cards without fallback, and duplicate cards', () => {
    const catalog = makeCatalog();
    expect(() => validateCatalog({...catalog, cards: [makeCard('bad', {knowledgeId: 'missing'})]})).toThrow(/参照先/);
    expect(() => validateCatalog({...catalog, cards: [makeCard('bad', {type: 'image'})]})).toThrow(/代替/);
    expect(() => validateCatalog({...catalog, cards: [...catalog.cards, makeCard('duplicate')]})).toThrow(/重複/);
    expect(() => validateCatalog({...catalog, items: [makeItem('socrates', {relatedWorks: ['not-registered']})]})).toThrow(/関連項目/);
  });
  it('rejects unsupported schemas, malformed fields and unsafe URLs', () => {
    for (const patch of [{schemaVersion: 2}, {version: -1}, {updatedAt: 'yesterday'}]) expect(() => validateCatalog({...makeCatalog(), ...patch})).toThrow();
    for (const patch of [{level: 5}, {version: 0}, {deleted: 'false'}, {sources: []}, {sources: [{title: 'bad', url: 'javascript:alert(1)'}]}]) expect(() => validateCatalog({...makeCatalog(), items: [{...makeItem(), ...patch}]})).toThrow();
  });
  it('preserves fixed IDs while updating content and requires version increments', () => {
    const current = makeCatalog();
    const next = makeCatalog(); next.version = 2; next.items[0].version = 2; next.items[0].level = 4; next.cards[0].version = 2; next.cards[0].explanation = '追記';
    const merged = mergeCatalog(current, next);
    expect(merged.cards[0].id).toBe(current.cards[0].id); expect(merged.items[0].level).toBe(4);
    expect(() => mergeCatalog(current, {...current, items: [makeItem('socrates', {level: 3})]})).toThrow(/同じバージョン/);
    expect(() => mergeCatalog(next, current)).toThrow(/古い/);
  });
  it('rejects reassignment of a card ID to a different term so old results cannot change meaning', () => {
    const current = makeCatalog(); const next = makeCatalog(); next.version = 2;
    next.items.push(makeItem('plato'));
    next.cards[0] = makeCard('socrates-question', {knowledgeId: 'plato', version: 2});
    expect(() => mergeCatalog(current, next)).toThrow(/付け替え/);
  });
  it('requires a new global version for changed rows or additions, allowing exact and partial no-op retries', () => {
    const current = makeCatalog();
    expect(mergeCatalog(current, current)).toEqual(current);
    expect(mergeCatalog(current, {...current, items: [], cards: []})).toEqual(current);
    const changed = makeCatalog(); changed.items[0].version = 2; changed.items[0].level = 4;
    expect(() => mergeCatalog(current, changed)).toThrow(/全体のバージョン/);
    const added = makeCatalog(); added.items.push(makeItem('plato'));
    expect(() => mergeCatalog(current, added)).toThrow(/全体のバージョン/);
  });
  it('uses tombstones and retains missing records rather than erasing history references', () => {
    const current = makeCatalog();
    const missing = mergeCatalog(current, {...current, version: 2, items: [], cards: []});
    expect(missing.cards).toHaveLength(1);
    const removed = mergeCatalog(missing, {...current, version: 3, items: [makeItem('socrates', {version: 2, deleted: true})], cards: []});
    expect(removed.cards).toHaveLength(1);
    expect(selectCards(removed, [], DEFAULT_FILTER)).toHaveLength(0);
  });
  it('validates mixed image and text cards with attribution metadata', () => {
    const catalog = makeCatalog();
    catalog.items[0].images.push({id: 'painting', url: './images/painting.jpg', sourceUrl: 'https://example.org/art', author: 'Author', license: 'CC0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', caption: 'Image'});
    catalog.cards.push(makeCard('image-card', {type: 'image', imageId: 'painting', fallbackPrompt: '画像が表示されないときの文章問題。', question: 'この作品の作者は？'}));
    const validated = validateCatalog(catalog);
    expect(selectCards(validated, [], {...DEFAULT_FILTER, cardType: 'image'}).map(c => c.id)).toEqual(['image-card']);
    expect(selectCards(validated, [], {...DEFAULT_FILTER, cardType: 'text'}).map(c => c.id)).toEqual(['socrates-question']);
  });
  it('validates and filters a catalog with 10,000 knowledge items without quadratic duplicate lookup', () => {
    const catalog = makeCatalog();
    catalog.items = Array.from({length: 10_000}, (_, index) => makeItem(`item-${index}`, {canonicalName: `用語${index}`, level: index % 2 ? 4 : 1}));
    catalog.cards = catalog.items.map((item, index) => makeCard(`card-${index}`, {knowledgeId: item.id, question: `問題${index}`, answer: item.canonicalName}));
    const result = validateCatalog(catalog);
    expect(selectCards(result, [], {...DEFAULT_FILTER, level: 4, levelMode: 'single'})).toHaveLength(5000);
  });
});

describe('immutable answer history and spaced review', () => {
  it('increments attempts and keeps lifetime errors through subsequent successes', () => {
    const progress = getProgress([makeEvent('e1', false, 1), makeEvent('e2', true, 2), makeEvent('e3', true, 3)]).get('socrates-question')!;
    expect(progress).toMatchObject({correct: 2, wrong: 1, attempts: 3, streak: 2, lastStudiedAt: '2026-11-03T00:00:00.000Z', nextReviewAt: '2026-11-06T00:00:00.000Z', recent: [false, true, true]});
  });
  it('sorts out-of-order events and resets streak without resetting historical counts', () => {
    const p = getProgress([makeEvent('e3', false, 3), makeEvent('e1', true, 1), makeEvent('e2', true, 2)]).get('socrates-question')!;
    expect(p).toMatchObject({correct: 2, wrong: 1, streak: 0, nextReviewAt: '2026-11-03T00:10:00.000Z'});
  });
  it('prioritizes a recent failure over a recovered card with many lifetime mistakes', () => {
    const recovered = getProgress([...Array.from({length: 20}, (_, i) => ({...makeEvent(`old-${i}`, false, 1), reviewedAt: new Date(Date.parse('2026-11-01T00:00:00Z') + i * 1000).toISOString()})), ...Array.from({length: 5}, (_, i) => makeEvent(`good-${i}`, true, i + 5))]).get('socrates-question')!;
    const failed = getProgress([makeEvent('recent', false, 9)]).get('socrates-question')!;
    expect(priority(failed, new Date(TIME))).toBeGreaterThan(priority(recovered, new Date(TIME)));
    expect(priority(failed, new Date('2026-11-20T00:00:00Z'))).toBeGreaterThan(priority(failed, new Date(TIME)));
  });
});

describe('combined filters and modes', () => {
  const catalog = makeCatalog();
  catalog.items.push(makeItem('euclid', {level: 4, region: 'ヘレニズム', field: '科学', era: 'ヘレニズム時代'}));
  catalog.cards.push(makeCard('euclid-q', {knowledgeId: 'euclid', question: '幾何学の著作をまとめた人物は？', answer: 'エウクレイデス'}));
  it('distinguishes cumulative Lv.4 from single Lv.4', () => {
    expect(selectCards(catalog, [], {...DEFAULT_FILTER, level: 4, levelMode: 'cumulative'})).toHaveLength(2);
    expect(selectCards(catalog, [], {...DEFAULT_FILTER, level: 4, levelMode: 'single'}).map(c => c.id)).toEqual(['euclid-q']);
  });
  it('ANDs region, era, field and difficulty', () => {
    const filter = {...DEFAULT_FILTER, regions: ['ヘレニズム'], fields: ['科学'], eras: ['ヘレニズム時代'], level: 4 as const};
    expect(selectCards(catalog, [], filter)).toHaveLength(1);
    expect(selectCards(catalog, [], {...filter, fields: ['文学']})).toHaveLength(0);
  });
  it('handles unseen, lifetime mistake, due, weak, random and all modes', () => {
    const events = [makeEvent('failed', false, 1), makeEvent('recovered', true, 2)];
    expect(selectCards(catalog, events, {...DEFAULT_FILTER, mode: 'unseen'}).map(c => c.id)).toEqual(['euclid-q']);
    expect(selectCards(catalog, events, {...DEFAULT_FILTER, mode: 'mistakes'}).map(c => c.id)).toEqual(['socrates-question']);
    expect(selectCards(catalog, events, {...DEFAULT_FILTER, mode: 'due'}, new Date(TIME)).map(c => c.id)).toEqual(['socrates-question']);
    expect(selectCards(catalog, events, {...DEFAULT_FILTER, mode: 'due'}, new Date('2026-11-02T00:00:00Z'))).toEqual([]);
    for (const mode of ['weak', 'random', 'all'] as const) expect(selectCards(catalog, events, {...DEFAULT_FILTER, mode})).toHaveLength(2);
  });
});

describe('backup validation', () => {
  const backup = () => ({format: 'cultural-history-master', schemaVersion: 1, exportedAt: TIME, catalog: makeCatalog(), events: [makeEvent('event', false)], settings: DEFAULT_SETTINGS});
  it('rejects corrupted, duplicate or orphaned events before any database writes', () => {
    expect(validateBackup(backup()).events).toHaveLength(1);
    expect(() => validateBackup({...backup(), events: [makeEvent('event', false), makeEvent('event', false)]})).toThrow(/重複/);
    expect(() => validateBackup({...backup(), events: [makeEvent('event', false, 9, 'not-found')]})).toThrow(/参照先/);
    expect(() => validateBackup({...backup(), events: [{...makeEvent('event', false), correct: 'false'}]})).toThrow(/正誤/);
  });
});


describe('author/work direction and answer variety', () => {
  const catalog = makeCatalog();
  catalog.items.push(makeItem('homer', {canonicalName: 'ホメロス'}));
  catalog.items.push(makeItem('virgil', {canonicalName: 'ウェルギリウス'}));
  catalog.cards = [
    makeCard('aeneid-author', {knowledgeId:'virgil', type:'work-author', question:'『アエネイス』の作者は？', answer:'ウェルギリウス'}),
    makeCard('georgics-author', {knowledgeId:'virgil', type:'work-author', question:'『農耕詩』の作者は？', answer:'ウェルギリウス'}),
    makeCard('iliad-author', {knowledgeId:'homer', type:'work-author', question:'『イリアス』の作者は？', answer:'ホメロス'}),
    makeCard('odyssey-author', {knowledgeId:'homer', type:'work-author', question:'『オデュッセイア』の作者は？', answer:'ホメロス'}),
    makeCard('virgil-work', {knowledgeId:'virgil', type:'person-work', question:'ウェルギリウスの叙事詩は？', answer:'アエネイス'}),
    makeCard('homer-work', {knowledgeId:'homer', type:'person-work', question:'ホメロスの叙事詩は？', answer:'オデュッセイア'}),
    makeCard('method-person', {type:'achievement-person', answer:'ソクラテス'}),
  ];
  it('filters the two directions without changing the all-mode dataset', () => {
    expect(selectCards(catalog, [], {...DEFAULT_FILTER, cardDirection:'work-author'}).map(c=>c.id)).toEqual([
      'aeneid-author','georgics-author','iliad-author','odyssey-author',
    ]);
    expect(selectCards(catalog, [], {...DEFAULT_FILTER, cardDirection:'person-work'}).map(c=>c.id)).toEqual([
      'virgil-work','homer-work',
    ]);
    expect(selectCards(catalog, [], DEFAULT_FILTER)).toHaveLength(7);
    expect(selectCards(catalog, [], {...DEFAULT_FILTER, cardDirection:'work-author', cardType:'image'})).toEqual([]);
  });
  it('spreads repeated authors, preserves every ID and does not mutate the catalog', () => {
    const original = [...catalog.cards];
    const arranged = spreadSessionCards(original, 3);
    expect(arranged.map(c=>c.id)).toEqual(['aeneid-author','iliad-author','virgil-work']);
    expect(new Set(arranged.map(c=>c.answer)).size).toBe(3);
    expect(original.map(c=>c.id)).toEqual(catalog.cards.map(c=>c.id));
    expect(spreadSessionCards(original, 0)).toEqual([]);
    expect(spreadSessionCards(original, 99)).toHaveLength(original.length);
    expect(new Set(spreadSessionCards(original, 99).map(c=>c.id)).size).toBe(original.length);
  });
  it('does not place both sides of one knowledge item consecutively when alternatives exist', () => {
    const cards = [
      makeCard('work-front', {knowledgeId:'virgil', answer:'アエネイス'}),
      makeCard('author-back', {knowledgeId:'virgil', answer:'ウェルギリウス'}),
      makeCard('other', {knowledgeId:'homer', answer:'ホメロス'}),
    ];
    expect(spreadSessionCards(cards).map(c=>c.id)).toEqual(['work-front','other','author-back']);
  });
});

