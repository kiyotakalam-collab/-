export type CauseArea='culture'|'years'|'ordering'|'ambiguous';
export type ErrorCause='A'|'B'|'C'|'D'|'E';
export const ERROR_CAUSES:Record<ErrorCause,string>={A:'知識不足',B:'類似知識との混同',C:'文脈・年代の判断ミス',D:'設問処理ミス',E:'その他'};
export interface ErrorAnnotation {area:CauseArea;eventId:string;cause:ErrorCause|null;updatedAt:string}
const PREFIX='errorCause:';
const request=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
export function validateErrorCauses(input:unknown):ErrorAnnotation[]{
  if(input===undefined)return [];if(!Array.isArray(input)||input.length>1000000)throw Error('失点原因の形式が不正です。');
  const seen=new Set<string>();return input.map(value=>{
    if(!value||typeof value!=='object'||!['culture','years','ordering','ambiguous'].includes(value.area)||typeof value.eventId!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,299}$/.test(value.eventId)||(value.cause!==null&&!Object.hasOwn(ERROR_CAUSES,value.cause))||typeof value.updatedAt!=='string'||!Number.isFinite(Date.parse(value.updatedAt))||new Date(value.updatedAt).toISOString()!==value.updatedAt)throw Error('失点原因が不正です。');
    const key=value.area+':'+value.eventId;if(seen.has(key))throw Error('失点原因の参照が重複しています。');seen.add(key);return {area:value.area,eventId:value.eventId,cause:value.cause,updatedAt:value.updatedAt};
  });
}
export async function readErrorCauses(meta:IDBObjectStore):Promise<ErrorAnnotation[]>{return new Promise((resolve,reject)=>{const values:unknown[]=[],r=meta.openCursor();r.onerror=()=>reject(r.error);r.onsuccess=()=>{const cursor=r.result;if(!cursor){try{resolve(validateErrorCauses(values));}catch(error){reject(error);}return;}if(String(cursor.key).startsWith(PREFIX))values.push(cursor.value);cursor.continue();};});}
export async function restoreErrorCauses(meta:IDBObjectStore,input:unknown,events:{area:CauseArea;id:string;correct:boolean}[]){
  const incoming=validateErrorCauses(input),known=new Map(events.map(e=>[e.area+':'+e.id,e]));
  for(const value of incoming){const key=value.area+':'+value.eventId,event=known.get(key);if(!event||event.correct)throw Error('失点原因は実際の誤答履歴にのみ登録できます。');const old=await request(meta.get(PREFIX+key)) as ErrorAnnotation|undefined;
    if(old&&old.updatedAt===value.updatedAt&&old.cause!==value.cause)throw Error('失点原因の記録が競合しています。');if(!old||value.updatedAt>old.updatedAt)await request(meta.put(value,PREFIX+key));
  }
}
export async function saveErrorCause(area:CauseArea,eventId:string,cause:ErrorCause|null){
  const name=area==='culture'?'cultural-history-master':area==='ambiguous'?'world-history-ambiguous-terms':'world-history-year-test';
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onupgradeneeded=()=>r.transaction?.abort();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{const store=area==='culture'||area==='ambiguous'?'events':area==='ordering'?'orderingReviews':'reviews',tx=db.transaction(['meta',store],'readwrite'),done=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('失点原因を保存できません。'));tx.onerror=()=>{};});
    try{const event=await request(tx.objectStore(store).get(eventId));if(!event||event.correct)throw Error('実際の誤答だけに原因を登録できます。');const meta=tx.objectStore('meta'),key=PREFIX+area+':'+eventId,old=await request(meta.get(key)) as ErrorAnnotation|undefined;const value=validateErrorCauses([{area,eventId,cause,updatedAt:new Date(Math.max(Date.now(),old?Date.parse(old.updatedAt)+1:0)).toISOString()}])[0];await request(meta.put(value,key));await done;return value;}catch(error){try{tx.abort();}catch{}await done.catch(()=>{});throw error;}
  }finally{db.close();}
}
