import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { comparableYear, timelineItems } from '../src/year-chronology';
import { validateYearCatalog, type YearSnapshot } from '../src/years';

const catalog=validateYearCatalog(JSON.parse(readFileSync(new URL('../public/year-events.json',import.meta.url),'utf8')));
async function routes(context:BrowserContext){
  await context.route('**/year-events.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(catalog)}));
  await context.route('https://raw.githubusercontent.com/**/catalog-delta.json*',route=>route.fulfill({status:503,body:'offline fixture'}));
  await context.route('https://raw.githubusercontent.com/**/culture-relations.json*',route=>route.fulfill({status:503,body:'offline fixture'}));
}
async function snapshot(page:Page):Promise<YearSnapshot>{return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('world-history-year-test');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const t=db.transaction(['meta','reviews','orderingReviews'],'readonly');
  const get=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const [catalog,events,orderingEvents]=await Promise.all([get(t.objectStore('meta').get('catalog')),get(t.objectStore('reviews').getAll()),get(t.objectStore('orderingReviews').getAll())]);db.close();return {catalog,events,orderingEvents,lastSyncAt:null};
});}
async function culture(page:Page){return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('cultural-history-master');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const t=db.transaction(['meta','events'],'readonly');
  const get=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const result=await Promise.all([get(t.objectStore('meta').get('catalog')),get(t.objectStore('events').getAll())]);db.close();return result;
});}
async function boot(page:Page,context:BrowserContext){await routes(context);await page.goto('/');await page.locator('[data-enter-area=years]').click();await expect.poll(async()=>(await snapshot(page)).catalog.items.length).toBe(460);}
async function home(page:Page){await page.locator('.mobile-nav [data-year-nav=home]').click();}
async function sortAnswer(page:Page,correct=true){
  const ids=await page.locator('[data-order-item]').evaluateAll(els=>els.map(el=>(el as HTMLElement).dataset.orderItem!));
  const byId=new Map(catalog.items.map(item=>[item.id,item]));
  const target=[...ids].sort((a,b)=>comparableYear(byId.get(a)!.year)!-comparableYear(byId.get(b)!.year)!);if(!correct)target.reverse();
  for(let i=0;i<target.length;i++){
    let current=(await page.locator('[data-order-item]').evaluateAll(els=>els.map(el=>(el as HTMLElement).dataset.orderItem!))).indexOf(target[i]);
    while(current>i){await page.locator(`[data-order-move="${current}"][data-step="-1"]`).click();current--;}
  }
}

test('整序を採点・再読込・同期・バックアップ復元しても一問一答と文化史の履歴を保持する',async({page,context,browser})=>{
  await routes(context);await page.goto('/manifest.webmanifest');
  const old=[false,false,false,true,true].map((correct,i)=>({id:`old-year-${i}`,questionId:catalog.items[0].id+'::event-year',correct,at:`2026-11-09T00:0${i}:00.000Z`,sessionId:'old-session'}));
  await page.evaluate(async({catalog,events})=>{await new Promise<void>((resolve,reject)=>{const r=indexedDB.open('world-history-year-test',1);r.onupgradeneeded=()=>{r.result.createObjectStore('meta');r.result.createObjectStore('reviews',{keyPath:'id'});};r.onerror=()=>reject(r.error);r.onsuccess=()=>{const db=r.result,t=db.transaction(['meta','reviews'],'readwrite');t.objectStore('meta').put(catalog,'catalog');events.forEach(e=>t.objectStore('reviews').add(e));t.oncomplete=()=>{db.close();resolve();};};});},{catalog,events:old});
  await boot(page,context);const beforeCulture=await culture(page);
  await page.locator('[data-year-page-link=ordering]').click();await page.locator('#ordering-options button').click();
  await expect(page.locator('[data-order-item]')).toHaveCount(4);await expect(page.locator('.ordering-result')).toHaveCount(0);
  // No date element or answer exists before grading.
  await expect(page.locator('.ordering-session time')).toHaveCount(0);
  await sortAnswer(page,false);await page.locator('[data-order-action=grade]').evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
  await expect(page.locator('.ordering-result')).toContainText('× 不正解');await expect.poll(async()=>(await snapshot(page)).orderingEvents.length).toBe(1);
  await page.locator('[data-order-action=next]').click();await sortAnswer(page);await page.locator('[data-order-action=grade]').click();await expect(page.locator('.ordering-result')).toContainText('○ 正解');
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>undefined));await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);await page.reload();await expect(page.locator('#ordering-options')).toBeVisible();await expect(page.locator('.ordering-history')).toContainText('累積正答 1 ／ 累積誤答 1');
  await home(page);await page.locator('[data-year-page-link=timeline]').click();await expect(page.locator('.timeline-event')).toHaveCount(460);await context.setOffline(false);
  await page.locator('header [data-nav=settings]').click();await page.locator('[data-year-action=sync]').click();
  const download=page.waitForEvent('download');await page.locator('[data-year-action=backup]').click();const bytes=await readFile((await (await download).path())!);
  const backup=JSON.parse(bytes.toString());expect(backup.schemaVersion).toBe(2);expect(backup.events).toEqual(old);expect(backup.orderingEvents).toHaveLength(2);
  expect(await culture(page)).toEqual(beforeCulture);
  const fresh=await browser.newContext();try{
    await routes(fresh);const other=await fresh.newPage();await other.goto('/');await other.locator('header [data-nav=settings]').click();
    for(let i=0;i<2;i++){await other.locator('#year-restore').setInputFiles({name:'years.json',mimeType:'application/json',buffer:bytes});await expect(other.locator('#toast')).toContainText('統合');}
    const restored=await snapshot(other);expect(restored.events).toEqual(old);expect(restored.orderingEvents).toEqual(backup.orderingEvents);
  }finally{await fresh.close();}
});

