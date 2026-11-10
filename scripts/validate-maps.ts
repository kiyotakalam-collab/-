import {validateRegionalCities} from '../src/regional-cities.ts';
import {readFile} from 'node:fs/promises';
import {validateMapCatalog,validateMapInventory,mapDiagnostics} from '../src/historical-maps.ts';
const c=validateMapCatalog(JSON.parse(await readFile(process.argv[2]??'public/historical-maps.json','utf8'))),i=validateMapInventory(JSON.parse(await readFile(process.argv[3]??'public/historical_map_inventory.json','utf8')));
if(i.candidates.some(x=>x.linked_feature_ids.some(id=>!c.features.some(f=>f.id===id))))throw Error('棚卸しの参照先が不正です。');
console.log(JSON.stringify({pages:i.pages.length,candidates:i.candidates.length,features:c.features.length,...mapDiagnostics(c)},null,2));

const regional=validateRegionalCities(JSON.parse(await readFile('public/map-city-expansion-v1.json','utf8')));
const copy=validateRegionalCities(JSON.parse(await readFile('data/map-city-expansion-v1.json','utf8')));
if(JSON.stringify(regional)!==JSON.stringify(copy))throw Error('配信用と原データ整理版が一致しません。');
console.log('地域別閲覧用都市: '+regional.features.length+'件 ／ '+regional.regions.map(r=>r.id+' '+regional.features.filter(f=>f.region===r.id).length+'件').join(' ／ '));
