import {test,expect,chromium,type BrowserContext,type Page} from '@playwright/test';
import {readFile,mkdir} from 'node:fs/promises';
import {readFileSync,existsSync} from 'node:fs';
import {mergeCatalog,getProgress} from '../src/core';
import {seedCatalog} from '../src/seed';
import {validateRelations} from '../src/culture-relations';
import {prepareComparison} from '../src/culture-compare';
import {buildCultureGraph} from '../src/culture-graph';
import type {Catalog,ReviewEvent} from '../src/types';
import type {ComparisonEvent,CultureRelations} from '../src/culture-feature-types';
import type {DailyPlan} from '../src/culture-daily';

const delta=JSON.parse(readFileSync(new URL('../public/catalog-delta.json',import.meta.url),'utf8'));
const catalog=mergeCatalog(seedCatalog,delta);
const relations=validateRelations(JSON.parse(readFileSync(new URL('../public/culture-relations.json',import.meta.url),'utf8')));
const set=relations.comparisonSets.find(s=>s.id==='cmp-ming-practical')!;
const prepared=prepareComparison(set,relations.relations,catalog,'browser-test');
const fixedNow='2026-11-10T03:00:00.000Z'; // Noon in Japan, same local day after restart.
type Snapshot={version:number;catalog:Catalog;events:ReviewEvent[];comparisons:ComparisonEvent[];relations:CultureRelations|null;plans:DailyPlan[]};