test('年表は同年を省略せず表示し、範囲・複数地域・時代・レベルと詳細を正しく参照する',async({page,context})=>{
  await boot(page,context);await page.locator('[data-year-page-link=timeline]').click();await expect(page.locator('.timeline-event')).toHaveCount(460);
  const years=catalog.items.map(x=>Number(x.year));const same=years.find(year=>years.filter(y=>y===year).length>=2)!;
  await expect(page.locator('.timeline-event time').filter({hasText:new RegExp(`^${same}$`)})).toHaveCount(years.filter(y=>y===same).length);
  await page.locator('[name=timelineStart]').fill('1800');await page.locator('[name=timelineEnd]').fill('1850');
  await page.locator('[name=timelineRegion][value="ヨーロッパ"]').check();await page.locator('[name=timelineRegion][value="東アジア"]').check();
  await page.locator('[name=timelineLevel]').selectOption('2');await page.locator('[name=timelineEra]').selectOption('19世紀');await page.locator('#timeline-options button').click();
  const expected=timelineItems(catalog,{regions:['ヨーロッパ','東アジア'],region:'all',era:'19世紀',level:2,start:1800,end:1850});
  expect(expected.length).toBeGreaterThan(0);await expect(page.locator('.timeline-event')).toHaveCount(expected.length);
  const item=expected[0];await page.locator(`.timeline-event[data-timeline-id="${item.id}"]`).click();await expect(page.locator('.timeline-detail')).toContainText(item.event);await expect(page.locator('.timeline-detail')).toContainText(item.explanation);await expect(page.locator('.timeline-detail')).toContainText(item.sources[0].title);
  await page.reload();await expect(page.locator('#timeline-options')).toBeVisible();await page.goBack();await expect(page.getByRole('heading',{name:'年号ホーム',exact:true})).toBeVisible();
});

test('360px・393pxで整序と年表を操作でき、対象不足も安全に表示する',async({page,context})=>{
  await boot(page,context);
  for(const width of [360,393]){
    await page.setViewportSize({width,height:851});await home(page);await page.locator('[data-year-page-link=ordering]').click();
    await page.locator('[name=orderRegion]').selectOption('オセアニア');await expect(page.locator('#ordering-options button')).toBeDisabled();
    await page.locator('[name=orderRegion]').selectOption('ヨーロッパ');await page.locator('[name=orderCount]').selectOption('10');await page.locator('#ordering-options button').click();
    await expect(page.locator('[data-order-item]')).toHaveCount(4);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const buttons=await page.locator('[data-order-move]').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));expect(buttons.every(height=>height>=44)).toBe(true);
    await home(page);await page.locator('[data-year-page-link=timeline]').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const overlaps=await page.locator('.timeline-lane-events').evaluateAll(lanes=>lanes.some(lane=>{const rects=[...lane.querySelectorAll('.timeline-event')].map(el=>el.getBoundingClientRect());return rects.some((a,i)=>rects.slice(i+1).some(b=>a.left<b.right&&b.left<a.right&&a.top<b.bottom&&b.top<a.bottom));}));expect(overlaps).toBe(false);
  }
  expect((await snapshot(page)).orderingEvents).toHaveLength(0);
});

test('年号0件でも整序・年表の空状態を表示できる',async({page,context})=>{
  await routes(context);await context.route('**/year-events.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({...catalog,version:1,items:[]})}));
  await page.goto('/');await page.locator('[data-enter-area=years]').click();
  await page.locator('[data-year-page-link=ordering]').click();await expect(page.locator('#ordering-options button')).toBeDisabled();await expect(page.locator('#ordering-options')).toContainText('不足');
  await home(page);await page.locator('[data-year-page-link=timeline]').click();await expect(page.locator('#timeline-options button')).toBeDisabled();await expect(page.locator('.timeline-event')).toHaveCount(0);await expect(page.locator('.timeline-panel')).toContainText('0件');
});
