import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { seedCatalog } from '../src/seed.ts';

// Node 24 runs this TypeScript file directly. Only reviewed seed records are exported.
const output = resolve('artifacts/sheets-seed');
await mkdir(output, {recursive: true});
function cell(value: unknown): string {
  const text = Array.isArray(value) ? JSON.stringify(value) : typeof value === 'boolean' ? String(value).toUpperCase() : String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
for (const [tab, rows] of [['Knowledge', seedCatalog.items], ['Cards', seedCatalog.cards]] as const) {
  const header = (await readFile(`sheets/${tab}.csv`, 'utf8')).trim().split(',');
  const content = [header.join(','), ...rows.map(row => header.map(key => cell((row as unknown as Record<string, unknown>)[key])).join(','))].join('\n') + '\n';
  await writeFile(resolve(output, `${tab}.csv`), content, 'utf8');
}
await writeFile(resolve(output, 'catalog.json'), JSON.stringify(seedCatalog, null, 2));
console.log(`初期教材のKnowledge.csv・Cards.csv・catalog.jsonを ${output} に出力しました。固定IDを保って既存タブへ取り込んでください。`);
