import {test,expect,type BrowserContext,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';
import type {ChronologyFeed} from '../src/chronology-sync';
const feed=JSON.parse(readFileSync(new URL('../public/chronology-errors.json',import.meta.url),'utf8')) as ChronologyFeed;
const key='world-history-chronology-errors-v1';
const read=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),key);
async function open(page:Page,context:BrowserContext){await context.route('**/catalog-delta.json*',r=>r.fulfill({contentType:'application/json',body:readFileSync(new URL('../public/catalog-delta.json',import.meta.url),'utf8')}));await context.route('**/chronology-errors.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify(feed)}));await page.goto('/#/chronology-errors');await expect(page.locator('main [role=status]')).toContainText('同期済み');}
async function nav(page:Page,to:string){await page.locator(`main [data-chronology-page="${to}"]`).first().click();}
async function grade(page:Page,result:string){await page.locator('[data-chronology-reveal]').click();await page.locator(`[data-chronology-grade="${result}"]`).click();}

test('一覧は正答を隠し、個別・複数選択演習から条件と位置を保って戻る',async({page,context})=>{
 await open(page,context);await nav(page,'list');
 const first=feed.problems[0];await page.locator('#chronology-search').fill('ガズナ朝');await page.locator('#chronology-search').press('Tab');
 await expect(page.locator(`[data-chron-single="${first.id}"]`)).toBeVisible();
 const row=page.locator('.chrono-list-row').filter({has:page.locator(`[data-chron-single="${first.id}"]`)});
 await expect(row).not.toContainText(first.answer);await expect(row).not.toContainText(first.explanation);
 await row.getByRole('button',{name:'この問題を演習'}).click();await expect(page.locator('main h3')).toHaveText(first.question);
 await expect(page.locator('main')).not.toContainText(first.answer);await grade(page,'ambiguous');
 await expect(page.getByRole('heading',{name:'演習結果',exact:true})).toBeVisible();
 expect((await read(page)).notes.find((n:any)=>n.id===first.id)).toMatchObject({wrongCount:0,correctCount:0,ambiguousCount:1});
 await page.locator('[data-chron-return]').click();await expect(page.locator('#chronology-search')).toHaveValue('ガズナ朝');
 await page.locator('[data-chron-clear]').click();
 const target=page.locator('[data-chron-single]').nth(20);await target.scrollIntoViewIfNeeded();const id=await target.getAttribute('data-chron-single');const top=await page.evaluate(()=>scrollY);
 await target.click();await grade(page,'wrong');await page.locator('[data-chron-return]').click();
 await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(top-70);
 await page.locator(`[data-chron-check="${id}"]`).check();const another=page.locator('[data-chron-check]').first();const otherId=await another.getAttribute('data-chron-check');await another.check();
 await page.locator('[data-chron-selected]').click();const s=await read(page);const active=s.practiceSessions.find((x:any)=>x.id===s.activePracticeId);
 expect(new Set(active.questionIds)).toEqual(new Set([id,otherId]));expect(active.mode).toBe('selected');
 await page.locator('[data-chron-finish]').click();await expect(page.locator('main')).toContainText('未回答2');
});

test('5問のランダム演習・前後移動・再起動・途中結果・誤答だけ再演習を保存する',async({page,context})=>{
 await open(page,context);await page.locator('[data-chron-mode="random"]').click();await page.locator('#chronology-limit').selectOption('5');await page.locator('[data-chron-begin]').click();
 const initial=await read(page),session=initial.practiceSessions.find((x:any)=>x.id===initial.activePracticeId);expect(session.questionIds).toHaveLength(5);expect(new Set(session.questionIds).size).toBe(5);
 await grade(page,'correct');await page.locator('[data-chron-move="-1"]').click();await page.locator('[data-chronology-reveal]').click();await expect(page.locator('main')).toContainText('採点済み');await expect(page.locator('[data-chronology-grade]')).toHaveCount(0);
 expect((await read(page)).practiceEvents).toHaveLength(1);
 await page.locator('[data-chron-move="1"]').click();await page.locator('[data-chron-pause]').click();await page.reload();await page.locator('[data-chron-resume]').click();
 expect((await read(page)).practiceSessions.find((x:any)=>x.id===session.id).questionIds).toEqual(session.questionIds);
 await grade(page,'wrong');await page.locator('[data-chron-finish]').click();await expect(page.locator('main')).toContainText('未回答3');
 const before=await read(page),wrongId=before.practiceEvents.find((x:any)=>x.result==='wrong').noteId;
 await page.locator('[data-chron-retry="wrong"]').click();await expect(page.getByRole('heading',{name:'通史の復習 1 / 1',exact:true})).toBeVisible();await grade(page,'correct');
 const after=await read(page);expect(after.notes.find((x:any)=>x.id===wrongId)).toMatchObject({wrongCount:1,correctCount:1});expect(after.practiceEvents).toHaveLength(3);
});

test('演習中の同期は終了まで保留し、バックアップ復元後も履歴と予定を維持する',async({page,context,browser})=>{
 let payload=structuredClone(feed),requests=0;
 await context.route('**/chronology-errors.json',r=>{requests++;return r.fulfill({contentType:'application/json',body:JSON.stringify(payload)});});
 await page.goto('/#/chronology-errors');await expect(page.locator('main [role=status]')).toContainText('同期済み');await nav(page,'list');
 const id=feed.problems[0].id;await page.locator(`[data-chron-single="${id}"]`).click();
 payload.version++;payload.problems[0].answer+='（試験用の改訂）';payload.problems[0].updated_at='2026-12-01T00:00:00.000Z';
 await page.evaluate(()=>window.dispatchEvent(new Event('online')));await expect.poll(()=>requests).toBeGreaterThan(1);
 await page.locator('[data-chronology-reveal]').click();await expect(page.locator('.notice')).toContainText(feed.problems[0].answer);await expect(page.locator('.notice')).not.toContainText('試験用の改訂');
 await page.locator('[data-chronology-grade="wrong"]').click();await expect.poll(async()=>(await read(page)).sync.version).toBe(payload.version);
 const saved=await read(page);expect(saved.notes[0].answer).toContain('試験用の改訂');expect(saved.notes[0].wrongCount).toBe(1);expect(saved.practiceEvents).toHaveLength(1);
 const second=await browser.newContext({viewport:{width:393,height:851},locale:'ja-JP',timezoneId:'Asia/Tokyo'});
 try{const p=await second.newPage();await open(p,second);const backup={name:'通史.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(saved))};
  await p.locator('#chronology-import').setInputFiles(backup);await expect.poll(async()=>(await read(p)).practiceEvents?.length).toBe(1);
  await p.locator('#chronology-import').setInputFiles(backup);expect((await read(p)).notes).toEqual(saved.notes);expect((await read(p)).practiceEvents).toEqual(saved.practiceEvents);
 }finally{await second.close();}
});

test('期限到来・原因・時代・定着度・登録日を絞り、0問から解除して復帰できる',async({page,context})=>{
 await open(page,context);await page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key)!);s.notes[0].wrongCount=3;s.notes[0].correctCount=2;s.notes[0].nextReviewAt='2020-01-01T00:00:00.000Z';localStorage.setItem(key,JSON.stringify(s));},key);await page.reload();
 await page.locator('[data-chron-mode="due"]').click();await expect(page.locator('#chronology-target')).toHaveText('対象1問・今回1問');
 await page.locator('#chronology-cause').selectOption('A');await expect(page.locator('#chronology-target')).toHaveText('対象0問・今回0問');await expect(page.locator('[data-chron-begin]')).toBeDisabled();
 await page.locator('[data-chron-clear]').click();await page.locator('#chronology-mastery').selectOption('unknown');await page.locator('#chronology-era').selectOption(feed.problems[0].era);await page.locator('#chronology-region').selectOption(feed.problems[0].region);
 await page.locator('[data-chron-begin]').click();await grade(page,'correct');const s=await read(page);expect(s.notes[0].wrongCount).toBe(3);expect(s.notes[0].correctCount).toBe(3);expect(s.notes[0].nextReviewAt).not.toBe('2020-01-01T00:00:00.000Z');
});

