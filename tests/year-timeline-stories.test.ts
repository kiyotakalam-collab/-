import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolveYearStories, YEAR_STORIES } from '../src/year-timeline-stories';
import { comparableYear } from '../src/year-chronology';
import { validateYearCatalog } from '../src/years';

const catalog=validateYearCatalog(JSON.parse(readFileSync(new URL('../public/year-events.json',import.meta.url),'utf8')));
describe('curated history flows use existing year IDs without changing the catalogue',()=>{
  it('resolves all 73 turning points in eight small chapters, with exact dates and original sources',()=>{
    const byId=new Map(catalog.items.map(item=>[item.id,item]));
    expect(YEAR_STORIES).toHaveLength(8);const all=YEAR_STORIES.flatMap(story=>story.stops);
    expect(all).toHaveLength(73);expect(new Set(all.map(stop=>stop.itemId)).size).toBe(73);
    for(const story of YEAR_STORIES){
      expect(story.stops.length).toBeGreaterThanOrEqual(8);expect(story.stops.length).toBeLessThanOrEqual(10);expect(story.references.length).toBeGreaterThan(0);
      for(const ref of story.references)expect(new URL(ref.url).protocol).toBe('https:');
      for(const stop of story.stops){expect(comparableYear(byId.get(stop.itemId)!.year)).toBe(stop.year);expect(stop.connection.length).toBeGreaterThan(15);}
    }
    const resolved=resolveYearStories(catalog);expect(resolved.flatMap(story=>story.stops)).toHaveLength(73);
    for(const story of resolved)for(const {item} of story.stops)expect(item).toBe(byId.get(item.id));
  });
  it('keeps chronological order and every simultaneous selected event',()=>{
    for(const story of resolveYearStories(catalog)){
      const dates=story.stops.map(stop=>comparableYear(stop.item.year)!);expect(dates).toEqual([...dates].sort((a,b)=>a-b));
    }
    const sameYear=resolveYearStories(catalog).find(story=>story.id==='cold-war')!.stops.filter(stop=>stop.item.year==='1947');
    expect(sameYear).toHaveLength(2);expect(sameYear.map(stop=>stop.item.region)).toContain('南アジア');
  });
  it('hides missing, deleted, ambiguous-date and changed-date annotations safely',()=>{
    const first=YEAR_STORIES[0].stops[0];
    for(const changes of [{deleted:true},{year:'1500'},{year:'約1453'}]){
      const next={...catalog,items:catalog.items.map(item=>item.id===first.itemId?{...item,...changes}:item)};
      expect(resolveYearStories(next)[0].stops.some(stop=>stop.item.id===first.itemId)).toBe(false);
    }
    expect(resolveYearStories({...catalog,items:[]}).every(story=>story.stops.length===0)).toBe(true);
  });
  it('does not mutate textbook entries when selecting or browsing flows',()=>{
    const before=JSON.stringify(catalog);resolveYearStories(catalog);resolveYearStories(catalog);expect(JSON.stringify(catalog)).toBe(before);expect(catalog.items).toHaveLength(460);
  });
});
