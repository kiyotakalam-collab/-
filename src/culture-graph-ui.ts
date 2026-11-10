import { getProgress } from './core';
import { buildCultureGraph } from './culture-graph';
import { RELATION_LABELS, resolveRelations } from './culture-relations';
import { eraGroupsForRegions, itemEraGroups, regionGroup } from './culture-scope';
import type { Card, Catalog, KnowledgeItem, ReviewEvent } from './types';
import type { CultureGraph, CultureRelation, CultureRelations, FeatureContext } from './culture-feature-types';

const h = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const kindNames = {person:'人物',work:'作品・著作',concept:'思想・用語',building:'建築物'};
const relationNames = RELATION_LABELS;
const href = (value: string | undefined) => { try { const url = new URL(value ?? ''); return ['https:','http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; } catch { return ''; } };
const broadEra = (item: KnowledgeItem) => {
  const options = eraGroupsForRegions([regionGroup(item)]), ids = itemEraGroups(item);
  return options.filter(option => ids.includes(option.id)).map(option => option.label).join('・') || item.era;
};

/** A bounded, directed neighbourhood. Viewing this page never records answers. */
export class GraphUI {
  private centerId = '';
  private detailId = '';
  private query = '';
  private hops: 1 | 2 = 1;
  private limit = 12;
  private display: 'diagram' | 'list' = 'diagram';
  private catalog: Catalog | null = null;
  private items = new Map<string,KnowledgeItem>();
  private cards = new Map<string,Card[]>();
  private events: ReviewEvent[] | null = null;
  private progress = getProgress([]);
  private resolvedCatalog: Catalog | null = null;
  private resolvedSource: CultureRelations | null = null;
  private resolved: ReturnType<typeof resolveRelations> | null = null;
  private graphCache: {catalog:Catalog;relations:CultureRelation[];centerId:string;hops:1|2;limit:number;value:CultureGraph} | null = null;

  constructor(
    private read: () => FeatureContext,
    private rerender: () => void,
    private onStudy: (knowledgeIds: string[]) => void,
    private onCompare: (comparisonSetId: string) => void,
  ) {}
  private index() {
    const context = this.read();
    if (this.catalog !== context.catalog) {
      this.catalog = context.catalog;
      this.items = new Map(context.catalog.items.filter(item => !item.deleted).map(item => [item.id,item]));
      this.cards = new Map();
      for (const card of context.catalog.cards) {
        const rows = this.cards.get(card.knowledgeId) ?? []; rows.push(card); this.cards.set(card.knowledgeId,rows);
      }
    }
    if (this.events !== context.events) { this.events = context.events; this.progress = getProgress(context.events); }
    return context;
  }
  open(centerId?: string) {
    const context = this.index(), available = this.available(context);
    this.centerId = centerId && this.items.has(centerId) ? centerId : available.relations[0]?.fromId ?? '';
    this.detailId = this.centerId; this.query = ''; this.hops = 1; this.limit = 12; this.display = 'diagram';
  }
  leave() { /* Graph visits are read-only; no review or comparison events are written. */ }
  private available(context: FeatureContext) {
    if (!this.resolved || this.resolvedCatalog !== context.catalog || this.resolvedSource !== context.relations) {
      this.resolvedCatalog = context.catalog; this.resolvedSource = context.relations;
      this.resolved = resolveRelations(context.relations,context.catalog);
    }
    return this.resolved;
  }
  private graph(context: FeatureContext, relations: CultureRelation[]) {
    const cache = this.graphCache;
    if (!cache || cache.catalog !== context.catalog || cache.relations !== relations || cache.centerId !== this.centerId || cache.hops !== this.hops || cache.limit !== this.limit) {
      this.graphCache = {catalog:context.catalog,relations,centerId:this.centerId,hops:this.hops,limit:this.limit,value:buildCultureGraph(context.catalog,relations,this.centerId,this.hops,this.limit)};
    }
    return this.graphCache!.value;
  }
  private status(id: string) {
    const cards = this.cards.get(id) ?? [], live = cards.filter(card => !card.deleted);
    let correct = 0, wrong = 0, studied = 0, due = 0, next: string | null = null;
    for (const card of cards) {
      const p = this.progress.get(card.id); if (!p) continue;
      correct += p.correct; wrong += p.wrong;
      if (card.deleted) continue;
      studied++;
      if (p.nextReviewAt && Date.parse(p.nextReviewAt) <= Date.now()) due++;
      if (p.nextReviewAt && (!next || p.nextReviewAt < next)) next = p.nextReviewAt;
    }
    return {correct,wrong,studied,due,next,count:live.length,label:due ? `復習対象 ${due}枚` : studied ? `学習済み ${studied}/${live.length}枚` : '未学習'};
  }
  render(): string {
    const context = this.index(), available = this.available(context);
    if (this.centerId && !this.items.has(this.centerId)) { this.centerId = ''; this.detailId = ''; }
    if (!this.centerId && available.relations.length) { this.centerId = available.relations[0].fromId; this.detailId = this.centerId; }
    const graph = this.graph(context,available.relations);
    const center = this.items.get(this.centerId);
    const text = this.query.trim().normalize('NFKC').toLocaleLowerCase('ja');
    const matches = text ? [...this.items.values()].filter(item => `${item.canonicalName} ${item.aliases.join(' ')}`.normalize('NFKC').toLocaleLowerCase('ja').includes(text)).slice(0,20) : [];
    const heading = `<section class="page-heading"><div><div class="eyebrow">CONNECT YOUR KNOWLEDGE</div><h1>文化史の関連図</h1><p>確認できた関係から、人物・作品・思想のつながりをたどります。</p></div></section>`;
    return `<div id="culture-graph" class="culture-feature">${heading}<section class="panel graph-search-panel"><label class="form-field" for="culture-graph-search">人物・作品・思想を検索<input id="culture-graph-search" type="search" value="${h(this.query)}" placeholder="例：朱熹、プラトン、作品名" autocomplete="off" aria-controls="graph-search-results"></label><div id="graph-search-results" aria-live="polite">${text ? matches.length ? `<p class="small muted">${matches.length}件を表示（最大20件）</p><div class="graph-search-results">${matches.map(item => `<button class="graph-search-choice" data-graph-center="${h(item.id)}"><strong>${h(item.canonicalName)}</strong><small>${h(item.region)} · ${h(broadEra(item))}</small></button>`).join('')}</div>` : '<p class="feature-empty-inline">一致する用語はありません。</p>' : ''}</div></section>
      ${!available.relations.length ? '<section class="panel feature-empty"><h2>関係データは準備中です</h2><p>取得済みの関係データがない場合も、通常の文化史演習は利用できます。オンラインで教材を確認してから、もう一度開いてください。</p></section>' : ''}
      ${center ? `<section class="panel graph-panel"><div class="section-title"><h2>選択中：${h(center.canonicalName)}</h2></div><div class="feature-segmented" role="group" aria-label="関係をたどる範囲"><button data-graph-hop="1" aria-pressed="${this.hops === 1}">1段階</button><button data-graph-hop="2" aria-pressed="${this.hops === 2}">2段階</button></div><div class="feature-segmented graph-display-switch" role="group" aria-label="関連図の表示形式"><button data-graph-display="diagram" aria-pressed="${this.display === 'diagram'}">関連図</button><button data-graph-display="list" aria-pressed="${this.display === 'list'}">関係の一覧</button></div><p class="small muted">${graph.nodes.length}項目・${graph.edges.length}関係を表示。矢印は関係の向きを表します。</p>
      ${this.display === 'diagram' ? this.diagram(graph.nodes,graph.edges) : this.edgeList(graph.edges)}${!graph.edges.length ? '<p class="feature-empty-inline">この項目の関係は、まだ収録されていません。関係を推測して追加することはありません。</p>' : ''}${graph.omitted ? `<p class="small muted" role="status">さらに${graph.omitted}項目あります。画面の見やすさのため一部を省略しています。</p>${this.limit < 20 ? '<button class="button secondary" data-graph-action="expand">最大20項目まで表示</button>' : ''}` : ''}<button class="button secondary graph-study-all" data-graph-action="study-visible" ${graph.nodes.some(item => (this.cards.get(item.id) ?? []).some(card => !card.deleted)) ? '' : 'disabled'}>この関係の通常カードを復習する</button></section>` : ''}
      ${this.detailId && this.items.has(this.detailId) ? this.detail(this.items.get(this.detailId)!,available.relations,available.comparisonSets) : ''}
      ${available.diagnostics.length ? `<details class="feature-diagnostics"><summary>関係データの確認（${available.diagnostics.length}件）</summary><p>参照先を確認できない関係は図と演習から除外しています。</p><ul>${available.diagnostics.slice(0,20).map(message => `<li>${h(message)}</li>`).join('')}</ul></details>` : ''}</div>`;
  }
  private node(item: KnowledgeItem, depth: number) {
    const status = this.status(item.id);
    return `<button class="graph-node ${item.id === this.centerId ? 'is-center' : ''} ${item.id === this.detailId ? 'is-selected' : ''}" data-graph-node="${h(item.id)}" data-graph-depth="${depth}" aria-pressed="${item.id === this.detailId}"><span class="graph-node-type">${kindNames[item.kind]}</span><strong>${h(item.canonicalName)}</strong><span>${h(item.region)} · ${h(broadEra(item))}</span><span class="graph-node-bottom"><small>Lv.${item.level}</small><small>${h(status.label)}</small></span></button>`;
  }
  private diagram(nodes: KnowledgeItem[], edges: CultureRelation[]) {
    const byId = new Map(nodes.map(item => [item.id,item]));
    const seen = new Set([this.centerId]), parents = new Map<string,{id:string;edge:CultureRelation;depth:number}>();
    let frontier = [this.centerId];
    for (let depth = 1; depth <= this.hops; depth++) {
      const next: string[] = [];
      for (const parent of frontier) for (const edge of edges) {
        if (edge.fromId !== parent && edge.toId !== parent) continue;
        const target = edge.fromId === parent ? edge.toId : edge.fromId;
        if (seen.has(target)) continue;
        seen.add(target); parents.set(target,{id:parent,edge,depth}); next.push(target);
      }
      frontier = next;
    }
    const center = byId.get(this.centerId);
    return `<div class="graph-tree" aria-label="${h(center?.canonicalName)}を中心とした関連図">${center ? this.node(center,0) : ''}<div class="graph-branches">${nodes.filter(item => item.id !== this.centerId).map(item => {
      const parent = parents.get(item.id); if (!parent) return '';
      const edge = parent.edge, from = byId.get(edge.fromId)!, to = byId.get(edge.toId)!;
      return `<div class="graph-branch graph-branch-depth-${parent.depth}"><div class="graph-connector"><span class="graph-direction" aria-hidden="true">${edge.fromId === parent.id ? '↓' : '↑'}</span><p><span>${h(from.canonicalName)}</span> <strong>→ ${relationNames[edge.type]} →</strong> <span>${h(to.canonicalName)}</span></p></div>${this.node(item,parent.depth)}</div>`;
    }).join('')}</div></div><details class="graph-all-edges"><summary>すべての関係と出典（${edges.length}件）</summary>${this.edgeList(edges)}</details>`;
  }
  private edgeList(edges: CultureRelation[]) {
    return `<div class="graph-edge-list">${edges.map(edge => {
      const from = this.items.get(edge.fromId), to = this.items.get(edge.toId); if (!from || !to) return '';
      return `<article class="graph-edge" data-graph-edge="${h(edge.id)}" data-from-id="${h(edge.fromId)}" data-to-id="${h(edge.toId)}"><div class="graph-edge-direction"><button data-graph-select="${h(from.id)}">${h(from.canonicalName)}</button><strong>→ ${relationNames[edge.type]} →</strong><button data-graph-select="${h(to.id)}">${h(to.canonicalName)}</button></div><p>${h(edge.description)}</p><span class="feature-verification">${edge.verification === 'verified' ? '出典で確認済み' : '暫定：出典の記述を参照'}</span><details><summary>関係の出典</summary><ul>${edge.sources.map(source => `<li>${href(source.url) ? `<a href="${h(href(source.url))}" target="_blank" rel="noopener noreferrer">${h(source.title)}</a>` : h(source.title)}${source.note ? `<p>${h(source.note)}</p>` : ''}</li>`).join('')}</ul></details></article>`;
    }).join('')}</div>`;
  }
  private detail(item: KnowledgeItem, relations: CultureRelation[], sets: FeatureContext['relations']['comparisonSets']) {
    const status = this.status(item.id), linked = relations.filter(relation => relation.fromId === item.id || relation.toId === item.id);
    const relationIds = new Set(linked.map(relation => relation.id));
    const comparisons = sets.filter(set => set.relationIds.some(id => relationIds.has(id))).slice(0,4);
    const confusing = this.read().comparisonEvents.filter(event => !event.correct && (event.sourceKnowledgeId === item.id || event.targetKnowledgeId === item.id)).length;
    const relatedIds = [...new Set(linked.flatMap(relation => [relation.fromId,relation.toId]).filter(id => id !== item.id))];
    return `<section class="panel graph-detail" aria-labelledby="graph-detail-title"><div class="feature-card-top"><span>${kindNames[item.kind]}</span><span class="level-tag l${item.level}">Lv.${item.level}</span></div><h2 id="graph-detail-title" tabindex="-1">${h(item.canonicalName)}</h2>${item.aliases.length ? `<p class="small muted">別名：${item.aliases.map(h).join('・')}</p>` : ''}<p>${h(item.description)}</p><p class="small muted">${h(item.region)} ／ ${h(broadEra(item))}<br>教材の分類：${h(item.era)}</p><dl class="graph-detail-metrics"><div><dt>学習状況</dt><dd>${h(status.label)}</dd></div><div><dt>通常カードの累積正答</dt><dd>${status.correct}回</dd></div><div><dt>通常カードの累積誤答</dt><dd>${status.wrong}回</dd></div><div><dt>識別演習の混同</dt><dd>${confusing}回</dd></div><div><dt>次回推奨復習</dt><dd>${status.next ? h(new Date(status.next).toLocaleString('ja-JP')) : '未学習・予定なし'}</dd></div></dl>${relatedIds.length ? `<h3>関連する知識</h3><div class="graph-related-chips">${relatedIds.slice(0,20).map(id => `<button data-graph-select="${h(id)}">${h(this.items.get(id)?.canonicalName ?? id)}</button>`).join('')}</div>` : ''}<div class="feature-button-stack"><button class="button primary" data-graph-study="${h(item.id)}" ${status.count ? '' : 'disabled'}>関連問題を解く（${status.count}枚）</button>${item.id === this.centerId ? '' : `<button class="button secondary" data-graph-center="${h(item.id)}">この項目を中心にする</button>`}${comparisons.map(set => `<button class="button secondary" data-graph-compare="${h(set.id)}">比較演習：${h(set.title)}</button>`).join('')}</div><p class="small muted">固定ID：${h(item.id)}<br>関連図の閲覧では、正答・誤答は記録しません。</p></section>`;
  }
  private refresh(focus?: string) {
    const panel = document.querySelector('#culture-graph'); if (!panel) return;
    panel.outerHTML = this.render(); this.bind();
    if (focus) document.getElementById(focus)?.focus({preventScroll:true});
  }
  private choose(id: string, center: boolean) {
    if (!this.items.has(id)) return;
    if (center) { this.centerId = id; this.hops = 1; this.limit = 12; this.query = ''; }
    this.detailId = id; this.refresh();
    if (!center) { const title = document.querySelector<HTMLElement>('#graph-detail-title'); title?.focus({preventScroll:true}); title?.scrollIntoView({block:'nearest'}); }
  }
  bind() {
    const search = document.querySelector<HTMLInputElement>('#culture-graph-search');
    if (search) search.oninput = () => { this.query = search.value; const cursor = search.selectionStart; this.refresh('culture-graph-search'); const next = document.querySelector<HTMLInputElement>('#culture-graph-search'); try { next?.setSelectionRange(cursor,cursor); } catch { /* Browser-specific search selection support. */ } };
    document.querySelectorAll<HTMLButtonElement>('[data-graph-center]').forEach(button => button.onclick = () => this.choose(button.dataset.graphCenter!,true));
    document.querySelectorAll<HTMLButtonElement>('[data-graph-node]').forEach(button => button.onclick = () => this.choose(button.dataset.graphNode!,false));
    document.querySelectorAll<HTMLButtonElement>('[data-graph-select]').forEach(button => button.onclick = () => this.choose(button.dataset.graphSelect!,false));
    document.querySelectorAll<HTMLButtonElement>('[data-graph-hop]').forEach(button => button.onclick = () => { this.hops = button.dataset.graphHop === '2' ? 2 : 1; this.limit = 12; this.detailId = this.centerId; this.refresh(); document.querySelector<HTMLButtonElement>(`[data-graph-hop="${this.hops}"]`)?.focus({preventScroll:true}); });
    document.querySelectorAll<HTMLButtonElement>('[data-graph-display]').forEach(button => button.onclick = () => { this.display = button.dataset.graphDisplay === 'list' ? 'list' : 'diagram'; this.refresh(); document.querySelector<HTMLButtonElement>(`[data-graph-display="${this.display}"]`)?.focus({preventScroll:true}); });
    document.querySelectorAll<HTMLButtonElement>('[data-graph-study]').forEach(button => button.onclick = () => this.onStudy([button.dataset.graphStudy!]));
    document.querySelectorAll<HTMLButtonElement>('[data-graph-compare]').forEach(button => button.onclick = () => this.onCompare(button.dataset.graphCompare!));
    document.querySelectorAll<HTMLButtonElement>('[data-graph-action]').forEach(button => button.onclick = () => {
      if (button.dataset.graphAction === 'expand') { this.limit = 20; this.refresh(); }
      if (button.dataset.graphAction === 'study-visible') { const context = this.index(), available = this.available(context); this.onStudy(this.graph(context,available.relations).nodes.map(item => item.id)); }
    });
  }
}
