export type Level = 1 | 2 | 3 | 4;
export interface Source { title: string; url?: string; note?: string }
export interface ImageAsset {
  id: string; url: string; sourceUrl: string; author: string;
  license: string; licenseUrl: string; caption: string;
}
export interface KnowledgeItem {
  id: string; canonicalName: string; aliases: string[];
  kind: 'person' | 'work' | 'concept' | 'building';
  field: string; region: string; era: string; level: Level;
  relatedPeople: string[]; relatedWorks: string[]; description: string;
  images: ImageAsset[]; sources: Source[]; difficultyEvidence: string;
  verification: 'verified' | 'provisional' | 'needs-review';
  updatedAt: string; version: number; deleted: boolean;
}
export type CardType = 'achievement-person' | 'person-work' | 'work-author' | 'theory-person' | 'image' | 'context';
export interface Card {
  id: string; knowledgeId: string; type: CardType;
  question: string; answer: string; explanation: string;
  imageId?: string; fallbackPrompt?: string;
  updatedAt: string; version: number; deleted: boolean;
}
export interface Catalog {
  schemaVersion: 1; version: number; updatedAt: string;
  items: KnowledgeItem[]; cards: Card[];
}
export interface ReviewEvent {
  id: string; cardId: string; correct: boolean; reviewedAt: string; sessionId: string;
}
export interface CardProgress {
  cardId: string; correct: number; wrong: number; attempts: number;
  streak: number; lastStudiedAt: string | null; nextReviewAt: string | null;
  recent: boolean[];
}
export type StudyMode = 'all' | 'unseen' | 'mistakes' | 'due' | 'weak' | 'random';
export interface StudyFilter {
  mode: StudyMode; level: Level | 'all'; levelMode: 'cumulative' | 'single';
  regions: string[]; eras: string[]; fields: string[];
  regionGroups?: string[]; eraGroups?: string[];
  cardType: 'all' | 'text' | 'image';
  cardDirection: 'all' | 'person-work' | 'work-author';
}
export interface Settings {
  syncUrl: string; lastSyncAt: string | null; lastBackupAt: string | null;
  dailyGoal: number;
}
export interface AppState {
  catalog: Catalog; events: ReviewEvent[]; settings: Settings;
}
export interface Backup {
  format: 'cultural-history-master'; schemaVersion: 1; exportedAt: string;
  catalog: Catalog; events: ReviewEvent[]; settings: Settings;
}
export const DEFAULT_SETTINGS: Settings = {syncUrl: '', lastSyncAt: null, lastBackupAt: null, dailyGoal: 20};
export const DEFAULT_FILTER: StudyFilter = {mode: 'all', level: 'all', levelMode: 'cumulative', regions: [], eras: [], fields: [], cardType: 'all', cardDirection: 'all'};
