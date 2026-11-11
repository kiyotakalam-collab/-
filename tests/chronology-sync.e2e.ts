import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {ChronologyFeed} from '../src/chronology-sync';
const feed=JSON.parse(readFileSync(new URL('../public/chronology-errors.json',import.meta.url),'utf8')) as ChronologyFeed;
const count=feed.problems.length;
import {CHRONOLOGY_NOTE_KEY} from '../src/chronology-errors';

for(const width of [360,393])test(`通史の実シート由来の全問題・再同期・履歴保持・通信復帰 ${width}px`,async({page,context})=>{
 await page.setViewportSize({width,height:851});
 let mode:'ok'|'invalid'|'offline'='ok';
 await context.route('**/chronology-errors.json',route=>mode==='offline'?route.abort():route.fulfill({contentType:'application/json',body:JSON.stringify(mode==='invalid'?{...feed,problems:[...feed.problems,feed.problems[0]]}:feed)}));
 await page.goto('/#/chronology-errors');
 await expect(page.locator('main [role=status]')).toContainText('同期済み');
 await expect(page.locator('main [role=status]')).toContainText(`有効${count}件 / 保存${count}件`);
 const read=()=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),CHRONOLOGY_NOTE_KEY);
 expect((await read()).notes.every((n:any)=>n.wrongCount===0&&n.correctCount===0)).toBe(true);
 const otherHistories=()=>page.evaluate(async()=>{
  const out:Record<string,unknown>={};
  for(const name of ['cultural-history-master','world-history-year-test','world-history-ambiguous-terms','world-history-map-master']){
   if(!(await indexedDB.databases()).some(d=>d.name===name))continue;
   const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);});
   for(const store of ['events','reviews','orderingReviews'])if(db.objectStoreNames.contains(store))out[name+store]=await new Promise(resolve=>{const r=db.transaction(store).objectStore(store).getAll();r.onsuccess=()=>resolve(r.result);});
   db.close();
  }return out;
 });
 const before=await otherHistories();
 await page.locator('[data-chronology-start="all"]').click();
 const seen=new Set<string>();
 for(let i=0;i<count;i++){
  await expect(page.getByRole('heading',{name:`通史の復習 ${i+1} / ${count}`,exact:true})).toBeVisible();
  const question=await page.locator('main h3').innerText();seen.add(question);
  const p=feed.problems.find(x=>x.question===question)!;expect(p).toBeTruthy();
  await page.locator('[data-chronology-reveal]').click();
  await expect(page.locator('.notice')).toContainText(p.answer);
  await page.locator('[data-chronology-grade="wrong"]').click();
 }
 expect(seen.size).toBe(count);
 await page.locator('main [data-chronology-page="home"]').first().click();
 const graded=await read();expect(graded.notes.every((n:any)=>n.wrongCount===1&&n.correctCount===0)).toBe(true);
 await page.locator('[data-chronology-sync]').click();
 await expect(page.locator('main [role=status]')).toContainText('同期済み');
 expect((await read()).notes).toEqual(graded.notes);
 mode='invalid';await page.locator('[data-chronology-sync]').click();
 await expect(page.locator('main [role=status]')).toContainText('同期失敗');expect((await read()).notes).toEqual(graded.notes);
 mode='offline';await page.reload();await expect(page.locator('main [role=status]')).toContainText('同期失敗');
 await page.locator('[data-chronology-start="all"]').click();await page.locator('[data-chronology-reveal]').click();await page.locator('[data-chronology-grade="correct"]').click();
 const offline=await read();expect(offline.notes.reduce((sum:number,n:any)=>sum+n.wrongCount,0)).toBe(count);
 expect(offline.notes.reduce((sum:number,n:any)=>sum+n.correctCount,0)).toBe(1);
 await page.locator('main [data-chronology-page="home"]').first().click();
 mode='ok';await page.evaluate(()=>window.dispatchEvent(new Event('online')));
 await expect(page.locator('main [role=status]')).toContainText('同期済み');expect((await read()).notes).toEqual(offline.notes);
 const downloadPromise=page.waitForEvent('download');await page.locator('[data-chronology-export]').click();const download=await downloadPromise;expect(download.suggestedFilename()).toBe('chronology-error-notebook.json');
 await page.locator('#chronology-import').setInputFiles({name:'backup.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(offline))});
 expect((await read()).notes).toEqual(offline.notes);
 expect(await otherHistories()).toEqual(before);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`artifacts/chronology-sheets-${width}.png`,fullPage:true});
});

test('不正な初回同期を拒否し、教材0件を維持する',async({page,context})=>{
 await context.route('**/chronology-errors.json',route=>route.fulfill({contentType:'application/json',body:'{"error":"private sheet"}'}));
 await page.goto('/#/chronology-errors');await expect(page.locator('main [role=status]')).toContainText('同期失敗');
 await expect(page.locator('main [role=status]')).toContainText('保存0件');await expect(page.locator('[data-chronology-start="all"]')).toBeDisabled();
});

test('PWAで実教材取得後、完全オフライン再起動して復習できる',async({page,context})=>{
 await context.route('**/chronology-errors.json',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(feed)}));
 await page.goto('/#/chronology-errors');await expect(page.locator('main [role=status]')).toContainText('同期済み');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.reload();await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 await context.unroute('**/chronology-errors.json');await context.setOffline(true);await page.reload();await expect(page.getByRole('heading',{name:'通史の誤答ノート',exact:true})).toBeVisible();
 await expect(page.locator('main [role=status]')).toContainText('同期失敗');
 await page.locator('[data-chronology-start="all"]').click();await page.locator('[data-chronology-reveal]').click();await page.locator('[data-chronology-grade="correct"]').click();
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).notes.reduce((s:number,n:any)=>s+n.correctCount,0),CHRONOLOGY_NOTE_KEY)).toBe(1);
 await context.setOffline(false);
});
