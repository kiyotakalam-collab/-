import {
  EMPTY_YEARS, fetchYearCatalog, openYearDatabase,
  selectYearQuestions, yearProgress, type YearDB,
  type YearFilter, type YearQuestion, type YearSnapshot, type YearStudyMode,
} from './years';

const h = (v: unknown) => String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const percent = (a:number,b:number) => b?Math.round(a/b*100):0;
type Tab='quiz'|'list'|'history';
type Stage='setup'|'studying'|'finished';

export class YearTestUI {
  private database:YearDB|null=null;
  private state:YearSnapshot={catalog:structuredClone(EMPTY_YEARS),events:[],lastSyncAt:null};
  private tab:Tab='quiz';
  private stage:Stage='setup';
  private filter:YearFilter={direction:'event-year',mode:'all',level:'all',region:'all',era:'all'};
  private limit='20';
  private queue:YearQuestion[]=[];
  private index=0;
  private revealed=false;
  private correctInSession=0;
  private sessionId='';
  private busy=false;
  private syncing=false;
  private syncMessage='';
  private search='';
  constructor(private rerender:()=>void,private notify:(message:string,error?:boolean)=>void){}
  async initialize(){
    try{
      this.database=await openYearDatabase();
      this.state=await this.database.load();
      this.rerender();
      void this.sync();
    }catch(error){this.syncMessage='年号の保存領域を開けませんでした: '+String(error);this.rerender();}
  }
  async onOnline(){if(this.database)await this.sync();}
  private async sync(){
    if(this.syncing||!this.database||this.stage==='studying')return;
    this.syncing=true;this.syncMessage='年号データを確認中…';this.rerender();
    try{
      this.state=await fetchYearCatalog(this.database);
      this.syncMessage='取得済み：教材v'+this.state.catalog.version+' ／ '+this.liveItems().length+'件';
    }catch(error){this.syncMessage=error instanceof Error?error.message:'年号データを更新できませんでした。';}
    finally{this.syncing=false;this.rerender();}
  }
  private liveItems(){return this.state.catalog.items.filter(x=>!x.deleted);}
  private questions(){return selectYearQuestions(this.state.catalog,this.state.events,this.filter);}
  private progress(){return yearProgress(this.state.events);}
  render():string{
    const items=this.liveItems(), total=this.state.events.length, correct=this.state.events.filter(x=>x.correct).length, due=selectYearQuestions(this.state.catalog,this.state.events,{direction:'both',mode:'due',level:'all',era:'all',region:'all'}).length;
    const common=`<section class="page-heading"><div><div class="eyebrow">CHRONOLOGY PRACTICE</div><h1>年号テスト</h1><p>文化史とは独立した年号の暗記・復習。年号は指定されたものだけ登録します。</p></div></section>
    <div class="year-stats"><div><span>登録年号</span><strong>${items.length}<small>件</small></strong></div><div><span>回答履歴</span><strong>${total}<small>回</small></strong></div><div><span>累計正答率</span><strong>${percent(correct,total)}<small>%</small></strong></div><div><span>復習対象</span><strong>${due}<small>問</small></strong></div></div>`;
    const tabs=`<div class="year-tabs" role="tablist" aria-label="年号テストメニュー">${([['quiz','年号を学習'],['list','登録一覧'],['history','回答履歴']] as [Tab,string][]).map(([key,label])=>`<button type="button" role="tab" aria-selected="${this.tab===key}" data-year-tab="${key}" class="${this.tab===key?'active':''}">${label}</button>`).join('')}</div>`;
    if(this.tab==='list')return common+tabs+this.list();
    if(this.tab==='history')return common+tabs+this.history();
    return common+tabs+(this.stage==='setup'?this.setup():this.stage==='studying'?this.question():this.finished());
  }
  private setup(){
    const items=this.liveItems(), count=this.questions().length;
    const options=(values:[string,string][],current:string)=>values.map(([value,label])=>`<option value="${h(value)}" ${current===value?'selected':''}>${h(label)}</option>`).join('');
    const regions=[...new Set(items.map(x=>x.region))].sort();
    const eras=[...new Set(items.map(x=>x.era))].sort();
    const filters=`<form id="year-options" class="panel year-setup">
      <div class="year-form-grid">
        <label class="form-field">出題方向<select name="direction">${options([['event-year','出来事 → 年号'],['year-event','年号 → 出来事'],['both','両方向を混ぜる']],this.filter.direction)}</select></label>
        <label class="form-field">出題モード<select name="mode">${options([['all','全範囲'],['unseen','未学習'],['mistakes','誤答した問題'],['due','復習期限が来た問題']],this.filter.mode)}</select></label>
        <label class="form-field">難易度<select name="level">${options([['all','全レベル'],['1','Lv.1 共通テスト'],['2','Lv.2 日東駒専'],['3','Lv.3 MARCH'],['4','Lv.4 早慶']],String(this.filter.level))}</select></label>
        <label class="form-field">地域<select name="region">${options([['all','全地域'],...regions.map(v=>[v,v] as [string,string])],this.filter.region)}</select></label>
        <label class="form-field">時代<select name="era">${options([['all','全時代'],...eras.map(v=>[v,v] as [string,string])],this.filter.era)}</select></label>
        <label class="form-field">一度に出題<select name="limit">${options([['10','10問'],['20','20問'],['all','対象全部']],this.limit)}</select></label>
      </div>
      <div class="year-setup-bottom"><span>対象 <strong>${count}</strong> 問</span><button type="submit" class="button primary" ${count?'':'disabled'}>年号テストを開始</button></div>
    </form>`;
    const empty=items.length?'' : `<section class="panel year-empty"><h2>年号の登録待ち</h2><p>年号はまだ0件です。こちらで勝手に年号を追加しません。指定された出来事・年号・教材写真を受け取ったら、この枠に登録します。</p><span class="small muted">後から追加しても、文化史のカードやこれまでの学習履歴は変更されません。</span></section>`;
    return empty+filters+`<section class="panel year-sync"><div><strong>年号教材の更新</strong><p class="small muted">${h(this.syncMessage||'新しい教材が公開されると自動取得。オフラインでは保存済みの年号を使います。')}</p><span class="small muted">教材v${this.state.catalog.version} · 更新履歴 ${this.state.lastSyncAt?h(new Date(this.state.lastSyncAt).toLocaleDateString('ja-JP')):'なし'}</span></div><div class="year-tools"><button class="button secondary" data-year-action="sync" ${this.syncing?'disabled':''}>最新版を確認</button><button class="button secondary" data-year-action="backup">年号履歴をバックアップ</button><label class="button secondary year-import">年号履歴を復元<input type="file" id="year-restore" accept="application/json,.json"></label></div></section>`;
  }
  private question(){
    const q=this.queue[this.index];if(!q)return this.finished();
    const p=this.progress().get(q.id);
    const source=q.item.sources.map(x=>`<li><a href="${h(x.url)}" target="_blank" rel="noopener noreferrer">${h(x.title)}</a></li>`).join('');
    return `<section class="year-session-head"><button class="text-button" data-year-action="stop">× 年号テストを終了</button><span>${this.index+1} / ${this.queue.length}</span></section>
    <div class="year-track"><span style="width:${percent(this.index,this.queue.length)}%"></span></div>
    <article class="panel year-flashcard"><div class="eyebrow">${this.revealed?'QUESTION & ANSWER':'QUESTION'}</div><div class="year-meta"><span class="level-tag l${q.item.level}">Lv.${q.item.level}</span> ${h(q.item.region)} ／ ${h(q.item.era)} ／ ${q.direction==='event-year'?'出来事から年号':'年号から出来事'}</div><h2 class="year-prompt">${h(q.prompt)}</h2>
    ${this.revealed?`<div class="year-answer"><div class="eyebrow">ANSWER</div><strong>${h(q.answer)}</strong>${q.item.explanation?`<p>${h(q.item.explanation)}</p>`:''}<details><summary>根拠・出典</summary><ul>${source||'<li>出典情報なし</li>'}</ul><p class="small muted">年号ID：${h(q.item.id)}</p></details></div>`:`<button class="year-reveal" data-year-action="reveal">タップして解答を確認</button>`}
    </article>
    ${this.revealed?`<div class="grade-buttons"><button class="grade wrong" data-year-action="wrong" ${this.busy?'disabled':''}>× 思い出せなかった</button><button class="grade correct" data-year-action="correct" ${this.busy?'disabled':''}>○ 正答した</button></div>`:''}
    <div class="year-past">これまでの記録：正答 ${p?.correct??0} ／ 誤答 ${p?.wrong??0}（累積）</div>`;
  }
  private finished(){
    return `<section class="panel year-finished"><div class="eyebrow">SESSION COMPLETE</div><h2>年号テスト終了</h2><div class="year-result"><strong>${this.queue.length}問</strong><strong>正答 ${this.correctInSession}問</strong><strong>正答率 ${percent(this.correctInSession,this.queue.length)}%</strong></div><p class="small muted">正答・誤答は年号テスト専用の履歴に保存しました。</p><button class="button primary" data-year-action="stop">年号テストに戻る</button></section>`;
  }
  private list(){
    const list=this.liveItems().filter(x=>(x.event+' '+x.year+' '+x.region+' '+x.era).toLowerCase().includes(this.search.toLowerCase())).slice(0,500);
    return `<section class="panel year-list"><div class="section-title"><h2>登録済みの年号</h2><span class="small muted">${this.liveItems().length}件</span></div><input id="year-search" type="search" placeholder="出来事・年号・地域で検索" value="${h(this.search)}">${list.length?list.map(x=>`<details class="year-list-item"><summary><span>${h(x.year)}</span><strong>${h(x.event)}</strong><small>Lv.${x.level}</small></summary><p>${h(x.explanation)}</p><p class="small muted">${h(x.region)} / ${h(x.era)}</p>${x.sources.map(t=>`<p class="small"><a href="${h(t.url)}" target="_blank" rel="noopener noreferrer">${h(t.title)}</a></p>`).join('')}</details>`).join(''):'<div class="year-empty-inline">まだ年号は登録されていません。</div>'}</section>`;
  }
  private history(){
    const progress=this.progress(), active=new Set(this.liveItems().map(x=>x.id)), rows=[...progress].filter(([id])=>active.has(id.split('::')[0])).sort((a,b)=>(b[1].lastAt||'').localeCompare(a[1].lastAt||''));
    return `<section class="panel year-list"><div class="section-title"><h2>年号の回答履歴</h2><span class="small muted">${this.state.events.length}回答</span></div>${rows.length?rows.map(([id,p])=>{const entry=this.liveItems().find(x=>x.id===id.split('::')[0]);return `<div class="year-history-row"><span>${h(entry?.event||id)}</span><small>${id.endsWith('year-event')?'年号→出来事':'出来事→年号'}</small><strong>正 ${p.correct} ／ 誤 ${p.wrong}</strong></div>`}).join(''):'<div class="year-empty-inline">学習履歴はまだありません。</div>'}</section>`;
  }
  bind(){
    document.querySelectorAll<HTMLElement>('[data-year-tab]').forEach(el=>el.onclick=()=>{this.tab=el.dataset.yearTab as Tab;this.stage='setup';this.rerender();});
    const form=document.querySelector<HTMLFormElement>('#year-options');
    if(form){
      form.onchange=()=>{
        const d=new FormData(form),number=String(d.get('level'));
        this.filter={direction:String(d.get('direction')) as YearFilter['direction'],mode:String(d.get('mode')) as YearStudyMode,level:number==='all'?'all':Number(number) as YearFilter['level'],era:String(d.get('era')),region:String(d.get('region'))};this.limit=String(d.get('limit'));this.rerender();
      };
      form.onsubmit=e=>{e.preventDefault();this.start();};
    }
    document.querySelectorAll<HTMLElement>('[data-year-action]').forEach(el=>el.onclick=()=>{void this.action(el.dataset.yearAction!);});
    const search=document.querySelector<HTMLInputElement>('#year-search');
    if(search)search.oninput=()=>{this.search=search.value;const pos=search.selectionStart;this.rerender();const next=document.querySelector<HTMLInputElement>('#year-search');next?.focus();try{next?.setSelectionRange(pos,pos);}catch{/* browser dependent */}};
    const restore=document.querySelector<HTMLInputElement>('#year-restore');
    if(restore)restore.onchange=async()=>{const f=restore.files?.[0];if(!f||!this.database)return;try{if(f.size>5_000_000)throw Error('5MB以内の年号バックアップを選んでください。');await this.database.restoreBackup(await f.text());this.state=await this.database.load();this.notify('年号の履歴を統合しました。');this.rerender();}catch(e){this.notify(String(e),true);}finally{restore.value='';}};
  }
  private start(){
    const list=this.questions();
    if(!list.length){this.notify('年号が未登録か、条件に合う問題がありません。');return;}
    // Deterministic order within a session is maintained after selection.
    this.queue=list.sort(()=>Math.random()-.5).slice(0,this.limit==='all'?undefined:Number(this.limit));
    this.index=0;this.revealed=false;this.correctInSession=0;this.sessionId=crypto.randomUUID();this.stage='studying';this.rerender();
  }
  private async action(key:string){
    try{
      if(key==='sync'){await this.sync();return;}
      if(key==='backup'){
        if(!this.database)throw Error('保存領域の読み込み前です。');
        const backup=await this.database.exportBackup(),link=document.createElement('a');
        const url=URL.createObjectURL(new Blob([backup],{type:'application/json'}));link.href=url;link.download='year-test-backup-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return;
      }
      if(key==='stop'){this.stage='setup';this.queue=[];this.revealed=false;this.rerender();return;}
      if(key==='reveal'&&this.stage==='studying'){this.revealed=true;this.rerender();return;}
      if((key==='correct'||key==='wrong')&&this.stage==='studying'&&this.revealed&&!this.busy){
        if(!this.database)throw Error('保存領域が利用できません。');
        this.busy=true;const correct=key==='correct';
        await this.database.addReview(this.queue[this.index].id,correct,this.sessionId);
        if(correct)this.correctInSession++;
        this.index++;this.revealed=false;
        this.state=await this.database.load();this.stage=this.index>=this.queue.length?'finished':'studying';this.busy=false;this.rerender();
      }
    }catch(error){this.busy=false;this.notify(error instanceof Error?error.message:String(error),true);}
  }
}
