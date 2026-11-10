import {test, expect, type BrowserContext, type Page} from '@playwright/test';
import {readFile, mkdir} from 'node:fs/promises';
import type {YearCatalog, YearSnapshot} from '../src/years';
import type {Catalog, ReviewEvent} from '../src/types';

// Explicitly fictional fixtures are served only by Playwright. Never write them
// to public/year-events.json or to the cultural-history catalogue.
const fixture: YearCatalog = {
  schemaVersion: 1, version: 2, updatedAt: '2026-11-09T18:00:00.000Z',
  items: [
    {id:'fixture-year-a', year:'9999年', event:'架空の出来事A', region:'架空地域A', era:'架空時代A', level:2,
      explanation:'ブラウザ試験専用の架空の解説A。', sources:[{title:'試験専用出典',url:'https://example.org/fixture-a'}],version:1,deleted:false},
    {id:'fixture-year-b', year:'紀元前9999〜紀元前9998年', event:'架空の出来事B', region:'架空地域B', era:'架空時代B', level:4,
      explanation:'ブラウザ試験専用の架空の解説B。', sources:[{title:'試験専用出典',url:'https://example.org/fixture-b'}],version:1,deleted:false},
  ],
};
const empty:YearCatalog={schemaVersion:1,version:1,updatedAt:'2026-11-09T12:40:00.000Z',items:[]};
async function routeCatalogs(context:BrowserContext, years:YearCatalog=empty){
  await context.route('**/year-events.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(years)}));
  await context.route('**/catalog-delta.json*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({schemaVersion:1,version:12,updatedAt:'2026-11-09T11:27:10.092Z',items:[],cards:[]})}));
}
async function portal(page:Page){
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'世界史学習マスター',exact:true})).toBeVisible();
}
async function enter(page:Page,area:'culture'|'years'){
  await page.locator(`[data-enter-area="${area}"]`).click();
  await expect(page.getByRole('heading',{name:area==='culture'?'今日も、ひとつ先の知識へ。':'年号ホーム',exact:true})).toBeVisible();
}
async function back(page:Page){
  await page.locator('header [data-nav="portal"]').click();
  await expect(page.getByRole('heading',{name:'世界史学習マスター',exact:true})).toBeVisible();
}
async function yearNav(page:Page,name:string){await page.locator(`.mobile-nav [data-year-nav="${name}"]`).click();}
async function cultureNav(page:Page,name:string){await page.locator(`.mobile-nav [data-nav="${name}"]`).click();}
async function database<T>(page:Page,name:string,eventsStore:string):Promise<T>{
  await page.waitForFunction(async name=>(await indexedDB.databases()).some(db=>db.name===name),name);
  return await page.evaluate(async({name,eventsStore})=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(name);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const tx=db.transaction(['meta',eventsStore],'readonly');
    const request=<V>(r:IDBRequest<V>)=>new Promise<V>((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    const [catalog,events]=await Promise.all([request(tx.objectStore('meta').get('catalog')),request(tx.objectStore(eventsStore).getAll())]);
    db.close();return {catalog,events};
  },{name,eventsStore}) as T;
}
const cultures=(p:Page)=>database<{catalog:Catalog;events:ReviewEvent[]}>(p,'cultural-history-master','events');
const years=(p:Page)=>database<YearSnapshot>(p,'world-history-year-test','reviews');
async function oneYear(page:Page,correct:boolean){
  await yearNav(page,'quiz');
  if(await page.locator('[data-year-action=stop]').isVisible())await page.locator('[data-year-action=stop]').click();
  await expect(page.locator('#year-options [name=direction]')).toHaveCount(0);
  await page.locator('#year-options [name=level]').selectOption('2');
  await expect(page.locator('#year-options [type=submit]')).toBeEnabled();
  await page.locator('#year-options [type=submit]').click();
  await expect(page.locator('.year-prompt')).toContainText('架空の出来事A');
  await page.locator('[data-year-action=reveal]').click();
  await expect(page.locator('.year-answer')).toContainText('9999年');
  await expect(page.locator('.year-answer')).toContainText('架空の解説A');
  await page.locator(`[data-year-action=${correct?'correct':'wrong'}]`).click();
  await expect(page.getByRole('heading',{name:'年号テスト終了',exact:true})).toBeVisible();
}
async function cultureReview(page:Page){
  await cultureNav(page,'setup');
  const detail=page.locator('#detail-scope');
  if(!await detail.evaluate(el=>(el as HTMLDetailsElement).open))await detail.locator('summary').click();
  await page.locator('[name=regions][value="ギリシア"]').check();
  await page.locator('#field-scope').evaluate(el=>{(el as HTMLDetailsElement).open=true;});
  await page.locator('[name=fields][value="建築"]').check();
  await page.locator('[name=cardType]').selectOption('image');
  await page.locator('#study-options [type=submit]').click();
  await page.locator('[data-action=reveal]').click();
  await page.locator('[data-grade=wrong]').click();
  await expect(page.getByRole('heading',{name:'おつかれさまでした。'})).toBeVisible();
}

test.describe('二つの独立した学習エリア',()=>{
  test('ブラウザの戻るでも所属エリアと専用メニューを維持する',async({page,context})=>{
    await routeCatalogs(context);await portal(page);await enter(page,'years');
    await yearNav(page,'quiz');
    await page.goBack();
    await expect(page.getByRole('heading',{name:'年号ホーム',exact:true})).toBeVisible();
    await expect(page.locator('.mobile-nav [data-year-nav]')).toHaveCount(5);
    await page.goBack();
    await expect(page.getByRole('heading',{name:'世界史学習マスター',exact:true})).toBeVisible();
    await enter(page,'culture');await cultureNav(page,'setup');await page.goBack();
    await expect(page.getByRole('heading',{name:'今日も、ひとつ先の知識へ。'})).toBeVisible();
    await expect(page.locator('.mobile-nav [data-nav]')).toHaveCount(5);
    await page.goBack();
    await expect(page.getByRole('heading',{name:'世界史学習マスター',exact:true})).toBeVisible();
  });

  test('総合ホームと0件の年号全画面が使え、文化史365項目506カードを維持する',async({page,context})=>{
    await routeCatalogs(context);await portal(page);
    await expect(page.locator('[data-enter-area]')).toHaveCount(4);
    await enter(page,'years');
    await expect(page.locator('main')).toContainText('0');
    await expect(page.locator('.mobile-nav [data-year-nav]')).toHaveCount(5);
    await expect(page.locator('.mobile-nav [data-nav]')).toHaveCount(0);
    for(const name of ['home','quiz','list','history','review']){
      await yearNav(page,name);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
    await yearNav(page,'quiz');
    await expect(page.locator('#year-options [type=submit]')).toBeDisabled();
    await expect(page.locator('main')).toContainText('登録');
    await back(page);await enter(page,'culture');
    await expect(page.locator('.mobile-nav [data-nav]')).toHaveCount(5);
    await expect(page.locator('.mobile-nav [data-year-nav]')).toHaveCount(0);
    const stored=await cultures(page);
    expect(stored.catalog.items.filter(x=>!x.deleted)).toHaveLength(365);
    expect(stored.catalog.cards.filter(x=>!x.deleted)).toHaveLength(506);
    expect((await years(page)).catalog.items).toHaveLength(0);
    const production=JSON.parse(await readFile('public/year-events.json','utf8'));
    // The real catalog now contains user-requested years; only the test fixture stays empty here.
    expect(production.items.length).toBeGreaterThan(0);
    expect(production.items.some((item:{id:string})=>item.id.startsWith('fixture-'))).toBe(false);
  });

  test('文化史と年号の出題条件・成績を混ぜず、年号の累積誤答を正答後も保持する',async({page,context})=>{
    await routeCatalogs(context,fixture);await portal(page);await enter(page,'culture');
    await cultureReview(page);const before=await cultures(page);
    await cultureNav(page,'setup');await page.locator('[name=level][value="3"]').check();
    await back(page);await enter(page,'years');
    await expect.poll(async()=>(await years(page)).catalog.items.length).toBe(2);
    await oneYear(page,false);
    await oneYear(page,true);
    const events=(await years(page)).events;
    expect(events).toHaveLength(2);
    expect(events.filter(x=>x.questionId==='fixture-year-a::event-year').map(x=>x.correct).sort()).toEqual([false,true]);
    expect(events.every(x=>x.questionId.endsWith('::event-year'))).toBe(true);
    expect(await cultures(page)).toEqual(before);
    await yearNav(page,'history');
    await expect(page.locator('main')).toContainText('出来事');
    await expect(page.locator('main')).toContainText('年号');
    await back(page);await enter(page,'culture');
    await cultureNav(page,'setup');await expect(page.locator('[name=level][value="3"]')).toBeChecked();
    await cultureNav(page,'history');await expect(page.locator('.wrong-count')).toHaveText('1');
    await back(page);await enter(page,'years');await yearNav(page,'quiz');
    await expect(page.locator('#year-options [name=level]')).toHaveValue('2');
    await expect(page.locator('#year-options [name=direction]')).toHaveCount(0);
  });

  test('年号は出来事から年号だけを出題し、範囲指定・一覧検索・0問理由が表示される',async({page,context})=>{
    await routeCatalogs(context,fixture);await portal(page);await enter(page,'years');
    await expect.poll(async()=>(await years(page)).catalog.items.length).toBe(2);
    await yearNav(page,'quiz');await expect(page.locator('#year-options [name=direction]')).toHaveCount(0);
    await expect(page.locator('.year-setup-bottom')).toContainText('2');
    await page.locator('#year-options [name=level]').selectOption('1');
    await expect(page.locator('#year-options [type=submit]')).toBeDisabled();
    await expect(page.locator('main')).toContainText('条件');
    await page.locator('#year-options [name=level]').selectOption('2');
    await page.locator('#year-options [name=region]').selectOption('架空地域A');
    await page.locator('#year-options [name=era]').selectOption('架空時代A');
    await expect(page.locator('.year-setup-bottom')).toContainText('1');
    await page.locator('#year-options [type=submit]').click();
    const answers=[];
    for(let i=0;i<1;i++){
      await page.locator('[data-year-action=reveal]').click();
      answers.push(await page.locator('.year-answer strong').textContent());
      await page.locator('[data-year-action=correct]').click();
    }
    expect(answers).toEqual(['9999年']);
    await yearNav(page,'list');
    await expect(page.locator('.year-list-item')).toHaveCount(2);
    await page.locator('#year-list-options [name=listLevel]').selectOption('4');
    await page.locator('#year-list-options [name=listRegion]').selectOption('架空地域B');
    await page.locator('#year-list-options [name=listEra]').selectOption('架空時代B');
    await expect(page.locator('.year-list-item')).toHaveCount(1);
    await page.locator('#year-list-options [name=listLevel]').selectOption('2');
    await expect(page.locator('.year-list-item')).toHaveCount(0);
    await page.locator('#year-list-options [name=listLevel]').selectOption('all');
    await page.locator('#year-search').fill('出来事B');
    await expect(page.locator('.year-list-item')).toHaveCount(1);
    await expect(page.locator('.year-list-item')).toContainText('紀元前9999');
    await page.locator('.year-list-item summary').click();
    await expect(page.locator('.year-list-item')).toContainText('試験専用出典');
  });

  test('共通設定から両部門のバックアップを復元しても他方と新しい履歴を消さない',async({page,context,browser})=>{
    await routeCatalogs(context,fixture);await portal(page);await enter(page,'culture');await cultureReview(page);
    const cultureBefore=await cultures(page);
    await back(page);await enter(page,'years');await expect.poll(async()=>(await years(page)).catalog.items.length).toBe(2);
    await oneYear(page,false);
    await page.locator('header [data-nav=settings]').click();
    const yearDownload=page.waitForEvent('download');await page.locator('[data-year-action=backup]').click();
    const yearBytes=await readFile((await (await yearDownload).path())!);
    const cultureDownload=page.waitForEvent('download');await page.locator('[data-action=backup]').click();
    const cultureBytes=await readFile((await (await cultureDownload).path())!);
    await back(page);await enter(page,'years');await oneYear(page,true);
    const latest=(await years(page)).events;
    await page.locator('header [data-nav=settings]').click();
    await page.locator('#year-restore').setInputFiles({name:'years.json',mimeType:'application/json',buffer:yearBytes});
    await expect(page.locator('#toast')).toContainText('年号');
    expect((await years(page)).events).toEqual(latest);
    await page.locator('#restore-file').setInputFiles({name:'culture.json',mimeType:'application/json',buffer:cultureBytes});
    await expect(page.locator('#toast')).toContainText('復元しました');
    expect((await years(page)).events).toEqual(latest);
    expect((await cultures(page)).events).toEqual(cultureBefore.events);
    const fresh=await browser.newContext({viewport:{width:393,height:851},isMobile:true,hasTouch:true});
    try{
      await routeCatalogs(fresh,fixture);const other=await fresh.newPage();await portal(other);
      await other.locator('header [data-nav=settings]').click();
      await other.locator('#year-restore').setInputFiles({name:'years.json',mimeType:'application/json',buffer:yearBytes});
      await expect.poll(async()=>(await years(other)).events.length).toBe(1);
      await other.locator('#restore-file').setInputFiles({name:'culture.json',mimeType:'application/json',buffer:cultureBytes});
      await expect.poll(async()=>(await cultures(other)).events.length).toBe(1);
      expect((await years(other)).events).toEqual(JSON.parse(yearBytes.toString()).events);
      expect((await cultures(other)).events).toEqual(cultureBefore.events);
      await other.locator('#year-restore').setInputFiles({name:'wrong-area.json',mimeType:'application/json',buffer:cultureBytes});
      await expect(other.locator('#toast')).toContainText('バックアップ');
      expect((await cultures(other)).events).toEqual(cultureBefore.events);
      expect((await years(other)).events).toHaveLength(1);
    }finally{await fresh.close();}
  });

  test('360pxと393pxで総合ホームと両部門の全メニューをタップできる',async({page,context})=>{
    await routeCatalogs(context);await portal(page);await mkdir('artifacts',{recursive:true});
    for(const width of [360,393]){
      await page.setViewportSize({width,height:851});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      for(const area of ['culture','years'] as const){
        await enter(page,area);
        const names=area==='culture'?['home','setup','library','history','review']:['home','quiz','list','history','review'];
        for(const name of names){
          if(area==='culture')await cultureNav(page,name);else await yearNav(page,name);
          expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
          const boxes=await page.locator('.mobile-nav button').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,right:r.right,width:r.width,height:r.height};}));
          expect(boxes).toHaveLength(5);
          for(const box of boxes){expect(box.height).toBeGreaterThanOrEqual(44);expect(box.width).toBeGreaterThanOrEqual(44);expect(box.x).toBeGreaterThanOrEqual(0);expect(box.right).toBeLessThanOrEqual(width);}
          for(let i=1;i<boxes.length;i++)expect(boxes[i].x).toBeGreaterThanOrEqual(boxes[i-1].right-1);
        }
        await back(page);
      }
    }
    await page.screenshot({path:'artifacts/portal-mobile.png',fullPage:true});
    await enter(page,'years');await page.screenshot({path:'artifacts/year-home-mobile.png',fullPage:true});
  });

  test('保存済みの年号教材をオフライン再起動後も出来事から年号で学習できる',async({page,context})=>{
    await routeCatalogs(context,fixture);await portal(page);await enter(page,'years');
    await expect.poll(async()=>(await years(page)).catalog.items.length).toBe(2);
    await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>undefined));
    await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
    await oneYear(page,false);
    await context.setOffline(true);await page.reload();
    await expect(page.getByRole('heading',{name:'世界史学習マスター',exact:true})).toBeVisible();
    await enter(page,'years');await oneYear(page,true);
    expect((await years(page)).events).toHaveLength(2);
    expect((await cultures(page)).events).toHaveLength(0);
    await context.setOffline(false);
  });
});
