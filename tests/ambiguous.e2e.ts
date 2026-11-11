import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { ambiguousFixture } from './ambiguous-fixture';
import { ambiguousProgress, ambiguousStatus, EMPTY_AMBIGUOUS, type AmbCatalog, type AmbSnapshot } from '../src/ambiguous';

async function routes(context:BrowserContext,read:()=>AmbCatalog=ambiguousFixture,failed=()=>false){
  for(const name of ['catalog-delta.json','year-events.json'])await context.route('**/'+name+'*',r=>r.fulfill({contentType:'application/json',body:readFileSync(new URL('../public/'+name,import.meta.url),'utf8')}));
  await context.route('**/ambiguous-terms.json*',r=>r.fulfill(failed()&&r.request().url().startsWith('https://raw.githubusercontent.com')?{status:503,body:'simulated sync failure'}:{contentType:'application/json',body:JSON.stringify(read())}));
}
async function snapshot(page:Page):Promise<AmbSnapshot>{return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('world-history-ambiguous-terms');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const tx=db.transaction(['meta','events'],'readonly');
  const get=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const [catalog,events]=await Promise.all([get(tx.objectStore('meta').get('catalog')),get(tx.objectStore('events').getAll())]);db.close();return {catalog,events,lastSyncAt:null};
});}
async function others(page:Page){return page.evaluate(async()=>{
  const read=async(name:string,stores:string[])=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const tx=db.transaction(['meta',...stores],'readonly'),get=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const values=await Promise.all([get(tx.objectStore('meta').get('catalog')),...stores.map(store=>get(tx.objectStore(store).getAll()))]);db.close();return values;};
  return {culture:await read('cultural-history-master',['events','comparisonEvents']),years:await read('world-history-year-test',['reviews','orderingReviews'])};
});}
async function boot(page:Page){await page.goto('/');await page.locator('header [data-nav=settings]').click();await expect(page.locator('.amb-tools')).toContainText('取得済み');await expect(page.locator('.chronology-tools')).toContainText('取得済み');await page.locator('header [data-nav=portal]').click();await page.locator('[data-enter-area=ambiguous]').click();}
async function home(page:Page){await page.locator('.mobile-nav [data-amb-route=home]').click();}
async function startRecall(page:Page){await home(page);await page.locator('[data-amb-kind=recall]').click();await page.locator('[name=region]').selectOption('架空地域A');await page.locator('#amb-options button:not([type=button])').click();await expect(page.locator('.amb-question')).toBeVisible();}
async function seedOtherHistory(page:Page){
  await page.evaluate(async()=>{
    const read=async(name:string)=>new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    for(const name of ['cultural-history-master','world-history-year-test']){
      const db=await read(name),store=name==='cultural-history-master'?'events':'reviews';const catalog=await new Promise<any>(resolve=>{const r=db.transaction('meta').objectStore('meta').get('catalog');r.onsuccess=()=>resolve(r.result);});
      await new Promise<void>((resolve,reject)=>{const tx=db.transaction([store],'readwrite');for(let i=0;i<5;i++){const common={id:'protected-'+name+'-'+i,correct:i>=3,sessionId:'protected-original'};tx.objectStore(store).add(name==='cultural-history-master'?{...common,cardId:catalog.cards[0].id,reviewedAt:`2026-11-0${i+1}T00:00:00.000Z`}:{...common,questionId:catalog.items[0].id+'::event-year',at:`2026-11-0${i+1}T00:00:00.000Z`});}tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
    }
  });await page.reload();await expect(page.locator('[data-amb-page=home]')).toBeVisible();
}

test('教材0件の第3エリアが正常に開き、既存エリアと独立した5項目メニューを持つ',async({page,context})=>{
  await routes(context,()=>EMPTY_AMBIGUOUS);await boot(page);await expect(page.locator('.amb-empty')).toContainText('用語0件');await expect(page.locator('.mobile-nav [data-amb-route]')).toHaveCount(5);
  const before=await others(page);
  for(const route of ['quiz','groups','terms','review']){await page.locator(`.mobile-nav [data-amb-route=${route}]`).click();await expect(page.locator(`[data-amb-page=${route}]`)).toBeVisible();}
  await page.locator('[data-amb-route=history]').click();await expect(page.locator('[data-amb-page=history]')).toContainText('演習履歴はまだ');await home(page);await page.locator('.mobile-nav [data-amb-route=quiz]').click();await expect(page.locator('#amb-options button:not([type=button])')).toBeDisabled();
  expect(await others(page)).toEqual(before);expect((await snapshot(page)).events).toEqual([]);await page.locator('header [data-nav=portal]').click();await expect(page.locator('[data-enter-area]')).toHaveCount(5);
});

test('3形式を採点し、比較表と用語別・グループ別定着度、累積誤答を独立して保持する',async({page,context})=>{
  await routes(context);await boot(page);await seedOtherHistory(page);const before=await others(page);
  await startRecall(page);await page.locator('[data-amb-action=reveal]').click();await expect(page.locator('.amb-answer')).toContainText('架空用語a');expect((await snapshot(page)).events).toHaveLength(0);await page.locator('[data-amb-action=wrong]').click();await expect(page.locator('.amb-feedback')).toContainText('誤答');
  await startRecall(page);await page.locator('[data-amb-action=reveal]').click();await page.locator('[data-amb-action=correct]').click();await expect(page.locator('.amb-question')).toContainText('累積正答 1 ／ 累積誤答 1');
  await home(page);await page.locator('[data-amb-kind=identify]').click();await page.locator('#amb-options button:not([type=button])').click();await expect(page.locator('[name=amb-answer]')).toHaveCount(3);
  await page.locator('[name=amb-answer][value=at-test-b]').check();await page.locator('[name=amb-answer][value=at-test-c]').check();await page.locator('[name=amb-answer][value=at-test-b]').check();expect((await snapshot(page)).events).toHaveLength(2);
  await page.locator('[data-amb-action=choice]').evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});await expect(page.locator('.amb-feedback')).toContainText('誤答');expect((await snapshot(page)).events).toHaveLength(3);
  await home(page);await page.locator('[data-amb-kind=compare]').click();await page.locator('#amb-options button:not([type=button])').click();await page.locator('[data-amb-action=reveal]').click();await expect(page.locator('.amb-answer')).toContainText('テスト専用の比較正答');await page.locator('[data-amb-action=wrong]').click();
  const state=await snapshot(page);expect(ambiguousProgress(state.events).get('ac-test-recall')).toMatchObject({wrong:1,correct:1});expect(ambiguousStatus(state.catalog,state.events).groups.get('ag-test-six')).toBe('initial');
  await page.locator('[data-amb-route="group/ag-test-six"]').click();await expect(page.locator('.amb-table-scroll thead th')).toHaveCount(7);await expect(page.locator('.amb-relationship')).toContainText('架空用語a → 前後関係 → 架空用語b');await page.reload();await expect(page.locator('.amb-group-detail')).toContainText('最重要識別ポイント');
  await page.locator('.mobile-nav [data-amb-route=terms]').click();await page.locator('#amb-search').fill('架空別名a');await expect(page.locator('.amb-term')).toHaveCount(1);await page.locator('.amb-term summary').click();await expect(page.locator('.amb-term [data-amb-route^="group/"]')).toHaveCount(2);
  expect(await others(page)).toEqual(before);
});

