/** Evidence about remembered knowledge; never changes an existing repetition deadline. */
export type Retention='unseen'|'initial'|'learning'|'stable'|'unknown';
export const RETENTION_LABELS:Record<Retention,string>={unseen:'未学習',initial:'定着初期',learning:'定着途中',stable:'安定',unknown:'判定不能・再判定待ち'};
export type Urgency='future'|'today'|'overdue'|'short'|'unscheduled';
export const URGENCY_LABELS:Record<Urgency,string>={future:'期限未到来',today:'本日復習',overdue:'期限超過',short:'直近誤答・短期再復習',unscheduled:'復習期限なし'};
export interface RetentionEvidence {attempts:number;streak:number;recent:boolean[];dueSuccesses:number;longSuccesses:number;dueDays:string[];invalid:boolean}
const DAY=86400000;
const day=(ms:number)=>new Date(ms+9*3600000).toISOString().slice(0,10);
export function advanceRetention(previous:RetentionEvidence|undefined,correct:boolean,at:string,lastAt:string|null|undefined,dueBefore:string|number|null|undefined):RetentionEvidence{
  const p=previous??{attempts:0,streak:0,recent:[],dueSuccesses:0,longSuccesses:0,dueDays:[],invalid:false};
  const now=Date.parse(at),last=lastAt?Date.parse(lastAt):null,due=typeof dueBefore==='number'?dueBefore:dueBefore?Date.parse(dueBefore):null;
  const invalid=p.invalid||!Number.isFinite(now)||last!==null&&!Number.isFinite(last)||due!==null&&!Number.isFinite(due)||last!==null&&now<last;
  const confirmed=correct&&!invalid&&last!==null&&due!==null&&due-last>=DAY&&now>=due;
  return {attempts:p.attempts+1,streak:correct?p.streak+1:0,recent:[...p.recent.slice(-4),correct],dueSuccesses:correct?p.dueSuccesses+(confirmed?1:0):0,longSuccesses:correct?p.longSuccesses+(confirmed&&due!-last!>=7*DAY?1:0):0,dueDays:correct?[...new Set([...p.dueDays,...(confirmed?[day(now)]:[])])].slice(-10):[],invalid};
}
export function retentionFromEvidence(evidence:RetentionEvidence|undefined,attempts=0):Retention{
  if(!attempts&&!evidence?.attempts)return 'unseen';if(!evidence||evidence.invalid)return 'unknown';
  if(evidence.streak>=3&&evidence.recent.slice(-3).length===3&&evidence.recent.slice(-3).every(Boolean)&&evidence.dueSuccesses>=2&&evidence.longSuccesses>=1&&evidence.dueDays.length>=2)return 'stable';
  return evidence.dueSuccesses>=1?'learning':'initial';
}
export function reviewUrgency(dueAt:number|null,lastCorrect:boolean|undefined,now=Date.now()):Urgency{
  if(dueAt===null||!Number.isFinite(dueAt))return 'unscheduled';
  if(lastCorrect===false)return 'short';const dueDay=day(dueAt),today=day(now);return dueDay<today?'overdue':dueDay===today?'today':'future';
}
export function aggregateRetention(states:Retention[]):Retention{
  if(!states.length||states.every(v=>v==='unseen'))return 'unseen';if(states.includes('unknown'))return 'unknown';if(states.every(v=>v==='stable'))return 'stable';if(states.some(v=>v==='initial'||v==='unseen'))return 'initial';return 'learning';
}
export const RETENTION_RULES=[
  '未学習：回答がない。定着初期：回答はあるが、1日以上の既存復習間隔を実際に迎えてからの正答がない。',
  '定着途中：1日以上の復習間隔を実際に迎えて正答した実績がある。誤答後は、その後の復習成功から再評価する。',
  '安定：連続正答3回以上・直近3回が正答。さらに誤答後から数え、異なる日本時間の日付で期限到来後の正答2回以上、そのうち7日以上の予定間隔での正答1回以上。',
  '判定不能・再判定待ち：復習間隔を確認できる履歴がない、または日時に不整合がある。年代整序は既存の復習期限計算がないため長期定着度を判定しない。',
  '期限超過や最終回答日からの時間経過だけでは定着度を下げない。短時間の連続正答だけでも安定にしない。',
];
