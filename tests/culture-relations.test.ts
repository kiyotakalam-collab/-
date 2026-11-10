import {describe,expect,it,vi,afterEach} from 'vitest';
import {readFileSync} from 'node:fs';
import type {Catalog} from '../src/types';
import type {CultureRelation,CultureRelations} from '../src/culture-feature-types';
import {mergeCatalog} from '../src/core';
import {seedCatalog} from '../src/seed';
import {comparisonEndpoints,createRelationIndex,EMPTY_RELATIONS,fetchRelationsData,resolveRelations,validateRelations} from '../src/culture-relations';
import {makeItem,TIME} from './fixtures';

const relation=(n:string,patch:Partial<CultureRelation>={}):CultureRelation=>({id:'r-'+n,fromId:'a-'+n,toId:'w-'+n,type:'authored',description:'試験専用の著作対応。',verification:'provisional',sources:[{title:'試験専用出典'}],...patch});
const fixture=():CultureRelations=>({schemaVersion:1,version:1,updatedAt:TIME,relations:['1','2','3'].map(n=>relation(n)),comparisonSets:[{id:'set-a',title:'試験用の作品と著者',description:'作品と著者を対応させる試験。',relationIds:['r-1','r-2','r-3'],direction:'reverse',level:2}]});
const catalog=():Catalog=>({schemaVersion:1,version:1,updatedAt:TIME,items:['1','2','3'].flatMap(n=>[makeItem('a-'+n),makeItem('w-'+n,{kind:'work'})]),cards:[]});
afterEach(()=>vi.unstubAllGlobals());

