import { comparisonProgress, gradeComparison, prepareComparison } from './culture-compare';
import { resolveRelations } from './culture-relations';
import { REGION_GROUPS, regionGroup } from './culture-scope';
import type { ComparisonEvent, ComparisonSet, CultureRelation, CultureRelations, FeatureContext, PreparedComparison } from './culture-feature-types';
import type { Catalog } from './types';

const h = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const href = (value: string | undefined) => { try { const url = new URL(value ?? ''); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; } };

/** Comparison answers are kept in memory until an explicit, complete submission. */
export class CompareUI {
  private prepared: PreparedComparison | null = null;
  private sessionRelations: CultureRelation[] = [];
  private selections: Record<string,string> = {};
  private results: ComparisonEvent[] | null = null;
  private sessionId = '';
  private busy = false;
  private generation = 0;
  private region = 'all';
  private mode: 'all' | 'weak' | 'mistakes' = 'all';
  private resolvedCatalog: Catalog | null = null;
  private resolvedSource: CultureRelations | null = null;
  private resolved: ReturnType<typeof resolveRelations> | null = null;
  private historySource: ComparisonEvent[] | null = null;
  private historyResults: ComparisonEvent[] | null = null;
  private historyEvents: ComparisonEvent[] = [];
  private historyProgress = comparisonProgress([]);

  constructor(
    private read: () => FeatureContext,
    private save: (events: ComparisonEvent[]) => Promise<void>,
    private rerender: () => void,
    private notify: (message: string, error?: boolean) => void,
    private onGraph: (id: string) => void,
  ) {}

