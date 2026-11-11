import {CHRONOLOGY_NOTE_KEY,CHRONOLOGY_CAUSES,addChronology,loadChronology,mergeChronology,dueChronology,validateChronology,type ChronologyCollection,type PracticeMode,type PracticeResult} from './chronology-errors';
import {applyChronologyFeed,fetchChronologyFeed,InvalidChronologyFeedError,type ChronologyFeed} from './chronology-sync';
import {PRACTICE_MODES,MASTERY_LABELS,EMPTY_PRACTICE_FILTER,filterPractice,notePractice,selectPractice,shufflePractice,startPractice,recordPractice,updatePractice,sessionResults,type PracticeFilter} from './chronology-practice';
import type {ErrorCause} from './error-causes';
import './chronology-practice.css';
const h=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const opts=(pairs:[string,string][],selected:string)=>pairs.map(([v,t])=>`<option value="${h(v)}" ${v===selected?'selected':''}>${h(t)}</option>`).join('');
const SOURCE_OPTIONS:[string,string][]=[['全レベル問題集','全レベル問題集'],['慶應文学部過去問','慶應文学部過去問'],['その他私大過去問','その他私大過去問'],['共通テスト・センター','共通テスト・センター'],['模試','模試'],['その他の問題演習','その他の問題演習']];
const CAUSE_OPTIONS=Object.entries(CHRONOLOGY_CAUSES) as [string,string][];
const UI_KEY='world-history-chronology-practice-ui-v1';
type Page='home'|'add'|'setup'|'review'|'results'|'list';
export class ChronologyErrorUI {
 private data:ChronologyCollection={version:1,notes:[]};
 private error='';private syncing=false;private syncStatus='未同期';private pendingFeed:ChronologyFeed|null=null;
 private page:Page='home';private filter:PracticeFilter={...EMPTY_PRACTICE_FILTER};private visible=50;
 private selected=new Set<string>();private listScroll=0;private returnPage:Page='home';private lastSessionId='';
 private mode:PracticeMode='random';private limit=20;private randomOrder=false;private revealed=false;private busy=false;
 constructor(private renderApp:()=>void,private notify:(msg:string,error?:boolean)=>void){}
 init(){
  try{this.data=loadChronology(localStorage);this.error='';}catch(e){this.error=e instanceof Error?e.message:String(e);}
  try{const ui=JSON.parse(localStorage.getItem(UI_KEY)||'{}');for(const k of Object.keys(this.filter) as (keyof PracticeFilter)[])if(typeof ui.filter?.[k]==='string'&&ui.filter[k].length<700)this.filter[k]=ui.filter[k];
   this.visible=Number.isInteger(ui.visible)?Math.max(50,Math.min(20000,ui.visible)):50;this.listScroll=Math.max(0,Number(ui.scroll)||0);this.returnPage=ui.returnPage==='list'?'list':'home';this.lastSessionId=typeof ui.lastSessionId==='string'?ui.lastSessionId:'';
  }catch{/* Optional view preferences never prevent learning. */}
  this.restoreRoute();
 }
 restorePosition(){if(this.page==='list')requestAnimationFrame(()=>window.scrollTo({top:this.listScroll,behavior:'instant'}));}
 currentRoute(){return '#/chronology-errors'+(this.page==='home'?'':'/'+this.page);}
 restoreRoute(){const p=location.hash.split('/')[2];this.page=['add','setup','review','results','list'].includes(p)?p as Page:'home';this.revealed=false;}
 private preferences(){try{localStorage.setItem(UI_KEY,JSON.stringify({filter:this.filter,visible:this.visible,scroll:this.listScroll,returnPage:this.returnPage,lastSessionId:this.lastSessionId}));}catch{/* Core history is saved separately and reports storage failures. */}}
 private draw(scroll?:number){this.renderApp();if(scroll!==undefined)requestAnimationFrame(()=>window.scrollTo({top:scroll,behavior:'instant'}));}
 navigate(page:Page,push=true){if(page==='setup')this.returnPage=this.page==='list'?'list':'home';if(this.page==='list'){this.listScroll=window.scrollY;this.preferences();}this.page=page;this.revealed=false;
  if(push)window.history.pushState({...window.history.state,view:'chronology-errors',area:'chronology-errors'},'',this.currentRoute());
  this.draw(page==='list'?this.listScroll:0);
 }
 async sync(manual=false){
  if(this.error||this.syncing)return;this.syncing=true;this.syncStatus='取得中…';if(manual)this.draw();
  try{let feed;try{feed=await fetchChronologyFeed();}catch(e){if(e instanceof InvalidChronologyFeedError||this.data.sync||this.data.notes.length)throw e;feed=await fetchChronologyFeed(new URL('chronology-errors.json',document.baseURI).href);}
   if(this.page==='review'&&this.session()){applyChronologyFeed(this.data,feed);this.pendingFeed=feed;this.syncStatus='演習終了後に教材を反映します。';}
   else{this.save(applyChronologyFeed(this.data,feed));this.syncStatus=`同期済み・教材v${feed.version}`;}
   if(manual)this.notify('問題データを取得しました。学習履歴は保持しています。');
  }catch(e){this.syncStatus='同期失敗：保存済みの問題で学習できます。';if(manual)this.notify(String(e),true);}
  finally{this.syncing=false;if(!['add','review','list','setup'].includes(this.page))this.draw();}
 }
 private applyPending(){if(this.pendingFeed){try{const f=this.pendingFeed;this.save(applyChronologyFeed(this.data,f));this.syncStatus=`同期済み・教材v${f.version}`;this.pendingFeed=null;}catch(e){this.notify(String(e),true);}}}
 summary(){return {count:filterPractice(this.data).length,due:dueChronology(this.data).filter(n=>n.verification!=='provisional').length};}
 private save(next:ChronologyCollection){localStorage.setItem(CHRONOLOGY_NOTE_KEY,JSON.stringify(next));this.data=next;}
 private session(){const id=this.page==='results'?this.lastSessionId:this.data.activePracticeId;return this.data.practiceSessions?.find(s=>s.id===id);}
 private begin(mode:PracticeMode,ids:string[],from:Page=this.page){
  if(from==='list'){this.listScroll=window.scrollY;this.returnPage='list';}else if(from!=='results'&&from!=='review'&&from!=='setup')this.returnPage='home';
  const next=startPractice(this.data,mode,ids);this.save(next);this.lastSessionId=next.activePracticeId!;this.preferences();this.navigate('review');
 }
 private finish(){const s=this.session();if(!s)return;this.save(updatePractice(this.data,s.id,s.position,true));this.lastSessionId=s.id;this.preferences();this.applyPending();this.navigate('results');}
 private grade(result:PracticeResult){if(this.busy||!this.revealed)return;const s=this.session();if(!s||s.finishedAt)return;
  this.busy=true;try{const id=s.questionIds[s.position];this.save(recordPractice(this.data,s.id,id,result));const r=sessionResults(this.data,s.id);
   if(!r.unanswered.length){this.finish();return;}
   const next=s.questionIds.findIndex((id,i)=>i>s.position&&r.unanswered.includes(id));const position=next>=0?next:s.questionIds.findIndex(id=>r.unanswered.includes(id));
   this.save(updatePractice(this.data,s.id,position));this.revealed=false;this.draw(0);
  }catch(e){this.notify(String(e),true);}finally{this.busy=false;}
 }
 private download(){const url=URL.createObjectURL(new Blob([JSON.stringify(this.data,null,2)],{type:'application/json;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='chronology-error-notebook.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 private filters(){const values=(key:'region'|'era'|'source')=>[...new Set(this.data.notes.filter(n=>n.active!==false).map(n=>n[key]).filter(Boolean))].sort().map(x=>[x,x] as [string,string]);
  return `<div class="chrono-filters"><label>キーワード<input id="chronology-search" name="query" type="search" value="${h(this.filter.query)}" placeholder="問い・用語を検索"></label>
  <label>地域<select id="chronology-region" name="region"><option value="">すべて</option>${opts(values('region'),this.filter.region)}</select></label>
  <label>時代<select id="chronology-era" name="era"><option value="">すべて</option>${opts(values('era'),this.filter.era)}</select></label>
  <label>誤答原因<select id="chronology-cause" name="cause"><option value="">すべて</option>${opts([...CAUSE_OPTIONS,['unrecorded','原因未記録']],this.filter.cause)}</select></label>
  <label>定着度<select id="chronology-mastery" name="mastery"><option value="">すべて</option>${opts(Object.entries(MASTERY_LABELS),this.filter.mastery)}</select></label>
  <label>出典<select id="chronology-source" name="source"><option value="">すべて</option>${opts(values('source'),this.filter.source)}</select></label>
  <label>端末への登録日・開始<input name="from" type="date" value="${h(this.filter.from)}"></label><label>登録日・終了<input name="to" type="date" value="${h(this.filter.to)}"></label></div><button class="text-button" data-chron-clear>条件をすべて解除</button>`;
 }
 render():string{
  if(this.error)return `<section class="panel"><h1>通史の誤答ノート</h1><p role="alert">${h(this.error)}</p><p>記録は上書きしていません。データを削除せず確認してください。</p></section>`;
  const total=this.summary().count,due=this.summary().due;
  const heading=`<section class="page-heading"><div><div class="eyebrow">CHRONOLOGY PRACTICE</div><h1>通史の誤答ノート</h1><p>思い出す・見分ける・解き直す。学習履歴は通史だけで管理します。</p></div></section><nav class="chrono-tabs" aria-label="通史メニュー"><button class="button secondary" data-chronology-page="home">概要</button><button class="button secondary" data-chronology-page="setup">演習</button><button class="button secondary" data-chronology-page="list">誤答一覧</button><button class="button secondary" data-chronology-page="add">誤答を登録</button></nav>`;
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
   const rows=filterPractice(this.data,this.filter).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)),selected=rows.filter(n=>this.selected.has(n.id));
   return heading+`<section class="panel chrono-area"><h2>誤答一覧（${rows.length}件）</h2><div data-chron-filters>${this.filters()}</div>
   <div class="chrono-selection"><button class="button secondary" data-chron-select-visible>表示中を選択／解除</button><button class="button primary" data-chron-selected ${selected.length?'':'disabled'}>選択した問題を演習（${selected.length}）</button></div>
   ${rows.slice(0,this.visible).map(n=>{const p=notePractice(n,this.data.practiceEvents);return `<article class="chrono-list-row"><label class="chrono-check"><input type="checkbox" data-chron-check="${h(n.id)}" ${this.selected.has(n.id)?'checked':''}><span>${h(n.question)}</span></label><p class="small muted">${h(n.region)} / ${h(n.era)} · ${h(n.cause?CHRONOLOGY_CAUSES[n.cause]:'原因未記録')} · ${MASTERY_LABELS[p.mastery]}</p><p class="small">累積正答${n.correctCount} · 誤答${n.wrongCount} · 曖昧${n.ambiguousCount??0}</p><details><summary>学習状況・履歴</summary><p>連続正答：${p.history.length||!p.attempts?`${p.streak}回`:'旧履歴のため不明'} · 直近10回答：${p.recentAccuracy===null?'未記録':`${Math.round(p.recentAccuracy*100)}%正答`}</p><p>最終演習：${n.lastReviewedAt?h(new Date(n.lastReviewedAt).toLocaleString('ja-JP')):'未演習'}<br>次回復習：${n.nextReviewAt?h(new Date(n.nextReviewAt).toLocaleString('ja-JP')):'未設定'}</p>${p.history.slice(-10).reverse().map(e=>`<p class="small">${h(new Date(e.answeredAt).toLocaleString('ja-JP'))} · ${PRACTICE_MODES[e.mode]} · ${e.result==='correct'?'○ 正解':e.result==='wrong'?'× 不正解':'△ 曖昧'}</p>`).join('')}</details><button class="button secondary" data-chron-single="${h(n.id)}">この問題を演習</button></article>`;}).join('')||'<p>対象は0件です。地域・時代・原因・定着度・登録日の条件を解除すると対象を広げられます。</p>'}
   ${rows.length>this.visible?'<button class="button secondary" data-chronology-more>さらに表示</button>':''}</section>`;
  }
  if(this.page==='setup'){
   const rows=selectPractice(this.data,this.mode,0,this.filter),n=this.limit?Math.min(this.limit,rows.length):rows.length;
   return heading+`<section class="panel chrono-area"><h2>演習の設定</h2><label class="form-field">演習モード<select id="chronology-mode">${opts(Object.entries(PRACTICE_MODES).filter(([k])=>['due','weak','random','range'].includes(k)),this.mode)}</select></label>
   <div data-chron-filters>${this.filters()}</div><div class="chrono-filters"><label>問題数<select id="chronology-limit">${opts([['5','5問'],['10','10問'],['20','20問'],['0','全問']],String(this.limit))}</select></label><label>出題順<select id="chronology-order">${opts([['priority','モードに応じた順序'],['shuffle','シャッフル']],this.randomOrder?'shuffle':'priority')}</select></label></div>
   <p role="status" id="chronology-target">対象${rows.length}問・今回${n}問</p>${n?'':'<p>対象がありません。今日の復習は期限到来のみ、苦手集中は誤答・曖昧のある問題のみです。条件を解除するか、ランダム演習に切り替えてください。</p>'}<button class="button primary" data-chron-begin ${n?'':'disabled'}>演習を開始</button></section>`;
  }
  if(this.page==='review'){
   const s=this.session(),n=s&&this.data.notes.find(n=>n.id===s.questionIds[s.position]);
   if(!s||!n)return heading+'<section class="panel"><p>途中の演習はありません。演習設定から開始してください。</p><button class="button primary" data-chronology-page="setup">演習を設定</button></section>';
   const r=sessionResults(this.data,s.id),answered=r.events.find(e=>e.noteId===n.id),p=notePractice(n,this.data.practiceEvents);
   return heading+`<section class="panel chrono-area chrono-question"><p class="small">${PRACTICE_MODES[s.mode]} · 回答済み${r.events.length} / ${s.questionIds.length}</p><progress aria-label="演習の進捗" value="${r.events.length}" max="${s.questionIds.length}"></progress><h2>通史の復習 ${s.position+1} / ${s.questionIds.length}</h2><h3>${h(n.question)}</h3>
   ${this.revealed?`<div class="notice"><strong>正しい知識：</strong><p>${h(n.answer)}</p>${n.explanation?`<p>${h(n.explanation)}</p>`:''}${n.source?`<p class="small">出典：${h(n.source)} ${h(n.sourceDetail)}</p>`:''}${n.verificationSources?.length?`<p class="small">検証資料：${n.verificationSources.map(s=>s.url?`<a href="${h(s.url)}" target="_blank" rel="noopener noreferrer">${h(s.title)}</a>`:h(s.title)).join(' / ')}</p>`:''}</div>${answered?`<p>この演習では採点済み：${answered.result==='correct'?'○ 正解':answered.result==='wrong'?'× 不正解':'△ 曖昧'}（再表示では加算しません）</p>`:`<div class="chrono-grade"><button class="button primary" data-chronology-grade="correct">○ 正解</button><button class="button secondary" data-chronology-grade="wrong">× 不正解</button><button class="button secondary" data-chronology-grade="ambiguous">△ 曖昧</button></div><p class="small muted">曖昧は正答にせず、10分後に再確認します。</p>`}`:'<button class="button primary" data-chronology-reveal>答えを見る</button>'}
   <p class="small muted">累積正答${n.correctCount} · 誤答${n.wrongCount} · 曖昧${n.ambiguousCount??0} · 連続正答${p.history.length||!p.attempts?`${p.streak}回`:'旧履歴のため不明'}</p>
   <div class="chrono-move"><button class="button secondary" data-chron-move="-1" ${s.position?'':'disabled'}>前の問題</button><button class="button secondary" data-chron-move="1" ${s.position<s.questionIds.length-1?'':'disabled'}>次の問題</button></div><div class="chrono-secondary-actions"><button class="text-button" data-chron-pause>途中保存して概要へ</button><button class="text-button" data-chron-finish>ここまでの結果を保存して終了</button>${r.unanswered.length>1?'<button class="text-button" data-chron-shuffle>未回答をシャッフルして再開</button>':''}</div></section>`;
  }
  if(this.page==='results'){
   const r=sessionResults(this.data,this.lastSessionId),rate=r.events.length?Math.round(r.correct.length/r.events.length*100):0;
   const list=(ids:string[])=>ids.map(id=>{const n=this.data.notes.find(x=>x.id===id);if(!n)return '';const p=notePractice(n,this.data.practiceEvents);return `<li><strong>${h(n.question)}</strong><p class="small">${p.missStreak>=2?`連続誤答${p.missStreak}回 · `:''}次回復習：${n.nextReviewAt?h(new Date(n.nextReviewAt).toLocaleString('ja-JP')):'未設定'}</p></li>`;}).join('');
   return heading+`<section class="panel chrono-area"><h2>演習結果</h2><p>${r.session?PRACTICE_MODES[r.session.mode]:''} · 正答率${rate}%（正答${r.correct.length} / 回答${r.events.length}）</p><p>不正解${r.wrong.length} · 曖昧${r.ambiguous.length} · 未回答${r.unanswered.length}（誤答には数えません）</p><h3>今回間違えた問題</h3>${r.wrong.length?`<ul>${list(r.wrong.map(e=>e.noteId))}</ul>`:'<p>ありません。</p>'}<h3>曖昧だった問題</h3>${r.ambiguous.length?`<ul>${list(r.ambiguous.map(e=>e.noteId))}</ul>`:'<p>ありません。</p>'}<details><summary>今回の全回答と復習予定</summary><ul>${list(r.events.map(e=>e.noteId))}</ul></details>
   <div class="review-actions"><button class="button primary" data-chron-retry="wrong" ${r.wrong.length?'':'disabled'}>間違えた問題だけ再演習</button><button class="button secondary" data-chron-retry="ambiguous" ${r.ambiguous.length?'':'disabled'}>曖昧な問題を再演習</button><button class="button secondary" data-chron-return>${this.returnPage==='list'?'元の一覧に戻る':'概要に戻る'}</button></div></section>`;
  }
  const active=this.data.practiceSessions?.find(s=>s.id===this.data.activePracticeId),last=(this.data.practiceSessions??[]).slice(-10).reverse();
  return heading+`<section class="panel chrono-area"><h2>学び方を選ぶ</h2><p>登録${total}問 · 今日の復習${due}問</p>${active?`<button class="button primary" data-chron-resume>続きから演習（${sessionResults(this.data,active.id).events.length} / ${active.questionIds.length}回答済み）</button>`:''}<div class="chrono-mode-grid">${(['due','weak','random','range'] as PracticeMode[]).map(m=>`<button class="button secondary" data-chron-mode="${m}">${PRACTICE_MODES[m]}</button>`).join('')}</div><div class="review-actions"><button class="text-button" data-chronology-start="due" ${due?'':'disabled'}>今日の復習を全問</button><button class="text-button" data-chronology-start="all" ${total?'':'disabled'}>全件を再テスト</button></div></section>
  <section class="panel"><h2>Google Sheetsの問題マスター</h2><p class="small">ChatGPTがシートへ登録・読み戻しし、GitHubへ配信した問題を取得します。シートのみの直接編集は無人反映されません。</p><p role="status">${h(this.syncStatus)} · 有効${total}件 / 保存${this.data.notes.length}件</p>${this.data.sync?`<p class="small muted">最終成功：${h(new Date(this.data.sync.lastSyncedAt).toLocaleString('ja-JP'))}</p>`:''}<button class="button secondary" data-chronology-sync ${this.syncing?'disabled':''}>今すぐ同期</button></section>
  <section class="panel"><h2>演習履歴</h2>${last.map(s=>{const r=sessionResults(this.data,s.id);return `<p><button class="text-button" data-chron-result="${h(s.id)}">${h(new Date(s.startedAt).toLocaleString('ja-JP'))} · ${PRACTICE_MODES[s.mode]} · ○${r.correct.length} ×${r.wrong.length} △${r.ambiguous.length} ${s.finishedAt?'保存済み':'途中保存'}</button></p>`;}).join('')||'<p>まだ演習していません。</p>'}<details><summary>定着度・苦手集中の基準</summary><p>未演習は回答0回。旧形式で詳細履歴がない問題は再判定待ち。新しい演習で連続正答3回未満は定着初期、3回以上は定着途中。7日以上にわたり、期限到来後の正答を2回以上含む連続3正答で安定。曖昧・誤答は連続正答を止めます。期限超過だけでは定着度を下げません。</p><p>苦手集中は直近10回答の正答率・再失点と連続誤答を重視し、累積誤答は上限付きで加点します。未記録の直近成績は推測しません。</p></details></section>
  <section class="panel"><h2>バックアップ</h2><p class="small muted">通史専用。既存の成績・演習履歴・途中の演習を含みます。</p><button class="button secondary" data-chronology-export>JSONを書き出す</button><label class="form-field">保存したJSONを統合<input id="chronology-import" type="file" accept=".json,application/json"></label></section>`;
 }
 bind(){
  const sync=document.querySelector<HTMLElement>('[data-chronology-sync]');if(sync)sync.onclick=()=>void this.sync(true);
  const safe=(fn:()=>void)=>{try{fn();}catch(e){this.notify(String(e),true);}};
  document.querySelectorAll<HTMLElement>('[data-chronology-page]').forEach(e=>e.onclick=()=>this.navigate(e.dataset.chronologyPage as Page));
  document.querySelectorAll<HTMLElement>('[data-chron-mode]').forEach(e=>e.onclick=()=>{this.mode=e.dataset.chronMode as PracticeMode;this.navigate('setup');});
  document.querySelectorAll<HTMLElement>('[data-chronology-start]').forEach(e=>e.onclick=()=>safe(()=>{const m=e.dataset.chronologyStart==='due'?'due':'random';this.begin(m,selectPractice(this.data,m,0).map(n=>n.id));}));
  const form=document.querySelector<HTMLFormElement>('#chronology-add-form');
  if(form)form.onsubmit=e=>{e.preventDefault();if(this.busy)return;this.busy=true;
   try{const f=new FormData(form),raw={
     question:String(f.get('question')||''),answer:String(f.get('answer')||''),
     explanation:String(f.get('explanation')||''),source:String(f.get('source')||''),
     sourceDetail:String(f.get('sourceDetail')||''),region:String(f.get('region')||''),
     era:String(f.get('era')||''),cause:String(f.get('cause')||'') as ErrorCause
    };this.save(addChronology(this.data,raw));this.notify('誤答を登録しました。翌日以降の復習管理に反映されます。');this.navigate('home');
   }catch(err){this.notify(String(err),true);}finally{this.busy=false;}};
  document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('[data-chron-filters] input,[data-chron-filters] select').forEach(e=>e.onchange=()=>{this.filter[e.name as keyof PracticeFilter]=e.value;this.visible=50;this.listScroll=0;this.preferences();this.draw();});
  const clear=document.querySelector<HTMLElement>('[data-chron-clear]');if(clear)clear.onclick=()=>{this.filter={...EMPTY_PRACTICE_FILTER};this.visible=50;this.preferences();this.draw();};
  const more=document.querySelector<HTMLElement>('[data-chronology-more]');if(more)more.onclick=()=>{this.visible+=50;this.preferences();this.draw(window.scrollY);};
  document.querySelectorAll<HTMLInputElement>('[data-chron-check]').forEach(e=>e.onchange=()=>{e.checked?this.selected.add(e.dataset.chronCheck!):this.selected.delete(e.dataset.chronCheck!);this.draw(window.scrollY);});
  const selectVisible=document.querySelector<HTMLElement>('[data-chron-select-visible]');if(selectVisible)selectVisible.onclick=()=>{const rows=filterPractice(this.data,this.filter).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||a.id.localeCompare(b.id)).slice(0,this.visible),all=rows.every(n=>this.selected.has(n.id));rows.forEach(n=>all?this.selected.delete(n.id):this.selected.add(n.id));this.draw(window.scrollY);};
  const selected=document.querySelector<HTMLElement>('[data-chron-selected]');if(selected)selected.onclick=()=>safe(()=>this.begin('selected',filterPractice(this.data,this.filter).filter(n=>this.selected.has(n.id)).map(n=>n.id),'list'));
  document.querySelectorAll<HTMLElement>('[data-chron-single]').forEach(e=>e.onclick=()=>safe(()=>this.begin('single',[e.dataset.chronSingle!],'list')));
  const mode=document.querySelector<HTMLSelectElement>('#chronology-mode');if(mode)mode.onchange=()=>{this.mode=mode.value as PracticeMode;this.draw();};
  const limit=document.querySelector<HTMLSelectElement>('#chronology-limit');if(limit)limit.onchange=()=>{this.limit=Number(limit.value);this.draw();};
  const order=document.querySelector<HTMLSelectElement>('#chronology-order');if(order)order.onchange=()=>{this.randomOrder=order.value==='shuffle';};
  const begin=document.querySelector<HTMLElement>('[data-chron-begin]');if(begin)begin.onclick=()=>safe(()=>{let rows=selectPractice(this.data,this.mode,this.limit,this.filter);if(this.randomOrder)rows=shufflePractice(rows);this.begin(this.mode,rows.map(n=>n.id));});
  const reveal=document.querySelector<HTMLElement>('[data-chronology-reveal]');if(reveal)reveal.onclick=()=>{this.revealed=true;this.draw();};
  document.querySelectorAll<HTMLElement>('[data-chronology-grade]').forEach(e=>e.onclick=()=>this.grade(e.dataset.chronologyGrade as PracticeResult));
  document.querySelectorAll<HTMLElement>('[data-chron-move]').forEach(e=>e.onclick=()=>safe(()=>{const s=this.session();if(!s)return;this.save(updatePractice(this.data,s.id,s.position+Number(e.dataset.chronMove)));this.revealed=false;this.draw(0);}));
  const pause=document.querySelector<HTMLElement>('[data-chron-pause]');if(pause)pause.onclick=()=>this.navigate('home');
  const finish=document.querySelector<HTMLElement>('[data-chron-finish]');if(finish)finish.onclick=()=>safe(()=>this.finish());
  const resume=document.querySelector<HTMLElement>('[data-chron-resume]');if(resume)resume.onclick=()=>this.navigate('review');
  const shuffle=document.querySelector<HTMLElement>('[data-chron-shuffle]');if(shuffle)shuffle.onclick=()=>safe(()=>{const s=this.session();if(s)this.begin(s.mode,shufflePractice(sessionResults(this.data,s.id).unanswered),'review');});
  const back=document.querySelector<HTMLElement>('[data-chron-return]');if(back)back.onclick=()=>this.navigate(this.returnPage);
  document.querySelectorAll<HTMLElement>('[data-chron-retry]').forEach(e=>e.onclick=()=>safe(()=>{const r=sessionResults(this.data,this.lastSessionId),ids=(e.dataset.chronRetry==='wrong'?r.wrong:r.ambiguous).map(x=>x.noteId);this.begin('retry',shufflePractice(ids),'results');}));
  document.querySelectorAll<HTMLElement>('[data-chron-result]').forEach(e=>e.onclick=()=>{this.lastSessionId=e.dataset.chronResult!;this.preferences();this.navigate('results');});
  const ex=document.querySelector<HTMLElement>('[data-chronology-export]');if(ex)ex.onclick=()=>this.download();
  const file=document.querySelector<HTMLInputElement>('#chronology-import');if(file)file.onchange=async()=>{const f=file.files?.[0];if(!f)return;try{if(f.size>5*1024*1024)throw Error('ファイルは5MB以下にしてください。');this.save(mergeChronology(this.data,validateChronology(JSON.parse(await f.text()))));this.notify('誤答記録を統合しました。');this.draw();}catch(e){this.notify('取り込みを中止：'+String(e),true);}finally{file.value='';}};
 }
}
