import {describe,expect,it} from 'vitest';
import {DEFAULT_FILTER, type Catalog} from '../src/types';
import {mergeCatalog,selectCards} from '../src/core';
import {readFileSync} from 'node:fs';
import {seedCatalog} from '../src/seed';
import {REGION_GROUPS,UNCLASSIFIED_ERA,eraGroupsForRegions,itemEraGroups,regionGroup} from '../src/culture-scope';
import {makeCard,makeItem,TIME} from './fixtures';
const publishedDelta=JSON.parse(readFileSync(new URL('../public/catalog-delta.json',import.meta.url),'utf8'));

describe('broad culture display groups',()=>{
  it('keeps the newly published Oriental catalogue reachable without changing any records',()=>{
    const catalog=mergeCatalog(seedCatalog,publishedDelta),before=JSON.stringify(catalog);
    const cards=selectCards(catalog,[],structuredClone(DEFAULT_FILTER));
    expect(new Set(cards.map(card=>card.id)).size).toBe(cards.length);
    for(const item of catalog.items.filter(i=>!i.deleted)){
      const validIds=[...eraGroupsForRegions([regionGroup(item)]).map(option=>option.id),UNCLASSIFIED_ERA];
      expect(itemEraGroups(item).every(id=>validIds.includes(id)),item.id).toBe(true);
      expect(REGION_GROUPS.some(group=>group.id===regionGroup(item))).toBe(true);
    }
    expect(selectCards(catalog,[],{...DEFAULT_FILTER,regionGroups:['china'],eraGroups:['china-ancient-middle']}).length).toBeGreaterThan(0);
    expect(JSON.stringify(catalog)).toBe(before);
  });
  it('offers six European periods and keeps the regional period options separate',()=>{
    expect(eraGroupsForRegions(['europe']).map(x=>x.label)).toEqual(['古代','中世','ルネサンス・宗教改革','17〜18世紀','19世紀','20世紀以降']);
    expect(eraGroupsForRegions(['china']).map(x=>x.label)).toEqual(['古代・中世','近世','近現代']);
    expect(eraGroupsForRegions(['islam']).map(x=>x.label)).toEqual(['成立期・中世','近世','近現代']);
    expect(eraGroupsForRegions(['europe','europe'])).toHaveLength(6);
    expect(eraGroupsForRegions([]).map(x=>x.id)).toContain('other-pre-modern');
  });

  it('covers all current 365 knowledge items without changing their original metadata',()=>{
    const before=JSON.stringify(seedCatalog);
    const active=seedCatalog.items.filter(item=>!item.deleted);
    expect(active).toHaveLength(365);
    const regionIds=REGION_GROUPS.map(x=>x.id);
    for(const item of active){
      expect(regionIds).toContain(regionGroup(item));
      const eras=itemEraGroups(item);
      expect(eras,item.id+' '+item.era).not.toContain(UNCLASSIFIED_ERA);
      expect(eras.every(era=>eraGroupsForRegions([regionGroup(item)]).some(option=>option.id===era)),item.id).toBe(true);
    }
    expect(JSON.stringify(seedCatalog)).toBe(before);
  });

  it.each([
    ['古代ギリシア',['eu-ancient']], ['ヘレニズム',['eu-ancient']], ['ビザンツ帝国',['eu-medieval']],
    ['紀元前19世紀',['eu-ancient']],
    ['北方ルネサンス',['eu-renaissance']], ['中世から近世',['eu-medieval','eu-renaissance']],
    ['科学技術の伝播',['eu-medieval','eu-renaissance']], ['科学革命',['eu-renaissance','eu-17-18']],
    ['18〜19世紀文学',['eu-17-18','eu-19']], ['19〜20世紀美術',['eu-19','eu-20-plus']],
    ['近世哲学',['eu-17-18']], ['近代哲学',['eu-17-18','eu-19']], ['20世紀科学',['eu-20-plus']],
  ])('maps the existing syllabus tag %s to its broader teaching groups',(era,expected)=>{
    expect(itemEraGroups({region:'ヨーロッパ',era:era as string}).sort()).toEqual([...expected].sort());
  });

  it('does not confuse Southeast Asia or Indonesia with India',()=>{
    expect(regionGroup({region:'東南アジア',era:'古代'})).toBe('other-asia');
    expect(regionGroup({region:'インドネシア',era:'古代'})).toBe('other-asia');
    expect(regionGroup({region:'インド',era:'古代'})).toBe('india');
    expect(regionGroup({region:'ヨーロッパ・アメリカ',era:'19世紀'})).toBe('europe');
    expect(regionGroup({region:'世界各地',era:'19世紀探検'})).toBe('other');
  });

  it('uses regional syllabus names for China, Islam and India instead of European date divisions',()=>{
    expect(itemEraGroups({region:'中国',era:'唐宋文化'})).toEqual(['china-ancient-middle']);
    expect(itemEraGroups({region:'中国',era:'明清文化'})).toEqual(['china-early-modern']);
    expect(itemEraGroups({region:'中国',era:'近現代'})).toEqual(['china-modern']);
    expect(itemEraGroups({region:'イスラーム',era:'アッバース朝'})).toEqual(['islam-classical']);
    expect(itemEraGroups({region:'イスラーム',era:'オスマン帝国'})).toEqual(['islam-early-modern']);
    expect(itemEraGroups({region:'インド',era:'グプタ朝'})).toEqual(['india-ancient-middle']);
    expect(itemEraGroups({region:'その他アジア',era:'近世'})).toEqual(['asia-early-modern']);
  });

  it('selects overlapping eras as a union without duplicating cards and preserves raw filters',()=>{
    const items=[makeItem('spanning',{era:'18〜19世紀文学',region:'ヨーロッパ'}),makeItem('ancient',{era:'古代ギリシア',region:'ギリシア'})];
    const cards=items.map(item=>makeCard(item.id+'-card',{knowledgeId:item.id}));
    const catalog:Catalog={schemaVersion:1,version:1,updatedAt:TIME,items,cards};
    const broad={...DEFAULT_FILTER,regionGroups:['europe'],eraGroups:['eu-17-18','eu-19']};
    expect(selectCards(catalog,[],broad).map(x=>x.id)).toEqual(['spanning-card']);
    expect(selectCards(catalog,[],{...DEFAULT_FILTER,regionGroups:['europe']}).map(x=>x.id)).toEqual(['spanning-card','ancient-card']);
    expect(selectCards(catalog,[],{...DEFAULT_FILTER,regions:['ギリシア'],eras:['古代ギリシア']}).map(x=>x.id)).toEqual(['ancient-card']);
    expect(selectCards(catalog,[],{...broad,eras:['古代ギリシア']})).toEqual([]);
  });

  it('keeps unrecognized future eras accessible through all periods and an explicit unclassified option',()=>{
    const item=makeItem('future',{region:'中国',era:'将来追加する未知の区分'});
    const card=makeCard('future-card',{knowledgeId:item.id});
    const catalog:Catalog={schemaVersion:1,version:1,updatedAt:TIME,items:[item],cards:[card]};
    expect(itemEraGroups(item)).toEqual([UNCLASSIFIED_ERA]);
    expect(selectCards(catalog,[],{...DEFAULT_FILTER,regionGroups:['china']})).toEqual([card]);
    expect(selectCards(catalog,[],{...DEFAULT_FILTER,eraGroups:[UNCLASSIFIED_ERA]})).toEqual([card]);
    expect(selectCards(catalog,[],{...DEFAULT_FILTER,eraGroups:['china-ancient-middle']})).toEqual([]);
  });
});
