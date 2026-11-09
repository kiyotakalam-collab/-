import {test, expect, type Page} from '@playwright/test';
import {mkdir} from 'node:fs/promises';
import {seedCatalog} from '../src/seed';
import {mergeCatalog,selectCards} from '../src/core';
import {readFileSync} from 'node:fs';
import {DEFAULT_FILTER, type Catalog, type ReviewEvent, type StudyFilter} from '../src/types';
const publishedDelta=JSON.parse(readFileSync(new URL('../public/catalog-delta.json',import.meta.url),'utf8'));

// These tests isolate the selector UI from new live textbook publications.
// Real Service Worker and offline recovery remain covered by app/areas.e2e.ts.
test.use({serviceWorkers:'block'});
test.beforeEach(async({context})=>{
  await context.route('**/catalog-delta.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({schemaVersion:1,version:seedCatalog.version,updatedAt:seedCatalog.updatedAt,items:[],cards:[]})}));
  await context.route('**/year-events.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({schemaVersion:1,version:1,updatedAt:'2026-11-09T00:00:00.000Z',items:[]})}));
});
async function setup(page:Page){
  await page.goto('/');
  await page.locator('[data-enter-area=culture]').click();
  await page.locator('.mobile-nav [data-nav=setup]').click();
  await expect(page.locator('#study-options')).toBeVisible();
}
const expected=(patch:Partial<StudyFilter>)=>selectCards(seedCatalog,[],{...structuredClone(DEFAULT_FILTER),...patch});
async function expectCount(page:Page,patch:Partial<StudyFilter>){
  await expect(page.locator('.setup-bottom strong')).toHaveText(`${expected(patch).length} 枚が対象`);
}
async function records(page:Page):Promise<{catalog:Catalog;events:ReviewEvent[]}>{
  return page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('cultural-history-master');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const tx=db.transaction(['meta','events'],'readonly');
    const get=<T>(request:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
    const [catalog,events]=await Promise.all([get(tx.objectStore('meta').get('catalog')),get(tx.objectStore('events').getAll())]);
    db.close();return {catalog,events};
  });
}

test('文化史の通常画面は6地域・欧州6時代にまとまり、細かなテーマは閉じている',async({page})=>{
  await setup(page);
  await expect(page.locator('[name=regionGroups]')).toHaveCount(6);
  const regions=['europe','china','islam','india','other-asia','other'];
  for(const region of regions)await expect(page.locator(`[name=regionGroups][value="${region}"]`)).toHaveCount(1);
  await page.locator('[name=regionGroups][value=europe]').check();
  const eras=[['eu-ancient','古代'],['eu-medieval','中世'],['eu-renaissance','ルネサンス・宗教改革'],['eu-17-18','17〜18世紀'],['eu-19','19世紀'],['eu-20-plus','20世紀以降']];
  await expect(page.locator('[name=eraGroups]')).toHaveCount(6);
  for(const [id,label] of eras){
    const control=page.locator(`[name=eraGroups][value="${id}"]`);
    await expect(control).toHaveCount(1);
    await expect(control.locator('..')).toContainText(label);
  }
  expect(await page.locator('#detail-scope').evaluate(el=>(el as HTMLDetailsElement).open)).toBe(false);
  await expect(page.locator('[name=eras]').first()).not.toBeVisible();
  await expectCount(page,{regionGroups:['europe']});
  await page.locator('[name=eraGroups][value=eu-ancient]').check();
  await expectCount(page,{regionGroups:['europe'],eraGroups:['eu-ancient']});
  await page.locator('[data-action=all-eras]').click();
  await expect(page.locator('[name=eraGroups]:checked')).toHaveCount(0);
  await expectCount(page,{regionGroups:['europe']});
  await page.locator('[name=eraGroups][value=eu-ancient]').check();
  await page.locator('[name=regionGroups][value=europe]').uncheck();
  await expect(page.locator('[name=eraGroups]')).toHaveCount(0);
  await expectCount(page,{});
  await page.locator('[data-action=all-regions]').click();
  await expect(page.locator('[name=regionGroups]:checked')).toHaveCount(0);
  await expectCount(page,{});
});

test('公開済みの東洋文化史の追加を保持し、中国の大区分で出題できる',async({page,context})=>{
  await context.route('**/catalog-delta.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(publishedDelta)}));
  await setup(page);
  const catalog=mergeCatalog(seedCatalog,publishedDelta);
  await expect.poll(async()=>(await records(page)).catalog.version).toBe(catalog.version);
  await page.locator('[name=regionGroups][value=china]').check();
  await expect(page.locator('[name=eraGroups]')).toHaveCount(3);
  await page.locator('[name=eraGroups][value=china-ancient-middle]').check();
  const cards=selectCards(catalog,[],{...DEFAULT_FILTER,regionGroups:['china'],eraGroups:['china-ancient-middle']});
  expect(cards.length).toBeGreaterThan(0);
  await expect(page.locator('.setup-bottom strong')).toHaveText(`${cards.length} 枚が対象`);
  await page.locator('#study-options [type=submit]').click();
  await expect(page.locator('.flashcard h1')).toHaveText(cards[0].question);
  expect((await records(page)).catalog.items).toEqual(catalog.items);
});

test('大区分の時代の和集合と他の条件を組み合わせ、地域変更時に古い時代を残さない',async({page})=>{
  await setup(page);
  const base={regionGroups:['europe']};
  await page.locator('[name=regionGroups][value=europe]').check();
  await page.locator('[name=eraGroups][value=eu-17-18]').check();
  await expectCount(page,{...base,eraGroups:['eu-17-18']});
  await page.locator('[name=eraGroups][value=eu-19]').check();
  const union=expected({...base,eraGroups:['eu-17-18','eu-19']});
  const separate=expected({...base,eraGroups:['eu-17-18']}).length+expected({...base,eraGroups:['eu-19']}).length;
  expect(union.length).toBeLessThan(separate);
  expect(new Set(union.map(card=>card.id)).size).toBe(union.length);
  await expectCount(page,{...base,eraGroups:['eu-17-18','eu-19']});
  await page.locator('[name=level][value="3"]').check();
  await page.locator('[name=levelMode][value=single]').check();
  await page.locator('#field-scope').evaluate(el=>{(el as HTMLDetailsElement).open=true;});
  await page.locator('[name=fields][value="文学"]').check();
  await page.locator('[name=cardType]').selectOption('text');
  const combined:Partial<StudyFilter>={...base,eraGroups:['eu-17-18','eu-19'],level:3,levelMode:'single',fields:['文学'],cardType:'text'};
  await expectCount(page,combined);
  await page.locator('[name=mode]').selectOption('unseen');
  await expectCount(page,{...combined,mode:'unseen'});
  await page.locator('[name=regionGroups][value=europe]').uncheck();
  await page.locator('[name=regionGroups][value=china]').check();
  await expect(page.locator('[name=eraGroups][value^=eu-]')).toHaveCount(0);
  await expect(page.locator('[name=eraGroups]:checked')).toHaveCount(0);
  await expect(page.locator('#study-options [type=submit]')).toBeDisabled();
  await expect(page.locator('.setup-bottom strong')).toHaveText('0 枚が対象');
});

test('範囲選択で元の時代タグと回答履歴を変更せず、360pxと393pxで押せる',async({page})=>{
  await setup(page);
  const before=await records(page);
  await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('cultural-history-master');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const tx=db.transaction('events','readwrite');
    tx.objectStore('events').add({id:'scope-preserved-wrong',cardId:'gr-homer-iliad-author',correct:false,reviewedAt:'2026-11-09T01:00:00.000Z',sessionId:'scope-session'});
    await new Promise<void>((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
  });
  await setup(page);
  const learned=await records(page);
  for(const width of [360,393]){
    await page.setViewportSize({width,height:851});
    await page.locator('[data-action=all-regions]').click();
    await page.locator('[name=regionGroups][value=europe]').check();
    for(const id of ['eu-ancient','eu-19'])await page.locator(`[name=eraGroups][value="${id}"]`).check();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const control of await page.locator('[name=regionGroups], [name=eraGroups]').all()){
      const box=await control.evaluate(el=>{const r=el.closest('label')!.getBoundingClientRect();return {width:r.width,height:r.height};});
      expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
  const after=await records(page);
  expect(after.catalog).toEqual(before.catalog);
  expect(after.events).toEqual(learned.events);
  expect(after.events).toHaveLength(1);
  await page.locator('[data-action=all-eras]').click();
  await page.locator('[data-action=all-regions]').click();
  await expectCount(page,{});
  await mkdir('artifacts',{recursive:true});
  await page.addStyleTag({content:'#toast{display:none!important}'});
  await page.locator('[name=regionGroups][value=europe]').check();
  await page.screenshot({path:'artifacts/scope-mobile.png',fullPage:true});
});
