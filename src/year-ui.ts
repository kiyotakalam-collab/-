import {
  EMPTY_YEARS, fetchYearCatalog, openYearDatabase, selectYearQuestions, yearProgress,
  type YearDB, type YearFilter, type YearQuestion, type YearSnapshot, type YearStudyMode,
} from './years';
import { YearChronologyUI } from './year-chronology-ui';

const h = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const percent = (a: number, b: number) => b ? Math.round(a / b * 100) : 0;
const directions = {'event-year':'出来事 → 年号', 'year-event':'年号 → 出来事'};
const defaults = (): YearFilter => ({direction:'event-year', mode:'all', level:'all', region:'all', era:'all'});
export type YearPage = 'home' | 'quiz' | 'list' | 'history' | 'review' | 'ordering' | 'timeline';
type Stage = 'setup' | 'studying' | 'finished';

export class YearTestUI {
  private database: YearDB | null = null;
  private loaded = false;
  private state: YearSnapshot = {catalog:structuredClone(EMPTY_YEARS), events:[], lastSyncAt:null, orderingEvents:[]};
  private chronology = new YearChronologyUI(()=>this.state,()=>this.database,async()=>{if(this.database)this.state=await this.database.load();},()=>this.rerender(),(text,error)=>this.notify(text,error),async()=>{if(this.syncPromise)await this.syncPromise;});
  private tab: YearPage = 'home';
  private stage: Stage = 'setup';
  private filter = defaults();
  private limit = '20';
  private queue: YearQuestion[] = [];
  private index = 0;
  private revealed = false;
  private correctInSession = 0;
  private sessionId = '';
  private busy = false;
  private generation = 0;
  private starting = false;
  private syncPending = false;
  private syncPromise: Promise<void> | null = null;
  private syncMessage = '';
  private search = '';
  private listFilter = {level:'all', region:'all', era:'all'};
  private listLimit = 50;
  private historyLimit = 50;
  constructor(private rerender: () => void, private notify: (message: string, error?: boolean) => void) {}