test('同期更新・失敗・アプリ更新・オフライン・別DBへのバックアップ復元後も全履歴を保持する',async({page,context,browser})=>{
  let current=ambiguousFixture(),failed=false;await routes(context,()=>current,()=>failed);await boot(page);await startRecall(page);await page.locator('[data-amb-action=reveal]').click();await page.locator('[data-amb-action=wrong]').click();await home(page);
  const before=await snapshot(page);current=structuredClone(current);current.version=3;current.cards[0].version=2;current.cards[0].explanation='同期後の架空解説';
  await page.locator('header [data-nav=settings]').click();await page.locator('[data-amb-action=sync]').click();await expect(page.locator('.amb-tools')).toContainText('教材v3');failed=true;await page.locator('[data-amb-action=sync]').click();await expect(page.locator('.amb-tools')).toContainText('保持');expect((await snapshot(page)).events).toEqual(before.events);
  const download=page.waitForEvent('download');await page.locator('[data-amb-action=backup]').click();const bytes=await readFile((await(await download).path())!);const backup=JSON.parse(bytes.toString());expect(backup.format).toBe('world-history-ambiguous-terms');
  const fresh=await browser.newContext();try{await routes(fresh,()=>EMPTY_AMBIGUOUS);const other=await fresh.newPage();await boot(other);await other.locator('header [data-nav=settings]').click();for(let i=0;i<2;i++){await other.locator('#amb-restore').setInputFiles({name:'amb.json',mimeType:'application/json',buffer:bytes});await expect(other.locator('#toast')).toContainText('統合');}expect((await snapshot(other)).events).toEqual(before.events);const protectedData=await others(other);await other.locator('#amb-restore').setInputFiles({name:'foreign.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...backup,format:'world-history-years'}))});await expect(other.locator('#toast')).toContainText('専用');expect(await others(other)).toEqual(protectedData);}finally{await fresh.close();}
  await page.locator('header [data-nav=portal]').click();await page.locator('[data-enter-area=ambiguous]').click();await page.locator('.mobile-nav [data-amb-route=review]').click();await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>undefined));await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  await page.evaluate(async()=>{const registration=await navigator.serviceWorker.register('./sw.js?amb-update=2',{scope:'./'});await registration.update();const worker=registration.installing||registration.waiting;if(worker&&worker.state!=='installed')await new Promise<void>(resolve=>worker.addEventListener('statechange',()=>{if(worker.state==='installed')resolve();}));if(registration.waiting){const changed=new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));registration.waiting.postMessage({type:'SKIP_WAITING'});await changed;}});
  await context.setOffline(true);await page.reload();await expect(page.locator('[data-amb-page=review]')).toBeVisible();expect((await snapshot(page)).events).toEqual(before.events);expect((await snapshot(page)).catalog.cards[0].explanation).toBe('同期後の架空解説');
});

test('条件0件の解除案・6用語比較・履歴画面を360pxと393pxで操作できる',async({page,context})=>{
  await routes(context);await boot(page);for(const width of [360,393]){
    await page.setViewportSize({width,height:851});await home(page);await page.locator('.mobile-nav [data-amb-route=quiz]').click();await page.locator('[name=region]').selectOption('架空地域A');await page.locator('[name=field]').selectOption('架空分野B');await expect(page.locator('.amb-count')).toContainText('対象 0問');await expect(page.locator('[data-amb-clear=field]')).toBeVisible();await page.locator('[data-amb-clear=field]').click();await expect(page.locator('#amb-options button:not([type=button])')).toBeEnabled();
    await page.locator('.mobile-nav [data-amb-route=groups]').click();await page.locator('[data-amb-route="group/ag-test-six"]').click();await expect(page.locator('.amb-table-scroll')).toHaveAttribute('tabindex','0');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.goBack();await expect(page.locator('[data-amb-page=groups]')).toBeVisible();
    const boxes=await page.locator('.mobile-nav button').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));expect(boxes.every(v=>v>=44)).toBe(true);
  }
  expect((await snapshot(page)).events).toHaveLength(0);
});
