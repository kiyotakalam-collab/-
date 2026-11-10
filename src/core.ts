import {advanceRetention} from './retention';
import {validateErrorCauses} from './error-causes';
import { DEFAULT_SETTINGS, type Backup, type Card, type CardProgress, type Catalog, type ImageAsset, type KnowledgeItem, type ReviewEvent, type Settings, type StudyFilter } from './types';
import { matchesCultureScope } from './culture-scope';
import {validateComparisonEvent} from './culture-compare';
import {validateRelations} from './culture-relations';

const DAY = 86_400_000;
const CARD_TYPES = ['achievement-person', 'person-work', 'work-author', 'theory-person', 'image', 'context'];
export const EMPTY_CATALOG: Catalog = { schemaVersion: 1, version: 0, updatedAt: '1970-01-01T00:00:00.000Z', items: [], cards: [] };

function fail(message: string): never { throw new Error(message); }
function object(value: unknown, name: string): Record<string, unknown> {
  if (typeof value !== 'object' || !value || Array.isArray(value)) fail(`${name}の形式が不正です。`);
  return value as Record<string, unknown>;
}
function string(value: unknown, name: string, allowEmpty = false, max = 100_000): string {
  if (typeof value !== 'string' || (!allowEmpty && !value.trim()) || value.length > max) fail(`${name}が不正です。`);
  return value as string;
}
function id(value: unknown, name: string): string {
  const result = string(value, name, false, 200);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(result)) fail(`${name}は英数字・ハイフン等の固定IDにしてください。`);
  return result;
}
function integer(value: unknown, name: string, min = 1): number {
  if (!Number.isSafeInteger(value) || (value as number) < min) fail(`${name}が不正です。`);
  return value as number;
}
function bool(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') fail(`${name}が不正です。`);
  return value;
}
function date(value: unknown, name: string): string {
  const result = string(value, name, false, 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(result) || !Number.isFinite(Date.parse(result))) fail(`${name}はUTCのISO日時にしてください。`);
  const normalized = result.includes('.') ? result.replace(/\.(\d{1,3})Z$/, (_, fraction: string) => `.${fraction.padEnd(3, '0')}Z`) : result.replace('Z', '.000Z');
  if (new Date(result).toISOString() !== normalized) fail(`${name}に存在しない日時が含まれています。`);
  return result;
}
function array<T>(value: unknown, name: string, parser: (entry: unknown, label: string) => T, max = 20_000): T[] {
  if (!Array.isArray(value) || value.length > max) fail(`${name}の配列が不正または大きすぎます。`);
  return value.map((entry, index) => parser(entry, `${name}[${index}]`));
}
function strings(value: unknown, name: string): string[] { return array(value, name, (v, n) => string(v, n), 1000); }
function url(value: unknown, name: string, local = false): string {
  const result = string(value, name, false, 4000);
  if (local && /^(?:\.\/)?[A-Za-z0-9_-][A-Za-z0-9_./-]*\.(png|jpg|jpeg|webp|svg|avif)$/i.test(result) && !result.includes('..')) return result;
  let parsed: URL;
  try { parsed = new URL(result); } catch { return fail(`${name}のURLが不正です。`); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) fail(`${name}には認証情報のないHTTP(S) URLを指定してください。`);
  return result;
}
function image(value: unknown, name: string): ImageAsset {
  const v = object(value, name);
  return { id: id(v.id, `${name}.id`), url: url(v.url, `${name}.url`, true), sourceUrl: url(v.sourceUrl, `${name}.sourceUrl`), author: string(v.author, `${name}.author`), license: string(v.license, `${name}.license`), licenseUrl: url(v.licenseUrl, `${name}.licenseUrl`), caption: string(v.caption, `${name}.caption`) };
}
function item(value: unknown, name: string): KnowledgeItem {
  const v = object(value, name);
  if (!['person', 'work', 'concept', 'building'].includes(v.kind as string)) fail(`${name}.kindが不正です。`);
  if (![1, 2, 3, 4].includes(v.level as number)) fail(`${name}.levelが不正です。`);
  if (!['verified', 'provisional', 'needs-review'].includes(v.verification as string)) fail(`${name}.verificationが不正です。`);
  const result: KnowledgeItem = {
    id: id(v.id, `${name}.id`), canonicalName: string(v.canonicalName, `${name}.canonicalName`), aliases: strings(v.aliases, `${name}.aliases`), kind: v.kind as KnowledgeItem['kind'],
    field: string(v.field, `${name}.field`), region: string(v.region, `${name}.region`), era: string(v.era, `${name}.era`), level: v.level as KnowledgeItem['level'],
    relatedPeople: array(v.relatedPeople, `${name}.relatedPeople`, id, 1000), relatedWorks: array(v.relatedWorks, `${name}.relatedWorks`, id, 1000), description: string(v.description, `${name}.description`, true),
    images: array(v.images, `${name}.images`, image, 100),
    sources: array(v.sources, `${name}.sources`, (entry, label) => { const s = object(entry, label); return { title: string(s.title, `${label}.title`), ...(s.url === undefined ? {} : {url: url(s.url, `${label}.url`)}), ...(s.note === undefined ? {} : {note: string(s.note, `${label}.note`, true)}) }; }, 100),
    difficultyEvidence: string(v.difficultyEvidence, `${name}.difficultyEvidence`), verification: v.verification as KnowledgeItem['verification'], updatedAt: date(v.updatedAt, `${name}.updatedAt`), version: integer(v.version, `${name}.version`), deleted: bool(v.deleted, `${name}.deleted`),
  };
  if (!result.sources.length) fail(`${name}には知識の出典が必要です。`);
  unique(result.images, x => x.id, `${name}の画像ID`);
  return result;
}
function card(value: unknown, name: string): Card {
  const v = object(value, name);
  if (!CARD_TYPES.includes(v.type as string)) fail(`${name}.typeが不正です。`);
  const result: Card = { id: id(v.id, `${name}.id`), knowledgeId: id(v.knowledgeId, `${name}.knowledgeId`), type: v.type as Card['type'], question: string(v.question, `${name}.question`), answer: string(v.answer, `${name}.answer`), explanation: string(v.explanation, `${name}.explanation`, true), updatedAt: date(v.updatedAt, `${name}.updatedAt`), version: integer(v.version, `${name}.version`), deleted: bool(v.deleted, `${name}.deleted`) };
  if (v.imageId !== undefined) result.imageId = id(v.imageId, `${name}.imageId`);
  if (v.fallbackPrompt !== undefined) result.fallbackPrompt = string(v.fallbackPrompt, `${name}.fallbackPrompt`);
  if (result.type === 'image' && (!result.imageId || !result.fallbackPrompt)) fail(`${name}の画像問題には画像IDと代替問題文が必要です。`);
  return result;
}
function unique<T>(values: T[], key: (entry: T) => string, label: string) {
  const seen = new Set<string>();
  for (const value of values) { const k = key(value); if (seen.has(k)) fail(`${label}が重複しています: ${k}`); seen.add(k); }
}
export function normalizeName(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ja').replace(/[\s・･·「」『』“”"'’.,，。\-‐‑–—―ー]/g, '');
}