  async initialize() {
    try {
      this.database = await openYearDatabase();
      this.state = await this.database.load();
      this.loaded = true;
      this.rerender();
      void this.sync();
    } catch (error) {
      this.syncMessage = '年号の保存領域を開けませんでした：' + String(error);
      this.rerender();
    }
  }
  currentPage(): YearPage { return this.tab; }
  insightSnapshot():YearSnapshot|null { return this.loaded?this.state:null; }
  async startSelectedQuestions(ids:string[]) {
    if(this.starting||this.busy||!this.database)return;
    const generation=this.generation;this.starting=true;this.rerender();
    try{
      if(this.syncPromise)await this.syncPromise;
      const latest=await this.database.load();if(generation!==this.generation)return;this.state=latest;
      const available=new Map(this.questions(defaults()).map(question=>[question.id,question]));
      const selected=[...new Set(ids)].flatMap(id=>available.has(id)?[available.get(id)!]:[]);
      if(!selected.length){this.notify('現在、この範囲に出題可能な年号はありません。');return;}
      this.filter=defaults();this.queue=selected;this.index=0;this.revealed=false;this.correctInSession=0;this.sessionId=crypto.randomUUID();this.stage='studying';
    }catch(error){this.notify(String(error),true);}finally{this.starting=false;this.rerender();}
  }
  navigate(tab: YearPage) {
    if (this.tab !== tab) this.leave();
    this.tab = tab;
  }
  leave() {
    this.generation++;
    this.chronology.leave();
    this.stage = 'setup'; this.queue = []; this.revealed = false;
    if (this.syncPending) void this.sync();
  }
  async onOnline() { if (this.database) await this.sync(); }
  private sync(): Promise<void> {
    if (!this.database) return Promise.resolve();
    if (this.stage === 'studying' || this.chronology.isStudying()) { this.syncPending = true; return Promise.resolve(); }
    if (this.syncPromise) return this.syncPromise;
    this.syncPending = false;
    this.syncMessage = '年号教材を確認中…';
    this.syncPromise = (async () => {
      try {
        this.state = await fetchYearCatalog(this.database!);
        this.syncMessage = `取得済み：教材v${this.state.catalog.version} ／ ${this.liveItems().length}件`;
      } catch (error) {
        this.syncMessage = error instanceof Error ? error.message : '年号教材を更新できませんでした。';
      } finally { this.syncPromise = null; this.rerender(); }
    })();
    this.rerender();
    return this.syncPromise;
  }
  private liveItems() { return this.state.catalog.items.filter(x => !x.deleted); }
  private questions(filter = this.filter) { return selectYearQuestions(this.state.catalog, this.state.events, {...filter, direction:'event-year'}); }
  private progress() { return yearProgress(this.state.events); }
  summary() {
    const items = this.liveItems(), progress = this.progress();
    const events=this.state.events.filter(x=>x.questionId.endsWith('::event-year'));
    return {count:items.length, learned:items.filter(x => progress.has(x.id+'::event-year')).length,
      total:events.length, correct:events.filter(x => x.correct).length,
      wrong:events.filter(x => !x.correct).length,
      due:this.questions({...defaults(), mode:'due'}).length, mistakes:this.questions({...defaults(), mode:'mistakes'}).length,
      unseen:this.questions({...defaults(), mode:'unseen'}).length};
  }
  render(): string {
    const titles: Record<YearPage, [string, string]> = {
      home:['年号ホーム', '出来事と年号を、ひとつずつ確かな記憶に。'],
      quiz:['年号の問題演習', '出来事から年号を思い出す、一問一答の演習。'],
      list:['年号一覧', '登録した年号・出来事・出典を確認できます。'],
      history:['年号の学習履歴', '思い出した年号と、次に復習する問題を確認。'],
      review:['年号の復習管理', '復習のタイミングと、苦手な問題を確認。'],
      ordering:['年代整序テスト', '出来事の前後関係を、4件ずつ確かめます。'],
      timeline:['インタラクティブ年表', '重要な年号を、歴史の流れでつなげます。'],
    };
    const [title, description] = titles[this.tab];
    const content = this.tab === 'home' ? this.home() : this.tab === 'list' ? this.list() : this.tab === 'history' ? this.history()
      : this.tab === 'review' ? this.review() : this.tab === 'ordering' ? this.chronology.ordering() : this.tab === 'timeline' ? this.chronology.timelineView() : this.stage === 'setup' ? this.setup() : this.stage === 'studying' ? this.question() : this.finished();
    return `<div class="year-area" data-year-page="${this.tab}"><section class="page-heading"><div><div class="eyebrow">CHRONOLOGY</div><h1>${title}</h1><p>${description}</p></div></section>${content}</div>`;
  }
  private stat(label: string, value: string | number, unit: string) {
    return `<div class="chronology-stat"><span>${label}</span><strong>${value}<small>${unit}</small></strong></div>`;
  }
  private empty() {
    return `<section class="panel chronology-empty"><span class="chronology-empty-mark" aria-hidden="true">01</span><h2>年号はまだ登録されていません</h2><p>登録年号は0件です。指定した教材が追加されると、このエリアで学習できます。</p><p class="small muted">登録後はオンラインで自動取得し、保存済みの教材をオフラインでも利用できます。</p></section>`;
  }
  private shortcut(mode: YearStudyMode, label: string, count?: number) {
    return `<button class="chronology-shortcut" data-year-start="${mode}"><span>${label}</span>${count === undefined ? '<span aria-hidden="true">→</span>' : `<strong>${count}<small>問</small></strong>`}</button>`;
  }
  private home() {
    const s = this.summary();
    return `<section class="chronology-hero"><div class="eyebrow">ONE DATE AT A TIME</div><h2>年号を、確かな記憶に。</h2><p>出来事から年号を思い出す。<br>一問ずつ、記憶を確かめましょう。</p><button class="button primary" data-year-start="all">全範囲で学習 <span aria-hidden="true">→</span></button></section>
      <section class="panel chronology-actions"><h2>前後関係と同時代を学ぶ</h2><button class="chronology-shortcut" data-year-page-link="ordering"><span>年代整序テスト<small>4つの出来事を古い順に</small></span><span aria-hidden="true">→</span></button><button class="chronology-shortcut" data-year-page-link="timeline"><span>インタラクティブ年表<small>重要年号と歴史の流れ</small></span><span aria-hidden="true">→</span></button></section>
      <section class="chronology-stats" aria-label="年号の学習統計">${this.stat('登録年号',s.count,'件')}${this.stat('学習済み年号',s.learned,'件')}${this.stat('累積回答',s.total,'回')}${this.stat('正答率',percent(s.correct,s.total),'%')}${this.stat('誤答履歴のある問題',s.mistakes,'問')}${this.stat('復習期限到来',s.due,'問')}</section>
      <section class="panel chronology-actions"><div class="section-title"><h2>今日の学習</h2><span class="small muted">出来事 → 年号</span></div>${this.shortcut('unseen','未学習の年号',s.unseen)}${this.shortcut('mistakes','間違えた年号',s.mistakes)}${this.shortcut('due','今日の復習',s.due)}<button class="chronology-shortcut" data-year-page-link="quiz"><span>範囲を指定して学習</span><span aria-hidden="true">→</span></button></section>${s.count ? '' : this.empty()}`;
  }
  private options(values: [string,string][], current: string) {
    return values.map(([value,label]) => `<option value="${h(value)}" ${current === value ? 'selected' : ''}>${h(label)}</option>`).join('');
  }
  private filters(list: boolean) {
    const items = this.liveItems(), current = list ? this.listFilter : this.filter;
    const levels: [string,string][] = [['all','全レベル'],['1','Lv.1 共通テスト'],['2','Lv.2 日東駒専'],['3','Lv.3 MARCH'],['4','Lv.4 早慶']];
    const regions = [...new Set(items.map(x => x.region))].sort(), eras = [...new Set(items.map(x => x.era))].sort();
    return `<label class="form-field">難易度<select name="${list?'listLevel':'level'}">${this.options(levels,String(current.level))}</select></label><label class="form-field">地域<select name="${list?'listRegion':'region'}">${this.options([['all','全地域'],...regions.map(v => [v,v] as [string,string])],current.region)}</select></label><label class="form-field">時代<select name="${list?'listEra':'era'}">${this.options([['all','全時代'],...eras.map(v => [v,v] as [string,string])],current.era)}</select></label>`;
  }
  private setup() {
    const count = this.questions().length, actual = Math.min(count, this.limit === 'all' ? count : Number(this.limit));
    const reason = this.liveItems().length ? this.filter.mode === 'due' ? '現在、復習期限が来ている問題はありません。' : 'この条件に合う問題がありません。出題範囲を変更してください。' : '年号が0件のため、まだ演習を開始できません。';
    return `${this.liveItems().length ? '' : this.empty()}<form id="year-options" class="panel chronology-setup"><p class="chronology-direction-badge">出来事 → 年号</p>
      <div class="chronology-form-grid"><label class="form-field">出題モード<select name="mode">${this.options([['all','全範囲'],['unseen','未学習'],['mistakes','誤答履歴あり'],['due','復習期限到来'],['weak','苦手優先']],this.filter.mode)}</select></label>${this.filters(false)}<label class="form-field">1回の出題数<select name="limit">${this.options([['10','10問'],['20','20問'],['all','全問']],this.limit)}</select></label></div>
      <p class="small muted">難易度は選んだレベルのみを出題します。</p><div class="chronology-setup-total year-setup-bottom" aria-live="polite">対象 <strong>${count}</strong> 問 <span>今回 ${actual} 問</span></div>${count ? '' : `<p class="chronology-no-match" role="status">${reason}</p>`}<button type="submit" class="button primary chronology-start" ${!count || this.starting || !this.database ? 'disabled' : ''}>${this.starting ? '教材を確認中…' : '年号テストを開始'}</button></form>`;
  }
  private sources(item: YearQuestion['item']) {
    return item.sources.length ? item.sources.map(x => `<li><a href="${h(x.url)}" target="_blank" rel="noopener noreferrer">${h(x.title)}</a></li>`).join('') : '<li>出典情報なし</li>';
  }
  private question() {
    const q = this.queue[this.index]; if (!q) return this.finished();
    const p = this.progress().get(q.id);
    return `<section class="chronology-session"><div class="chronology-session-top"><button class="text-button" data-year-action="stop">演習を終了</button><strong>${this.index+1}<span> / ${this.queue.length} 問</span></strong></div><div class="year-track" role="progressbar" aria-label="年号演習の進捗" aria-valuenow="${this.index}" aria-valuemin="0" aria-valuemax="${this.queue.length}"><span style="width:${percent(this.index,this.queue.length)}%"></span></div>
      <article class="panel chronology-question"><span class="chronology-direction-badge">${directions[q.direction]}</span><div class="chronology-question-meta"><span class="level-tag l${q.item.level}">Lv.${q.item.level}</span><span>${h(q.item.region)} · ${h(q.item.era)}</span></div><p class="eyebrow">QUESTION ${String(this.index+1).padStart(2,'0')}</p><h2 class="year-prompt">${h(q.prompt)}</h2>
      ${this.revealed ? `<div class="year-answer chronology-answer"><span class="eyebrow">ANSWER</span><strong>${h(q.answer)}</strong>${q.item.explanation ? `<p>${h(q.item.explanation)}</p>` : ''}<details><summary>解説・出典を確認</summary><ul>${this.sources(q.item)}</ul><p class="small muted">固定ID：${h(q.item.id)}</p></details></div>` : `<button class="chronology-reveal" data-year-action="reveal">解答を表示 <span aria-hidden="true">↓</span></button>`}</article>
      <p class="year-past">これまでの累積記録：正答 ${p?.correct??0} ／ 誤答 ${p?.wrong??0}</p>${this.revealed ? `<div class="chronology-grade"><button class="chronology-wrong" data-year-action="wrong" ${this.busy?'disabled':''}><strong>×</strong><span>思い出せなかった</span></button><button class="chronology-correct" data-year-action="correct" ${this.busy?'disabled':''}><strong>○</strong><span>正答した</span></button></div>` : ''}</section>`;
  }
  private finished() {
    return `<section class="panel chronology-finished"><div class="eyebrow">SESSION COMPLETE</div><h2>年号テスト終了</h2><div class="chronology-stats">${this.stat('回答数',this.queue.length,'問')}${this.stat('正答',this.correctInSession,'問')}${this.stat('正答率',percent(this.correctInSession,this.queue.length),'%')}</div><p>今回の回答を年号専用の履歴に保存しました。</p><button class="button primary" data-year-action="stop">出題設定に戻る</button><button class="button secondary" data-year-page-link="home">年号ホームへ</button></section>`;
  }
  private list() {
    const matching = this.liveItems().filter(x => (this.listFilter.level === 'all' || String(x.level) === this.listFilter.level) && (this.listFilter.region === 'all' || x.region === this.listFilter.region) && (this.listFilter.era === 'all' || x.era === this.listFilter.era) && `${x.event} ${x.year} ${x.region} ${x.era}`.toLocaleLowerCase('ja').includes(this.search.toLocaleLowerCase('ja')));
    return `<section class="panel chronology-list"><label class="form-field">年号を検索<input id="year-search" type="search" placeholder="年号・出来事・地域" value="${h(this.search)}"></label><form id="year-list-options" class="chronology-form-grid">${this.filters(true)}</form><p class="small muted" aria-live="polite">${matching.length}件が対象 · ${Math.min(this.listLimit,matching.length)}件を表示</p>${matching.length ? matching.slice(0,this.listLimit).map(x => `<details class="year-list-item chronology-list-item"><summary><span class="chronology-list-year">${h(x.year)}</span><strong>${h(x.event)}</strong><span class="small muted">${h(x.region)} · ${h(x.era)} · Lv.${x.level}</span></summary><p>${h(x.explanation || '補足説明はありません。')}</p><ul>${this.sources(x)}</ul></details>`).join('') : `<div class="year-empty-inline">${this.liveItems().length ? '条件に合う年号がありません。' : '年号はまだ登録されていません。登録年号0件。'}</div>`}${matching.length > this.listLimit ? '<button class="button secondary" data-year-action="list-more">さらに50件表示</button>' : ''}</section>`;
  }
  private questionLabel(id: string) {
    const direction = id.endsWith('::year-event') ? 'year-event' : 'event-year';
    const entry = this.state.catalog.items.find(x => x.id === id.slice(0,id.lastIndexOf('::')));
    return {direction, entry, title:entry ? `${entry.year} · ${entry.event}` : id};
  }
  private mastery() {
    const progress = this.progress(), items = this.liveItems();
    return `<section class="panel chronology-mastery"><div class="section-title"><h2>年号の習熟</h2></div>${(['event-year'] as const).map(direction => {
      const values = items.map(x => progress.get(x.id+'::'+direction));
      const studied = values.filter(Boolean).length, correct = values.reduce((a,p) => a+(p?.correct??0),0), wrong = values.reduce((a,p) => a+(p?.wrong??0),0);
      return `<div class="chronology-mastery-row"><strong>${directions[direction]}</strong><span>学習済み ${studied} / ${items.length}問 · 正答率 ${percent(correct,correct+wrong)}%</span><div class="progress-track"><span style="width:${percent(studied,items.length)}%"></span></div></div>`;
    }).join('')}</section>`;
  }
  private history() {
    const s = this.summary(), progress = this.progress();
    const recent = [...this.state.events].sort((a,b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
    const weak = this.questions({...defaults(),mode:'weak'}).filter(q => (progress.get(q.id)?.wrong??0)>0).slice(0,10);
    return `<section class="chronology-stats" aria-label="年号の累積成績">${this.stat('累積正答',s.correct,'回')}${this.stat('累積誤答',s.wrong,'回')}${this.stat('正答率',percent(s.correct,s.total),'%')}${this.stat('未学習の問題',s.unseen,'問')}${this.stat('復習期限到来',s.due,'問')}</section>${this.mastery()}<section class="panel chronology-list"><div class="section-title"><h2>苦手な年号</h2><span class="small muted">累積誤答を保持</span></div>${weak.length ? weak.map(q => {const p=progress.get(q.id)!;return `<div class="chronology-history-row"><strong>${h(q.item.year)} · ${h(q.item.event)}</strong><span>${directions[q.direction]}</span><span>累積正答 ${p.correct} ／ 累積誤答 ${p.wrong}</span></div>`;}).join('') : '<p class="year-empty-inline">誤答履歴のある問題はありません。</p>'}</section><section class="panel chronology-list"><div class="section-title"><h2>最近の回答履歴</h2><span class="small muted">保存済み ${recent.length}回答</span></div>${recent.length ? recent.slice(0,this.historyLimit).map(ev => {const q=this.questionLabel(ev.questionId);return `<div class="chronology-history-row"><strong>${ev.correct?'○':'×'} ${h(q.title)}</strong><span>${q.direction==='year-event'?'旧形式の回答記録':directions['event-year']}</span><time class="small muted" datetime="${h(ev.at)}">${h(new Date(ev.at).toLocaleString('ja-JP'))}</time></div>`;}).join('') : '<div class="year-empty-inline">学習履歴はまだありません。</div>'}${recent.length > this.historyLimit ? '<button class="button secondary" data-year-action="history-more">さらに50回答表示</button>' : ''}</section>`;
  }
  private review() {
    const s = this.summary(), progress = this.progress();
    const due = this.questions({...defaults(),mode:'due'}).slice(0,20);
    return `<section class="chronology-stats">${this.stat('復習期限到来',s.due,'問')}${this.stat('誤答履歴あり',s.mistakes,'問')}${this.stat('未学習',s.unseen,'問')}</section><section class="panel chronology-actions"><h2>復習する範囲</h2>${this.shortcut('due','今日の復習',s.due)}${this.shortcut('weak','苦手な問題から学習')}${this.shortcut('mistakes','誤答履歴のある問題',s.mistakes)}<p class="small muted">直近の正誤・連続正答・復習期限から優先順位を決めます。正答しても累積誤答は保持されます。</p></section><section class="panel chronology-list"><h2>復習期限が来ている問題</h2>${due.length ? due.map(q => `<div class="chronology-history-row"><strong>${h(q.item.year)} · ${h(q.item.event)}</strong><span>${directions[q.direction]}</span><span class="small muted">復習期限 ${h(new Date(progress.get(q.id)!.dueAt).toLocaleString('ja-JP'))}</span></div>`).join('') : '<p class="year-empty-inline">現在、復習期限が来ている問題はありません。</p>'}</section>`;
  }
  renderTools() {
    return `<section class="panel settings-panel year-area chronology-tools"><div class="section-title"><h2>年号のデータ管理</h2><span class="subtle-chip">年号専用</span></div><p>年号教材と回答履歴を、この端末に保存します。</p><p class="small" role="status">${h(this.syncMessage || '保存済みの年号を読み込んでいます。')}</p><p class="small muted">登録 ${this.liveItems().length}件 · 教材v${this.state.catalog.version}<br>最終確認 ${this.state.lastSyncAt ? h(new Date(this.state.lastSyncAt).toLocaleString('ja-JP')) : '未取得'}</p><div class="chronology-tool-buttons"><button class="button secondary" data-year-action="sync" ${this.syncPromise?'disabled':''}>年号教材の最新版を確認</button><button class="button secondary" data-year-action="backup" ${this.database?'':'disabled'}>年号履歴をバックアップ</button><label class="button secondary year-import">年号履歴を復元<input type="file" id="year-restore" accept="application/json,.json"></label></div><p class="small muted">年号用JSONの復元は、年号の履歴に統合します。文化史のデータは別の保存領域で管理します。</p></section>`;
  }
  bind() {
    this.chronology.bind();
    document.querySelectorAll<HTMLElement>('[data-year-page-link]').forEach(el => el.onclick = () => {this.navigate(el.dataset.yearPageLink as YearPage);this.rerender();});
    document.querySelectorAll<HTMLElement>('[data-year-start]').forEach(el => el.onclick = () => {this.navigate('quiz');this.filter={...defaults(),mode:el.dataset.yearStart as YearStudyMode};this.rerender();});
    const form = document.querySelector<HTMLFormElement>('#year-options');
    if (form) {
      form.onchange = event => {
        const focused = event.target as HTMLInputElement | HTMLSelectElement;
        const name = focused.name, value = focused.value, d = new FormData(form), level=String(d.get('level'));
        this.filter={direction:'event-year',mode:String(d.get('mode')) as YearStudyMode,level:level==='all'?'all':Number(level) as YearFilter['level'],era:String(d.get('era')),region:String(d.get('region'))};this.limit=String(d.get('limit'));this.rerender();
        [...document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('#year-options input, #year-options select')].find(x => x.name===name&&x.value===value)?.focus({preventScroll:true});
      };
      form.onsubmit = event => {event.preventDefault();void this.start();};
    }
    const list = document.querySelector<HTMLFormElement>('#year-list-options');
    if (list) list.onchange = () => {const d=new FormData(list);this.listFilter={level:String(d.get('listLevel')),region:String(d.get('listRegion')),era:String(d.get('listEra'))};this.listLimit=50;this.rerender();};
    document.querySelectorAll<HTMLElement>('[data-year-action]').forEach(el => el.onclick = () => {void this.action(el.dataset.yearAction!);});
    const search = document.querySelector<HTMLInputElement>('#year-search');
    if (search) search.oninput = () => {this.search=search.value;this.listLimit=50;const pos=search.selectionStart;this.rerender();const next=document.querySelector<HTMLInputElement>('#year-search');next?.focus();try{next?.setSelectionRange(pos,pos);}catch{/* Search inputs vary by browser. */}};
    const restore = document.querySelector<HTMLInputElement>('#year-restore');
    if (restore) restore.onchange = async () => {const file=restore.files?.[0];if(!file||!this.database)return;try{if(file.size>5_000_000)throw Error('5MB以内の年号バックアップを選んでください。');await this.database.restoreBackup(await file.text());this.state=await this.database.load();this.notify('年号の履歴を統合しました。');this.rerender();}catch(error){this.notify(String(error),true);}finally{restore.value='';}};
  }
  private async start() {
    if (this.starting || this.busy || !this.database) return;
    const generation=this.generation;
    this.starting=true;this.rerender();
    try {
      if(this.syncPromise)await this.syncPromise;
      if(generation!==this.generation)return;
      const list=this.questions();
      if(!list.length){this.notify('年号が未登録か、条件に合う問題がありません。');return;}
      if(this.filter.mode!=='weak')for(let i=list.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[list[i],list[j]]=[list[j],list[i]];}
      this.queue=list.slice(0,this.limit==='all'?undefined:Number(this.limit));this.index=0;this.revealed=false;this.correctInSession=0;this.sessionId=crypto.randomUUID();this.stage='studying';
    } finally {this.starting=false;this.rerender();}
  }
  private async action(key: string) {
    try {
      if(key==='sync'){await this.sync();return;}
      if(key==='backup'){
        if(!this.database)throw Error('保存領域の読み込み前です。');
        const backup=await this.database.exportBackup(),link=document.createElement('a');const url=URL.createObjectURL(new Blob([backup],{type:'application/json'}));link.href=url;link.download='year-test-backup-'+new Date().toISOString().slice(0,10)+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);return;
      }
      if(key==='list-more'){this.listLimit+=50;this.rerender();return;}
      if(key==='history-more'){this.historyLimit+=50;this.rerender();return;}
      if(key==='stop'){this.leave();this.rerender();return;}
      if(key==='reveal'&&this.stage==='studying'){this.revealed=true;this.rerender();return;}
      if((key==='correct'||key==='wrong')&&this.stage==='studying'&&this.revealed&&!this.busy){
        if(!this.database)throw Error('保存領域が利用できません。');
        const generation=this.generation, id=this.queue[this.index].id;
        this.busy=true;document.querySelectorAll<HTMLButtonElement>('.chronology-grade button').forEach(x=>x.disabled=true);const correct=key==='correct';await this.database.addReview(id,correct,this.sessionId);this.state=await this.database.load();
        if(generation!==this.generation){this.busy=false;this.rerender();return;}
        if(correct)this.correctInSession++;this.index++;this.revealed=false;this.stage=this.index>=this.queue.length?'finished':'studying';this.busy=false;this.rerender();if(this.stage==='finished'&&this.syncPending)void this.sync();
      }
    } catch(error) {this.busy=false;this.notify(error instanceof Error?error.message:String(error),true);this.rerender();}
  }
}
