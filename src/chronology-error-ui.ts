import {CHRONOLOGY_NOTE_KEY,CHRONOLOGY_CAUSES,addChronology,gradeChronology,loadChronology,mergeChronology,dueChronology,validateChronology,type ChronologyCollection,type ChronologyNote} from './chronology-errors';
import {applyChronologyFeed,fetchChronologyFeed,InvalidChronologyFeedError} from './chronology-sync';
import type {ErrorCause} from './error-causes';
const h=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const opts=(pairs:[string,string][],selected:string)=>pairs.map(([v,t])=>`<option value="${h(v)}" ${v===selected?'selected':''}>${h(t)}</option>`).join('');
const SOURCE_OPTIONS:[string,string][]=[['全レベル問題集','全レベル問題集'],['慶應文学部過去問','慶應文学部過去問'],['その他私大過去問','その他私大過去問'],['共通テスト・センター','共通テスト・センター'],['模試','模試'],['その他の問題演習','その他の問題演習']];
const CAUSE_OPTIONS=Object.entries(CHRONOLOGY_CAUSES) as [string,string][];
type Page='home'|'add'|'review'|'list';
export class ChronologyErrorUI {
 private data:ChronologyCollection={version:1,notes:[]};
 private error='';
 private syncing=false;
 private syncStatus='未同期';
 private page:Page='home';
 private query='';
 private source='';
 private region='';
 private visible=50;
 private reviewIds:string[]=[];
 private cursor=0;
 private revealed=false;
 private busy=false;
 constructor(private renderApp:()=>void,private notify:(msg:string,error?:boolean)=>void){}
 init(){try{this.data=loadChronology(localStorage);this.error='';}catch(e){this.error=e instanceof Error?e.message:String(e);}}
 async sync(manual=false){
  if(this.error||this.syncing)return;this.syncing=true;this.syncStatus='取得中…';if(manual)this.renderApp();
  try{let feed;try{feed=await fetchChronologyFeed();}catch(e){if(e instanceof InvalidChronologyFeedError||this.data.sync||this.data.notes.length)throw e;feed=await fetchChronologyFeed(new URL('chronology-errors.json',document.baseURI).href);}
   this.save(applyChronologyFeed(this.data,feed));this.syncStatus=`同期済み・教材v${feed.version}`;if(manual)this.notify('問題データを同期しました。学習履歴は保持しています。');
  }catch(e){this.syncStatus='同期失敗：保存済みの問題で学習できます。';if(manual)this.notify(String(e),true);}
  finally{this.syncing=false;if(!['add','review'].includes(this.page))this.renderApp();}
 }
 summary(){return {count:this.data.notes.filter(n=>n.active!==false).length,due:dueChronology(this.data).length};}
 navigate(page:Page){this.page=page;this.reviewIds=[];this.cursor=0;this.revealed=false;this.renderApp();}
 private save(next:ChronologyCollection){
  // Storage writes are synchronous and atomic. On quota error keep the old in-memory snapshot.
  localStorage.setItem(CHRONOLOGY_NOTE_KEY,JSON.stringify(next));
  this.data=next;
 }
 private filtered(){
  return this.data.notes.filter(x=>x.active!==false&&(!this.source||x.source===this.source)&&
   (!this.region||x.region.includes(this.region))&&
   (!this.query||[x.term,x.question,x.answer,x.explanation,x.sourceDetail,x.era].join(' ').includes(this.query)))
   .sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 }
 private startReview(dueOnly:boolean){
  const rows=dueOnly?dueChronology(this.data):this.data.notes.filter(n=>n.active!==false);
  this.reviewIds=rows.map(n=>n.id).sort(()=>Math.random()-.5);
  this.cursor=0;this.revealed=false;this.page='review';this.renderApp();
 }
 private download(data:string,name:string){
  const url=URL.createObjectURL(new Blob([data],{type:'application/json;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 render():string{
  if(this.error)return `<section class="page-heading"><h1>通史の誤答ノート</h1></section><section class="panel"><p role="alert">${h(this.error)}</p><p>記録は上書きしていません。データを消去せず、バックアップからの復元を確認してください。</p></section>`;
  const total=this.summary().count,due=dueChronology(this.data).length;
  const heading=`<section class="page-heading"><div><div class="eyebrow">CHRONOLOGY ERROR NOTEBOOK</div><h1>通史の誤答ノート</h1><p>問題演習で見つけた知識の穴を教材横断で集約します。文化史・年号・曖昧用語の履歴は変更しません。</p></div></section><div class="review-actions"><button class="button secondary" data-chronology-page="home">概要</button><button class="button secondary" data-chronology-page="add">誤答を登録</button><button class="button secondary" data-chronology-page="list">誤答一覧</button><button class="button secondary" data-chronology-start="due" ${due?'':'disabled'}>今日の復習（${due}）</button></div>`;
  if(this.page==='add')return heading+`<section class="panel"><h2>知識の穴を登録</h2><p class="small muted">1つの記録につき1つの知識・区別を登録。問題全文の転載ではなく、覚えるべき問いに言い換えてください。</p>
   <form id="chronology-add-form" class="form-grid">
   <label class="form-field">確認したい問い <textarea name="question" rows="3" required maxlength="700" placeholder="例：総裁政府の後に成立した政府は？"></textarea></label>
   <label class="form-field">正しい知識 <textarea name="answer" rows="3" required maxlength="700" placeholder="統領政府。1799年のブリュメール18日のクーデタ後。"></textarea></label>
   <label class="form-field">補足・混同した点（任意） <textarea name="explanation" rows="2" maxlength="1400"></textarea></label>
   <label class="form-field">教材・出典<select name="source"><option value="">出典未記録</option>${opts(SOURCE_OPTIONS,'')}</select></label>
   <label class="form-field">年度・章・設問番号（任意）<input name="sourceDetail" maxlength="250" placeholder="例：2026年度 大問2 問5"></label>
   <label class="form-field">地域<input name="region" required maxlength="100" placeholder="例：西ヨーロッパ"></label>
   <label class="form-field">時代<input name="era" required maxlength="100" placeholder="例：18世紀末"></label>
   <label class="form-field">誤答原因<select name="cause"><option value="">原因未記録</option>${opts(CAUSE_OPTIONS,'')}</select></label>
   <button class="button primary" type="submit">誤答を保存</button></form></section>`;
  if(this.page==='list'){
   const rows=this.filtered(),visible=rows.slice(0,this.visible);
   return heading+`<section class="panel"><h2>登録した知識の穴（${rows.length}件）</h2><div class="form-grid">
   <label>検索<input id="chronology-search" type="search" value="${h(this.query)}" placeholder="用語・人物・時代"></label>
   <label>出典<select id="chronology-source"><option value="">すべて</option>${opts(SOURCE_OPTIONS,this.source)}</select></label>
   <label>地域<input id="chronology-region" value="${h(this.region)}" placeholder="地域で絞る"></label></div>
   ${visible.length?visible.map(n=>`<div class="review-weak-row"><strong>${h(n.term||n.question)}</strong><p>${h(n.question)}</p><p>${h(n.answer)}</p><p class="small muted">${h(n.region)} / ${h(n.era)} · ${h(n.source)} ${h(n.sourceDetail)} · ${n.cause?CHRONOLOGY_CAUSES[n.cause]:'原因未記録'} · 累積誤答${n.wrongCount}回</p><div class="review-actions"><button class="button secondary" data-chronology-wrong="${h(n.id)}">同じ穴で再失点 +1</button></div></div>`).join(''):'<p>条件に合う登録はありません。</p>'}
   ${rows.length>this.visible?'<button class="button secondary" data-chronology-more>さらに表示</button>':''}</section>`;
  }
  if(this.page==='review'){
   const id=this.reviewIds[this.cursor],n=this.data.notes.find(x=>x.id===id);
   if(!n)return heading+`<section class="panel"><h2>復習終了</h2><p>今回の確認は完了しました。</p><button class="button primary" data-chronology-page="home">概要に戻る</button></section>`;
   return heading+`<section class="panel"><h2>通史の復習 ${this.cursor+1} / ${this.reviewIds.length}</h2><p class="small muted">${h(n.source)} · ${h(n.region)} · ${h(n.era)}</p><h3>${h(n.question)}</h3>
   ${this.revealed?`<div class="notice"><strong>正しい知識：</strong><p>${h(n.answer)}</p>${n.explanation?`<p>${h(n.explanation)}</p>`:''}</div>
   <div class="review-actions"><button class="button primary" data-chronology-grade="correct">正解</button><button class="button secondary" data-chronology-grade="wrong">不正解</button></div>`:
   '<button class="button primary" data-chronology-reveal>答えを確認</button>'}</section>`;
  }
  const sources=Object.entries(this.data.notes.reduce<Record<string,number>>((acc,n)=>(acc[n.source||'出典未記録']=(acc[n.source||'出典未記録']||0)+1,acc),{})).sort((a,b)=>b[1]-a[1]);
  const causes=Object.entries({...CHRONOLOGY_CAUSES,'':'原因未記録'}).map(([k,label])=>[label,this.data.notes.filter(n=>n.cause===k).length] as const).filter(x=>x[1]);
  return heading+`<section class="panel"><h2>Google Sheetsの問題マスター</h2><p class="small">ChatGPTがシートへ登録し、読み戻して配信した問題を自動取得します。シート自体は非公開です。シートのみの手動編集は、ChatGPTへ反映を依頼してください。</p><p role="status">${h(this.syncStatus)} · 有効${total}件 / 保存${this.data.notes.length}件</p>${this.data.sync?`<p class="small muted">最終成功：${h(new Date(this.data.sync.lastSyncedAt).toLocaleString('ja-JP'))}</p>`:''}<button class="button secondary" data-chronology-sync ${this.syncing?'disabled':''}>今すぐ同期</button></section><div class="stats-grid"><section class="panel"><h2>記録した知識の穴</h2><strong>${total}件</strong></section><section class="panel"><h2>復習期限到来</h2><strong>${due}件</strong></section></div>
  <div class="review-actions"><button class="button primary" data-chronology-page="add">新しい誤答を登録</button><button class="button secondary" data-chronology-start="all" ${total?'':'disabled'}>全件を再テスト</button></div>
  <section class="panel"><h2>出典別</h2>${sources.map(([k,n])=>`<p>${h(k)}：${n}件</p>`).join('')||'<p>まだ記録がありません。</p>'}<h2>誤答原因別</h2>${causes.map(([k,n])=>`<p>${h(k)}：${n}件</p>`).join('')||'<p>まだ記録がありません。</p>'}</section>
  <section class="panel"><h2>バックアップ</h2><p class="small muted">この誤答ノート専用JSONです。別機能の学習履歴は含まれません。</p><button class="button secondary" data-chronology-export>JSONを書き出す</button><label class="form-field">保存したJSONを統合<input id="chronology-import" type="file" accept=".json,application/json"></label></section>`;
 }
 bind(){
  const sync=document.querySelector<HTMLElement>('[data-chronology-sync]');if(sync)sync.onclick=()=>void this.sync(true);
  document.querySelectorAll<HTMLElement>('[data-chronology-page]').forEach(e=>e.onclick=()=>this.navigate(e.dataset.chronologyPage as Page));
  document.querySelectorAll<HTMLElement>('[data-chronology-start]').forEach(e=>e.onclick=()=>this.startReview(e.dataset.chronologyStart==='due'));
  const form=document.querySelector<HTMLFormElement>('#chronology-add-form');
  if(form)form.onsubmit=e=>{e.preventDefault();if(this.busy)return;this.busy=true;
   try{const f=new FormData(form),raw={
     question:String(f.get('question')||''),answer:String(f.get('answer')||''),
     explanation:String(f.get('explanation')||''),source:String(f.get('source')||''),
     sourceDetail:String(f.get('sourceDetail')||''),region:String(f.get('region')||''),
     era:String(f.get('era')||''),cause:String(f.get('cause')||'') as ErrorCause
    };this.save(addChronology(this.data,raw));this.page='home';this.notify('誤答を登録しました。翌日以降の復習管理に反映されます。');this.renderApp();
   }catch(err){this.notify(String(err),true);}finally{this.busy=false;}};
  const reveal=document.querySelector<HTMLElement>('[data-chronology-reveal]');if(reveal)reveal.onclick=()=>{this.revealed=true;this.renderApp();};
  document.querySelectorAll<HTMLElement>('[data-chronology-grade]').forEach(e=>e.onclick=()=>{
   if(!this.revealed)return;
   try{this.save(gradeChronology(this.data,this.reviewIds[this.cursor],e.dataset.chronologyGrade==='correct'));this.cursor++;this.revealed=false;this.renderApp();}
   catch(err){this.notify(String(err),true);}
  });
  document.querySelectorAll<HTMLElement>('[data-chronology-wrong]').forEach(e=>e.onclick=()=>{
   try{this.save(gradeChronology(this.data,e.dataset.chronologyWrong!,false));this.notify('累積誤答数を加算しました。');this.renderApp();}
   catch(err){this.notify(String(err),true);}
  });
  const search=document.querySelector<HTMLInputElement>('#chronology-search');
  if(search)search.onchange=()=>{this.query=search.value;this.visible=50;this.renderApp();};
  const source=document.querySelector<HTMLSelectElement>('#chronology-source');
  if(source)source.onchange=()=>{this.source=source.value;this.visible=50;this.renderApp();};
  const region=document.querySelector<HTMLInputElement>('#chronology-region');
  if(region)region.onchange=()=>{this.region=region.value;this.visible=50;this.renderApp();};
  const more=document.querySelector<HTMLElement>('[data-chronology-more]');
  if(more)more.onclick=()=>{this.visible+=50;this.renderApp();};
  const ex=document.querySelector<HTMLElement>('[data-chronology-export]');
  if(ex)ex.onclick=()=>this.download(JSON.stringify(this.data,null,2),'chronology-error-notebook.json');
  const input=document.querySelector<HTMLInputElement>('#chronology-import');
  if(input)input.onchange=async()=>{const file=input.files?.[0];if(!file)return;
   try{if(file.size>5*1024*1024)throw Error('ファイルは5MB以下にしてください。');
    const incoming=validateChronology(JSON.parse(await file.text()));
    this.save(mergeChronology(this.data,incoming));this.notify('誤答記録を統合しました。');this.renderApp();
   }catch(err){this.notify('取り込みを中止：'+String(err),true);}finally{input.value='';}};
 }
}
