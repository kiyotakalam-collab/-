import type { Card, Catalog, KnowledgeItem, ReviewEvent } from '../src/types';
export const TIME = '2026-11-09T00:00:00.000Z';
export function makeItem(id = 'socrates', patch: Partial<KnowledgeItem> = {}): KnowledgeItem {
  return { id, canonicalName: id === 'socrates' ? 'ソクラテス' : id, aliases: [], kind: 'person', field: '哲学・思想', region: 'ギリシア', era: '古代', level: 1, relatedPeople: [], relatedWorks: [], description: '問答法。', images: [], sources: [{title: 'Reference', url: 'https://example.org/reference'}], difficultyEvidence: '暫定分類', verification: 'provisional', updatedAt: TIME, version: 1, deleted: false, ...patch };
}
export function makeCard(id = 'socrates-question', patch: Partial<Card> = {}): Card {
  return {id, knowledgeId: 'socrates', type: 'achievement-person', question: '問答法を用いた人物は？', answer: 'ソクラテス', explanation: '哲学者。', updatedAt: TIME, version: 1, deleted: false, ...patch};
}
export function makeCatalog(): Catalog { return {schemaVersion: 1, version: 1, updatedAt: TIME, items: [makeItem()], cards: [makeCard()]}; }
export function makeEvent(id: string, correct: boolean, day = 9, cardId = 'socrates-question'): ReviewEvent {
  return {id, cardId, correct, reviewedAt: `2026-11-${String(day).padStart(2, '0')}T00:00:00.000Z`, sessionId: 'session-test'};
}