/** Validates a complete catalog; mergeCatalog can also accept partial updates. */
export function validateCatalog(input: unknown, allowMissingReferences = false): Catalog {
  const value = object(input, 'カタログ');
  if (value.schemaVersion !== 1) fail('未対応のカタログ形式です。アプリを更新してください。');
  const result: Catalog = { schemaVersion: 1, version: integer(value.version, 'カタログバージョン', 0), updatedAt: date(value.updatedAt, 'カタログ更新日時'), items: array(value.items, 'items', item), cards: array(value.cards, 'cards', card, 100_000) };
  unique(result.items, x => x.id, '用語ID'); unique(result.cards, x => x.id, 'カードID');
  const owners = new Map<string, string>();
  for (const entry of result.items.filter(x => !x.deleted)) {
    for (const name of [entry.canonicalName, ...entry.aliases]) {
      const normalized = normalizeName(name);
      if (!normalized) fail(`用語名が空です: ${entry.id}`);
      const owner = owners.get(normalized);
      if (owner && owner !== entry.id) fail(`表記揺れを含む用語の重複です: ${name} (${owner}, ${entry.id})`);
      owners.set(normalized, entry.id);
    }
  }
  if (!allowMissingReferences) {
    const items = new Map(result.items.map(x => [x.id, x]));
    const signatures = new Set<string>();
    for (const entry of result.cards) {
      const owner = items.get(entry.knowledgeId);
      if (!owner) fail(`カードの参照先がありません: ${entry.id}`);
      if (!entry.deleted && !owner.deleted && entry.imageId && !owner.images.some(x => x.id === entry.imageId)) fail(`カードの画像がありません: ${entry.id}`);
      if (!entry.deleted && !owner.deleted) {
        // Distinct works can legitimately share the same 'Who painted this?' question.
        // Use the image ID for visual card identity; still reject duplicates for the same image.
        const signature = `${entry.knowledgeId}|${entry.type}|${entry.type === 'image' ? entry.imageId : ''}|${normalizeName(entry.question)}|${normalizeName(entry.answer)}`;
        if (signatures.has(signature)) fail(`同じ内容のカードが重複しています: ${entry.id}`);
        signatures.add(signature);
      }
    }
    for (const entry of result.items) for (const reference of [...entry.relatedPeople, ...entry.relatedWorks]) if (!items.has(reference)) fail(`関連項目の参照先がありません: ${entry.id} → ${reference}`);
  }
  return result;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function sameValue(a: unknown, b: unknown): boolean { return canonical(a) === canonical(b); }

function mergeRows<T extends {id: string; version: number; updatedAt: string}>(current: T[], incoming: T[]): T[] {
  const map = new Map(current.map(entry => [entry.id, entry]));
  for (const entry of incoming) {
    const old = map.get(entry.id);
    if (old && 'knowledgeId' in old && 'knowledgeId' in entry && old.knowledgeId !== entry.knowledgeId) fail(`カードIDを別の知識項目に付け替えることはできません: ${entry.id}`);
    if (old && entry.version < old.version) fail(`古い項目バージョンです: ${entry.id}`);
    if (old && entry.version === old.version && !sameValue(old, entry)) fail(`同じバージョンに異なる内容があります: ${entry.id}`);
    if (old && entry.version > old.version && Date.parse(entry.updatedAt) < Date.parse(old.updatedAt)) fail(`項目の更新日時が過去に戻っています: ${entry.id}`);
    map.set(entry.id, entry);
  }
  return [...map.values()];
}
export function mergeCatalog(current: Catalog, incoming: unknown): Catalog {
  const next = validateCatalog(incoming, true);
  if (next.version < current.version) fail('古いカタログのため同期しませんでした。');
  if (Date.parse(next.updatedAt) < Date.parse(current.updatedAt)) fail('カタログ更新日時が過去に戻っています。');
  if (next.version === current.version) {
    const unchanged = <T extends {id: string}>(existing: T[], incoming: T[]): boolean => {
      const byId = new Map(existing.map(entry => [entry.id, entry]));
      return incoming.every(entry => byId.has(entry.id) && sameValue(byId.get(entry.id), entry));
    };
    if (!unchanged(current.items, next.items) || !unchanged(current.cards, next.cards)) fail('同じバージョンのカタログに変更があります。項目の変更・追加時はカタログ全体のバージョンも増やしてください。');
    // An exact or partial retransmission is a no-op, including its metadata.
    return validateCatalog(current);
  }
  return validateCatalog({schemaVersion: 1, version: next.version, updatedAt: next.updatedAt, items: mergeRows(current.items, next.items), cards: mergeRows(current.cards, next.cards)});
}

export function validateEvent(input: unknown): ReviewEvent {
  const value = object(input, '履歴');
  return {id: id(value.id, '履歴ID'), cardId: id(value.cardId, '履歴カードID'), correct: bool(value.correct, '正誤'), reviewedAt: date(value.reviewedAt, '学習日時'), sessionId: id(value.sessionId, 'セッションID')};
}
export function validateSettings(input: unknown): Settings {
  const value = object(input, '設定');
  const syncUrl = string(value.syncUrl, '同期URL', true, 4000);
  if (syncUrl) url(syncUrl, '同期URL');
  const dailyGoal = integer(value.dailyGoal, '一日の目標');
  if (dailyGoal > 10_000) fail('一日の目標が大きすぎます。');
  return {syncUrl, dailyGoal, lastSyncAt: value.lastSyncAt === null ? null : date(value.lastSyncAt, '最終同期日時'), lastBackupAt: value.lastBackupAt === null ? null : date(value.lastBackupAt, '最終バックアップ日時')};
}
export function validateBackup(input: unknown): Backup {
  const value = object(input, 'バックアップ');
  if (value.format !== 'cultural-history-master' || ![1,2].includes(value.schemaVersion as number)) fail('未対応または別アプリのバックアップです。');
  const result: Backup = {format: 'cultural-history-master', schemaVersion: value.schemaVersion as 1|2, exportedAt: date(value.exportedAt, '書き出し日時'), catalog: validateCatalog(value.catalog), events: array(value.events, 'events', validateEvent, 1_000_000), settings: validateSettings(value.settings ?? DEFAULT_SETTINGS)};
  unique(result.events, event => event.id, '履歴ID');
  const cardIds = new Set(result.catalog.cards.map(entry => entry.id));
  for (const event of result.events) if (!cardIds.has(event.cardId)) fail(`履歴の参照先カードがありません: ${event.cardId}`);
  result.comparisonEvents=value.schemaVersion===2?array(value.comparisonEvents??[],'comparisonEvents',validateComparisonEvent,1_000_000):[];
  unique(result.comparisonEvents,event=>event.id,'識別履歴ID');
  const knowledgeIds=new Set(result.catalog.items.map(item=>item.id));
  for(const event of result.comparisonEvents)for(const id of [event.sourceKnowledgeId,event.targetKnowledgeId,event.selectedTargetId].filter(Boolean) as string[])if(!knowledgeIds.has(id))fail(`識別履歴の参照先がありません: ${id}`);
  if(value.schemaVersion===2&&value.relations!==undefined)result.relations=validateRelations(value.relations);
  result.errorCauses=validateErrorCauses(value.errorCauses);
  return result;
}

export function getProgress(events: ReviewEvent[]): Map<string, CardProgress> {
  const result = new Map<string, CardProgress>();
  for (const event of [...events].sort((a, b) => Date.parse(a.reviewedAt) - Date.parse(b.reviewedAt) || a.id.localeCompare(b.id))) {
    const p:CardProgress = result.get(event.cardId) ?? {cardId: event.cardId, correct: 0, wrong: 0, attempts: 0, streak: 0, lastStudiedAt: null, nextReviewAt: null, recent: []};
    p.retention=advanceRetention(p.retention,event.correct,event.reviewedAt,p.lastStudiedAt,p.nextReviewAt);
    p.attempts++;
    if (event.correct) { p.correct++; p.streak++; } else { p.wrong++; p.streak = 0; }
    p.recent = [...p.recent.slice(-4), event.correct];
    p.lastStudiedAt = event.reviewedAt;
    const days = [1, 3, 7, 14, 30, 60, 120, 180][Math.min(7, p.streak - 1)] ?? 1;
    const successRate = p.recent.filter(Boolean).length / p.recent.length;
    const interval = event.correct ? Math.max(DAY, days * DAY * (successRate < 0.6 ? 0.5 : 1)) : 10 * 60_000;
    p.nextReviewAt = new Date(Date.parse(event.reviewedAt) + interval).toISOString();
    result.set(event.cardId, p);
  }
  return result;
}

/** Recent failures and overdue time dominate; lifetime mistakes are a bounded tie-breaker. */
export function priority(progress: CardProgress | undefined, now: number | Date = Date.now()): number {
  if (!progress) return 2;
  const time = Number(now);
  const recentFailure = 1 - progress.recent.filter(Boolean).length / Math.max(1, progress.recent.length);
  const overdueDays = Math.max(0, (time - Date.parse(progress.nextReviewAt ?? new Date(time).toISOString())) / DAY);
  const idleDays = Math.max(0, (time - Date.parse(progress.lastStudiedAt ?? new Date(time).toISOString())) / DAY);
  return recentFailure * 10 + Math.min(20, overdueDays) + Math.min(5, idleDays / 14) + Math.min(1, progress.wrong / 20) - Math.min(3, progress.streak * 0.4);
}
/**
 * Older synced textbooks use broad card types (context/achievement-person) even
 * for author/work recall. Identify the clearly attributable pairs at query time
 * instead of rewriting card IDs, catalog versions, or existing review events.
 */
const CREATOR_TO_WORK_CUES = /著した|著わした|著述した|執筆した|編纂した|編集した|書いた|詠んだ|作成した|制定した|漢訳した|翻訳した|風刺した|が残した|が記録した|が(?:編んだ|まとめた)|をまとめた|の(?:著作|作品|詩集|戯曲|絵画|絵巻|著書|学術随筆|長編詩|元曲|四行詩集|回想録)|による(?:著作|絵画|作品|書作品|行書)|の作と伝えられる|が描いた/;
function matchesDirection(card: Card, owner: KnowledgeItem, direction: StudyFilter['cardDirection'], creatorNames: string[]): boolean {
  if (direction === 'all') return true;
  if (card.type === direction) return true;
  if (direction === 'work-author') {
    // A named work provides a real cue. Do not count rulers who only ordered compilation.
    return card.type === 'achievement-person' && owner.kind === 'person'
      && /『[^』]+』/.test(card.question)
      && !/(?:編纂|作成)を命じた/.test(card.question);
  }
  if (direction === 'person-work') {
    if (card.type !== 'context' || owner.kind !== 'work') return false;
    // Remove the generic suffix present on most textbook cards before classifying.
    const question = card.question.replace(/(?:この)?作品・文献は何か[？?]?/g, '');
    if (/作者不詳|の命で(?:編纂|作成)された/.test(question) || !CREATOR_TO_WORK_CUES.test(question)) return false;
    return creatorNames.some(name => question.includes(name));
  }
  return false;
}

export function selectCards(catalog: Catalog, events: ReviewEvent[], filter: StudyFilter, now: number | Date = Date.now()): Card[] {
  const items = new Map(catalog.items.filter(entry => !entry.deleted).map(entry => [entry.id, entry]));
  const progress = getProgress(events);
  const creatorNames = filter.cardDirection === 'person-work'
    ? [...new Set(catalog.items.filter(item => !item.deleted && item.kind === 'person').flatMap(item => [item.canonicalName, ...item.aliases]))].filter(name => name.length >= 2)
    : [];
  const cards = catalog.cards.filter(entry => {
    const owner = items.get(entry.knowledgeId);
    if (entry.deleted || !owner) return false;
    if (filter.level !== 'all' && (filter.levelMode === 'single' ? owner.level !== filter.level : owner.level > filter.level)) return false;
    if (filter.regions.length && !filter.regions.includes(owner.region)) return false;
    if (filter.eras.length && !filter.eras.includes(owner.era)) return false;
    if (!matchesCultureScope(owner, filter)) return false;
    if (filter.fields.length && !filter.fields.includes(owner.field)) return false;
    if (filter.cardType !== 'all' && (filter.cardType === 'image' ? entry.type !== 'image' : entry.type === 'image')) return false;
    if (filter.cardDirection && !matchesDirection(entry, owner, filter.cardDirection, creatorNames)) return false;
    const p = progress.get(entry.id);
    if (filter.mode === 'unseen' && p) return false;
    if (filter.mode === 'mistakes' && (!p || p.wrong === 0)) return false;
    if (filter.mode === 'due' && (!p?.nextReviewAt || Date.parse(p.nextReviewAt) > Number(now))) return false;
    return true;
  });
  if (filter.mode === 'random') {
    for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
  } else if (filter.mode === 'weak' || filter.mode === 'due') cards.sort((a, b) => priority(progress.get(b.id), now) - priority(progress.get(a.id), now) || a.id.localeCompare(b.id));
  return cards;
}

/**
 * Spread repeated answers across a study session, avoiding back-to-back cards
 * about the same knowledge item when alternatives exist.
 * Card objects/IDs and review events are never modified.
 */
export function spreadSessionCards(cards: Card[], limit = cards.length): Card[] {
  const remaining = [...cards];
  const result: Card[] = [];
  const usedAnswers = new Set<string>();
  const requested = Number.isFinite(limit) ? Math.max(0, Math.trunc(limit)) : remaining.length;
  const target = Math.min(requested, remaining.length);
  while (remaining.length && result.length < target) {
    const last = result[result.length - 1];
    const nextIsDifferent = (card: Card) => !last || card.knowledgeId !== last.knowledgeId;
    let index = remaining.findIndex(card => !usedAnswers.has(normalizeName(card.answer)) && nextIsDifferent(card));
    if (index < 0) index = remaining.findIndex(card => !usedAnswers.has(normalizeName(card.answer)));
    if (index < 0) {
      // Every remaining answer has appeared in this round. Begin another round.
      usedAnswers.clear();
      index = remaining.findIndex(nextIsDifferent);
      if (index < 0) index = 0;
    }
    const [card] = remaining.splice(index, 1);
    result.push(card);
    usedAnswers.add(normalizeName(card.answer));
  }
  return result;
}
