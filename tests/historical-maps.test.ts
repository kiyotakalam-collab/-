import {mapProgress} from '../src/map-progress';
import 'fake-indexeddb/auto';
import {readFileSync} from 'node:fs';
import {describe,it,expect,vi} from 'vitest';
import {activeMapQuestions,geometryPath,mapDiagnostics,snapshotFeatures,validateGeometry,validateMapCatalog,validateMapInventory,yearText,type MapCatalog} from '../src/historical-maps';
import {openMapDB,syncMaps} from '../src/map-db';
const catalog=()=>JSON.parse(readFileSync(new URL('../public/historical-maps.json',import.meta.url),'utf8')) as MapCatalog;
const inventory=()=>JSON.parse(readFileSync(new URL('../public/historical_map_inventory.json',import.meta.url),'utf8'));
describe('historical map provenance and safe geometry',()=>{
 it('validates all 28 visually reviewed pages separately from verified registrations',()=>{
  const i=validateMapInventory(inventory()),c=validateMapCatalog(catalog());expect(i.pages).toHaveLength(28);expect(i.candidates).toHaveLength(389);expect(i.pages.every(p=>p.status==='reviewed'&&p.extraction_status==='partial')).toBe(true);expect(i.candidates.every(c=>c.verification_status==='C')).toBe(true);expect(mapDiagnostics(c)).toMatchObject({verified:12,approximate:14,cities:12,polities:8,routes:0,questions:12});
  expect(c.features.filter(f=>f.entity_id==='polity-ottoman')).toHaveLength(3);expect(c.features.find(f=>f.id==='mp-alexandria')?.source_record).toMatchObject({adm0name:'Egypt'});const egypt=i.candidates.filter(c=>c.type==='states'&&c.name_ja.startsWith('エジプト（'));expect(egypt).toHaveLength(2);expect(egypt.map(c=>c.source_pdf_pages)).toEqual([[4],[25]]);
 });
 it('rejects invalid coordinates, nonclosed rings and BCE chronology contradictions',()=>{
  expect(()=>validateGeometry({type:'Point',coordinates:[181,0]})).toThrow();expect(()=>validateGeometry({type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1]]]})).toThrow();expect(()=>validateGeometry({type:'LineString',coordinates:[[0,0]]})).toThrow();expect(()=>validateGeometry({type:'MultiLineString',coordinates:[[[0,0]]]})).toThrow();
  expect(yearText(-1)).toBe('前1年');expect(yearText(1)).toBe('1年');const c=catalog();c.features[0].valid_from=0;expect(()=>validateMapCatalog(c)).toThrow(/年代/);c.features[0].valid_from=100;c.features[0].valid_to=-100;expect(()=>validateMapCatalog(c)).toThrow(/年代/);
 });
 it('never admits approximate, deleted or unreferenced features to normal questions',()=>{
  const c=catalog(),q=c.questions[0];c.features.find(f=>f.id===q.correct_answer)!.verification_status='B';expect(activeMapQuestions(c).some(x=>x.id===q.id)).toBe(false);c.features.find(f=>f.id===q.correct_answer)!.verification_status='A';c.features.find(f=>f.id===q.correct_answer)!.deleted=true;expect(activeMapQuestions(c).some(x=>x.id===q.id)).toBe(false);q.target_feature_ids=['missing'];expect(()=>validateMapCatalog(c)).toThrow(/問題/);
 });
 it('shows only the selected time point, does not interpolate borders, supports real GeoJSON route shapes',()=>{
  const c=catalog(),s=c.snapshots.find(s=>s.reference_year===1600)!;const visible=snapshotFeatures(c,s);expect(visible.some(f=>f.id==='mt-ming-1600')).toBe(true);expect(visible.some(f=>f.id==='mt-ming-1500')).toBe(false);expect(visible.every(f=>f.verification_status!=='C')).toBe(true);
  expect(geometryPath(validateGeometry({type:'LineString',coordinates:[[170,10],[-170,20]]})).split('M')).toHaveLength(3);
 });
 it('requires sources and handles all question formats without inventing distractors',()=>{
  const c=catalog();c.features[0].source_ids=[];expect(()=>validateMapCatalog(c)).toThrow(/出典/);const bad=inventory();bad.pages[0].candidate_ids=['missing'];expect(()=>validateMapInventory(bad)).toThrow();
  const kinds=['period','association'] as const;for(const kind of kinds){const d=catalog();d.questions[0]={...d.questions[0],question_type:kind,option_feature_ids:[],correct_answer:'テスト用の登録済み解答',accepted_answers:['テスト用の登録済み解答']};expect(activeMapQuestions(validateMapCatalog(d))).toHaveLength(12);}
 });
});
describe('independent map history persistence',()=>{
 it('preserves lifetime mistakes, deadlines and event IDs through reopen, synchronization and additive restore',async()=>{
  const name=crypto.randomUUID();let db=await openMapDB(name);await db.apply(catalog(),inventory());const q=catalog().questions[0];await db.grade('wrong',q.id,'session',q.option_feature_ids.find(id=>id!==q.correct_answer)!,null,'region');await db.grade('right',q.id,'session',q.correct_answer,null,null);const before=await db.load(),backup=await db.backup();db.close();db=await openMapDB(name);await db.apply(catalog(),inventory());expect((await db.load()).events).toEqual(before.events);expect(mapProgress(before.events).get(q.id)).toMatchObject({correct:1,wrong:1,attempts:2});
  const restored=await openMapDB(crypto.randomUUID());await restored.restore(backup);await restored.restore(backup);expect((await restored.load()).events).toEqual(before.events);expect(mapProgress((await restored.load()).events)).toEqual(mapProgress(before.events));const corrupt=JSON.parse(backup);corrupt.events[0].confusion='other';await expect(restored.restore(JSON.stringify(corrupt))).rejects.toThrow(/競合/);expect((await restored.load()).events).toEqual(before.events);db.close();restored.close();
 });
 it('rejects repeated grading with conflicting answers and unsafe fixed-ID updates atomically',async()=>{
  const db=await openMapDB(crypto.randomUUID());await db.apply(catalog(),inventory());const q=catalog().questions[0];await db.grade('same',q.id,'session',q.correct_answer,null,null);await db.grade('same',q.id,'session',q.correct_answer,null,null);expect((await db.load()).events).toHaveLength(1);await expect(db.grade('same',q.id,'session',q.option_feature_ids[1],null,null)).rejects.toThrow(/競合/);const c=catalog();c.version++;c.features[0].entity_id='changed';await expect(db.apply(c,inventory())).rejects.toThrow(/再割当/);expect((await db.load()).catalog.version).toBe(1);const update=catalog();update.version=2;update.features[0].version++;update.features[0].uncertainty_note+=' 説明更新';const history=(await db.load()).events;await db.apply(update,inventory());expect((await db.load()).events).toEqual(history);expect(mapProgress((await db.load()).events).get(q.id)?.correct).toBe(1);db.close();
 });
 it('keeps saved catalog on invalid/failed sync and resumes with valid data',async()=>{
  const db=await openMapDB(crypto.randomUUID());await db.apply(catalog(),inventory());const before=await db.load();vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));await expect(syncMaps(db,'https://example.org/')).rejects.toThrow();expect(await db.load()).toEqual(before);
  vi.stubGlobal('fetch',vi.fn(async(url:URL)=>({ok:true,json:async()=>url.pathname.endsWith('historical-maps.json')?catalog():inventory()})));await syncMaps(db,'https://example.org/');expect((await db.load()).catalog).toEqual(before.catalog);vi.unstubAllGlobals();db.close();
 });
});
