import type {Catalog, KnowledgeItem, Level, ReviewEvent, Source} from './types';

export type RelationType='authored'|'founded'|'advocated'|'influenced'|'criticized'|'developed'|'contrasted_with'|'associated_with';
export interface CultureRelation {
  id:string; fromId:string; toId:string; type:RelationType; description:string;
  verification:'verified'|'provisional'; sources:Source[];
}
export interface ComparisonSet {
  id:string; title:string; description:string; relationIds:string[];
  level?:Level; direction:'forward'|'reverse';
}
export interface CultureRelations {
  schemaVersion:1; version:number; updatedAt:string;
  relations:CultureRelation[]; comparisonSets:ComparisonSet[];
}
export interface ComparisonEvent {
  id:string; comparisonSetId:string; relationId:string;
  sourceKnowledgeId:string; targetKnowledgeId:string; selectedTargetId:string|null;
  correct:boolean; reviewedAt:string; sessionId:string;
}
export interface ComparisonPair {
  relationId:string; sourceKnowledgeId:string; targetKnowledgeId:string; prompt:string; answer:string;
}
export interface PreparedComparison {
  set:ComparisonSet; pairs:ComparisonPair[]; choices:{id:string;label:string}[];
}
export interface FeatureContext {
  catalog:Catalog; events:ReviewEvent[]; comparisonEvents:ComparisonEvent[]; relations:CultureRelations;
  catalogSyncing?:boolean;
}
export interface CultureGraph {nodes:KnowledgeItem[];edges:CultureRelation[];omitted:number}