async function endpoints(context:BrowserContext,options:{relations?:CultureRelations;badRelations?:()=>boolean}={}){
  await context.route('**/catalog-delta.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(delta)}));
  await context.route('**/culture-relations.json*',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(options.badRelations?.()?{schemaVersion:999}:options.relations??relations)}));
  // Existing year synchronisation must not mutate the sentinel database in these tests.
  await context.route('https://raw.githubusercontent.com/**/year-events.json*',r=>r.fulfill({status:503,body:'year fixture unavailable'}));
}
async function snapshot(page:Page):Promise<Snapshot>{
  return page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('cultural-history-master');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const tx=db.transaction(['meta','events','comparisonEvents'],'readonly');
    const get=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const [catalog,events,comparisons,relations,keys,values]=await Promise.all([get(tx.objectStore('meta').get('catalog')),get(tx.objectStore('events').getAll()),get(tx.objectStore('comparisonEvents').getAll()),get(tx.objectStore('meta').get('cultureRelations')),get(tx.objectStore('meta').getAllKeys()),get(tx.objectStore('meta').getAll())]);
    const version=db.version;db.close();return {version,catalog,events,comparisons,relations:relations??null,plans:values.filter((_,i)=>String(keys[i]).startsWith('dailyPlan:'))};
  });
}
async function yearSnapshot(page:Page){
  return page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('world-history-year-test');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const tx=db.transaction(['meta','reviews'],'readonly');
    const get=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const [meta,keys,reviews]=await Promise.all([get(tx.objectStore('meta').getAll()),get(tx.objectStore('meta').getAllKeys()),get(tx.objectStore('reviews').getAll())]);db.close();return {keys,meta,reviews};
  });
}
async function enterCulture(page:Page){
  await expect(page.locator('[data-enter-area=culture]')).toBeVisible();
  await page.locator('[data-enter-area=culture]').click();
  await expect(page.getByRole('heading',{name:'今日も、ひとつ先の知識へ。',exact:true})).toBeVisible();
}
async function boot(page:Page){
  await page.goto('/');await enterCulture(page);
  await expect.poll(async()=>(await snapshot(page)).catalog.version).toBe(catalog.version);
  await expect.poll(async()=>(await snapshot(page)).relations?.version).toBe(relations.version);
  await expect(page.locator('#daily-recommendations')).toBeVisible();
  await expect.poll(async()=>(await snapshot(page)).plans.length).toBeGreaterThan(0);
}
async function home(page:Page){await page.locator('.mobile-nav [data-nav=home]').click();await expect(page.locator('#daily-recommendations')).toBeVisible();}
async function openCompare(page:Page,id=set.id){
  await home(page);await page.locator('[data-nav=compare]').click();
  await page.locator(`[data-comparison-start="${id}"]`).click();
  await expect(page.locator('[data-comparison-answer]')).toHaveCount(set.relationIds.length);
}
async function choose(page:Page,correct:boolean){
  for(const p of prepared.pairs)await page.locator(`[data-comparison-answer="${p.relationId}"]`).selectOption('');
  for(const [index,p] of prepared.pairs.entries()){
    const target=correct?p.targetKnowledgeId:prepared.pairs[(index+1)%prepared.pairs.length].targetKnowledgeId;
    await page.locator(`[data-comparison-answer="${p.relationId}"]`).selectOption(target);
  }
}
async function submitComparison(page:Page,correct:boolean){
  await choose(page,correct);await page.locator('[data-comparison-action=grade]').click();
  await expect(page.locator('.comparison-result-summary')).toContainText(`${correct?prepared.pairs.length:0} / ${prepared.pairs.length}`);
}
async function openGraph(page:Page,id?:string){
  await home(page);await page.locator('[data-nav=graph]').click();
  await expect(page.locator('#culture-graph')).toBeVisible();
  if(id){const item=catalog.items.find(i=>i.id===id)!;await page.locator('#culture-graph-search').fill(item.canonicalName);await page.locator(`[data-graph-center="${id}"]`).click();}
}
async function gradeNormal(page:Page,correct=true){
  await page.locator('[data-action=reveal]').click();
  await page.locator(`[data-grade=${correct?'correct':'wrong'}]`).click();
}
async function seedVersion2(page:Page){
  const target=catalog.cards.find(c=>c.id==='gr-homer-iliad-author')!;
  const events:ReviewEvent[]=[false,false,false,true,true].map((correct,index)=>({id:`protected-normal-${index}`,cardId:target.id,correct,sessionId:'old-normal-session',reviewedAt:`2026-11-10T00:0${index}:00.000Z`}));
  await page.goto('/manifest.webmanifest');
  await page.evaluate(async({catalog,events})=>{
    await new Promise<void>((resolve,reject)=>{
      const request=indexedDB.open('cultural-history-master',2);
      request.onupgradeneeded=()=>{const db=request.result;db.createObjectStore('meta');const store=db.createObjectStore('events',{keyPath:'id'});store.createIndex('cardId','cardId');store.createIndex('reviewedAt','reviewedAt');};
      request.onsuccess=()=>{const db=request.result,tx=db.transaction(['meta','events'],'readwrite');tx.objectStore('meta').put(catalog,'catalog');tx.objectStore('meta').put({syncUrl:'',lastSyncAt:null,lastBackupAt:null,dailyGoal:20},'settings');events.forEach(event=>tx.objectStore('events').add(event));tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};request.onerror=()=>reject(request.error);
    });
    await new Promise<void>((resolve,reject)=>{
      const request=indexedDB.open('world-history-year-test',1);
      request.onupgradeneeded=()=>{request.result.createObjectStore('meta');request.result.createObjectStore('reviews',{keyPath:'id'});};
      request.onsuccess=()=>{const db=request.result,tx=db.transaction(['meta','reviews'],'readwrite');tx.objectStore('meta').put({schemaVersion:1,version:1,updatedAt:'2026-11-09T00:00:00.000Z',items:[]},'catalog');tx.objectStore('meta').put('protected year metadata','sentinel');tx.objectStore('reviews').add({id:'protected-year-answer',questionId:'old-year::event-year',correct:false,at:'2026-11-09T01:00:00.000Z',sessionId:'old-year-session'});tx.oncomplete=()=>{db.close();resolve();};tx.onabort=()=>reject(tx.error);};request.onerror=()=>reject(request.error);
    });
  },{catalog,events});
  return {target,events};
}

