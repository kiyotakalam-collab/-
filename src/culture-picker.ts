import { REGION_GROUPS, eraGroupsForRegions, itemEraGroups, regionGroup } from './culture-scope';
import type { KnowledgeItem, StudyFilter } from './types';

const h=(value:unknown)=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));

export function availableRegionGroups(items:KnowledgeItem[],selected:string[]):string[]{
  return selected.length?selected:REGION_GROUPS.filter(g=>items.some(i=>regionGroup(i)===g.id)).map(g=>g.id);
}
export function renderCultureScope(items:KnowledgeItem[],filter:StudyFilter):string{
  const selected=filter.regionGroups??[],eras=filter.eraGroups??[];
  const regions=availableRegionGroups(items,selected);
  const regionLabel=selected.length?REGION_GROUPS.filter(g=>selected.includes(g.id)).map(g=>g.label).join('・'):'全地域';
  const eraSections=selected.length?regions.map(id=>{
    const group=REGION_GROUPS.find(g=>g.id===id)!;
    const options=eraGroupsForRegions([id]);
    return `${regions.length>1?`<p class="scope-region-heading">${h(group.label)}</p>`:''}<div class="scope-era-grid">${options.filter(o=>o.id!=='unclassified').map(o=>`<label class="scope-tile"><input type="checkbox" name="eraGroups" value="${h(o.id)}" ${eras.includes(o.id)?'checked':''}><span>${h(o.label)}</span></label>`).join('')}</div>`;
  }).join(''):'';
  const unknown=selected.length>0&&items.some(i=>regions.includes(regionGroup(i))&&itemEraGroups(i).includes('unclassified'));
  return `<section class="culture-scope-picker" aria-label="文化史の地域と時代"><fieldset class="scope-field"><legend>地域を選択</legend><button type="button" class="scope-all ${selected.length?'':'selected'}" data-action="all-regions" aria-pressed="${!selected.length}">全地域</button><div class="scope-region-grid">${REGION_GROUPS.map(g=>{const count=items.filter(i=>regionGroup(i)===g.id).length;return `<label class="scope-tile"><input type="checkbox" name="regionGroups" value="${g.id}" ${selected.includes(g.id)?'checked':''}><span>${h(g.label)}${!count?'<small>未収録</small>':''}</span></label>`;}).join('')}</div><p class="scope-help">ヨーロッパは、既存教材の欧米文化を含みます。</p></fieldset><fieldset class="scope-field"><legend>時代を選択<span>（${h(regionLabel)}）</span></legend><button type="button" class="scope-all ${eras.length?'':'selected'}" data-action="all-eras" aria-pressed="${!eras.length}">全時代</button>${eraSections}${unknown?`<label class="scope-tile scope-unclassified"><input type="checkbox" name="eraGroups" value="unclassified" ${eras.includes('unclassified')?'checked':''}><span>その他・時代確認中</span></label>`:''}<p class="scope-help">${selected.length?"複数選択できます。時代をまたぐ項目は、それぞれの区分に含まれます。":"地域を選ぶと、その地域の時代を表示します。全地域のまま学習することもできます。"}</p></fieldset></section>`;
}
