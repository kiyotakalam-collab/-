import { activeAmbiguous, AMBIGUOUS_URL, EMPTY_AMBIGUOUS, mergeAmbiguousCatalog, validateAmbiguousCatalog, validateAmbiguousReview, type AmbCatalog, type AmbReview, type AmbSnapshot } from './ambiguous';

export class AmbiguousDB {
  constructor(private database:IDBDatabase){}
  close(){this.database.close();}
  private req<T>(r:IDBRequest<T>):Promise<T>{return new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
  private async write<T>(action:(tx:IDBTransaction)=>Promise<T>){
    const tx=this.database.transaction(['meta','events'],'readwrite'),done=new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error??Error('曖昧用語の保存を取り消しました。'));tx.onerror=()=>{};});
    try{const result=await action(tx);await done;return result;}catch(error){try{tx.abort();}catch{}await done.catch(()=>{});throw error;}
  }
  async load():Promise<AmbSnapshot>{
    const tx=this.database.transaction(['meta','events'],'readonly'),[catalog,events,lastSyncAt]=await Promise.all([this.req<AmbCatalog|undefined>(tx.objectStore('meta').get('catalog')),this.req<AmbReview[]>(tx.objectStore('events').getAll()),this.req<string|undefined>(tx.objectStore('meta').get('lastSyncAt'))]);
    return {catalog:catalog??structuredClone(EMPTY_AMBIGUOUS),events,lastSyncAt:lastSyncAt??null};
  }
  async applyCatalog(input:unknown){const incoming=validateAmbiguousCatalog(input);await this.write(async tx=>{const meta=tx.objectStore('meta'),old=await this.req<AmbCatalog|undefined>(meta.get('catalog'));const merged=mergeAmbiguousCatalog(old??structuredClone(EMPTY_AMBIGUOUS),incoming);await this.req(meta.put(merged,'catalog'));await this.req(meta.put(new Date().toISOString(),'lastSyncAt'));});}
  async grade(id:string,questionId:string,sessionId:string,selfCorrect:boolean|null,selectedTermId:string|null){
    return this.write(async tx=>{
      const meta=tx.objectStore('meta'),store=tx.objectStore('events'),catalog=await this.req<AmbCatalog|undefined>(meta.get('catalog'))??structuredClone(EMPTY_AMBIGUOUS),card=activeAmbiguous(catalog).cards.find(card=>card.id===questionId);
      if(!card)throw Error('出題可能な問題が見つかりません。');
      const old=await this.req<AmbReview|undefined>(store.get(id)),correct=card.kind==='identify'?selectedTermId===card.correctTermId:selfCorrect;
      if(old){if(old.questionId!==questionId||old.sessionId!==sessionId||old.correct!==correct||old.selectedTermId!==selectedTermId)throw Error('曖昧用語の履歴IDが競合しています。');return old;}
      const latest=await this.req<string|undefined>(meta.get('lastReviewAt')),at=new Date(Math.max(Date.now(),latest?Date.parse(latest)+1:0)).toISOString();
      const event=validateAmbiguousReview({id,questionId,sessionId,correct,selectedTermId,groupId:card.groupId,termIds:card.termIds,kind:card.kind,at},catalog);
      await this.req(store.add(event));await this.req(meta.put(at,'lastReviewAt'));return event;
    });
  }
  async exportBackup(){return JSON.stringify({format:'world-history-ambiguous-terms',schemaVersion:1,exportedAt:new Date().toISOString(),...await this.load()},null,2);}
  async restoreBackup(text:string){
    const input=JSON.parse(text);if(!input||input.format!=='world-history-ambiguous-terms'||input.schemaVersion!==1||!Array.isArray(input.events)||input.events.length>1000000)throw Error('曖昧用語専用のバックアップではありません。');
    const catalog=validateAmbiguousCatalog(input.catalog),events:AmbReview[]=input.events.map((value:unknown)=>validateAmbiguousReview(value,catalog));if(new Set(events.map(event=>event.id)).size!==events.length)throw Error('履歴IDが重複しています。');
    await this.write(async tx=>{
      const meta=tx.objectStore('meta'),store=tx.objectStore('events'),old=await this.req<AmbCatalog|undefined>(meta.get('catalog'))??structuredClone(EMPTY_AMBIGUOUS);
      // An older backup may contain historical rows absent on this device. Keep the union, with newer rows winning.
      const newer=old.version>=catalog.version?old:catalog,older=old.version>=catalog.version?catalog:old;
      const merged=mergeAmbiguousCatalog(older,{...newer,version:Math.max(old.version,catalog.version)+1});
      merged.version=Math.max(old.version,catalog.version);merged.updatedAt=newer.updatedAt;
      // Check every saved event against the union before committing any content change.
      const saved=await this.req<AmbReview[]>(store.getAll());for(const event of saved)validateAmbiguousReview(event,merged);
      let latest=await this.req<string|undefined>(meta.get('lastReviewAt'));
      for(const event of events){validateAmbiguousReview(event,merged);const existing=await this.req<AmbReview|undefined>(store.get(event.id));if(existing&&JSON.stringify(existing)!==JSON.stringify(event))throw Error('曖昧用語の履歴が競合しています。');if(!existing)await this.req(store.add(event));if(!latest||event.at>latest)latest=event.at;}
      await this.req(meta.put(merged,'catalog'));if(latest)await this.req(meta.put(latest,'lastReviewAt'));
    });
  }
}
export function openAmbiguousDatabase(name='world-history-ambiguous-terms'):Promise<AmbiguousDB>{return new Promise((resolve,reject)=>{
  const request=indexedDB.open(name,1);request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('meta');const events=db.createObjectStore('events',{keyPath:'id'});events.createIndex('questionId','questionId');events.createIndex('groupId','groupId');events.createIndex('at','at');};
  request.onsuccess=()=>{request.result.onversionchange=()=>request.result.close();resolve(new AmbiguousDB(request.result));};request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('曖昧用語の保存領域を別のタブで使用しています。'));
});}
export async function fetchAmbiguousCatalog(db:AmbiguousDB,url=AMBIGUOUS_URL){
  if(!navigator.onLine)throw Error('オフラインです。保存済みの曖昧用語で学習できます。');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{const response=await fetch(url+'?t='+Date.now(),{cache:'no-store',signal:controller.signal});if(!response.ok)throw Error('曖昧用語の取得に失敗：HTTP '+response.status);await db.applyCatalog(await response.json());return db.load();}finally{clearTimeout(timer);}
}