describe('explicit cultural relations',()=>{
  it('parses sources without invented public URLs and returns independent values',()=>{
    const input=fixture(),result=validateRelations(input);
    expect(result).toEqual(input);
    result.relations[0].sources[0].title='changed';
    expect(input.relations[0].sources[0].title).toBe('試験専用出典');
    expect(validateRelations(EMPTY_RELATIONS).relations).toEqual([]);
  });
  it('rejects duplicate stable IDs and semantic duplicate edges',()=>{
    const value=fixture();
    expect(()=>validateRelations({...value,relations:[...value.relations,value.relations[0]]})).toThrow(/関係ID/);
    expect(()=>validateRelations({...value,relations:[...value.relations,{...value.relations[0],id:'different-id'}]})).toThrow(/同一の関係/);
    const contrast=relation('1',{type:'contrasted_with'});
    expect(()=>validateRelations({...value,relations:[contrast,{...contrast,id:'mirrored',fromId:contrast.toId,toId:contrast.fromId}]})).toThrow(/同一の関係/);
  });
  it('requires evidence and rejects unsafe URLs, types, IDs and unsupported files',()=>{
    const value=fixture();
    for(const patch of [{sources:[]},{type:'same-century'},{fromId:'bad id'},{verification:'guessed'},{fromId:'w-1'},{sources:[{title:'x',url:'javascript:alert(1)'}]},{sources:[{title:'x',url:'https://secret:token@example.org/'}]}]){
      expect(()=>validateRelations({...value,relations:[{...value.relations[0],...patch}]})).toThrow();
    }
    expect(()=>validateRelations({...value,schemaVersion:2})).toThrow(/形式/);
    expect(()=>validateRelations({...value,version:1.5})).toThrow(/バージョン/);
    expect(()=>validateRelations({...value,updatedAt:'2026-02-30T00:00:00.000Z'})).toThrow(/日時/);
  });
  it('requires three to five unique relationships per comparison set',()=>{
    const value=fixture(),set=value.comparisonSets[0];
    expect(()=>validateRelations({...value,comparisonSets:[{...set,relationIds:['r-1','r-2']}]})).toThrow(/3〜5/);
    expect(()=>validateRelations({...value,comparisonSets:[{...set,relationIds:['r-1','r-1','r-2']}]})).toThrow(/重複/);
    expect(()=>validateRelations({...value,comparisonSets:[{...set,level:'2'}]})).toThrow(/難易度/);
    expect(()=>validateRelations({...value,comparisonSets:[{...set,direction:'guess'}]})).toThrow(/方向/);
  });
  it('excludes broken/deleted references instead of connecting names or guessing replacements',()=>{
    const value=fixture(),c=catalog();
    c.items.find(item=>item.id==='a-1')!.deleted=true;
    c.items=c.items.filter(item=>item.id!=='w-2');
    c.items.push(makeItem('different-id',{canonicalName:'w-2',kind:'work'}));
    const result=resolveRelations(value,c);
    expect(result.relations.map(entry=>entry.id)).toEqual(['r-3']);
    expect(result.comparisonSets).toEqual([]);
    expect(result.diagnostics.some(message=>message.includes('参照先'))).toBe(true);
    expect(result.diagnostics.some(message=>message.includes('出題停止'))).toBe(true);
  });
  it('does not treat a concept as an author or reverse the stored authored direction',()=>{
    const value=fixture(),c=catalog();
    c.items.find(item=>item.id==='a-1')!.kind='concept';
    expect(resolveRelations(value,c).relations.map(entry=>entry.id)).toEqual(['r-2','r-3']);
    expect(comparisonEndpoints(value.relations[0],'reverse')).toEqual({sourceId:'w-1',targetId:'a-1'});
    expect(value.relations[0]).toMatchObject({fromId:'a-1',toId:'w-1'});
  });
  it('rejects repeated answer candidates and mixed relation meanings',()=>{
    const repeated=fixture();repeated.relations[1].fromId='a-1';
    expect(resolveRelations(repeated,catalog()).comparisonSets).toEqual([]);
    const mixed=fixture();mixed.relations[1].type='associated_with';
    expect(resolveRelations(mixed,catalog()).comparisonSets).toEqual([]);
  });
  it('rejects a set when another known edge permits an alternative answer',()=>{
    const value=fixture();
    value.relations.push(relation('extra',{fromId:'a-1',toId:'w-2'}));
    const result=resolveRelations(value,catalog());
    expect(result.relations).toHaveLength(4);
    expect(result.comparisonSets).toHaveLength(0);
    expect(result.diagnostics.some(message=>message.includes('複数の正解'))).toBe(true);
  });
  it('builds indexed incoming/outgoing relations and comparison membership by stable knowledge ID',()=>{
    const value=fixture(),index=createRelationIndex(value,catalog());
    expect(index.byId.get('r-1')).toEqual(value.relations[0]);
    expect(index.byKnowledgeId.get('w-1')?.map(entry=>entry.id)).toEqual(['r-1']);
    expect(index.byKnowledgeId.get('a-1')?.map(entry=>entry.id)).toEqual(['r-1']);
    expect(index.setsByKnowledgeId.get('w-1')?.map(set=>set.id)).toEqual(['set-a']);
    expect(index.comparisonSets).toHaveLength(1);
  });
  it('checks all shipped relations and comparisons against the actual combined catalogue',()=>{
    const shipped=validateRelations(JSON.parse(readFileSync(new URL('../public/culture-relations.json',import.meta.url),'utf8')));
    const combined=mergeCatalog(seedCatalog,JSON.parse(readFileSync(new URL('../public/catalog-delta.json',import.meta.url),'utf8')));
    const before=JSON.stringify(combined),resolved=resolveRelations(shipped,combined);
    expect(shipped.relations.length).toBeGreaterThanOrEqual(40);
    expect(shipped.relations.length).toBeLessThanOrEqual(80);
    expect(resolved.diagnostics).toEqual([]);
    expect(resolved.relations).toHaveLength(shipped.relations.length);
    expect(resolved.comparisonSets).toHaveLength(shipped.comparisonSets.length);
    expect(resolved.comparisonSets.length).toBeGreaterThanOrEqual(10);
    expect(shipped.relations.every(entry=>entry.sources.length&&entry.sources.some(src=>src.note?.includes('根拠')))).toBe(true);
    expect(JSON.stringify(combined)).toBe(before);
  });
  it('validates a fetched file and rejects HTTP errors, malformed data and oversized files',async()=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture()),{status:200}));vi.stubGlobal('fetch',fetch);
    expect(await fetchRelationsData()).toEqual(fixture());
    expect(fetch.mock.calls[0][1]).toMatchObject({cache:'no-store',credentials:'omit'});
    fetch.mockResolvedValueOnce(new Response('no',{status:503}));
    await expect(fetchRelationsData()).rejects.toThrow(/HTTP 503/);
    fetch.mockResolvedValueOnce(new Response('{broken',{status:200}));
    await expect(fetchRelationsData()).rejects.toThrow();
    fetch.mockResolvedValueOnce(new Response('{}',{status:200,headers:{'content-length':String(4*1024*1024)}}));
    await expect(fetchRelationsData()).rejects.toThrow(/大きすぎ/);
  });
});
