import {describe,it,expect} from 'vitest';
import {buildCultureGraph} from '../src/culture-graph';
import {featureFixture} from './culture-feature-fixtures';
import {makeItem} from './fixtures';

describe('bounded relation graph',()=>{
  it('keeps the authored edge direction and never duplicates nodes',()=>{
    const {catalog,relations}=featureFixture();
    const graph=buildCultureGraph(catalog,relations.relations,'work-a');
    expect(graph.nodes.map(n=>n.id)).toEqual(['work-a','author-a']);
    expect(graph.edges).toMatchObject([{fromId:'author-a',toId:'work-a',type:'authored'}]);
    expect(new Set(graph.nodes.map(n=>n.id)).size).toBe(graph.nodes.length);
  });
  it('changes the center, expands only on explicit two-hop request and removes deleted nodes',()=>{
    const {catalog,relations}=featureFixture();
    const bridge={...relations.relations[0],id:'bridge',fromId:'author-a',toId:'author-b',type:'influenced' as const};
    const edges=[...relations.relations,bridge];
    expect(buildCultureGraph(catalog,edges,'work-a',1).nodes.map(n=>n.id)).not.toContain('author-b');
    expect(buildCultureGraph(catalog,edges,'work-a',2).nodes.map(n=>n.id)).toContain('author-b');
    expect(buildCultureGraph(catalog,edges,'author-c').nodes[0].id).toBe('author-c');
    const deleted=structuredClone(catalog);deleted.items.find(i=>i.id==='author-a')!.deleted=true;
    const graph=buildCultureGraph(deleted,edges,'work-a',2);
    expect(graph.nodes.map(n=>n.id)).toEqual(['work-a']);expect(graph.edges).toEqual([]);
  });
  it('bounds dense graphs and ignores missing reference edges',()=>{
    const {catalog,relations}=featureFixture();
    const extras=Array.from({length:30},(_,i)=>makeItem('extra-'+i));catalog.items.push(...extras);
    const edges=extras.map(i=>({...relations.relations[0],id:'r-'+i.id,fromId:'author-a',toId:i.id}));
    edges.push({...edges[0],id:'missing-edge',toId:'missing'});
    const graph=buildCultureGraph(catalog,edges,'author-a',1,12);
    expect(graph.nodes).toHaveLength(12);expect(graph.omitted).toBe(19);
    expect(graph.edges).toHaveLength(11);expect(graph.edges.some(e=>e.id==='missing-edge')).toBe(false);
  });
  it('handles empty data or a missing center without modifying inputs',()=>{
    const {catalog,relations}=featureFixture(),before=JSON.stringify({catalog,relations});
    expect(buildCultureGraph(catalog,[],'missing')).toEqual({nodes:[],edges:[],omitted:0});
    expect(buildCultureGraph(catalog,[],'author-a').nodes.map(n=>n.id)).toEqual(['author-a']);
    expect(JSON.stringify({catalog,relations})).toBe(before);
  });
});
