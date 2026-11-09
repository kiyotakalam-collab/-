import type { KnowledgeItem, StudyFilter } from './types';

/** Display groups only: the catalogue's original region/era tags remain intact. */
export interface ScopeOption { id: string; label: string }
export const REGION_GROUPS: ScopeOption[] = [
  {id:'europe', label:'ヨーロッパ'}, {id:'china', label:'中国'},
  {id:'islam', label:'イスラーム'}, {id:'india', label:'インド'},
  {id:'other-asia', label:'その他アジア'}, {id:'other', label:'その他'},
];
export const UNCLASSIFIED_ERA = 'unclassified';
const ERA_GROUPS: Record<string, ScopeOption[]> = {
  europe: [
    {id:'eu-ancient', label:'古代'}, {id:'eu-medieval', label:'中世'},
    {id:'eu-renaissance', label:'ルネサンス・宗教改革'}, {id:'eu-17-18', label:'17〜18世紀'},
    {id:'eu-19', label:'19世紀'}, {id:'eu-20-plus', label:'20世紀以降'},
  ],
  china: [
    {id:'china-ancient-middle', label:'古代・中世'}, {id:'china-early-modern', label:'近世'},
    {id:'china-modern', label:'近現代'},
  ],
  islam: [
    {id:'islam-classical', label:'成立期・中世'}, {id:'islam-early-modern', label:'近世'},
    {id:'islam-modern', label:'近現代'},
  ],
  india: [
    {id:'india-ancient-middle', label:'古代・中世'}, {id:'india-early-modern', label:'近世'},
    {id:'india-modern', label:'近現代'},
  ],
  'other-asia': [
    {id:'asia-ancient-middle', label:'古代・中世'}, {id:'asia-early-modern', label:'近世'},
    {id:'asia-modern', label:'近現代'},
  ],
  other: [
    {id:'other-pre-modern', label:'近代以前'}, {id:'other-modern', label:'近現代'},
  ],
};
type ScopeItem = Pick<KnowledgeItem, 'region' | 'era'>;

/** Explicit regional names take precedence over wider shared labels. */
export function regionGroup(item: ScopeItem): string {
  const region=item.region.normalize('NFKC');
  if(/中国|中華/.test(region))return 'china';
  if(/イスラーム|イスラム|アラブ/.test(region))return 'islam';
  if(/インド(?!ネシア)|^南アジア$/.test(region))return 'india';
  if(/ヨーロッパ|欧州|欧米|ギリシア|ギリシャ|ローマ|東地中海|西洋|イタリア|フランス|ドイツ|イギリス|英国|ロシア|スペイン|ポルトガル|オランダ|ベルギー|スイス|オーストリア|ポーランド|北欧|スウェーデン|ノルウェー|デンマーク/.test(region))return 'europe';
  if(/アジア|日本|朝鮮|韓国|モンゴル|インドネシア|ベトナム|タイ|カンボジア|イラン|ペルシア/.test(region))return 'other-asia';
  return 'other';
}

/** Regional names are not converted through a single worldwide date boundary. */
export function eraGroupsForRegions(selected: string[]): ScopeOption[] {
  const regions=selected.length?selected:REGION_GROUPS.map(option=>option.id);
  const ids=new Set<string>();
  return regions.flatMap(region=>ERA_GROUPS[region]??[]).filter(option=>{
    if(ids.has(option.id))return false;
    ids.add(option.id);return true;
  });
}

function centuryRange(era: string): number[] {
  const match=/(\d{1,2})(?:[〜～~\-–−](\d{1,2}))?世紀/.exec(era);
  if(!match)return [];
  const first=Number(match[1]),last=Number(match[2]??match[1]);
  if(first>last||last>30)return [];
  return Array.from({length:last-first+1},(_,index)=>first+index);
}

/**
 * Broad, provisional teaching groups derived from existing syllabus tags.
 * A spanning tag belongs to each relevant group; selecting both still yields
 * one card because selectCards filters the original card array once.
 * Unknown future tags stay reachable through 全時代 and 要分類.
 */
export function itemEraGroups(item: ScopeItem): string[] {
  const region=regionGroup(item),era=item.era.normalize('NFKC');
  const out=new Set<string>(),centuries=centuryRange(era);
  const add=(condition:boolean,id:string)=>{if(condition)out.add(id);};
  if(region==='europe'){
    if(/紀元前|(?:^|\s)前\d+世紀/.test(era))return ['eu-ancient'];
    add(/古代|ヘレニズム/.test(era),'eu-ancient');
    add(/中世|ビザンツ/.test(era),'eu-medieval');
    add(/ルネサンス|宗教改革|中世から近世/.test(era),'eu-renaissance');
    // Existing topic tags deliberately span periods instead of inventing dates.
    add(era==='科学技術の伝播','eu-medieval');
    add(era==='科学技術の伝播'||era==='科学革命','eu-renaissance');
    add(era==='科学革命'||/近世|18世紀/.test(era)&&!era.includes('中世から近世'),'eu-17-18');
    add(era==='近代哲学','eu-17-18');
    add(era==='近代哲学','eu-19');
    for(const century of centuries){
      if(century<=5)out.add('eu-ancient');
      else if(century<=14)out.add('eu-medieval');
      else if(century<=16)out.add('eu-renaissance');
      else if(century<=18)out.add('eu-17-18');
      else if(century===19)out.add('eu-19');
      else out.add('eu-20-plus');
    }
  }else if(region==='other'){
    add(/古代|中世|近世|近代以前/.test(era)||centuries.some(c=>c<=18),'other-pre-modern');
    add(/近代|近現代|現代/.test(era)&&!era.includes('近代以前')||centuries.some(c=>c>=19),'other-modern');
  }else{
    const prefix=region==='other-asia'?'asia':region;
    const ancient=region==='islam'?'islam-classical':`${prefix}-ancient-middle`;
    const commonEarly=/古代|中世/.test(era);
    const regionalEarly=region==='china'?/先秦|秦|漢|魏晋|南北朝|隋|唐|宋|元/.test(era)
      :region==='islam'?/成立|古典|ウマイヤ|アッバース|ファーティマ|アイユーブ|セルジューク|マムルーク/.test(era)
      :region==='india'?/ヴェーダ|マウリヤ|クシャーナ|グプタ/.test(era):false;
    add(commonEarly||regionalEarly,ancient);
    add(/近世/.test(era)||region==='china'&&/明|清/.test(era)||region==='islam'&&/オスマン|サファヴィー|ムガル/.test(era)||region==='india'&&/ムガル/.test(era),`${prefix}-early-modern`);
    add(/近現代|近代|現代/.test(era)&&!era.includes('近代以前')||region==='china'&&/民国|中華人民共和国/.test(era),`${prefix}-modern`);
  }
  return out.size?[...out]:[UNCLASSIFIED_ERA];
}

export function matchesCultureScope(item: ScopeItem, filter: Pick<StudyFilter,'regionGroups'|'eraGroups'>): boolean {
  if(filter.regionGroups?.length&&!filter.regionGroups.includes(regionGroup(item)))return false;
  return !filter.eraGroups?.length||itemEraGroups(item).some(group=>filter.eraGroups!.includes(group));
}
