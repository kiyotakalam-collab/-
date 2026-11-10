import type {Catalog} from './types';
import type {CultureGraph,CultureRelation} from './culture-feature-types';

export function buildCultureGraph(catalog:Catalog,relations:CultureRelation[],centerId:string,hops:1|2=1,limit=12):CultureGraph{
  const items=new Map(catalog.items.filter(i=>!i.deleted).map(i=>[i.id,i]));
  if(!items.has(centerId))return {nodes:[],edges:[],omitted:0};
  const links=new Map<string,CultureRelation[]>();
  for(const r of relations){if(!items.has(r.fromId)||!items.has(r.toId))continue;for(const id of [r.fromId,r.toId]){const rows=links.get(id)??[];rows.push(r);links.set(id,rows);}}
  const ids=new Set([centerId]);let frontier=[centerId];
  for(let depth=0;depth<hops;depth++){
    const next:string[]=[];for(const id of frontier)for(const r of links.get(id)??[])for(const target of [r.fromId,r.toId])if(!ids.has(target)){ids.add(target);next.push(target);}
    frontier=next;
  }
  const all=[...ids],visible=all.slice(0,Math.max(1,Math.min(24,limit))),shown=new Set(visible);
  return {nodes:visible.map(id=>items.get(id)!),edges:relations.filter(r=>shown.has(r.fromId)&&shown.has(r.toId)),omitted:Math.max(0,all.length-visible.length)};
}
