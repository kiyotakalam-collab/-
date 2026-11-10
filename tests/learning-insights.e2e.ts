import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { seedCatalog } from '../src/seed';
import { getProgress, mergeCatalog } from '../src/core';
import { DEFAULT_SETTINGS, type ReviewEvent } from '../src/types';
import { yearProgress, type YearCatalog, type YearReview } from '../src/years';
import { orderingKey } from '../src/year-chronology';

test.use({timezoneId:'America/Los_Angeles'}); // The app must still use Japan's calendar dates.

const delta=JSON.parse(readFileSync(new URL('../public/catalog-delta.json',import.meta.url),'utf8'));
const catalog=mergeCatalog(seedCatalog,delta),cards=catalog.cards.filter(card=>!card.deleted&&card.type!=='image').slice(0,4);
const now='2026-11-10T03:00:00.000Z';
const years:YearCatalog={schemaVersion:1,version:100,updatedAt:now,items:['a','b','c','d'].map((id,i)=>({id:'insight-year-'+id,year:String(1990+i),event:'可視化テスト専用の出来事'+id,region:i%2?'試験地域B':'試験地域A',era:'試験時代',level:i%2?3:2,explanation:'試験専用。教材に追加しない。',sources:[],version:1,deleted:false}))};
const cEvent=(id:string,index:number,correct:boolean,at:string):ReviewEvent=>({id,cardId:cards[index].id,correct,reviewedAt:at,sessionId:'old-culture'});
const yEvent=(event:ReviewEvent,index:number):YearReview=>({id:event.id.replace('culture','year'),questionId:years.items[index].id+'::event-year',correct:event.correct,at:event.reviewedAt,sessionId:'old-years'});
const events=[cEvent('today-culture',0,true,'2026-11-09T03:00:00.000Z'),
  ...[false,false,false,true,true].map((correct,i)=>cEvent('protected-culture-'+i,1,correct,`2026-11-0${i+1}T03:00:00.000Z`)),
  ...['2026-10-20','2026-10-21','2026-10-24','2026-10-31'].map((day,i)=>cEvent('stable-culture-'+i,2,true,`${day}T03:00:00.000Z`))];
const yearEvents=events.map(event=>yEvent(event,event.cardId===cards[0].id?0:event.cardId===cards[1].id?1:2));
const orderIds=years.items.map(item=>item.id);
const ordering={id:'protected-ordering',questionId:orderingKey(orderIds),itemIds:orderIds,submittedIds:[...orderIds].reverse(),correctOrderIds:orderIds,correct:false,at:'2026-11-09T00:00:00.000Z',sessionId:'old-ordering'};