  open(setId?: string) {
    this.leave();
    if (setId) this.begin(setId);
  }
  leave() {
    this.generation++;
    this.prepared = null; this.results = null; this.selections = {}; this.busy = false;
  }
  isStudying(): boolean { return Boolean(this.prepared) && !this.results; }
  private available() {
    const context = this.read();
    if (!this.resolved || this.resolvedCatalog !== context.catalog || this.resolvedSource !== context.relations) {
      this.resolvedCatalog = context.catalog; this.resolvedSource = context.relations;
      this.resolved = resolveRelations(context.relations, context.catalog);
    }
    return this.resolved;
  }
  private begin(id: string) {
    const context = this.read(), available = this.available();
    if(context.catalogSyncing){this.notify('教材を同期しています。確認が終わってから演習を開始してください。');return;}
    const set = available.comparisonSets.find(entry => entry.id === id);
    if (!set) { this.notify('この比較問題は準備中か、参照する教材が見つかりません。', true); return; }
    try {
      this.generation++; this.sessionId = crypto.randomUUID();
      this.prepared = prepareComparison(set, available.relations, context.catalog, this.sessionId);
      this.sessionRelations = available.relations.filter(relation => set.relationIds.includes(relation.id));
      this.selections = {}; this.results = null; this.busy = false;
    } catch (error) { this.prepared = null; this.notify(error instanceof Error ? error.message : String(error), true); }
  }
  private allEvents() {
    const source = this.read().comparisonEvents;
    if (this.historySource !== source || this.historyResults !== this.results) {
      this.historySource = source; this.historyResults = this.results;
      const map = new Map(source.map(event => [event.id,event]));
      for (const event of this.results ?? []) if (!map.has(event.id)) map.set(event.id,event);
      this.historyEvents = [...map.values()]; this.historyProgress = comparisonProgress(this.historyEvents);
    }
    return this.historyEvents;
  }
  private progress() { this.allEvents(); return this.historyProgress; }
  private score(set: ComparisonSet, progress = this.progress()) {
    return set.relationIds.reduce((sum,id) => {
      const p = progress.get(id); if (!p) return sum;
      const recent = p.recent.length ? 1 - p.recent.filter(Boolean).length / p.recent.length : 0;
      return sum + recent * 10 + Math.min(1,p.wrong / 20);
    },0);
  }
  render(): string {
    const heading = `<section class="page-heading"><div><div class="eyebrow">COMPARE & UNDERSTAND</div><h1>類似知識の識別演習</h1><p>人物・作品・思想の対応を比べて、混同を減らしましょう。</p></div></section>`;
    return `<div id="culture-compare" class="culture-feature">${heading}${this.prepared ? this.exercise() : this.list()}</div>`;
  }
  private list() {
    const context = this.read(), available = this.available(), progress = this.progress();
    const itemById = new Map(context.catalog.items.map(item => [item.id,item]));
    const relationById = new Map(available.relations.map(relation => [relation.id,relation]));
    const matching = available.comparisonSets.filter(set => {
      if (this.region !== 'all' && !set.relationIds.some(id => { const r = relationById.get(id)!; const item = itemById.get(r.fromId); return item && regionGroup(item) === this.region; })) return false;
      return this.mode !== 'mistakes' || set.relationIds.some(id => (progress.get(id)?.wrong ?? 0) > 0);
    });
    if (this.mode === 'weak' || this.mode === 'mistakes') matching.sort((a,b) => this.score(b,progress) - this.score(a,progress) || a.id.localeCompare(b.id));
    const wrong = this.allEvents().filter(event => !event.correct).length;
    return `<section class="panel feature-intro"><h2>3〜5組を、一度に照合する</h2><p>すべての対応を選んでから採点します。途中の変更や離脱は成績に記録しません。</p><p class="feature-record-note">これまでの混同 <strong>${wrong}回</strong><span>通常カードの誤答とは別の記録です。</span></p></section>
      <form id="comparison-filters" class="feature-filter-row"><label class="form-field">地域<select name="comparisonRegion"><option value="all">全地域</option>${REGION_GROUPS.map(group => `<option value="${group.id}" ${this.region === group.id ? 'selected' : ''}>${h(group.label)}</option>`).join('')}</select></label><label class="form-field">並び方<select name="comparisonMode">${([['all','すべてのテーマ'],['weak','苦手な組み合わせを優先'],['mistakes','混同した関係を再演習']] as const).map(([value,label]) => `<option value="${value}" ${this.mode === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></form>
      <p class="small muted" role="status">${matching.length}テーマが対象</p><div class="comparison-set-list">${matching.length ? matching.map(set => {
        const rows = set.relationIds.map(id => progress.get(id));
        const mistakes = rows.reduce((sum,p) => sum + (p?.wrong ?? 0),0);
        return `<article class="panel comparison-set"><div class="feature-card-top"><span class="level-tag l${set.level ?? 1}">Lv.${set.level ?? 1}</span><span>${set.relationIds.length}組</span></div><h2>${h(set.title)}</h2><p>${h(set.description)}</p><p class="small muted">累積の混同 ${mistakes}回</p><button class="button primary" data-comparison-start="${h(set.id)}">演習を開始<span aria-hidden="true">→</span></button></article>`;
      }).join('') : '<section class="panel feature-empty"><h2>この範囲は準備中です</h2><p>確認できた関係だけを出題します。地域や並び方を変えてみてください。</p></section>'}</div>`;
  }
  private complete() {
    if (!this.prepared) return false;
    const values = this.prepared.pairs.map(pair => this.selections[pair.relationId]);
    return values.every(Boolean) && new Set(values).size === values.length;
  }
  private exercise() {
    const prepared = this.prepared!, selected = prepared.pairs.filter(pair => this.selections[pair.relationId]).length;
    const progress = this.progress(), resultById = new Map((this.results ?? []).map(event => [event.relationId,event]));
    const relations = new Map(this.sessionRelations.map(relation => [relation.id,relation]));
    const complete = this.complete();
    return `<div class="feature-session-top"><button class="text-button" data-comparison-action="back">‹ テーマ一覧</button><span>${this.results ? '採点済み' : `${selected} / ${prepared.pairs.length}組を選択`}</span></div><section class="panel comparison-exercise"><div class="feature-card-top"><span class="level-tag l${prepared.set.level ?? 1}">Lv.${prepared.set.level ?? 1}</span><span>${prepared.pairs.length}組の対応</span></div><h2>${h(prepared.set.title)}</h2><p>${h(prepared.set.description)}</p><p class="small muted">候補は1回ずつ使います。採点する前なら選び直せます。</p>
      ${this.results ? `<div class="comparison-result-summary" role="status"><strong>${this.results.filter(result => result.correct).length} / ${this.results.length}組 正答</strong><p>対応ごとの結果を保存しました。通常カードの履歴は変更していません。</p></div>` : ''}
      <div class="comparison-pairs">${prepared.pairs.map((pair,index) => {
        const result = resultById.get(pair.relationId), relation = relations.get(pair.relationId)!;
        const prior = progress.get(pair.relationId), chosen = prepared.choices.find(choice => choice.id === this.selections[pair.relationId]);
        return `<section class="comparison-pair ${result ? result.correct ? 'is-correct' : 'is-wrong' : ''}"><label ${this.results ? "" : `for="comparison-answer-${index}"`}><span class="comparison-number">${index + 1}</span><strong>${h(pair.prompt)}</strong></label>${this.results ? `<div class="comparison-pair-result"><strong>${result?.correct ? '○ 正答' : '× 混同'}</strong><p>あなたの対応：${h(chosen?.label ?? '未選択')}</p><p class="comparison-correct-answer">正しい対応：<strong>${h(pair.answer)}</strong></p><p>${h(relation.description)}</p><details><summary>関係の根拠・出典</summary><p>${relation.verification === 'verified' ? '出典で確認済み' : '暫定：出典の記述に基づく関係'}</p><ul>${relation.sources.map(source => `<li>${href(source.url) ? `<a href="${h(href(source.url))}" target="_blank" rel="noopener noreferrer">${h(source.title)}</a>` : h(source.title)}${source.note ? `<p>${h(source.note)}</p>` : ''}</li>`).join('')}</ul></details><button class="text-button" data-comparison-graph="${h(pair.sourceKnowledgeId)}">この知識の関連図を見る →</button></div>` : `<select id="comparison-answer-${index}" data-comparison-answer="${h(pair.relationId)}" aria-label="${h(pair.prompt)}の対応を選択"><option value="">対応を選択してください</option>${prepared.choices.map(choice => { const used = prepared.pairs.some(other => other.relationId !== pair.relationId && this.selections[other.relationId] === choice.id); return `<option value="${h(choice.id)}" ${this.selections[pair.relationId] === choice.id ? 'selected' : ''} ${used ? 'disabled' : ''}>${h(choice.label)}${used ? '（選択済み）' : ''}</option>`; }).join('')}</select>`}<p class="comparison-cumulative">この関係：累積正答 ${prior?.correct ?? 0} ／ 累積の混同 ${prior?.wrong ?? 0}</p></section>`;
      }).join('')}</div>${this.results ? '<div class="feature-button-stack"><button class="button primary" data-comparison-action="retry">同じテーマを再演習</button><button class="button secondary" data-comparison-action="back">テーマ一覧へ戻る</button></div>' : `<p class="small muted" id="comparison-grade-help" role="status">${complete ? 'すべての対応を選択しました。採点できます。' : '全ての組み合わせを、重複なく選ぶと採点できます。'}</p><button class="button primary comparison-grade" data-comparison-action="grade" aria-describedby="comparison-grade-help" ${!complete || this.busy ? 'disabled' : ''}>${this.busy ? '記録を保存中…' : '採点する'}</button>`}</section>`;
  }
  private refresh(focusId?: string) {
    const panel = document.querySelector('#culture-compare');
    if (!panel) return;
    panel.outerHTML = this.render(); this.bind();
    if (focusId) document.getElementById(focusId)?.focus({preventScroll:true});
  }
  bind() {
    const filters = document.querySelector<HTMLFormElement>('#comparison-filters');
    if (filters) filters.onchange = event => {
      const name = (event.target as HTMLSelectElement).name, values = new FormData(filters);
      this.region = String(values.get('comparisonRegion')); this.mode = String(values.get('comparisonMode')) as typeof this.mode;
      this.refresh(); document.querySelector<HTMLSelectElement>(`#comparison-filters [name="${name}"]`)?.focus({preventScroll:true});
    };
    document.querySelectorAll<HTMLButtonElement>('[data-comparison-start]').forEach(button => button.onclick = () => {this.begin(button.dataset.comparisonStart!); this.refresh();});
    document.querySelectorAll<HTMLSelectElement>('[data-comparison-answer]').forEach(select => select.onchange = () => {if (this.results || this.busy) return; this.selections[select.dataset.comparisonAnswer!] = select.value; this.refresh(select.id);});
    document.querySelectorAll<HTMLButtonElement>('[data-comparison-action]').forEach(button => button.onclick = () => { void this.action(button.dataset.comparisonAction!); });
    document.querySelectorAll<HTMLButtonElement>('[data-comparison-graph]').forEach(button => button.onclick = () => this.onGraph(button.dataset.comparisonGraph!));
  }
  private async action(action: string) {
    if (action === 'back') { this.leave(); this.refresh(); return; }
    if (action === 'retry' && this.prepared) { const id = this.prepared.set.id; this.begin(id); this.refresh(); return; }
    if (action !== 'grade' || !this.prepared || this.results || this.busy || !this.complete()) return;
    const generation = this.generation;
    try {
      if (!this.available().comparisonSets.some(set => set.id === this.prepared!.set.id)) throw Error('教材が更新されたため、このテーマを採点できません。テーマ一覧から選び直してください。');
      this.busy = true; this.refresh();
      const events = gradeComparison(this.prepared, this.selections, this.sessionId, new Date().toISOString());
      await this.save(events);
      if (generation !== this.generation) return;
      this.results = events; this.busy = false; this.refresh();
      document.querySelector<HTMLElement>('.comparison-result-summary')?.scrollIntoView({block:'nearest'});
    } catch (error) {
      if (generation !== this.generation) return;
      this.busy = false; this.notify(error instanceof Error ? error.message : String(error), true); this.refresh();
    }
  }
}