for(const width of [360,393])test(`通史演習 ${width}px・再読み込みとブラウザバック・キーボード`,async({page,context})=>{
 await page.setViewportSize({width,height:851});await open(page,context);await nav(page,'list');await page.locator('#chronology-region').selectOption(feed.problems[0].region);
 await page.locator('[data-chron-single]').first().click();await page.goBack();await expect(page.locator('#chronology-region')).toHaveValue(feed.problems[0].region);
 await page.reload();await expect(page.locator('#chronology-region')).toHaveValue(feed.problems[0].region);await page.locator('[data-chron-single]').first().click();await page.reload();await expect(page.locator('[data-chronology-reveal]')).toBeVisible();
 await page.locator('[data-chronology-reveal]').focus();await page.keyboard.press('Enter');await expect(page.locator('[data-chronology-grade="ambiguous"]')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.waitForFunction(()=>!document.querySelector('#toast')||document.querySelector('#toast')!.classList.contains('hidden'));await page.screenshot({path:`artifacts/chronology-practice-${width}.png`,fullPage:true});
});

test('シャッフルは回答済みを変えず、未回答だけで順序を変えて再開する',async({page,context})=>{
 await open(page,context);await page.locator('[data-chron-mode="random"]').click();await page.locator('#chronology-limit').selectOption('5');await page.locator('[data-chron-begin]').click();await grade(page,'correct');
 const before=await read(page),old=before.practiceSessions.find((s:any)=>s.id===before.activePracticeId),answered=before.practiceEvents[0].noteId;
 await page.locator('[data-chron-shuffle]').click();const after=await read(page),active=after.practiceSessions.find((s:any)=>s.id===after.activePracticeId);
 expect(active.id).not.toBe(old.id);expect(new Set(active.questionIds)).toEqual(new Set(old.questionIds.filter((id:string)=>id!==answered)));
 expect(after.practiceEvents).toEqual(before.practiceEvents);expect(after.notes).toEqual(before.notes);expect(after.practiceSessions.find((s:any)=>s.id===old.id).finishedAt).toBeTruthy();
});
