import {MapUI,type MapPage} from './map-ui';
import {ChronologyErrorUI} from './chronology-error-ui';
import './map-area.css';
import {WeaknessUI} from './weakness-ui';
import {ErrorCauseUI} from './error-cause-ui';
import {saveErrorCause,type CauseArea,type ErrorCause} from './error-causes';
import './style.css';
import './study-areas.css';
import './year-area.css';
import './culture-scope.css';
import './culture-features.css';
import './learning-insights.css';
import './ambiguous.css';
import { AmbiguousUI } from './ambiguous-ui';
import { LearningInsightsUI } from './learning-insights-ui';
import type { LearningArea } from './learning-insights';
import {CompareUI} from './culture-compare-ui';
import {GraphUI} from './culture-graph-ui';
import {EMPTY_RELATIONS,fetchRelationsData,resolveRelations,validateRelations} from './culture-relations';
import {completedDaily,localDateKey,type DailyPlan} from './culture-daily';
import type {CultureRelations,FeatureContext} from './culture-feature-types';
import { renderCultureScope, availableRegionGroups } from './culture-picker';
import { REGION_GROUPS, eraGroupsForRegions } from './culture-scope';
import { version as appVersion } from '../package.json';
import { openDatabase, type HistoryDB } from './db';
import { getProgress, selectCards, spreadSessionCards } from './core';
import { seedCatalog } from './seed';
import { synchronize, normalizeSyncUrl, DEFAULT_CATALOG_URL } from './sync';
import { setupPwa, activateUpdate, checkPwaUpdate } from './pwa';
import { YearTestUI } from './year-ui';
import { DEFAULT_FILTER, type AppState, type Card, type StudyFilter, type Level, type ImageAsset } from './types';

const app = document.querySelector<HTMLDivElement>('#app')!;
type View = 'chronology-errors' | 'portal' | 'home' | 'setup' | 'study' | 'years' | 'library' | 'history' | 'review' | 'settings' | 'compare' | 'graph' | 'calendar' | 'mastery' | 'ambiguous' | 'maps';
type YearPage = 'home' | 'quiz' | 'list' | 'history' | 'review' | 'ordering' | 'timeline';
let area: 'culture' | 'years' | 'ambiguous' | 'chronology-errors' | null = null;
let ambiguousRoute='home';
let mapRoute:MapPage='map';
let yearPage: YearPage = 'home';
let navigationEpoch = 0;
let db: HistoryDB;
let state: AppState;
let view: View = 'portal';
let filter: StudyFilter = structuredClone(DEFAULT_FILTER);
let detailScopeOpen = false;
let fieldScopeOpen = false;
let queue: Card[] = [];
let position = 0;
let revealed = false;
let saving = false;
let sessionCorrect = 0;
let sessionId = '';
let sessionKind:'normal'|'daily'|'related'='normal';
let dailyPlan:DailyPlan|null=null;
let relationData:CultureRelations=structuredClone(EMPTY_RELATIONS);
let relationMessage='関係データを確認しています。';
let relationLoading=false;
let featureSyncPending=false;
let featureRefresh:Promise<void>|null=null;
let syncing = false;
let syncMessage = '';
let sessionLimit = '20';
let search = '';
let historySort = 'recent';
let historyLimit = 50;
const historyEventLimits = new Map<string, number>();
let libraryQuery = '';
let libraryLimit = 50;
let syncPending = false;
let currentSync: Promise<void> | null = null;
let updateRegistration: ServiceWorkerRegistration | null = null;
let pwaRegistration: ServiceWorkerRegistration | null = null;
let checkingUpdate = false;
let updateStatus = '';
let installPrompt: (Event & {prompt(): Promise<void>; userChoice: Promise<{outcome:string}>}) | null = null;