test('旧DB v2の3誤答・2正答を、3機能・再起動・同期・別DBへの復元後も保持する',async({browser},testInfo)=>{
  const profile=testInfo.outputPath('protected-profile');
  const launch=()=>chromium.launchPersistentContext(profile,{headless:true,baseURL:'http://127.0.0.1:4173',viewport:{width:393,height:851},isMobile:true,hasTouch:true,locale:'ja-JP',timezoneId:'Asia/Tokyo',executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
  let context=await launch();
  try{
    await endpoints(context);let page=context.pages()[0]??await context.newPage();await page.clock.install({time:new Date(fixedNow)});
    const legacy=await seedVersion2(page),yearBefore=await yearSnapshot(page);
    await boot(page);expect((await snapshot(page)).version).toBe(3);
    await openCompare(page);await submitComparison(page,false);
    await page.locator('[data-comparison-action=retry]').click();await submitComparison(page,true);
    let saved=await snapshot(page);expect(saved.comparisons).toHaveLength(6);
    expect(saved.comparisons.filter(e=>!e.correct)).toHaveLength(3);
    await home(page);const plan=saved.plans[0];expect(plan.cardIds).toHaveLength(20);
    await page.locator('[data-action=start-daily]').click();
    await expect(page.locator('.flashcard')).toBeVisible();
    await expect(page.locator('.flashcard h1')).not.toHaveText(legacy.target.question);
    await gradeNormal(page);await home(page);
    const afterDaily=await snapshot(page);expect(afterDaily.events).toHaveLength(6);
    await openGraph(page,'ch-zhu-xi');await page.locator('[data-graph-hop="2"]').click();
    expect((await snapshot(page)).events).toEqual(afterDaily.events);
    const originalRows=(await snapshot(page)).events.filter(e=>legacy.events.some(old=>old.id===e.id));expect(originalRows).toEqual(legacy.events);
    expect(getProgress((await snapshot(page)).events).get(legacy.target.id)).toMatchObject({wrong:3,correct:2});
    await context.close();context=await launch();await endpoints(context);page=context.pages()[0]??await context.newPage();await page.clock.install({time:new Date(fixedNow)});await boot(page);
    saved=await snapshot(page);expect(saved.plans[0].cardIds).toEqual(plan.cardIds);expect(saved.comparisons).toHaveLength(6);expect(await yearSnapshot(page)).toEqual(yearBefore);
    await page.locator('header [data-nav=settings]').click();await page.locator('#sync-form [type=submit]').click();
    await expect(page.locator('#sync-form + .sync-state')).toContainText('同期完了');
    const download=page.waitForEvent('download');await page.locator('[data-action=backup]').click();const bytes=await readFile((await(await download).path())!);
    const backup=JSON.parse(bytes.toString());expect(backup.schemaVersion).toBe(2);expect(backup.comparisonEvents).toHaveLength(6);
    const fresh=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true,timezoneId:'Asia/Tokyo'});
    try{
      await endpoints(fresh);const other=await fresh.newPage();await other.clock.install({time:new Date(fixedNow)});await boot(other);await other.locator('header [data-nav=settings]').click();
      await other.locator('#restore-file').setInputFiles({name:'feature-backup.json',mimeType:'application/json',buffer:bytes});await expect(other.locator('#toast')).toContainText('復元');
      const restored=await snapshot(other);expect(restored.events).toEqual(saved.events);expect(restored.comparisons).toEqual(saved.comparisons);expect(getProgress(restored.events).get(legacy.target.id)).toMatchObject({wrong:3,correct:2});
      await other.locator('#restore-file').setInputFiles({name:'again.json',mimeType:'application/json',buffer:bytes});await expect(other.locator('#toast')).toContainText('復元');expect((await snapshot(other)).comparisons).toHaveLength(6);
      expect((await yearSnapshot(other)).reviews).toHaveLength(0);
    }finally{await fresh.close();}
    expect(await yearSnapshot(page)).toEqual(yearBefore);
  }finally{await context.close();}
});

