import { readFile } from 'node:fs/promises';
import { mergeAmbiguousCatalog, validateAmbiguousCatalog } from '../src/ambiguous.ts';

const input=process.argv[2]??'public/ambiguous-terms.json';
const catalog=validateAmbiguousCatalog(JSON.parse(await readFile(input,'utf8')));
if(process.argv[3])mergeAmbiguousCatalog(validateAmbiguousCatalog(JSON.parse(await readFile(process.argv[3],'utf8'))),catalog);
console.log(`曖昧用語 v${catalog.version}: ${catalog.terms.length}用語 / ${catalog.groups.length}グループ / ${catalog.cards.length}問題 — 検証成功`);