const icons: Record<string, string> = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  study: '<rect x="4" y="6" width="16" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2M9 11l5 3-5 3"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M8 15h3M8 18h3"/>',
  book: '<path d="M12 5v16M3 4h5a4 4 0 0 1 4 3 4 4 0 0 1 4-3h5v15h-5a4 4 0 0 0-4 2 4 4 0 0 0-4-2H3Z"/>',
  history: '<path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2"/>',
  settings: '<path d="M4 7h16M4 17h16M8 4v6M16 14v6"/>',
  arrow: '<path d="M4 12h15m-5-5 5 5-5 5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  refresh: '<path d="M20 8a8 8 0 1 0 0 8M20 3v5h-5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  leaf: '<path d="M5 19C0 9 10 2 21 3c1 11-7 19-16 16Zm0 0L17 7"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
};
function icon(name: string, cls = '') { return `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.book}</svg>`; }
function esc(value: unknown): string {return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));}
function safeUrl(value: string) {try {const u=new URL(value,location.href); return ['http:','https:'].includes(u.protocol) ? u.href : '';}catch{return '';}}
const pct = (a: number, b: number) => b ? Math.round(a / b * 100) : 0;
const fmt = (at: string | null) => at ? new Date(at).toLocaleString('ja-JP', {month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '未学習';
const todayKey = (at: string | Date) => new Date(at).toLocaleDateString('sv-SE');
const levelNames = ['共通テスト', '日東駒専', 'MARCH', '早慶'];
const modeNames = {all:'全範囲', unseen:'未学習のみ', mistakes:'誤答履歴あり', due:'復習期限到来', weak:'苦手優先', random:'ランダム'};
const directionNames = {all:'全種類を混合', 'person-work':'作者・人物 → 作品', 'work-author':'作品 → 作者・人物'};
function activeItems() {return state.catalog.items.filter(x=>!x.deleted);}
function activeCards() {const ids=new Set(activeItems().map(i=>i.id));return state.catalog.cards.filter(c=>!c.deleted && ids.has(c.knowledgeId));}
function toast(message: string, error = false) {
  let el=document.querySelector('#toast'); if(!el){el=document.createElement('div');el.id='toast';el.setAttribute('role','status');document.body.append(el);}
  el.textContent=message; el.className=error?'toast error':'toast';
  window.setTimeout(()=>{if(el?.textContent===message)el.className='toast hidden';},5500);
}
const chronologyErrorsFeature=new ChronologyErrorUI(()=>{if(view==='chronology-errors'||view==='portal')render();},toast);
chronologyErrorsFeature.init();
const mapFeature=new MapUI(()=>{if(state&&['maps','portal'].includes(view))render();},toast);
const causeFeature=new ErrorCauseUI(saveCauseAndReload,()=>render(),toast);
const yearFeature = new YearTestUI(()=>{if(state&&['years','portal','settings','calendar','mastery'].includes(view))render();},toast,(area,id)=>causeFeature.offer(area,id));
const ambiguousFeature=new AmbiguousUI(()=>{if(state&&['ambiguous','portal','settings','mastery'].includes(view))render();},toast,id=>causeFeature.offer('ambiguous',id));
const weaknessFeature=new WeaknessUI(()=>({catalog:state.catalog,events:state.events,years:yearFeature.insightSnapshot(),ambiguous:ambiguousFeature.insightSnapshot(),errorCauses:[...(state.errorCauses??[]),...(yearFeature.insightSnapshot()?.errorCauses??[]),...(ambiguousFeature.insightSnapshot()?.errorCauses??[])]}),()=>render(),(area,ids)=>{void startAnalysisSession(area,ids);},saveCauseAndReload,toast);
const insightsFeature=new LearningInsightsUI(()=>({catalog:state.catalog,events:state.events,years:yearFeature.insightSnapshot()}),()=>render(),(area,ids)=>{void startInsightSession(area,ids);},()=>weaknessFeature.render());
const featureContext=():FeatureContext=>({catalog:state.catalog,events:state.events,comparisonEvents:state.comparisonEvents??[],relations:relationData,catalogSyncing:syncing});
const compareFeature=new CompareUI(featureContext,async events=>{await db.recordComparisons(events);state=await db.load();},()=>{if(view==='compare')render();},toast,id=>openGraph(id));
const graphFeature=new GraphUI(featureContext,()=>{if(view==='graph')render();},ids=>{void startRelatedSession(ids);},id=>openCompare(id));
function cultureSessionActive():boolean{return view==='compare'&&compareFeature.isStudying()||view==='study'&&position<queue.length;}
function openCompare(id?:string){compareFeature.open(id);go('compare');}
function openGraph(id?:string){graphFeature.open(id);go('graph');}
function nav() {
  if(area==='ambiguous')return ambiguousFeature.navigation();
  if(area==='years')return ([['home','ホーム','home'],['quiz','問題演習','calendar'],['list','年号一覧','book'],['history','学習履歴','history'],['review','復習管理','refresh']] as [YearPage,string,string][]).map(([v,t,i])=>`<button class="nav-item ${yearPage===v?'active':''}" data-year-nav="${v}" ${yearPage===v?'aria-current="page"':''}>${icon(i)}<span>${t}</span></button>`).join('');
  const links: [View,string,string][] = [['home','ホーム','home'],['setup','問題演習','study'],['library','用語一覧','book'],['history','学習履歴','history'],['review','復習管理','refresh']];
  return links.map(([v,t,i])=>`<button class="nav-item ${view===v || (v==='setup' && view==='study')||(v==='home'&&['compare','graph'].includes(view))?'active':''}" data-nav="${v}" ${view===v?'aria-current="page"':''}>${icon(i)}<span>${t}</span></button>`).join('');
}
function render() {
  const regionalSearch=view==='maps'&&document.activeElement instanceof HTMLInputElement&&document.activeElement.id==='map-region-search'?{value:document.activeElement.value,start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd}:null;
  if(view==='maps'&&mapRoute!==mapFeature.currentPage()){mapRoute=mapFeature.currentPage();rememberRoute();}
  if(view==='ambiguous'&&ambiguousRoute!==ambiguousFeature.currentRoute()){ambiguousRoute=ambiguousFeature.currentRoute();rememberRoute();}
  if(view==='years'){
    const next=yearFeature.currentPage();
    if(next!==yearPage){yearPage=next;rememberRoute();}
  }
  const inArea=!['portal','settings','calendar','mastery','maps','chronology-errors'].includes(view);
  const label=area==='ambiguous'?'曖昧用語':area==='years'?'年号':'文化史';
  const content=view==='chronology-errors'?chronologyErrorsFeature.render():view==='maps'?mapFeature.render():view==='ambiguous'?ambiguousFeature.render():view==='calendar'?insightsFeature.calendar():view==='mastery'?insightsFeature.mastery():view==='portal'?portal():view==='home'?home():view==='setup'?setup():view==='study'?study():view==='history'?history():view==='review'?cultureReview():view==='library'?library():view==='years'?yearFeature.render():view==='compare'?relationStatus()+compareFeature.render():view==='graph'?relationStatus()+graphFeature.render():settings()+yearFeature.renderTools()+ambiguousFeature.renderTools();
  app.innerHTML=`<div class="main-shell area-shell ${inArea?'with-area-nav':''} ${area==='years'&&inArea?'year-area':''}"><header class="topbar area-topbar"><a class="app-brand" href="#/" data-nav="portal">${icon('book')}<span>世界史学習マスター</span></a><button class="area-settings" data-nav="settings" aria-label="データ管理・設定">${icon('settings')}</button></header>
  ${view!=='portal'?`<div class="area-location"><button class="text-button" data-nav="portal">‹ 総合ホームに戻る</button><span class="area-badge">${view==='chronology-errors'?'通史の誤答ノート':view==='maps'?'地図エリア':view==='settings'?'共通設定':['calendar','mastery'].includes(view)?'共通の学習管理':label+'エリア'}</span></div>`:''}
  <main id="main" tabindex="-1">${causeFeature.html()}${content}</main><footer class="page-footer"><span>世界史学習マスター</span><span>${navigator.onLine?'学習記録は端末内に保存':'オフライン · 保存済み教材で学習'}</span></footer></div>${inArea?`<nav class="mobile-nav ${area==='ambiguous'?'ambiguous-nav':''}" aria-label="${label}メニュー">${nav()}</nav>`:''}<dialog id="image-dialog"><button class="icon-button dialog-close" aria-label="画像を閉じる" data-action="close-image">${icon('close')}</button><div id="image-dialog-content"></div></dialog>`;
  bind();
  if(regionalSearch){const input=document.querySelector<HTMLInputElement>('#map-region-search');if(input){input.value=regionalSearch.value;input.focus({preventScroll:true});if(regionalSearch.start!==null)input.setSelectionRange(regionalSearch.start,regionalSearch.end);}}
}
function portal(){
  const progress=getProgress(state.events);
  const due=activeCards().filter(c=>{const p=progress.get(c.id);return p?.nextReviewAt&&Date.parse(p.nextReviewAt)<=Date.now();}).length;
  const years=yearFeature.summary(),ambiguous=ambiguousFeature.summary();
  return `<section class="portal-heading"><div class="eyebrow">YOUR WORLD HISTORY STUDY</div><h1>世界史学習マスター</h1><p>大学受験に向けて、今日の学びを積み重ねる。<br>学習するエリアを選んで始めましょう。</p></section><div class="area-choices"><section class="area-choice culture-choice"><div class="area-choice-heading"><span class="area-symbol">${icon('book')}</span><div><span class="eyebrow">CULTURAL HISTORY</span><h2>文化史</h2></div></div><p>文化史の問題演習<br><span>人物・作品・思想・画像</span></p><dl><div><dt>登録項目</dt><dd>${activeItems().length}<small>項目</small></dd></div><div><dt>復習対象</dt><dd>${due}<small>枚</small></dd></div></dl><button class="button primary" data-enter-area="culture">文化史を学習する ${icon('arrow')}</button></section><section class="area-choice chronology-choice"><div class="area-choice-heading"><span class="area-symbol">${icon('calendar')}</span><div><span class="eyebrow">CHRONOLOGY</span><h2>年号</h2></div></div><p>年号の暗記・問題演習<br><span>出来事と年号の対応</span></p><dl><div><dt>登録年号</dt><dd>${years.count}<small>件</small></dd></div><div><dt>復習対象</dt><dd>${years.due}<small>問</small></dd></div></dl><button class="button primary" data-enter-area="years">年号を学習する ${icon('arrow')}</button></section><section class="area-choice ambiguous-choice"><div class="area-choice-heading"><span class="area-symbol">${icon('book')}</span><div><span class="eyebrow">DISTINGUISH &amp; CONNECT</span><h2>曖昧用語</h2></div></div><p>似た用語を比較して識別<br><span>用語・背景・前後関係の違い</span></p><dl><div><dt>登録用語</dt><dd>${ambiguous.terms}<small>件</small></dd></div><div><dt>復習対象</dt><dd>${ambiguous.due}<small>問</small></dd></div></dl><button class="button primary" data-enter-area="ambiguous">曖昧用語を学習する ${icon('arrow')}</button></section><section class="area-choice map-choice"><div class="area-choice-heading"><span class="area-symbol">${icon('book')}</span><div><span class="eyebrow">HISTORICAL GEOGRAPHY</span><h2>地図</h2></div></div><p>場所と時代を確かめる<br><span>都市・国家の概略領域・資料の確認</span></p><dl><div><dt>検証済み地理項目</dt><dd>${mapFeature.summary().verified}<small>件</small></dd></div><div><dt>復習対象</dt><dd>${mapFeature.summary().due}<small>問</small></dd></div></dl><button class="button primary" data-enter-area="maps">地図を学習する ${icon('arrow')}</button></section><section class="area-choice chronology-choice"><div class="area-choice-heading"><span class="area-symbol">${icon('history')}</span><div><span class="eyebrow">ERROR NOTEBOOK</span><h2>通史の誤答ノート</h2></div></div><p>演習で見つけた知識の穴を集約<br><span>出典・地域・時代・誤答原因を管理</span></p><dl><div><dt>登録した穴</dt><dd>${chronologyErrorsFeature.summary().count}<small>件</small></dd></div><div><dt>復習対象</dt><dd>${chronologyErrorsFeature.summary().due}<small>件</small></dd></div></dl><button class="button primary" data-enter-area="chronology-errors">誤答ノートを開く ${icon('arrow')}</button></section></div><div class="insight-portal-links"><button class="button secondary" data-nav="calendar">復習カレンダー</button><button class="button secondary" data-nav="mastery">定着度ダッシュボード</button></div><p class="portal-note">学習記録と復習は、それぞれのエリアで管理します。</p><button class="button secondary portal-settings" data-nav="settings">${icon('settings')} データ管理・設定</button>`;
}
function cultureReview(){
  const cards=activeCards(), p=getProgress(state.events), now=Date.now();
  const due=cards.filter(c=>{const row=p.get(c.id);return row?.nextReviewAt&&Date.parse(row.nextReviewAt)<=now;}).length;
  const mistakes=cards.filter(c=>(p.get(c.id)?.wrong??0)>0).length;
  const unseen=cards.filter(c=>!p.has(c.id)).length;
  const weak=selectCards(state.catalog,state.events,{...structuredClone(DEFAULT_FILTER),mode:'weak'}).filter(c=>(p.get(c.id)?.wrong??0)>0).slice(0,8);
  return `<section class="page-heading"><div><div class="eyebrow">CULTURE REVIEW</div><h1>文化史の復習管理</h1><p>直近の成績と復習のタイミングから、記憶を定着させましょう。</p></div></section><section class="stats-grid">${stat('復習期限到来',due,'枚','今日の復習対象','refresh')}${stat('誤答履歴あり',mistakes,'枚','累積の誤答を保持','history')}</section><div class="review-actions">${([['due','今日の復習',due],['mistakes','間違えたカード',mistakes],['weak','苦手優先で学習',cards.length],['unseen','未学習のカード',unseen]] as [StudyFilter['mode'],string,number][]).map(([mode,title,count])=>`<button class="panel review-action" data-start="${mode}" ${!count?'disabled':''}><span>${title}<small>${count}枚が対象</small></span>${icon('arrow')}</button>`).join('')}</div><section class="panel review-weak"><div class="section-title"><h2>復習したいカード</h2></div>${weak.length?weak.map(c=>`<div class="review-weak-row"><strong>${esc(c.answer)}</strong><span>正答 ${p.get(c.id)!.correct} ／ 誤答 ${p.get(c.id)!.wrong}</span><p>${esc(c.question)}</p></div>`).join(''):'<p class="muted">まだ誤答のあるカードはありません。</p>'}</section>`;
}
function home() {
  const cards=activeCards(), items=activeItems(), progress=getProgress(state.events);
  const itemById=new Map(items.map(item=>[item.id,item]));
  const levels=new Map<Level,{total:number;studied:number}>(([1,2,3,4] as Level[]).map(level=>[level,{total:0,studied:0}]));
  const weak=new Map<string,{wrong:number;total:number}>();
  let studied=0,due=0;
  const now=Date.now();
  for(const card of cards){
    const item=itemById.get(card.knowledgeId)!;
    const counts=levels.get(item.level)!;
    counts.total++;
    const p=progress.get(card.id);
    if(!p)continue;
    studied++;counts.studied++;
    if(p.nextReviewAt&&Date.parse(p.nextReviewAt)<=now)due++;
    const field=weak.get(item.field)||{wrong:0,total:0};
    field.wrong+=p.wrong;field.total+=p.attempts;weak.set(item.field,field);
  }
  const events=state.events;
  const dayStart=new Date();dayStart.setHours(0,0,0,0);
  const nextDay=new Date(dayStart);nextDay.setDate(nextDay.getDate()+1);
  const today=events.filter(e=>{const at=Date.parse(e.reviewedAt);return at>=dayStart.getTime()&&at<nextDay.getTime();});
  const correct=events.filter(e=>e.correct).length;
  const days=Math.max(0,Math.ceil((new Date('2027-02-15T00:00:00+09:00').getTime()-Date.now())/86400000));
  const weakList=[...weak.entries()].filter(([,v])=>v.wrong>0).sort((a,b)=>b[1].wrong/b[1].total-a[1].wrong/a[1].total).slice(0,3);
  return `<section class="page-heading"><div><div class="eyebrow">YOUR CULTURAL HISTORY JOURNEY</div><h1>今日も、ひとつ先の知識へ。</h1><p>積み重ねた学びが、確かな力になります。</p></div><div class="exam-count"><span>慶應文学部の入試まで</span><strong>${days}<small>日</small></strong></div></section>
  ${dailyRecommendations()}<section class="panel feature-due-shortcut"><strong>期限が来たカードをまとめて復習</strong><span>${due}枚が対象</span><button class="button secondary" data-start="due" ${due?"":"disabled"}>今日の復習</button></section>
  <section class="stats-grid" aria-label="学習の統計">${stat('総収録項目',items.length,'項目',`${cards.length}枚のフラッシュカード`,'book')}${stat('学習済みカード',studied,'枚',`全カードの ${pct(studied,cards.length)}%`,'check')}${stat('全体の正答率',events.length?pct(correct,events.length):'—',events.length?'%':'',`${events.length}回の回答から集計`,'grid')}${stat('復習期限到来',due,'枚',due?'今が復習のタイミング':'自分のペースで進めましょう','refresh')}</section>
  <div class="dashboard-grid"><section class="panel level-panel"><div class="section-title"><h2>難易度別の学習進捗</h2><span class="muted small">学習済み / カード数</span></div>${([1,2,3,4] as Level[]).map(l=>{const {total,studied:n}=levels.get(l)!;return `<button class="level-row" data-level="${l}"><span class="level-tag l${l}">Lv.${l}</span><span class="level-detail"><span class="level-name">${levelNames[l-1]}</span><span class="progress-track"><span style="width:${pct(n,total)}%"></span></span></span><span class="level-count">${n}<span> / ${total}</span></span>${icon('arrow')}</button>`;}).join('')}<p class="panel-note">初期データの難易度は暫定分類です。</p></section><section class="panel today-panel"><div class="section-title"><h2>今日の学習</h2><span class="subtle-chip">${dateLabel()}</span></div><div class="daily-ring" style="--progress:${Math.min(100,pct(today.length,state.settings.dailyGoal))}%"><div><strong>${today.length}<small> / ${state.settings.dailyGoal}</small></strong><span>回答回数</span></div></div><p class="today-message">${today.length>=state.settings.dailyGoal?'今日の目標を達成しました。':today.length?'いいペースです。その調子で。':'最初の1問から、始めましょう。'}</p><span class="small muted">今日の正答率 ${today.length?`${pct(today.filter(e=>e.correct).length,today.length)}%`:'—'}</span></section></div>
  <div class="dashboard-grid lower"><section class="panel"><div class="section-title"><h2>苦手分野</h2><button class="text-button" data-start="weak">復習する ${icon('arrow')}</button></div>${weakList.length?weakList.map(([field,v])=>`<div class="weak-row"><span>${esc(field)}</span><span class="muted">正答率 <strong>${pct(v.total-v.wrong,v.total)}%</strong></span></div>`).join(''):`<div class="empty-inline">${icon('leaf')}<p>学習を進めると、苦手分野が見えてきます。<br><span>正答と誤答を記録して、復習に役立てましょう。</span></p></div>`}</section><section class="panel quick-panel"><div class="section-title"><h2>学び方を選ぶ</h2></div><button class="quick-row" data-start="unseen">${icon('book')}<span>未学習のカード<small>新しい知識に出会う</small></span>${icon('arrow')}</button><button class="quick-row" data-nav="setup">${icon('settings')}<span>範囲を指定して学習<small>地域・時代・分野から選ぶ</small></span>${icon('arrow')}</button><button class="quick-row" data-nav="compare">${icon('grid')}<span>類似知識を識別する<small>著者・作品・思想を比較。苦手な組み合わせを確認</small></span>${icon('arrow')}</button><button class="quick-row" data-nav="graph">${icon('leaf')}<span>文化史の関連図<small>人物・作品・思想のつながりを見る</small></span>${icon('arrow')}</button></section></div>`;
}
function dateLabel(){return new Date().toLocaleDateString('ja-JP',{month:'numeric',day:'numeric'});}
function stat(title:string,value:number|string,unit:string,note:string,i:string){return `<article class="stat-card"><div class="stat-title">${title}${icon(i)}</div><div class="stat-value">${value}<small>${unit}</small></div><span class="stat-note">${note}</span></article>`;}
function dailyRecommendations(){
  const done=dailyPlan?completedDaily(dailyPlan,state.events):new Set<string>(),total=dailyPlan?.cardIds.length??0;
  const count=(key:string)=>dailyPlan?.cardIds.filter(id=>dailyPlan!.categories[id]===key).length??0;
  return `<section id="daily-recommendations" class="panel daily-recommendation"><div class="section-title"><h2>今日のおすすめ</h2><span class="small muted">${esc(localDateKey())}</span></div><h3>${dailyPlan&&!total?'出題できるカードは0問です':`今日の${total||20}問`}</h3><p>復習のタイミングと最近の成績から、今日の問題を選びます。</p><div class="daily-split"><span>復習期限到来 <strong>${count('due')}問</strong></span><span>直近の苦手 <strong>${count('weak')}問</strong></span><span>未学習 <strong>${count('unseen')}問</strong></span>${count('fill')?`<span>既習カード <strong>${count('fill')}問</strong></span>`:''}</div><p class="daily-completion" data-daily-progress>学習済み ${done.size} / ${total}</p><div class="feature-progress-track" role="progressbar" aria-label="今日のおすすめの完了数" aria-valuenow="${done.size}" aria-valuemin="0" aria-valuemax="${total||20}"><span style="width:${pct(done.size,total)}%"></span></div>${dailyPlan?(total?done.size===total?'<p class="daily-finished" role="status">今日のおすすめを全問学習しました。</p>':`<button class="button primary" data-action="start-daily">${done.size?'続きから学習':'今日のおすすめを始める'} ${icon('arrow')}</button>`:'<p role="status">出題できるカードがありません。教材の取得後にもう一度お試しください。</p>'):'<p role="status">今日の問題を準備しています…</p>'}<p class="small muted">同じカードは1問として数えます。1日の目標回答数とは別の進捗です。</p></section>`;
}
function relationStatus(){return `<div class="feature-data-status"><p role="status">${esc(relationMessage)}</p><button class="text-button" data-action="feature-sync" ${relationLoading?'disabled':''}>${relationLoading?'確認中…':'関係データを更新'}</button></div>`;}
function knowledgeActions(id:string){
  const resolved=resolveRelations(relationData,state.catalog),links=resolved.relations.filter(r=>r.fromId===id||r.toId===id);
  if(!links.length)return '';
  const ids=new Set(links.map(r=>r.id)),set=resolved.comparisonSets.find(s=>s.relationIds.some(id=>ids.has(id)));
  return `<div class="feature-knowledge-actions"><button class="button secondary" data-open-graph="${esc(id)}">この知識の関連図</button>${set?`<button class="button secondary" data-open-compare="${esc(set.id)}">類似知識を識別する</button>`:''}</div>`;
}
function bindKnowledgeActions(root:ParentNode=document){
  root.querySelectorAll<HTMLElement>('[data-open-graph]').forEach(el=>el.onclick=()=>openGraph(el.dataset.openGraph));
  root.querySelectorAll<HTMLElement>('[data-open-compare]').forEach(el=>el.onclick=()=>openCompare(el.dataset.openCompare));
}
function setup(){
  const items=activeItems();
  const choices=(title:string,key:'regions'|'eras'|'fields',values:string[])=>`<fieldset class="filter-field"><legend>${title}<span>複数選択できます</span></legend><div class="choice-chips">${values.map(v=>`<label class="choice-chip"><input type="checkbox" name="${key}" value="${esc(v)}" ${filter[key].includes(v)?'checked':''}><span>${esc(v)}</span></label>`).join('')}</div></fieldset>`;
  const count=selectCards(state.catalog,state.events,filter).length;
  const itemById=new Map(items.map(item=>[item.id,item]));
  const levelCounts=new Map<Level,number>(([1,2,3,4] as Level[]).map(level=>[level,0]));
  for(const card of activeCards()){const level=itemById.get(card.knowledgeId)!.level;levelCounts.set(level,levelCounts.get(level)!+1);}
  const range=filter.level==='all'?'Lv.1〜4 すべて':filter.levelMode==='single'?`Lv.${filter.level} ${levelNames[filter.level-1]}のみ`:`Lv.1〜${filter.level}まで`;
  const regionLabels=(filter.regionGroups??[]).map(id=>REGION_GROUPS.find(g=>g.id===id)?.label).filter(Boolean);
  const eraLabels=eraGroupsForRegions(availableRegionGroups(items,filter.regionGroups??[])).filter(o=>filter.eraGroups?.includes(o.id)).map(o=>o.label);
  const scopeSummary=[regionLabels.join('・')||'全地域',eraLabels.join('・')||'全時代',range].join(' ／ ');
  const levelPicker=`<fieldset class="level-picker"><legend>難易度を選ぶ</legend><p class="level-picker-help">学びたい用語のレベルを選択してください。</p><label class="level-option level-option-all"><input type="radio" name="level" value="all" ${filter.level==='all'?'checked':''}><span class="level-option-body"><span class="level-option-heading"><strong>すべてのレベル</strong><span class="selection-check">${icon('check')}</span></span><span class="level-option-caption">Lv.1〜4をまとめて学習</span><span class="level-option-count">${activeCards().length}枚</span></span></label><div class="level-option-grid">${([1,2,3,4] as Level[]).map(level=>`<label class="level-option"><input type="radio" name="level" value="${level}" ${filter.level===level?'checked':''}><span class="level-option-body"><span class="level-option-heading"><span class="level-tag l${level}">Lv.${level}</span><span class="selection-check">${icon('check')}</span></span><strong class="level-option-name">${levelNames[level-1]}</strong><span class="level-option-caption">${level===4?'細かな用語・複数の手がかり':'人物・著作・用語を直接確認'}</span><span class="level-option-count">このレベル ${levelCounts.get(level)}枚</span></span></label>`).join('')}</div><p class="level-classification-note">難易度は用語の重要度・細かさで分類しています。初期教材は暫定分類です。</p></fieldset>`;
  const levelRange=`<fieldset class="level-range-picker ${filter.level==='all'?'hidden':''}"><legend>出題するレベルの範囲</legend><div class="level-range-grid"><label class="level-option range-option"><input type="radio" name="levelMode" value="cumulative" ${filter.levelMode==='cumulative'?'checked':''}><span class="level-option-body"><span class="level-option-heading"><strong>基礎からまとめて</strong><span class="selection-check">${icon('check')}</span></span><span class="range-option-target">Lv.1〜${filter.level==='all'?4:filter.level}から出題</span><span class="level-option-caption">累積モード</span></span></label><label class="level-option range-option"><input type="radio" name="levelMode" value="single" ${filter.levelMode==='single'?'checked':''}><span class="level-option-body"><span class="level-option-heading"><strong>このレベルだけ</strong><span class="selection-check">${icon('check')}</span></span><span class="range-option-target">Lv.${filter.level==='all'?4:filter.level}だけを出題</span><span class="level-option-caption">単独モード</span></span></label></div><p class="level-range-help">${filter.level===4?'Lv.1〜3は人物・著作・用語の直接確認、Lv.4は複数の手がかりからの確認も含みます。':'人物・著作・用語の対応を、短い問題で確認します。'}</p></fieldset>`;
  return `<section class="page-heading"><div><div class="eyebrow">MAKE IT YOUR OWN</div><h1>学習する</h1><p>今日学びたい範囲を選びましょう。</p></div><button class="text-button" data-action="reset-filter">条件をリセット</button></section><form id="study-options" class="panel setup-panel">${renderCultureScope(items,filter)}<details id="field-scope" class="scope-extra-fields" ${fieldScopeOpen?"open":""}><summary>分野で絞り込む（任意）${filter.fields.length?`<small>${filter.fields.length}分野を選択中</small>`:""}</summary>${choices("分野","fields",[...new Set(items.map(i=>i.field))])}</details><div class="scope-levels-label">難易度・出題方法</div>${levelPicker}${levelRange}<div class="selected-scope" role="status"><span>選択中の範囲</span><strong>${esc(scopeSummary)}</strong></div><label class="form-field study-mode-field">出題モード<select name="mode">${Object.entries(modeNames).map(([v,t])=>`<option value="${v}" ${filter.mode===v?'selected':''}>${t}</option>`).join('')}</select></label><label class="form-field study-mode-field">出題の向き<select name="cardDirection">${Object.entries(directionNames).map(([v,t])=>`<option value="${v}" ${filter.cardDirection===v?'selected':''}>${t}</option>`).join('')}</select></label><p class="small muted direction-help">向きを指定すると該当する作品・作者問題だけを出題します。出題順は同じ答えが続きにくいよう調整します。</p><details id="detail-scope" class="detail-scope" ${detailScopeOpen?'open':''}><summary>細かいテーマで絞る（任意）${filter.regions.length||filter.eras.length?' · 選択中':''}</summary><p>通常は上の大きな時代区分で選べます。教材の元の地域・テーマを指定したい場合だけ使います。</p>${choices('詳細な地域','regions',[...new Set(items.map(i=>i.region))])}${choices('教材のテーマ','eras',[...new Set(items.map(i=>i.era))])}</details><div class="form-columns"><label class="form-field">カードの種類<select name="cardType"><option value="all" ${filter.cardType==='all'?'selected':''}>文字・画像を混在</option><option value="text" ${filter.cardType==='text'?'selected':''}>文字問題のみ</option><option value="image" ${filter.cardType==='image'?'selected':''}>画像問題のみ</option></select></label><label class="form-field">1回の学習枚数<select name="limit">${['10','20','all'].map(n=>`<option value="${n}" ${sessionLimit===n?'selected':''}>${n==='all'?'対象すべて':n+'枚'}</option>`).join('')}</select></label></div><div class="setup-bottom"><div><strong>${count}<small> 枚が対象</small></strong><span class="small muted">${count?"選択した条件を組み合わせて出題します。":"この条件に合うカードはありません。地域・時代・分野などの条件を変更してください。"}</span></div><button type="submit" class="button primary" ${count?'':'disabled'}>この範囲で学習する${icon('arrow')}</button></div></form>`;
}
function study(){
  if(position>=queue.length){return `<div class="session-finished panel"><div class="finished-icon">${icon('check')}</div><div class="eyebrow">SESSION COMPLETE</div><h1>おつかれさまでした。</h1><p>今日の積み重ねが、明日の自信に。</p><div class="result-grid"><div><strong>${queue.length}</strong><span>回答したカード</span></div><div><strong>${pct(sessionCorrect,queue.length)}<small>%</small></strong><span>今回の正答率</span></div></div><p class="small muted">すべての回答を端末内に保存しました。</p><button class="button primary" data-nav="home">ホームに戻る${icon('arrow')}</button><button class="text-button" data-nav="setup">範囲を変えて学習する</button></div>`;}
  const c=queue[position], item=state.catalog.items.find(i=>i.id===c.knowledgeId)!;
  const image=c.imageId?item.images.find(i=>i.id===c.imageId):null;
  const progress=getProgress(state.events).get(c.id);
  return `<section class="study-heading"><button class="text-button" data-action="end-session">${icon('close')} 学習を終了</button><span>${sessionKind==='daily'?'今日のおすすめ':sessionKind==='related'?'関連する問題':modeNames[filter.mode]} <span class="muted">·</span> ${position+1} / ${queue.length}</span></section><div class="session-track"><span style="width:${position/queue.length*100}%"></span></div><section class="study-area"><div class="study-meta"><span class="level-tag l${item.level}">Lv.${item.level}</span><span>${esc(item.region)} / ${esc(item.era)} / ${esc(item.field)}</span></div><article class="flashcard ${revealed?'revealed':''}" aria-label="フラッシュカード"><span class="eyebrow">${revealed?'QUESTION & ANSWER':'QUESTION'}</span><h1>${esc(c.question)}</h1>${image?`<button class="image-button" data-action="zoom-image" aria-label="問題の画像を拡大"><img id="question-image" src="${esc(safeUrl(image.url))}" alt="問題の作品画像。タップして拡大" /></button><p id="image-fallback" class="image-fallback hidden">画像を読み込めませんでした。<br>${esc(c.fallbackPrompt||'解答を確認して、知識を復習してください。')}</p>`:''}${revealed?`<div class="answer-area"><span class="answer-label">ANSWER</span><h2>${esc(c.answer)}</h2><p>${esc(c.explanation)}</p></div><details class="source-details"><summary>出典・分類の根拠を見る</summary>${itemSources(item.id)}</details>`:`<button class="reveal-button" data-action="reveal">タップして解答を確認<span>答えを思い浮かべてから、めくりましょう</span></button>`}</article>${revealed?`<div class="grade-buttons"><button class="grade wrong" data-grade="wrong" ${saving?'disabled':''}><span>×</span>思い出せなかった</button><button class="grade correct" data-grade="correct" ${saving?'disabled':''}><span>○</span>正答した</button></div><p class="study-hint">${saving?'回答を保存しています…':'自分の回答を記録すると、次のカードに進みます。'}</p>`:`<p class="study-hint">${image?'画像をタップすると拡大できます。':'1枚に、ひとつの知識。焦らず、確実に。'}</p>`}<div class="card-past"><span>これまでの記録</span><span>正答 ${progress?.correct||0} <span class="muted">/</span> 誤答 ${progress?.wrong||0} <span class="muted">·</span> ${progress?`連続正答 ${progress.streak}回`:'未学習'}</span></div>${knowledgeActions(item.id)}</section>`;
}
function itemSources(id:string){const item=state.catalog.items.find(i=>i.id===id)!;return `<p>${esc(item.description)}</p><p><strong>難易度：暫定分類</strong><br>${esc(item.difficultyEvidence)}</p><p>知識の検証：${item.verification==='verified'?'出典で確認済み':item.verification==='needs-review'?'要確認':'暫定'}</p><ul>${item.sources.map(s=>`<li>${s.url?`<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>`:esc(s.title)}${s.note?`<br>${esc(s.note)}`:''}</li>`).join('')}</ul>${item.images.map(im=>`<p class="small">画像：${esc(im.author)} / <a href="${esc(safeUrl(im.licenseUrl))}" target="_blank" rel="noopener noreferrer">${esc(im.license)}</a> / <a href="${esc(safeUrl(im.sourceUrl))}" target="_blank" rel="noopener noreferrer">出典</a></p>`).join('')}<p class="small muted">固定ID：${esc(item.id)} · v${item.version} · 更新 ${esc(item.updatedAt.slice(0,10))}</p>`;}
function history(){
  const p=getProgress(state.events), cards=state.catalog.cards.filter(c=>p.has(c.id));
  const itemById=new Map(state.catalog.items.map(item=>[item.id,item]));
  const q=search.toLocaleLowerCase('ja');
  const rows=cards.filter(c=>`${c.question} ${c.answer}`.toLocaleLowerCase('ja').includes(q)).sort((a,b)=>{
    const aProgress=p.get(a.id)!,bProgress=p.get(b.id)!;
    const rank=historySort==='wrong'?bProgress.wrong-aProgress.wrong:historySort==='accuracy'?aProgress.correct/aProgress.attempts-bProgress.correct/bProgress.attempts:Date.parse(bProgress.lastStudiedAt!)-Date.parse(aProgress.lastStudiedAt!);
    return rank||a.id.localeCompare(b.id);
  });
  const visible=rows.slice(0,historyLimit),visibleIds=new Set(visible.map(card=>card.id));
  const eventsByCard=new Map<string,typeof state.events>();
  for(const event of state.events.filter(event=>visibleIds.has(event.cardId)).sort((a,b)=>Date.parse(b.reviewedAt)-Date.parse(a.reviewedAt)||b.id.localeCompare(a.id))){
    const events=eventsByCard.get(event.cardId)||[];
    if(events.length<(historyEventLimits.get(event.cardId)||100))events.push(event);
    eventsByCard.set(event.cardId,events);
  }
  return `<section class="page-heading"><div><div class="eyebrow">YOUR LEARNING RECORD</div><h1>学習履歴</h1><p>正答も誤答も、これからの学びの手がかりに。</p></div><span class="subtle-chip">全${state.events.length}回の回答を保存</span></section><div class="toolbar"><input id="history-search" type="search" placeholder="問題・解答を検索" aria-label="学習履歴を検索" value="${esc(search)}"><select id="history-sort" aria-label="履歴の並べ替え"><option value="recent" ${historySort==='recent'?'selected':''}>最終学習が新しい順</option><option value="wrong" ${historySort==='wrong'?'selected':''}>累積誤答回数が多い順</option><option value="accuracy" ${historySort==='accuracy'?'selected':''}>正答率が低い順</option></select></div>${rows.length?`<p class="small muted">${rows.length}枚中 ${visible.length}枚のカードを表示</p>`:''}<section class="history-list">${rows.length?visible.map(c=>{
    const x=p.get(c.id)!,events=eventsByCard.get(c.id)||[],item=itemById.get(c.knowledgeId);
    return `<details class="panel history-card" data-history-card="${esc(c.id)}"><summary><div class="history-question"><span class="small muted">${esc(item?.field||'保存済みカード')}${c.deleted||item?.deleted?' · 出題停止':''}</span><strong>${esc(c.answer)}</strong><span>${esc(c.question)}</span></div><div class="history-metrics"><span>累積誤答<strong class="wrong-count">${x.wrong}</strong></span><span>正答率<strong>${pct(x.correct,x.attempts)}<small>%</small></strong></span><span>回答数<strong>${x.attempts}</strong></span></div></summary><div class="history-extra"><div class="history-summary"><span>累積正答 ${x.correct}回</span><span>連続正答 ${x.streak}回</span><span>最終学習 ${fmt(x.lastStudiedAt)}</span><span>次回復習 ${fmt(x.nextReviewAt)}</span></div><p class="small muted">全${x.attempts}回の回答のうち、新しい順に${events.length}回を表示</p><ol class="event-list">${events.map(e=>`<li><span class="${e.correct?'event-correct':'event-wrong'}">${e.correct?'○ 正答':'× 誤答'}</span><time datetime="${esc(e.reviewedAt)}">${new Date(e.reviewedAt).toLocaleString('ja-JP')}</time></li>`).join('')}</ol>${events.length<x.attempts?`<button class="button secondary" data-history-events="${esc(c.id)}">過去の回答をさらに100回表示</button>`:''}<p class="small muted">カードID：${esc(c.id)}</p></div></details>`;
  }).join(''):`<div class="panel empty-state">${icon('history')}<h2>${cards.length?'一致する履歴がありません':'学習の記録は、ここに。'}</h2><p>カードを学習すると、回答ごとの履歴を確認できます。</p><button class="button primary" data-nav="setup">学習をはじめる${icon('arrow')}</button></div>`}</section>${visible.length<rows.length?'<button class="button secondary" data-history-more>カードをさらに50枚表示</button>':''}`;
}
function library(){
  const q=libraryQuery.toLocaleLowerCase('ja'),all=activeItems(),items=all.filter(i=>[i.canonicalName,...i.aliases,i.field,i.region,i.era].some(s=>s.toLocaleLowerCase('ja').includes(q)));
  return `<section class="page-heading"><div><div class="eyebrow">CULTURAL HISTORY LIBRARY</div><h1>用語一覧</h1><p>学びのつながりと、知識の出典を確認できます。</p></div><span class="subtle-chip">${all.length}項目 · ${activeCards().length}カード</span></section><div class="toolbar"><input type="search" id="library-search" aria-label="用語を検索" placeholder="人物・作品・地域・分野で検索" value="${esc(libraryQuery)}"></div><p class="notice">少量の初期データを収録しています。初期教材の難易度はすべて暫定分類で、大学別出題頻度は未検証です。</p><p class="small muted">${items.length}項目中 ${Math.min(libraryLimit,items.length)}項目を表示</p><div class="library-list">${items.slice(0,libraryLimit).map(i=>`<details class="panel library-item" data-item-id="${esc(i.id)}"><summary><span class="level-tag l${i.level}">Lv.${i.level}</span><span><strong>${esc(i.canonicalName)}</strong><small>${esc(i.region)} · ${esc(i.era)} · ${esc(i.field)}</small></span>${icon('arrow')}</summary><div class="library-detail" data-lazy-detail="${esc(i.id)}"></div></details>`).join('')||'<div class="panel empty-state"><p>一致する用語がありません。</p></div>'}</div>${items.length>libraryLimit?'<button class="button secondary load-more" data-action="library-more">さらに50項目表示</button>':''}`;
}

function settings(){return `<section class="page-heading"><div><div class="eyebrow">KEEP YOUR LEARNING SAFE</div><h1>データ管理・設定</h1><p>文化史と年号、それぞれの学習記録を保管します。</p></div></section><div class="settings-grid"><section class="panel settings-panel"><div class="section-title"><h2>${icon('download')} 文化史のバックアップ・復元</h2><span class="subtle-chip">JSON</span></div><p>文化史の学習履歴・用語・設定を、ひとつのファイルに保存します。端末の変更やブラウザデータの削除に備え、定期的に保存してください。</p><div class="data-summary"><span>保存済みの回答<strong>${state.events.length}回</strong></span><span>前回のバックアップ<strong>${fmt(state.settings.lastBackupAt)}</strong></span></div><button class="button primary" data-action="backup">${icon('download')}バックアップを保存</button><label class="button secondary file-label">JSONから復元<input id="restore-file" type="file" accept="application/json,.json"></label><p class="small muted">復元は現在の履歴に統合します。同じ回答は重複せず、過去の誤答は保持されます。</p></section><section class="panel settings-panel"><div class="section-title"><h2>${icon('refresh')} 文化史教材の同期</h2><span class="subtle-chip ${state.settings.lastSyncAt?'':'pending'}">${state.settings.lastSyncAt?'接続履歴あり':'未接続'}</span></div><p>Googleスプレッドシートを教材マスターとして使います。ChatGPTが確認済みの追加データをGitHubへ公開すると、アプリは自動同期します。Apps Scriptの設定・コード貼り付けは不要です。</p><form id="sync-form"><label class="form-field">独自の同期URL（通常は空欄）<input type="url" name="syncUrl" placeholder="標準のGitHub配信を自動利用" value="${esc(state.settings.syncUrl)}"></label><button type="submit" class="button secondary" ${syncing?'disabled':''}>${icon('refresh')}${syncing?'同期中…':'URLを保存して同期'}</button></form><p class="small sync-state" role="status">${esc(syncMessage||`前回の同期：${fmt(state.settings.lastSyncAt)}`)}</p><p class="small muted">起動時・接続復帰時にも取得します。失敗時は保存済み教材を使用します。削除はマスターの出題停止設定で反映します。</p><div class="notice compact">チャットで写真を送ると、ChatGPTが出典と重複を確認してSheetsとGitHubに登録します。Sheetsを手動編集しただけでは公開JSONへ自動反映されないため、このチャットで反映を依頼してください。</div><button class="text-button" data-action="disconnect" ${state.settings.syncUrl?'':'disabled'}>独自URLを解除</button></section><section class="panel settings-panel"><div class="section-title"><h2>${icon('study')} 文化史の学習設定</h2></div><form id="goal-form"><label class="form-field">1日の目標回答数<input type="number" name="dailyGoal" min="1" max="1000" step="1" value="${state.settings.dailyGoal}"></label><button class="button secondary" type="submit">目標を保存</button></form><p class="small muted">目標はホーム画面の今日の学習に反映されます。</p></section><section class="panel settings-panel"><div class="section-title"><h2>${icon('book')} ホーム画面で学習</h2></div><p>AndroidのChromeで開き、メニューから「ホーム画面に追加」または「アプリをインストール」を選択してください。</p>${installPrompt?'<button class="button secondary" data-action="install">アプリをインストール</button>':''}<button class="button secondary" data-action="check-update" ${checkingUpdate?'disabled':''}>${icon('refresh')}${checkingUpdate?'確認中…':'最新版を確認する'}</button>${updateRegistration?'<button class="button primary" data-action="update">新しいバージョンに更新</button>':''}<p class="small sync-state" role="status">${esc(updateStatus||'アプリを開くたびに自動確認します。新しいバージョンが配信されていなければ通知されません。')}</p><p class="small muted">一度オンラインで開くと、保存済み教材と画像をオフラインで利用できます。学習記録はこのブラウザ・端末内に保存されます。</p><div class="data-summary"><span>教材バージョン<strong>v${state.catalog.version}</strong></span><span>アプリ<strong>${esc(appVersion)}</strong></span></div><button class="text-button" data-action="persist">端末内の保存領域を保護する</button><p class="small muted">ブラウザが対応している場合に永続保存をリクエストします。バックアップは引き続き必要です。</p></section></div>`;}
function rememberRoute(){
  const route=view==='chronology-errors'?'#/chronology-errors':view==='maps'?'#/maps/'+mapRoute:view==='portal'?'#/':['settings','calendar','mastery'].includes(view)?'#/'+view:view==='ambiguous'?`#/ambiguous/${ambiguousRoute}`:view==='years'?`#/years/${yearPage}`:`#/culture/${view==='study'?'setup':view}`;
  window.history.pushState({view:view==='study'?'setup':view,area,yearPage,ambiguousRoute,mapRoute},'',route);
}
function focusPage(){window.scrollTo({top:0,behavior:'instant'});document.querySelector<HTMLElement>('#main')?.focus({preventScroll:true});}
function go(next:View,push=true){
  navigationEpoch++;
  if(view==='maps'&&next!=='maps')mapFeature.leave();
  if(view==='compare'&&next!=='compare')compareFeature.leave();
  if(view==='graph'&&next!=='graph')graphFeature.leave();
  if(view==='years'&&next!=='years')yearFeature.leave();
  if(view==='ambiguous'&&next!=='ambiguous')ambiguousFeature.leave();
  view=next;search='';
  if(['portal','calendar','mastery','maps'].includes(next))area=null;
   else if(next==='chronology-errors')area='chronology-errors';
  else if(next==='ambiguous'){area='ambiguous';ambiguousRoute='home';ambiguousFeature.navigate('home');}
  else if(next==='years'){area='years';yearPage='home';yearFeature.navigate('home');}
  else if(next!=='settings')area='culture';
  if(push)rememberRoute();
  render();focusPage();if(next!=='study'&&next!=='compare'&&syncPending)void sync();
  else if(next!=='study'&&next!=='compare'&&featureSyncPending)void refreshCultureFeatures(true);
  if(next==='home'&&dailyPlan?.dateKey!==localDateKey())void refreshCultureFeatures(false);
}
function goYear(next:YearPage,push=true){if(view==='ambiguous')ambiguousFeature.leave();navigationEpoch++;area='years';view='years';yearPage=next;yearFeature.navigate(next);if(push)rememberRoute();render();focusPage();}
window.addEventListener('popstate',event=>{
  if(!state)return;
  const route=event.state;
  if(route?.view==='maps'){mapFeature.navigate(route.mapRoute||'map');mapRoute=mapFeature.currentPage();go('maps',false);}
  else if(route?.view==='ambiguous'){if(view==='years')yearFeature.leave();if(view==='compare')compareFeature.leave();navigationEpoch++;view='ambiguous';area='ambiguous';ambiguousFeature.navigate(route.ambiguousRoute||'home');ambiguousRoute=ambiguousFeature.currentRoute();render();focusPage();}
  else if(route?.view==='years')goYear(route.yearPage||'home',false);
  else go(route?.view&&['chronology-errors','portal','home','setup','library','history','review','settings','compare','graph','calendar','mastery'].includes(route.view)?route.view:'portal',false);
});
async function saveCauseAndReload(area:CauseArea,eventId:string,cause:ErrorCause|null){
  await saveErrorCause(area,eventId,cause);
  if(area==='culture')state=await db.load();else if(area==='ambiguous')await ambiguousFeature.refreshSnapshot();else await yearFeature.refreshSnapshot();
}
async function startAnalysisSession(area:CauseArea,ids:string[]){
  if(area==='ordering'){goYear('ordering');await yearFeature.startOrderingQuestions(ids);return;}
  if(area==='ambiguous'){go('ambiguous',false);ambiguousFeature.navigate('quiz');ambiguousRoute='quiz';rememberRoute();render();focusPage();await ambiguousFeature.startSelectedQuestions(ids);return;}
  await startInsightSession(area,ids);
}
async function startInsightSession(target:LearningArea,ids:string[]){
  if(saving){toast('回答を保存しています。少し待ってください。');return;}
  if(target==='years'){goYear('quiz');await yearFeature.startSelectedQuestions(ids);return;}
  const epoch=navigationEpoch;if(currentSync)await currentSync;if(epoch!==navigationEpoch)return;
  state=await db.load();if(epoch!==navigationEpoch)return;
  const available=new Map(activeCards().map(card=>[card.id,card]));queue=[...new Set(ids)].flatMap(id=>available.has(id)?[available.get(id)!]:[]);
  if(!queue.length){toast('現在、この範囲に出題可能なカードはありません。');return;}
  sessionKind='related';position=0;sessionCorrect=0;revealed=false;sessionId=crypto.randomUUID();go('study');
}
async function start(mode?:StudyFilter['mode']) {
  if(saving){toast('回答を保存しています。少し待ってから開始してください。');return;}
  const epoch=navigationEpoch;
  if(currentSync)await currentSync; state=await db.load();
  if(epoch!==navigationEpoch)return;
  if(mode){filter={...structuredClone(DEFAULT_FILTER),mode};}
  const candidates=selectCards(state.catalog,state.events,filter);
  const limit=sessionLimit==='all'?candidates.length:Number(sessionLimit);
  // Keep highest-priority due/weak candidates, and diversify other sessions across all eligible cards.
  const pool=filter.mode==='weak'||filter.mode==='due'?candidates.slice(0,limit):candidates;
  queue=spreadSessionCards(pool,limit);
  if(!queue.length){toast('この条件に合うカードはありません。範囲を変更してください。');go('setup');return;}
  sessionKind='normal';position=0;sessionCorrect=0;revealed=false;sessionId=crypto.randomUUID();go('study');
}
async function startDailySession(){
  if(saving)return;
  const epoch=navigationEpoch;if(currentSync)await currentSync;if(epoch!==navigationEpoch)return;
  state=await db.load();dailyPlan=await db.getOrCreateDailyPlan();
  if(epoch!==navigationEpoch)return;
  const done=completedDaily(dailyPlan,state.events),byId=new Map(activeCards().map(c=>[c.id,c]));
  queue=dailyPlan.cardIds.filter(id=>!done.has(id)&&byId.has(id)).map(id=>byId.get(id)!);
  if(!queue.length){toast('今日のおすすめは完了しました。');go('home');return;}
  sessionKind='daily';position=0;sessionCorrect=0;revealed=false;sessionId=crypto.randomUUID();go('study');
}
async function startRelatedSession(ids:string[]){
  if(saving)return;
  const epoch=navigationEpoch;if(currentSync)await currentSync;if(epoch!==navigationEpoch)return;
  state=await db.load();if(epoch!==navigationEpoch)return;const owners=new Set(ids);queue=activeCards().filter(c=>owners.has(c.knowledgeId));
  if(!queue.length){toast('この知識に対応する出題可能なカードはありません。');return;}
  sessionKind='related';position=0;sessionCorrect=0;revealed=false;sessionId=crypto.randomUUID();go('study');
}
function refreshCultureFeatures(remote:boolean):Promise<void>{
  if(cultureSessionActive()){featureSyncPending=true;return Promise.resolve();}
  if(featureRefresh)return featureRefresh;
  featureSyncPending=false;
  featureRefresh=(async()=>{
    try{
      dailyPlan=await db.getOrCreateDailyPlan();
      const saved=await db.loadRelations();if(saved)relationData=saved;
      if(remote||!saved){
        relationLoading=true;
        try{
          let incoming:CultureRelations;
          try{if(!navigator.onLine)throw Error('オフラインです。');incoming=await fetchRelationsData();}
          catch(error){if(saved)throw error;const response=await fetch(new URL('./culture-relations.json',location.href));if(!response.ok)throw error;incoming=validateRelations(await response.json());}
          // A new matching session takes a snapshot, so cache replacement waits.
          if(cultureSessionActive()){featureSyncPending=true;return;}
          await db.applyRelations(incoming);relationData=(await db.loadRelations())!;
          relationMessage='関係データを確認しました。';
        }catch(error){relationMessage=`${relationData.relations.length?'保存済みの関係で学習できます。':'関係データは準備中です。'} ${message(error)}`;}
        finally{relationLoading=false;}
      }
      const resolved=resolveRelations(relationData,state.catalog);
      if(resolved.relations.length)relationMessage=`関係${resolved.relations.length}件・識別セット${resolved.comparisonSets.length}組。暫定の関係は出典で確認できます。${resolved.diagnostics.length?` ${resolved.diagnostics.length}件の参照を確認してください。`:''}`;
    }catch(error){relationMessage=`関係データを利用できません。${message(error)}`;}
    finally{featureRefresh=null;if(!cultureSessionActive())render();}
  })();return featureRefresh;
}
function readOptions(form:HTMLFormElement,changedName?:string){
  const f=new FormData(form),regionGroups=f.getAll('regionGroups') as string[];
  const allowed=new Set([...eraGroupsForRegions(availableRegionGroups(activeItems(),regionGroups)).map(o=>o.id),'unclassified']);
  const regionChanged=changedName==='regionGroups';
  filter={mode:f.get('mode') as StudyFilter['mode'],level:f.get('level')==='all'?'all':Number(f.get('level')) as Level,levelMode:f.get('levelMode') as StudyFilter['levelMode'],
    regions:regionChanged?[]:f.getAll('regions') as string[],eras:regionChanged||changedName==='eraGroups'?[]:f.getAll('eras') as string[],
    fields:f.getAll('fields') as string[],cardType:f.get('cardType') as StudyFilter['cardType'],cardDirection:(f.get('cardDirection')==='person-work'||f.get('cardDirection')==='work-author'?f.get('cardDirection'):'all') as StudyFilter['cardDirection'],regionGroups,eraGroups:regionChanged&&!regionGroups.length?[]:(f.getAll('eraGroups') as string[]).filter(id=>allowed.has(id))};
  detailScopeOpen=form.querySelector<HTMLDetailsElement>('#detail-scope')?.open??false;
  fieldScopeOpen=form.querySelector<HTMLDetailsElement>('#field-scope')?.open??false;
  sessionLimit=String(f.get('limit'));
}
function sync():Promise<void>{
  if(currentSync)return currentSync;
  // Built-in mirrored catalog is used unless the owner supplies a custom JSON source.
  if(cultureSessionActive()){syncPending=true;return Promise.resolve();}
  syncing=true;syncPending=false;syncMessage='教材を取得しています…';if(view==='settings')render();
  currentSync=(async()=>{try{
    const preferred=state.settings.syncUrl||DEFAULT_CATALOG_URL;
    let fallback=false;
    let r;
    try{r=await synchronize(db,preferred);}
    catch(error){
      if(preferred===DEFAULT_CATALOG_URL)throw error;
      // Older CSV / incomplete Apps Script settings must not block the standard source.
      r=await synchronize(db,DEFAULT_CATALOG_URL);
      fallback=true;
    }
    state=await db.load();
    syncMessage=`同期完了：v${r.version} · ${r.itemCount}項目${fallback?'（独自URLが利用できず標準データに切替）':''}`;
    toast('教材を同期しました。学習履歴は保持されています。');
  }catch(e){syncMessage=`同期できませんでした：${message(e)} 保存済み教材で学習できます。`;toast(syncMessage,true);}finally{syncing=false;currentSync=null;if(!cultureSessionActive())render();void refreshCultureFeatures(true);}})();
  return currentSync;
}

function message(e:unknown){return e instanceof Error?e.message:String(e);}
function bind(){
  if(view==='maps')mapFeature.bind();
  if(view==='chronology-errors')chronologyErrorsFeature.bind();
  causeFeature.bind();
  if(view==='mastery')weaknessFeature.bind();
  yearFeature.bind();
  ambiguousFeature.bind();
  if(view==='calendar'||view==='mastery')insightsFeature.bind();
  if(view==='compare')compareFeature.bind();
  if(view==='graph')graphFeature.bind();
  bindKnowledgeActions();
  document.querySelectorAll<HTMLElement>('[data-enter-area]').forEach(el=>el.onclick=()=>go(el.dataset.enterArea==='chronology-errors'?'chronology-errors':el.dataset.enterArea==='maps'?'maps':el.dataset.enterArea==='ambiguous'?'ambiguous':el.dataset.enterArea==='years'?'years':'home'));
  document.querySelectorAll<HTMLElement>('[data-year-nav]').forEach(el=>el.onclick=()=>goYear(el.dataset.yearNav as YearPage));
  document.querySelectorAll<HTMLElement>('[data-nav]').forEach(el=>el.onclick=e=>{e.preventDefault();go(el.dataset.nav as View);});
  document.querySelectorAll<HTMLElement>('[data-start]').forEach(el=>el.onclick=()=>{void start(el.dataset.start as StudyFilter['mode']);});
  document.querySelectorAll<HTMLElement>('[data-level]').forEach(el=>el.onclick=()=>{filter={...structuredClone(DEFAULT_FILTER),level:Number(el.dataset.level) as Level,levelMode:'single'};go('setup');});
  document.querySelectorAll<HTMLDetailsElement>('[data-item-id]').forEach(el=>el.ontoggle=()=>{
    const detail=el.querySelector<HTMLElement>('[data-lazy-detail]');if(!el.open||!detail||detail.dataset.loaded)return;
    const id=el.dataset.itemId!;detail.dataset.loaded='true';detail.innerHTML=itemSources(id)+knowledgeActions(id)+`<div class="linked-cards">${state.catalog.cards.filter(c=>c.knowledgeId===id&&!c.deleted).map(c=>`<div><span class="small muted">${c.type==='image'?'画像カード':'問題カード'}</span><p>${esc(c.question)}</p><strong>${esc(c.answer)}</strong></div>`).join('')}</div>`;bindKnowledgeActions(detail);
  });
  const form=document.querySelector<HTMLFormElement>('#study-options');if(form){
    form.onchange=event=>{
      const control=event.target;
      const focused=control instanceof HTMLInputElement||control instanceof HTMLSelectElement?{name:control.name,value:control.value}:null;
      readOptions(form,focused?.name);render();
      if(focused){
        const next=[...document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('#study-options input, #study-options select')].find(el=>el.name===focused.name&&el.value===focused.value);
        next?.focus({preventScroll:true});
      }
    };
    form.onsubmit=e=>{e.preventDefault();readOptions(form);void start();};
  }
  const scopeDetails=document.querySelector<HTMLDetailsElement>('#detail-scope');
  if(scopeDetails)scopeDetails.ontoggle=()=>{if(scopeDetails.isConnected)detailScopeOpen=scopeDetails.open;};
  const fieldDetails=document.querySelector<HTMLDetailsElement>('#field-scope');
  if(fieldDetails)fieldDetails.ontoggle=()=>{if(fieldDetails.isConnected)fieldScopeOpen=fieldDetails.open;};
  document.querySelectorAll<HTMLElement>('[data-action]').forEach(el=>el.onclick=()=>{void action(el.dataset.action!);});
  document.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach(el=>el.onclick=()=>{void grade(el.dataset.grade==='correct');});
  const image=document.querySelector<HTMLImageElement>('#question-image');if(image){image.onerror=()=>{image.parentElement!.classList.add('hidden');document.querySelector('#image-fallback')?.classList.remove('hidden');};if(image.complete&&image.naturalWidth===0)image.dispatchEvent(new Event('error'));}
  const hs=document.querySelector<HTMLInputElement>('#history-search');if(hs)hs.oninput=()=>{search=hs.value;historyLimit=50;rerenderSearch('history-search',search);};
  const ls=document.querySelector<HTMLInputElement>('#library-search');if(ls)ls.oninput=()=>{libraryQuery=ls.value;libraryLimit=50;rerenderSearch('library-search',libraryQuery);};
  const sort=document.querySelector<HTMLSelectElement>('#history-sort');if(sort)sort.onchange=()=>{historySort=sort.value;historyLimit=50;render();};
  const expandHistory=(cardId?:string)=>{
    const openIds=new Set([...document.querySelectorAll<HTMLDetailsElement>('[data-history-card][open]')].map(detail=>detail.dataset.historyCard!));
    if(cardId)historyEventLimits.set(cardId,(historyEventLimits.get(cardId)||100)+100);else historyLimit+=50;
    render();
    document.querySelectorAll<HTMLDetailsElement>('[data-history-card]').forEach(detail=>{if(openIds.has(detail.dataset.historyCard!))detail.open=true;});
  };
  const historyMore=document.querySelector<HTMLButtonElement>('[data-history-more]');if(historyMore)historyMore.onclick=()=>expandHistory();
  document.querySelectorAll<HTMLButtonElement>('[data-history-events]').forEach(button=>button.onclick=()=>expandHistory(button.dataset.historyEvents));
  const syncForm=document.querySelector<HTMLFormElement>('#sync-form');if(syncForm)syncForm.onsubmit=async e=>{e.preventDefault();try{const value=String(new FormData(syncForm).get('syncUrl')||'').trim();const url=value?normalizeSyncUrl(value):'';await db.updateSettings({syncUrl:url});state=await db.load();if(url)await sync();else{syncMessage='標準のGitHub同期に戻しました。';await sync();}}catch(e){toast(message(e),true);}};
  const gf=document.querySelector<HTMLFormElement>('#goal-form');if(gf)gf.onsubmit=async e=>{e.preventDefault();const n=Number(new FormData(gf).get('dailyGoal'));if(!Number.isInteger(n)||n<1||n>1000)return;await db.updateSettings({dailyGoal:n});state=await db.load();toast('1日の目標を保存しました。');render();};
  const restore=document.querySelector<HTMLInputElement>('#restore-file');if(restore)restore.onchange=async()=>{const file=restore.files?.[0];if(!file)return;try{if(file.size>100*1024*1024)throw new Error('100MB以内のバックアップを選択してください。');const data=JSON.parse(await file.text());await db.restoreBackup(data);state=await db.load();relationData=await db.loadRelations()??structuredClone(EMPTY_RELATIONS);dailyPlan=await db.getOrCreateDailyPlan();toast(`復元しました。${state.events.length}回の回答を保存しています。`);render();}catch(e){toast(`復元できませんでした。現在のデータは保持されています。${message(e)}`,true);}finally{restore.value='';}};
}
function rerenderSearch(id:string,value:string){const input=document.getElementById(id) as HTMLInputElement;const start=input.selectionStart;render();const next=document.getElementById(id) as HTMLInputElement;next.focus();if(next.type!=='search')next.setSelectionRange(start,start);else try{next.setSelectionRange(value.length,value.length);}catch{/* browser dependent */}}
async function grade(correct:boolean){
  if(saving||!revealed||position>=queue.length)return;
  saving=true;const activeSession=sessionId,answeredAt=position,cardId=queue[position].id;
  document.querySelectorAll<HTMLButtonElement>('[data-grade]').forEach(b=>b.disabled=true);
  try{
    const event=await db.recordReview(cardId,correct,activeSession);if(!correct)causeFeature.offer('culture',event.id);
    if(sessionId===activeSession&&position===answeredAt){if(correct)sessionCorrect++;position++;revealed=false;}
    state=await db.load();
  }catch(e){toast(`回答を保存できませんでした。もう一度お試しください。${message(e)}`,true);}
  finally{saving=false;render();if(position>=queue.length&&syncPending)void sync();}
}
async function action(name:string){try{
  if(name==='reveal'){revealed=true;render();document.querySelector<HTMLElement>('.answer-area')?.scrollIntoView({block:'nearest',behavior:'smooth'});}
  if(name==='end-session'){go('home');}
  if(name==='start-daily'){await startDailySession();}
  if(name==='feature-sync'){await refreshCultureFeatures(true);}
  if(name==='library-more'){libraryLimit+=50;render();}
  if(name==='reset-filter'){filter=structuredClone(DEFAULT_FILTER);detailScopeOpen=false;fieldScopeOpen=false;render();}
  if(name==='all-regions'){filter={...filter,regionGroups:[],eraGroups:[],regions:[],eras:[]};render();}
  if(name==='all-eras'){filter={...filter,eraGroups:[],eras:[]};render();}
  if(name==='zoom-image'){const c=queue[position];const im=state.catalog.items.find(i=>i.id===c.knowledgeId)?.images.find(i=>i.id===c.imageId);if(im)zoom(im);}
  if(name==='close-image')(document.querySelector('#image-dialog') as HTMLDialogElement).close();
  if(name==='backup'){const backup=await db.exportBackup();const url=URL.createObjectURL(new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`culture-history-backup-${todayKey(new Date())}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);await db.updateSettings({lastBackupAt:new Date().toISOString()});state=await db.load();toast('バックアップファイルを保存しました。');render();}
  if(name==='disconnect'){await db.updateSettings({syncUrl:'',lastSyncAt:null});state=await db.load();syncMessage='独自URLを解除し、標準のGitHub同期に戻しました。';render();void sync();}
  if(name==='install'&&installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;render();}
  if(name==='check-update'&&!checkingUpdate){
     checkingUpdate=true;updateStatus='公開済みの最新版を確認しています…';render();
     try{
       const result=await checkPwaUpdate(pwaRegistration);
       const registration=pwaRegistration??(await navigator.serviceWorker?.getRegistration())??null;
       if(registration?.waiting)updateRegistration=registration;
       updateStatus=result==='offline'?'オフラインです。接続後に再確認してください。'
         :result==='unsupported'?'このブラウザで更新機能が使えません。Chromeから開いてください。'
         :registration?.waiting?'更新が見つかりました。下の更新ボタンを押してください。'
         :'更新の確認を行いました。新しい公開版があれば更新ボタンが表示されます。';
     }catch(error){updateStatus='更新確認に失敗しました：'+message(error);}
     finally{checkingUpdate=false;render();}
   }
   if(name==='update'&&updateRegistration){activateUpdate(updateRegistration);}
  if(name==='persist'){const ok=await navigator.storage?.persist?.();toast(ok?'永続保存が許可されました。':'このブラウザでは永続保存が許可されませんでした。JSONバックアップをご利用ください。');}
}catch(e){toast(message(e),true);}}
function zoom(im:ImageAsset){const d=document.querySelector<HTMLDialogElement>('#image-dialog')!;document.querySelector('#image-dialog-content')!.innerHTML=`<img src="${esc(safeUrl(im.url))}" alt="拡大した問題画像"><p>${revealed?esc(im.caption):'問題の画像'}</p><p class="small">${esc(im.author)} / <a href="${esc(safeUrl(im.licenseUrl))}" target="_blank" rel="noopener noreferrer">${esc(im.license)}</a> / <a href="${esc(safeUrl(im.sourceUrl))}" target="_blank" rel="noopener noreferrer">出典</a></p>`;d.showModal();}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e as typeof installPrompt;if(view==='settings')render();});
window.addEventListener('offline',()=>{toast('オフラインになりました。保存済み教材で学習できます。');if(state&&!cultureSessionActive())render();});
window.addEventListener('online',()=>{if(state){if(!cultureSessionActive())render();void sync();void yearFeature.onOnline();void ambiguousFeature.onOnline();void chronologyErrorsFeature.sync();}});
window.addEventListener('focus',()=>void chronologyErrorsFeature.sync());
window.addEventListener('keydown',e=>{if(view==='study' && !document.querySelector('dialog[open]') && !(e.target instanceof HTMLInputElement)){if(e.key===' '&&!revealed){e.preventDefault();void action('reveal');}else if(revealed&&e.key==='ArrowRight'){e.preventDefault();void grade(true);}else if(revealed&&e.key==='ArrowLeft'){e.preventDefault();void grade(false);}}});
async function boot(){
  app.innerHTML='<div class="loading-state">学習ノートを開いています…</div>';
  try{
    db=await openDatabase();state=await db.load();
    if(state.catalog.version<seedCatalog.version){await db.applyCatalog(seedCatalog);state=await db.load();}
    relationData=await db.loadRelations()??structuredClone(EMPTY_RELATIONS);
    dailyPlan=await db.loadDailyPlan();
    const requested=location.hash.match(/^#\/culture\/(compare|graph)$/)?.[1] as View|undefined;
    const requestedYear=location.hash.match(/^#\/years\/(ordering|timeline)$/)?.[1] as YearPage|undefined;
    const requestedInsight=location.hash.match(/^#\/(calendar|mastery)$/)?.[1] as View|undefined;
    const requestedAmbiguous=location.hash.match(/^#\/ambiguous\/(.+)$/)?.[1];
    const requestedMap=location.hash.match(/^#\/maps\/(map|region|quiz|review|admin|data)$/)?.[1] as MapPage|undefined;
    const requestedNotebook=location.hash==='#/chronology-errors';
     if(requestedMap){mapRoute=requestedMap;mapFeature.navigate(mapRoute);}
    view=requestedNotebook?'chronology-errors':requestedMap?'maps':requestedAmbiguous?'ambiguous':requestedInsight??(requestedYear?'years':requested??'portal');area=requestedNotebook?'chronology-errors':requestedMap?null:requestedAmbiguous?'ambiguous':requestedInsight?null:requestedYear?'years':requested?'culture':null;
    if(requestedAmbiguous){ambiguousFeature.navigate(requestedAmbiguous);ambiguousRoute=ambiguousFeature.currentRoute();}
    if(requestedYear){yearPage=requestedYear;yearFeature.navigate(requestedYear);}
    window.history.replaceState({view,area,yearPage,ambiguousRoute,mapRoute},'',requestedNotebook?'#/chronology-errors':requestedMap?'#/maps/'+mapRoute:requestedAmbiguous?'#/ambiguous/'+ambiguousRoute:requestedInsight?'#/'+requestedInsight:requestedYear?'#/years/'+requestedYear:requested?'#/culture/'+requested:'#/');
    render();void chronologyErrorsFeature.sync();void yearFeature.initialize();void ambiguousFeature.initialize();void mapFeature.initialize();
    void setupPwa({onUpdate:r=>{updateRegistration=r;updateStatus='新しい公開版が見つかりました。「新しいバージョンに更新」を押してください。';toast('新しいバージョンがあります。データ管理から更新できます。');if(view==='settings')render();},onError:()=>{updateStatus='更新確認で通信エラーが発生しました。';if(view==='settings')render();}}).then(r=>{pwaRegistration=r;});
    if(!navigator.onLine)void refreshCultureFeatures(false);
    void sync();
  }catch(e){app.innerHTML=`<div class="loading-state"><h1>学習データを開けませんでした</h1><p>${esc(message(e))}</p><p>ブラウザの保存容量やプライベートモードの設定をご確認ください。データは削除せず、再読み込みしてください。</p><button class="button primary" onclick="location.reload()">もう一度開く</button></div>`;}
}
// Time alone can change due/mastery state; never interrupt an active exercise.
window.setInterval(()=>{if(state&&['calendar','mastery'].includes(view)&&!document.hidden)render();},60_000);
void boot();