test('対応の変更・途中離脱は記録せず、全回答と採点時だけ比較履歴を保存する',async({page,context})=>{
  await endpoints(context);await boot(page);await openCompare(page);
  const first=page.locator(`[data-comparison-answer="${prepared.pairs[0].relationId}"]`);
  await expect(page.locator('[data-comparison-action=grade]')).toBeDisabled();
  await first.selectOption(prepared.pairs[1].targetKnowledgeId);await first.selectOption(prepared.pairs[0].targetKnowledgeId);await expect(first).toBeFocused();
  expect((await snapshot(page)).comparisons).toHaveLength(0);
  await home(page);await openCompare(page);expect((await snapshot(page)).comparisons).toHaveLength(0);
  await choose(page,false);await page.locator('[data-comparison-action=grade]').evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});
  await expect(page.locator('.comparison-result-summary')).toContainText('0 / 3');expect((await snapshot(page)).comparisons).toHaveLength(3);expect((await snapshot(page)).events).toHaveLength(0);
  await page.locator('[data-comparison-action=retry]').click();await submitComparison(page,true);
  expect((await snapshot(page)).comparisons.filter(e=>!e.correct)).toHaveLength(3);await expect(page.locator('.comparison-cumulative').first()).toContainText('累積の混同 1');
});

test('日次推薦は同日固定で続けられ、同じカードへの通常演習の回答を重複集計しない',async({page,context})=>{
  await endpoints(context);await page.clock.install({time:new Date(fixedNow)});await boot(page);
  const plan=(await snapshot(page)).plans[0];expect(new Set(plan.cardIds).size).toBe(20);
  await page.locator('[data-action=start-daily]').click();await gradeNormal(page);await home(page);
  const event=(await snapshot(page)).events[0],card=catalog.cards.find(c=>c.id===event.cardId)!,owner=catalog.items.find(i=>i.id===card.knowledgeId)!;
  const related=catalog.cards.filter(c=>c.knowledgeId===owner.id&&!c.deleted);
  async function repeatNormal(){
    await openGraph(page,owner.id);await page.locator(`[data-graph-study="${owner.id}"]`).click();
    for(let i=0;i<related.length;i++)await gradeNormal(page);
    await expect(page.getByRole('heading',{name:'おつかれさまでした。',exact:true})).toBeVisible();await home(page);
  }
  await repeatNormal();const once=await snapshot(page);const completed=new Set(once.events.filter(e=>plan.cardIds.includes(e.cardId)).map(e=>e.cardId)).size;
  await expect(page.locator('#daily-recommendations')).toContainText(`${completed} / 20`);
  await repeatNormal();await expect(page.locator('#daily-recommendations')).toContainText(`${completed} / 20`);
  expect((await snapshot(page)).events.length).toBeGreaterThan(once.events.length);expect((await snapshot(page)).plans[0].cardIds).toEqual(plan.cardIds);
  await page.reload();await enterCulture(page);await expect(page.locator('#daily-recommendations')).toContainText(`${completed} / 20`);expect((await snapshot(page)).plans[0].cardIds).toEqual(plan.cardIds);
});

test('関連図の向き・1段階と2段階・一覧・詳細・既存演習への導線を操作できる',async({page,context})=>{
  await endpoints(context);await boot(page);const before=await snapshot(page);await openGraph(page,'ch-zhu-xi');
  const one=buildCultureGraph(catalog,relations.relations,'ch-zhu-xi',1,12),two=buildCultureGraph(catalog,relations.relations,'ch-zhu-xi',2,12);
  await expect(page.locator('#culture-graph .graph-node')).toHaveCount(one.nodes.length);await page.locator('[data-graph-hop="2"]').click();await expect(page.locator('#culture-graph .graph-node')).toHaveCount(two.nodes.length);expect(two.nodes.length).toBeGreaterThan(one.nodes.length);
  const ids=await page.locator('.graph-node').evaluateAll(els=>els.map(el=>(el as HTMLElement).dataset.graphNode));expect(new Set(ids).size).toBe(ids.length);
  await page.locator('[data-graph-display=list]').click();
  const edges=await page.locator('.graph-edge').evaluateAll(els=>els.map(el=>({id:(el as HTMLElement).dataset.graphEdge,from:(el as HTMLElement).dataset.fromId,to:(el as HTMLElement).dataset.toId})));
  for(const edge of edges)expect(relations.relations.find(r=>r.id===edge.id)).toMatchObject({fromId:edge.from,toId:edge.to});
  await page.locator('[data-graph-display=diagram]').click();await page.locator('[data-graph-node="ch-zhu-xi-learning"]').click();await expect(page.locator('#graph-detail-title')).toBeFocused();await expect(page.locator('#graph-detail-title')).toContainText('朱子学');
  expect((await snapshot(page)).events).toEqual(before.events);expect((await snapshot(page)).comparisons).toEqual(before.comparisons);
  await openGraph(page,prepared.pairs[0].targetKnowledgeId);await page.locator(`[data-graph-compare="${set.id}"]`).click();await expect(page.locator('[data-comparison-answer]')).toHaveCount(3);
  await openGraph(page,'ch-zhu-xi');await page.locator('[data-graph-study="ch-zhu-xi"]').click();await expect(page.locator('.flashcard')).toBeVisible();expect((await snapshot(page)).events).toEqual(before.events);
});

