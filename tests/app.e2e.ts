import { test, expect, chromium, type Page, type BrowserContext } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { resolve, extname } from 'node:path';
import { DEFAULT_FILTER, type Catalog, type ReviewEvent, type StudyFilter } from '../src/types';
import { selectCards } from '../src/core';
const totalFor = (patch: Partial<StudyFilter>) => selectCards(seedCatalog, [], {...DEFAULT_FILTER, ...patch}).length;
import { seedCatalog } from '../src/seed';

async function stableCultureFixture(context:BrowserContext){
  // These regressions exercise the bundled curriculum, independently of live
  // publications. scope.e2e.ts separately loads the actual published delta.
  await context.route('**/catalog-delta.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({schemaVersion:1,version:seedCatalog.version,updatedAt:seedCatalog.updatedAt,items:[],cards:[]})}));
}
test.beforeEach(async({context})=>{await stableCultureFixture(context);});

async function boot(page: Page) {
  await page.goto('/');
  await enterCulture(page);
}
async function enterCulture(page: Page) {
  await expect(page.getByRole('heading', { name: '世界史学習マスター', exact: true })).toBeVisible();
  await page.locator('[data-enter-area="culture"]').click();
  await expect(page.getByRole('heading', { name: '今日も、ひとつ先の知識へ。' })).toBeVisible();
}
async function nav(page: Page, view: string) {
  if (await page.locator('[data-enter-area="culture"]').isVisible()) await enterCulture(page);
  if (view !== 'settings' && !await page.locator('.mobile-nav').count()) {
    await page.locator('header [data-nav="portal"]').click();
    await enterCulture(page);
  }
  await page.locator(view === 'settings' ? 'header [data-nav="settings"]' : `.mobile-nav [data-nav="${view}"]`).click();
}
async function records(page: Page): Promise<{catalog: Catalog; events: ReviewEvent[]}> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('cultural-history-master'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    const tx = db.transaction(['meta', 'events'], 'readonly');
    const get = <T>(r: IDBRequest<T>) => new Promise<T>((resolve,reject) => {r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const [catalog, events] = await Promise.all([get(tx.objectStore('meta').get('catalog')), get(tx.objectStore('events').getAll())]);
    db.close(); return {catalog, events};
  });
}
async function detailScope(page: Page) {
  const detail=page.locator('#detail-scope');
  if(!await detail.evaluate(el=>(el as HTMLDetailsElement).open))await detail.locator('summary').click();
}
async function imageSession(page: Page) {
  await nav(page, 'setup');
  await detailScope(page);
  await page.locator('[name=regions][value="ギリシア"]').check();
  await page.locator('#field-scope').evaluate(el=>{(el as HTMLDetailsElement).open=true;});
  await page.locator('[name=fields][value="建築"]').check();
  await page.locator('[name=cardType]').selectOption('image');
  await page.locator('#study-options [type=submit]').click();
  await expect(page.locator('.flashcard')).toBeVisible();
}
async function grade(page: Page, correct: boolean) {
  await page.locator('[data-action=reveal]').click();
  await expect(page.locator('.answer-area')).toBeVisible();
  await page.locator(`[data-grade=${correct ? 'correct' : 'wrong'}]`).click();
  await expect(page.getByRole('heading', { name: 'おつかれさまでした。' })).toBeVisible();
}
async function readyWorker(page: Page) {
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
}


test('文化史の出題方向を独立して選択し、同じ作者の連続を避ける', async ({page}) => {
  await boot(page); await nav(page,'setup');
  const select=page.locator('[name=cardDirection]');
  await expect(select).toHaveValue('all');
  await select.selectOption('person-work');
  await expect(page.locator('.setup-bottom strong')).toHaveText(`${totalFor({cardDirection:'person-work'})} 枚が対象`);
  await select.selectOption('work-author');
  await expect(page.locator('.setup-bottom strong')).toHaveText(`${totalFor({cardDirection:'work-author'})} 枚が対象`);
  await page.locator('#study-options [type=submit]').click();
  await expect(page.locator('.flashcard h1')).toContainText('イリアス');
  await page.locator('[data-action=reveal]').click();
  await expect(page.locator('.answer-area h2')).toHaveText('ホメロス');
  await page.locator('[data-grade=correct]').click();
  await expect(page.locator('.flashcard h1')).toBeVisible();
  await page.locator('[data-action=reveal]').click();
  await expect(page.locator('.answer-area h2')).not.toHaveText('ホメロス');
  const saved=await records(page);
  expect(saved.events).toHaveLength(1);
  expect(saved.events[0].cardId).toBe('gr-homer-iliad-author');
  await page.locator('[data-action=end-session]').click();
  await nav(page,'setup');
  await expect(page.locator('[name=cardDirection]')).toHaveValue('work-author');
  await page.locator('[data-action=reset-filter]').click();
  await expect(page.locator('[name=cardDirection]')).toHaveValue('all');
  expect((await records(page)).events).toEqual(saved.events);
});

test('Android相当の全画面・絞り込み・正誤履歴・二重タップ防止・再起動', async ({page}) => {
  await boot(page);
  for (const view of ['home','setup','library','history','settings']) {
    await nav(page, view);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await nav(page, 'setup');
  await page.locator('[name=level][value="4"]').check();
  await expect(page.locator('.setup-bottom strong')).toHaveText(`${seedCatalog.cards.length} 枚が対象`);
  await page.locator('[name=levelMode][value=single]').check();
  await expect(page.locator('.setup-bottom strong')).toHaveText(`${totalFor({level: 4,levelMode: 'single'})} 枚が対象`);
  await detailScope(page);
  await page.locator('[name=regions][value="東地中海"]').check();
  await page.locator('#field-scope').evaluate(el=>{(el as HTMLDetailsElement).open=true;});
  await page.locator('[name=fields][value="科学"]').check();
  await expect(page.locator('.setup-bottom strong')).toHaveText('2 枚が対象');
  await page.locator('[name=eras][value="古代ローマ"]').check();
  await expect(page.locator('.setup-bottom strong')).toHaveText('0 枚が対象');
  await expect(page.locator('#study-options [type=submit]')).toBeDisabled();
  await page.locator('[data-action=reset-filter]').click();
  await imageSession(page);
  await page.locator('[data-action=reveal]').click();
  await page.locator('[data-grade=wrong]').evaluate(el => { (el as HTMLButtonElement).click(); (el as HTMLButtonElement).click(); });
  await expect(page.getByRole('heading', { name: 'おつかれさまでした。' })).toBeVisible();
  expect((await records(page)).events).toHaveLength(1);
  await imageSession(page);
  await expect(page.locator('.card-past')).toContainText('誤答 1');
  await grade(page, true);
  const before = await records(page);
  expect(before.events.slice().sort((a,b)=>a.reviewedAt.localeCompare(b.reviewedAt)).map(e=>e.correct)).toEqual([false,true]);
  await nav(page, 'history');
  await page.locator('#history-sort').selectOption('wrong');
  await expect(page.locator('.wrong-count')).toHaveText('1');
  await page.locator('.history-card summary').click();
  await expect(page.locator('.history-summary')).toContainText('累積正答 1回');
  await expect(page.locator('.history-summary')).toContainText('連続正答 1回');
  await expect(page.locator('.event-list li')).toHaveCount(2);
  await expect(page.locator('.event-list li').first()).toContainText('○ 正答');
  await expect(page.locator('.event-list li').last()).toContainText('× 誤答');
  await page.reload();
  await nav(page, 'history');
  await expect(page.locator('.wrong-count')).toHaveText('1');
  expect((await records(page)).events).toEqual(before.events);
});

test('画像を拡大しても問題面で解答を表示しない', async ({page}) => {
  await boot(page); await imageSession(page);
  await expect(page.locator('#question-image')).toBeVisible();
  expect(await page.locator('#question-image').evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.locator('[data-action=zoom-image]').click();
  await expect(page.locator('#image-dialog')).toBeVisible();
  await expect(page.locator('#image-dialog-content')).not.toContainText('パルテノン神殿');
  await page.getByRole('button', { name: '画像を閉じる' }).click();
  await grade(page, true);
});

test('文字問題のみの1枚を表示・解答・正答記録できる', async ({page}) => {
  await boot(page);await nav(page,'setup');
  await page.locator('[name=level][value="4"]').check();
  await page.locator('[name=levelMode][value=single]').check();
  await detailScope(page);
  await page.locator('[name=regions][value="ローマ"]').check();
  await page.locator('#field-scope').evaluate(el=>{(el as HTMLDetailsElement).open=true;});
  await page.locator('[name=fields][value="哲学・思想"]').check();
  await page.locator('[name=cardType]').selectOption('text');
  await expect(page.locator('.setup-bottom strong')).toHaveText('1 枚が対象');
  await page.locator('#study-options [type=submit]').click();
  await expect(page.locator('.flashcard')).toBeVisible();
  await expect(page.locator('#question-image')).toHaveCount(0);
  await page.locator('[data-action=reveal]').click();
  await expect(page.locator('.answer-area h2')).toHaveText('ルクレティウス');
  await page.locator('[data-grade=correct]').click();
  await expect(page.getByRole('heading',{name:'おつかれさまでした。'})).toBeVisible();
  const saved=await records(page);expect(saved.events).toHaveLength(1);
  expect(saved.events[0]).toMatchObject({cardId:'ro-lucretius-nature-author',correct:true});
});

test('大きなレベル選択で累積・単独を切り替え、他条件の変更後も選択を維持する', async ({page}) => {
  await boot(page);await nav(page,'setup');
  await expect(page.locator('input[name=level]')).toHaveCount(5);
  await expect(page.locator('[name=level][value=all]')).toBeChecked();
  for(const input of await page.locator('input[name=level]').all()){
    const size=await input.evaluate(el=>{
      const label=el.closest('label');
      if(!label)throw new Error('Level control has no associated tile label');
      const r=label.getBoundingClientRect();return {width:r.width,height:r.height};
    });
    expect(size.height).toBeGreaterThanOrEqual(48);
    expect(size.width).toBeGreaterThanOrEqual(48);
  }
  await page.locator('[name=level][value="1"]').check();
  await expect(page.locator('[name=level][value="1"]')).toBeFocused();
  await page.locator('[name=level][value="1"]').press('ArrowRight');
  await expect(page.locator('[name=level][value="2"]')).toBeChecked();
  await expect(page.locator('[name=level][value="2"]')).toBeFocused();
  await page.locator('[name=level][value="1"]').check();
  await page.locator('[name=levelMode][value=single]').check();
  await expect(page.locator('.setup-bottom strong')).toHaveText(`${totalFor({level: 1,levelMode: 'single'})} 枚が対象`);
  await page.locator('[name=levelMode][value=cumulative]').check();
  await expect(page.locator('.setup-bottom strong')).toHaveText(`${totalFor({level: 1,levelMode: 'single'})} 枚が対象`);
  await page.locator('[name=level][value="4"]').check();
  await expect(page.locator('.setup-bottom strong')).toHaveText(`${seedCatalog.cards.length} 枚が対象`);
  await page.locator('[name=levelMode][value=single]').check();
  await expect(page.locator('.setup-bottom strong')).toHaveText(`${totalFor({level: 4,levelMode: 'single'})} 枚が対象`);
  await detailScope(page);
  await page.locator('[name=regions][value="東地中海"]').check();
  await expect(page.locator('[name=level][value="4"]')).toBeChecked();
  await expect(page.locator('[name=levelMode][value=single]')).toBeChecked();
  await expect(page.locator('.setup-bottom strong')).toHaveText('2 枚が対象');
  await page.locator('[data-action=reset-filter]').click();
  await expect(page.locator('[name=level][value=all]')).toBeChecked();
  await expect(page.locator('.setup-bottom strong')).toHaveText(`${seedCatalog.cards.length} 枚が対象`);
  await page.locator('[name=level][value="4"]').check();
  await mkdir('artifacts',{recursive:true});
  for(const width of [393,360]){
    await page.setViewportSize({width,height:851});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.setViewportSize({width:393,height:851});
  await page.screenshot({path:'artifacts/levels-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'artifacts/levels-desktop.png',fullPage:true});
});

test('旧版で学習済みの端末でも問題文だけを更新し、累積誤答と全回答を保持する', async ({page}) => {
  // Isolate the bundled-data migration from a newer live mirror publication.
  await page.route('**/catalog-delta.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({schemaVersion:1,version:seedCatalog.version,updatedAt:seedCatalog.updatedAt,items:[],cards:[]})}));
  const originalQuestion='叙事詩『イリアス』の作者と伝統的にされる古代ギリシアの詩人は？';
  const homer=structuredClone(seedCatalog.items.find(item=>item.id==='gr-homer')!);
  const oldCard={...structuredClone(seedCatalog.cards.find(card=>card.id==='gr-homer-iliad-author')!),question:originalQuestion,version:1,updatedAt:'2026-11-09T00:00:00.000Z'};
  const oldCatalog:Catalog={schemaVersion:1,version:1,updatedAt:'2026-11-09T00:00:00.000Z',items:[homer],cards:[oldCard]};
  const oldEvents:ReviewEvent[]=[
    {id:'old-wrong',cardId:oldCard.id,correct:false,reviewedAt:'2026-11-09T01:00:00.000Z',sessionId:'old-session'},
    {id:'old-correct',cardId:oldCard.id,correct:true,reviewedAt:'2026-11-09T01:01:00.000Z',sessionId:'old-session'},
  ];
  // Establish the same origin without loading app scripts, then seed a real v1 DB.
  await page.goto('/manifest.webmanifest');
  await page.evaluate(async({catalog,events})=>{
    await new Promise<void>((resolve,reject)=>{
      const request=indexedDB.open('cultural-history-master',1);
      request.onupgradeneeded=()=>{
        request.result.createObjectStore('meta');
        request.result.createObjectStore('events',{keyPath:'id'});
      };
      request.onerror=()=>reject(request.error);
      request.onsuccess=()=>{
        const db=request.result,tx=db.transaction(['meta','events'],'readwrite');
        tx.objectStore('meta').put(catalog,'catalog');
        tx.objectStore('meta').put({syncUrl:'',lastSyncAt:null,lastBackupAt:null,dailyGoal:20},'settings');
        events.forEach(event=>tx.objectStore('events').add(event));
        tx.oncomplete=()=>{db.close();resolve();};
        tx.onabort=()=>{db.close();reject(tx.error);};
      };
    });
  },{catalog:oldCatalog,events:oldEvents});
  await boot(page);
  const upgraded=await records(page);
  expect(upgraded.catalog.version).toBe(seedCatalog.version);
  expect(upgraded.catalog.cards.find(card=>card.id===oldCard.id)?.question).toBe('『イリアス』の作者とされる人物は？');
  expect(upgraded.events.slice().sort((a,b)=>a.reviewedAt.localeCompare(b.reviewedAt))).toEqual(oldEvents);
  await nav(page,'history');
  await expect(page.locator('.wrong-count')).toHaveText('1');
  await page.locator('.history-card summary').click();
  await expect(page.locator('.history-summary')).toContainText('累積正答 1回');
  await expect(page.locator('.event-list li')).toHaveCount(2);
  await nav(page,'setup');
  await page.locator('[name=cardType]').selectOption('text');
  await page.locator('#study-options [type=submit]').click();
  await expect(page.locator('.flashcard h1')).toHaveText('『イリアス』の作者とされる人物は？');
  await page.locator('[data-action=reveal]').click();
  await expect(page.locator('.answer-area h2')).toHaveText('ホメロス');
  await expect(page.locator('.card-past')).toContainText('誤答 1');
});

test('JSONダウンロードを別端末相当の空DBに復元して全回答を復旧・再復元で重複しない', async ({page,browser}) => {
  await boot(page); await imageSession(page); await grade(page, false);
  await imageSession(page); await grade(page, true);
  const original = await records(page);
  await nav(page, 'settings');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-action=backup]').click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const bytes = await readFile(path!);
  const backup = JSON.parse(bytes.toString());
  expect(backup.events).toEqual(original.events);
  const fresh = await browser.newContext({viewport:{width:393,height:851}, isMobile:true,hasTouch:true});
  await stableCultureFixture(fresh);
  const other=await fresh.newPage();
  await boot(other); await nav(other,'settings');
  await other.locator('#restore-file').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:bytes});
  await expect(other.locator('#toast')).toContainText('復元しました。2回');
  const restored=await records(other);
  expect(restored.events).toEqual(original.events);
  expect(restored.catalog).toEqual(original.catalog);
  await other.locator('#restore-file').setInputFiles({name:'backup-again.json',mimeType:'application/json',buffer:bytes});
  await expect(other.locator('#toast')).toContainText('復元しました。2回');
  expect((await records(other)).events).toEqual(original.events);
  await other.locator('#restore-file').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{broken')});
  await expect(other.locator('#toast')).toContainText('復元できませんでした');
  expect((await records(other)).events).toEqual(original.events);
  await fresh.close();
});

test.describe('公開JSON同期の通信フィクスチャ',()=>{
// Playwright network routes cannot intercept requests owned by an installed SW.
// Worker/offline behavior is covered separately below using the real worker.
test.use({serviceWorkers:'block'});
test('同期失敗時は学習を続行し、再接続・起動時に同期しても学習履歴を保持', async ({page,context}) => {
  await context.route('**/catalog-delta.json*',route=>route.abort());
  await boot(page); await imageSession(page); await grade(page,false);
  const original=await records(page);
  const incoming=structuredClone(original.catalog);
  incoming.version=original.catalog.version+1;
  incoming.updatedAt='2026-11-10T00:00:00.000Z';
  incoming.items.push({...incoming.items[0],id:'test-extra',canonicalName:'試験用追加項目',aliases:[],version:1});
  incoming.cards.push({...incoming.cards[0],id:'test-extra-card',knowledgeId:'test-extra',question:'テスト用の追加カード',version:1});
  let failing=true, requests=0;
  await context.route('**/test-catalog.json',async route=>{requests++;await route.fulfill(failing?{status:503,body:'unavailable'}:{status:200,contentType:'application/json',body:JSON.stringify(incoming)});});
  await nav(page,'settings');
  await page.locator('[name=syncUrl]').fill('http://127.0.0.1:4173/test-catalog.json');
  await page.locator('#sync-form [type=submit]').click();
  await expect(page.locator('#sync-form + .sync-state')).toContainText('同期できませんでした');
  expect((await records(page)).catalog).toEqual(original.catalog);
  await imageSession(page); await grade(page,true);
  const learned=await records(page);
  failing=false;
  await context.setOffline(true);
  await page.waitForFunction(()=>!navigator.onLine);
  await context.setOffline(false);
  await expect.poll(async()=>(await records(page)).catalog.version).toBe(incoming.version);
  expect((await records(page)).events).toEqual(learned.events);
  expect((await records(page)).catalog.items).toHaveLength(original.catalog.items.length+1);
  const count=requests;
  await page.reload();
  await expect.poll(()=>requests).toBeGreaterThan(count);
  await expect.poll(async()=>(await records(page)).events.length).toBe(2);
  await nav(page,'settings');
  await expect(page.locator('#sync-form + .sync-state')).toContainText('同期完了');
});

test('学習途中の再接続同期を終了まで待ち、出題停止後も回答履歴を保持', async ({page,context}) => {
  await context.route('**/catalog-delta.json*',route=>route.abort());
  await boot(page);
  const original=(await records(page)).catalog;
  const incoming=structuredClone(original);
  incoming.version=original.version+1;incoming.updatedAt='2026-11-10T00:00:00.000Z';
  const target=incoming.cards.find(c=>c.type==='image')!;
  target.deleted=true;target.version++;target.updatedAt=incoming.updatedAt;
  let publishDeletion=false,requests=0;
  await context.route('**/deferred-catalog.json',async route=>{requests++;await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(publishDeletion?incoming:original)});});
  await nav(page,'settings');
  await page.locator('[name=syncUrl]').fill('http://127.0.0.1:4173/deferred-catalog.json');
  await page.locator('#sync-form [type=submit]').click();
  await expect(page.locator('#sync-form + .sync-state')).toContainText('同期完了');
  await imageSession(page);
  const count=requests;publishDeletion=true;
  await context.setOffline(true);await page.waitForFunction(()=>!navigator.onLine);
  await context.setOffline(false);await page.waitForFunction(()=>navigator.onLine);
  await page.evaluate(()=>new Promise(requestAnimationFrame));
  expect(requests).toBe(count);
  expect((await records(page)).catalog.version).toBe(original.version);
  await grade(page,false);
  await nav(page,'home');
  await expect.poll(async()=>(await records(page)).catalog.version).toBe(incoming.version);
  const saved=await records(page);
  expect(saved.events).toHaveLength(1);
  expect(saved.events[0].cardId).toBe(target.id);
  expect(saved.catalog.cards.find(c=>c.id===target.id)?.deleted).toBe(true);
  await expect(page.locator('.today-panel .daily-ring strong')).toHaveText('1 / 20');
  await expect(page.locator('.stats-grid .stat-card').nth(2)).toContainText('1回の回答から集計');
  await nav(page,'history');
  await expect(page.locator('.history-card')).toContainText('出題停止');
  await expect(page.locator('.wrong-count')).toHaveText('1');
});
});

test('Service Workerによる完全オフライン再起動・画像表示とManifestの構文確認', async ({page,context}) => {
  await boot(page); await readyWorker(page);
  const cdp=await context.newCDPSession(page);
  const manifest=await cdp.send('Page.getAppManifest');
  expect(manifest.url).toContain('manifest.webmanifest');
  expect(manifest.errors).toEqual([]);
  await imageSession(page); await grade(page,false);
  const before=await records(page);
  await context.setOffline(true);
  await page.reload();
  await enterCulture(page);
  await imageSession(page);
  await expect(page.locator('#question-image')).toBeVisible();
  await expect.poll(()=>page.locator('#question-image').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await grade(page,true);
  expect((await records(page)).events).toHaveLength(before.events.length+1);
  await context.setOffline(false);
  await page.reload();
  expect((await records(page)).events).toHaveLength(2);
});

test('通常のChromiumプロファイルでPWAインストール適格性エラーがない', async ({},testInfo) => {
  // Browser fixtures use incognito profiles, where installation is prohibited.
  const persistent=await chromium.launchPersistentContext(testInfo.outputPath('install-profile'),{
    headless:true,executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox'],
    baseURL:'http://127.0.0.1:4173',viewport:{width:393,height:851},isMobile:true,hasTouch:true,
  });
  try{
    const page=await persistent.newPage();await boot(page);await readyWorker(page);
    const cdp=await persistent.newCDPSession(page);
    const result=await cdp.send('Page.getInstallabilityErrors');
    expect(result.installabilityErrors).toEqual([]);
  }finally{await persistent.close();}
});

test('アプリのService Worker更新・再起動でもIndexedDBの履歴を保持', async ({page}) => {
  await boot(page); await readyWorker(page);
  await imageSession(page); await grade(page,false);
  const before=await records(page);
  // Re-registering a fresh copy at a cache-busted script URL installs an actual worker
  // while retaining the same scope and production application/cache implementation.
  await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.register('./sw.js?update-check=2',{scope:'./'});
    await registration.update();
    const worker=registration.installing||registration.waiting;
    if(worker && worker.state!=='installed')await new Promise<void>(resolve=>worker.addEventListener('statechange',()=>{if(worker.state==='installed')resolve();}));
    const waiting=registration.waiting;
    if(waiting){const changed=new Promise<void>(resolve=>navigator.serviceWorker.addEventListener('controllerchange',()=>resolve(),{once:true}));waiting.postMessage({type:'SKIP_WAITING'});await changed;}
  });
  await page.reload();
  expect((await records(page)).events).toEqual(before.events);
  await nav(page,'history');await expect(page.locator('.wrong-count')).toHaveText('1');
});

test('GitHub Pages相当のサブディレクトリで起動・SWスコープ・オフライン画像を確認', async ({browser}) => {
  const root=resolve('dist');
  const mime:Record<string,string>={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webmanifest':'application/manifest+json'};
  const server=createServer(async(req,res)=>{
    const pathname=new URL(req.url||'/', 'http://localhost').pathname;
    if(!pathname.startsWith('/culture/')){res.writeHead(404).end();return;}
    const file=resolve(root,pathname.slice('/culture/'.length)||'index.html');
    if(!file.startsWith(root+'/')){res.writeHead(403).end();return;}
    try{const bytes=await readFile(file);res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Vary':'Origin'}).end(bytes);}
    catch{res.writeHead(404).end();}
  });
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();if(!address||typeof address==='string')throw new Error('local server address unavailable');
  const context=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true});
  await stableCultureFixture(context);
  try{
    const page=await context.newPage();
    await page.goto(`http://127.0.0.1:${address.port}/culture/`);
    await enterCulture(page);
    await readyWorker(page);
    expect(await page.evaluate(async()=> (await navigator.serviceWorker.ready).scope)).toBe(`http://127.0.0.1:${address.port}/culture/`);
    await context.setOffline(true);await page.reload();
    await enterCulture(page);
    await imageSession(page);
    await expect.poll(()=>page.locator('#question-image').evaluate(el=>(el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await grade(page,true);
    expect((await records(page)).events).toHaveLength(1);
  }finally{await context.close();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});

test.describe('画像ロード失敗',()=>{
  test.use({serviceWorkers:'block'});
  test('取得できない画像を代替問題文へ置き換えて学習できる',async({page})=>{
    await page.route('**/images/parthenon.jpg',route=>route.abort());
    await boot(page);await imageSession(page);
    await expect(page.locator('#image-fallback')).toBeVisible();
    await expect(page.locator('#image-fallback')).toContainText('アテネのアクロポリス');
    await grade(page,true);
    expect((await records(page)).events).toHaveLength(1);
  });
});

test('デスクトップ・Android相当の画面を実データで撮影',async({page})=>{
  await mkdir('artifacts',{recursive:true});
  await boot(page);
  await page.screenshot({path:'artifacts/mobile.png',fullPage:true});
  await imageSession(page);
  await page.screenshot({path:'artifacts/study-mobile.png',fullPage:true});
  await nav(page,'home');
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'artifacts/desktop.png',fullPage:true});
});