async function routes(context:BrowserContext){
  await context.route('**/catalog-delta.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(delta)}));
  await context.route('**/year-events.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(years)}));
  await context.route('https://raw.githubusercontent.com/**/culture-relations.json*',route=>route.fulfill({status:503,body:'use saved fixture'}));
}
async function snapshot(page:Page){return page.evaluate(async()=>{
  const read=async(name:string,stores:string[])=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const tx=db.transaction(['meta',...stores],'readonly');
    const get=<T>(r:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const catalog=await get(tx.objectStore('meta').get('catalog')),history=await Promise.all(stores.map(store=>get(tx.objectStore(store).getAll())));db.close();return {catalog,history};
  };
  return {culture:await read('cultural-history-master',['events','comparisonEvents']),years:await read('world-history-year-test',['reviews','orderingReviews'])};
});}
async function boot(page:Page,context:BrowserContext){
  await routes(context);await page.clock.install({time:new Date(now)});await page.goto('/');await page.locator('header [data-nav=settings]').click();
  await expect(page.locator('.chronology-tools')).toContainText('取得済み');
  const cultureBackup={format:'cultural-history-master',schemaVersion:1,exportedAt:now,catalog,events,settings:DEFAULT_SETTINGS};
  await page.locator('#restore-file').setInputFiles({name:'old-culture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cultureBackup))});await expect(page.locator('#toast')).toContainText('復元しました');
  await page.locator('#year-restore').setInputFiles({name:'years-with-ordering.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({format:'world-history-years',schemaVersion:2,exportedAt:now,catalog:years,events:yearEvents,orderingEvents:[ordering],lastSyncAt:null}))});await expect(page.locator('#toast')).toContainText('統合');
  await page.locator('header [data-nav=portal]').click();
}
async function calendar(page:Page){await page.locator('header [data-nav=portal]').click();await page.locator('.insight-portal-links [data-nav=calendar]').click();}
async function mastery(page:Page){await page.locator('header [data-nav=portal]').click();await page.locator('.insight-portal-links [data-nav=mastery]').click();}

test('日本時間のカレンダーから文化史・年号の対象だけを解き、予定を再計算する',async({page,context})=>{
  await boot(page,context);const before=await snapshot(page);await calendar(page);
  await expect(page.locator('[data-insight-due]')).toHaveText('4');await expect(page.locator('[data-insight-overdue]')).toHaveText('2');
  const date=page.locator('[data-insight-date="2026-11-10"]');await expect(date).toHaveAttribute('aria-label',/文化史1問、年号1問、合計2問/);await date.click();
  await expect(page.locator('.insight-selection')).toContainText('この日の実際の回答：文化史 0回 ／ 年号 0回');await expect(page.locator('[data-insight-row]')).toHaveCount(2);
  await page.locator('.insight-selection>.insight-practice [data-insight-study=culture]').click();await expect(page.locator('.flashcard h1')).toHaveText(cards[0].question);
  await page.locator('[data-action=reveal]').click();await page.locator('[data-grade=correct]').click();await expect(page.getByRole('heading',{name:'おつかれさまでした。'})).toBeVisible();
  await calendar(page);await expect(page.locator('[data-insight-date="2026-11-10"]')).toHaveAttribute('aria-label',/文化史0問、年号1問、合計1問/);await expect(page.locator('[data-insight-date="2026-11-13"]')).toHaveAttribute('aria-label',/文化史1問/);
  await page.locator('[data-insight-date="2026-11-10"]').click();await page.locator('.insight-selection>.insight-practice [data-insight-study=years]').click();await expect(page.locator('.year-prompt')).toContainText(years.items[0].event);
  await page.locator('[data-year-action=reveal]').click();await page.locator('[data-year-action=correct]').click();await expect(page.getByRole('heading',{name:'年号テスト終了',exact:true})).toBeVisible();
  await calendar(page);await expect(page.locator('[data-insight-date="2026-11-10"]')).toHaveAttribute('aria-label',/合計0問/);
  const after=await snapshot(page);expect(after.culture.history[0]).toHaveLength(events.length+1);expect(after.years.history[0]).toHaveLength(yearEvents.length+1);expect(after.years.history[1]).toEqual(before.years.history[1]);
  expect(getProgress(after.culture.history[0]).get(cards[1].id)).toMatchObject({correct:2,wrong:3});expect(yearProgress(after.years.history[0]).get(years.items[1].id+'::event-year')).toMatchObject({correct:2,wrong:3});
  expect(after.culture.catalog).toEqual(before.culture.catalog);expect(after.years.catalog).toEqual(before.years.catalog);
});

test('定着度と範囲で絞り込み、両部門と整序を別集計し、閲覧では履歴を書かない',async({page,context})=>{
  await boot(page,context);const before=await snapshot(page);await mastery(page);
  await expect(page.locator('[data-analysis-retention=stable]')).toContainText('1');await page.locator('[data-analysis-retention=stable]').click();await expect(page.locator('[data-analysis-row]')).toHaveCount(1);await expect(page.locator('[data-analysis-row]')).toHaveAttribute('data-analysis-row',cards[2].id);
  await page.locator('.insight-rules summary').click();await expect(page.locator('.insight-rules')).toContainText('連続正答3回以上');
  await page.locator('[data-analysis-area=ordering]').click();await expect(page.locator('[data-analysis-retention=unknown]')).toContainText('1');await expect(page.locator('[data-analysis-urgency=unscheduled]')).toContainText('1');
  await page.locator('[data-analysis-area=years]').click();await page.locator('[data-analysis-retention=unseen]').click();await expect(page.locator('[data-analysis-row]')).toHaveCount(1);await page.locator('[data-analysis-study]').click();await expect(page.locator('.year-prompt')).toContainText(years.items[3].event);
  // Leaving without an answer must not create a review event.
  await calendar(page);await page.locator('[data-insight-scope=overdue]').click();await expect(page.locator('[data-insight-row]')).toHaveCount(2);await expect(page.locator('.insight-selection')).toContainText('期限超過');
  expect(await snapshot(page)).toEqual(before);
});

test('旧バックアップ再復元・オフライン再起動・日本時間外の端末でも同じ予定と履歴を保つ',async({page,context})=>{
  await boot(page,context);const before=await snapshot(page);
  await page.locator('header [data-nav=settings]').click();
  const oldYear={format:'world-history-years',schemaVersion:1,exportedAt:now,catalog:years,events:yearEvents,lastSyncAt:null};
  await page.locator('#year-restore').setInputFiles({name:'old-years.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(oldYear))});await expect(page.locator('#toast')).toContainText('統合');expect((await snapshot(page)).years).toEqual(before.years);
  const download=page.waitForEvent('download');await page.locator('[data-year-action=backup]').click();const bytes=await readFile((await(await download).path())!);expect(JSON.parse(bytes.toString()).orderingEvents).toEqual([ordering]);
  await calendar(page);await expect(page.locator('[aria-current=date]')).toHaveAttribute('data-insight-date','2026-11-10');await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>undefined));await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);await page.reload();await expect(page.locator('[data-insight-view=calendar]')).toBeVisible();await expect(page.locator('[data-insight-due]')).toHaveText('4');await page.locator('.insight-pages [data-nav=mastery]').click();await page.reload();await expect(page.locator('[data-analysis-retention=stable]')).toContainText('1');
  await page.goBack();await expect(page.locator('[data-insight-view=calendar]')).toBeVisible();expect(await snapshot(page)).toEqual(before);
});

test('360px・393pxで月送り、エリア切替、グラフと分類を操作できる',async({page,context})=>{
  await boot(page,context);for(const width of [360,393]){
    await page.setViewportSize({width,height:851});await calendar(page);await page.locator('[data-insight-month="1"]').click();await expect(page.locator('.insight-month h2')).toHaveText('2026年12月');await page.locator('[data-insight-today]').click();
    await page.locator('[data-insight-area=culture]').click();await expect(page.locator('[data-insight-due]')).toHaveText('2');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const heights=await page.locator('[data-insight-date]').evaluateAll(els=>els.map(el=>el.getBoundingClientRect().height));expect(heights.every(height=>height>=44)).toBe(true);
    await page.locator('.insight-pages [data-nav=mastery]').click();await expect(page.locator('.retention-composition').first()).toHaveAttribute('aria-label',/未学習.*定着初期.*定着途中.*安定/);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`artifacts/weakness-${width}.png`,fullPage:true});
  }
});

test('任意の失点原因を保存・再起動・バックアップし、回答と復習予定を変更しない',async({page,context})=>{
 await boot(page,context);await mastery(page);await page.locator('[data-analysis-cause-input="protected-culture-0"]').selectOption('B');const before=await snapshot(page);await page.locator('[data-analysis-save="protected-culture-0"]').click();await expect(page.locator('#toast')).toContainText('失点原因を保存');expect(await snapshot(page)).toEqual(before);
 await page.reload();await expect(page.locator('[data-analysis-cause-input="protected-culture-0"]')).toHaveValue('B');await page.locator('[data-analysis-area=years]').click();await expect(page.locator('[data-analysis-cause-input="protected-year-0"]')).toHaveValue('');
 await page.locator('header [data-nav=settings]').click();const download=page.waitForEvent('download');await page.locator('[data-action=backup]').click();const file=await(await download).path();const backup=JSON.parse((await readFile(file!)).toString());expect(backup.errorCauses).toContainEqual(expect.objectContaining({area:'culture',eventId:'protected-culture-0',cause:'B'}));expect(backup.events).toEqual(before.culture.history[0]);
});

test('誤答直後の任意入力から原因を記録しても一問一答の累積数を変えない',async({page,context})=>{
 await boot(page,context);await calendar(page);await page.locator('[data-insight-date="2026-11-10"]').click();await page.locator('.insight-selection>.insight-practice [data-insight-study=years]').click();await page.locator('[data-year-action=reveal]').click();await page.locator('[data-year-action=wrong]').click();await expect(page.locator('.error-cause-prompt')).toBeVisible();const before=await snapshot(page);await page.locator('.error-cause-prompt summary').click();await page.locator('#pending-error-cause').selectOption('C');await page.locator('[data-error-cause-save]').click();await expect(page.locator('#toast')).toContainText('回答と復習予定は変更していません');expect(await snapshot(page)).toEqual(before);await mastery(page);await page.locator('[data-analysis-area=years]').click();await expect(page.locator('[data-analysis-cause=C]')).toContainText('1回');
});
