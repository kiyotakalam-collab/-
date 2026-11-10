import {readFile} from 'node:fs/promises';
import {validateMapCatalog,validateMapInventory,mapDiagnostics} from '../src/historical-maps.ts';
const c=validateMapCatalog(JSON.parse(await readFile(process.argv[2]??'public/historical-maps.json','utf8'))),i=validateMapInventory(JSON.parse(await readFile(process.argv[3]??'public/historical_map_inventory.json','utf8')));
if(i.candidates.some(x=>x.linked_feature_ids.some(id=>!c.features.some(f=>f.id===id))))throw Error('棚卸しの参照先が不正です。');
console.log(JSON.stringify({pages:i.pages.length,candidates:i.candidates.length,features:c.features.length,...mapDiagnostics(c)},null,2));