test('関係データの通信失敗でもキャッシュを保持し、オフライン再読み込みから演習できる',async({page,context})=>{
  let bad=false,requests=0;
  await endpoints(context);
  await context.route('**/culture-relations.json*',r=>{requests++;return r.fulfill({contentType:'application/json',body:JSON.stringify(bad?{schemaVersion:999}:relations)});});
  await boot(page);const before=await snapshot(page),count=requests;bad=true;
  await page.evaluate(()=>dispatchEvent(new Event('online')));await expect.poll(()=>requests).toBeGreaterThan(count);expect((await snapshot(page)).relations).toEqual(before.relations);
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>undefined));await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);await page.reload();await enterCulture(page);await openCompare(page);await submitComparison(page,true);await openGraph(page,'ch-zhu-xi');await expect(page.locator('.graph-node')).toHaveCount(buildCultureGraph(catalog,relations.relations,'ch-zhu-xi',1,12).nodes.length);
  expect((await snapshot(page)).events).toEqual(before.events);expect((await snapshot(page)).comparisons).toHaveLength(3);await context.setOffline(false);
});

test('0件の関係・比較セットでも通常演習を利用でき、画面がクラッシュしない',async({page,context})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await endpoints(context,{relations:{schemaVersion:1,version:1,updatedAt:relations.updatedAt,relations:[],comparisonSets:[]}});await page.goto('/');await enterCulture(page);
  await expect.poll(async()=>(await snapshot(page)).relations?.version).toBe(1);
  await page.locator('[data-nav=compare]').click();await expect(page.locator('#culture-compare')).toContainText('準備中');
  await home(page);await page.locator('[data-nav=graph]').click();await expect(page.locator('#culture-graph')).toContainText('準備中');
  await home(page);await page.locator('[data-action=start-daily]').click();await expect(page.locator('.flashcard')).toBeVisible();expect(errors).toEqual([]);
});

test('360px・393pxとデスクトップで新機能を操作でき、5項目ナビを維持する',async({page,context})=>{
  await endpoints(context);await boot(page);await mkdir('artifacts',{recursive:true});
  for(const width of [360,393,1280]){
    await page.setViewportSize({width,height:851});await home(page);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.mobile-nav button')).toHaveCount(5);
    if(width===393)await page.screenshot({path:'artifacts/features-daily-mobile.png',fullPage:true});
    await openCompare(page);const first=page.locator('[data-comparison-answer]').first();await first.focus();await expect(first).toBeFocused();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);if(width===393)await page.screenshot({path:'artifacts/comparison-mobile.png',fullPage:true});
    await openGraph(page,'ch-zhu-xi');await page.locator('[data-graph-hop="2"]').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const sizes=await page.locator('.graph-node').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));for(const height of sizes)expect(height).toBeGreaterThanOrEqual(44);
    if(width===393)await page.screenshot({path:'artifacts/graph-mobile.png',fullPage:true});
  }
});
