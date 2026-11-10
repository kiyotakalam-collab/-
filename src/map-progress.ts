import {getProgress} from './core';
import type {ReviewEvent} from './types';
import type {MapReview} from './historical-maps';
export function mapProgress(events:MapReview[]){return getProgress(events.map(e=>({id:e.id,cardId:e.questionId,correct:e.correct,reviewedAt:e.at,sessionId:e.sessionId} satisfies ReviewEvent)));}
