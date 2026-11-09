import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { validateCatalog } from '../src/core';

const source = readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8');
const date = '2026-11-09T00:00:00.000Z';
function harness() {
  const sheets = new Map();
  const properties = new Map();
  const sheet = rows => ({
    rows,
    getLastRow: () => rows.length,
    getLastColumn: () => Math.max(0, ...rows.map(row => row.length)),
    setFrozenRows() {},
    getRange(row, column, height = 1, width = 1) {
      return {
        getDisplayValues: () => Array.from({length: height}, (_, y) => Array.from({length: width}, (_, x) => String(rows[row - 1 + y]?.[column - 1 + x] ?? ''))),
        setValues(values) {
          values.forEach((valuesRow, y) => valuesRow.forEach((value, x) => {
            rows[row - 1 + y] ??= [];
            rows[row - 1 + y][column - 1 + x] = value;
          }));
        },
        setValue(value) { rows[row - 1][column - 1] = value; }
      };
    }
  });
  const ss = {
    getId: () => 'test-spreadsheet',
    getSheetByName: name => sheets.get(name),
    insertSheet(name) { const result = sheet([]); sheets.set(name, result); return result; }
  };
  const context = vm.createContext({
    console: {error() {}},
    SpreadsheetApp: {getActiveSpreadsheet: () => ss, openById: () => ss, flush() {}},
    PropertiesService: {getScriptProperties: () => ({setProperty: (key, value) => properties.set(key, value), getProperty: key => properties.get(key)})},
    LockService: {getScriptLock: () => ({waitLock() {}, tryLock: () => true, hasLock: () => true, releaseLock() {}})},
    ContentService: {MimeType: {JSON: 'application/json'}, createTextOutput: text => ({text, setMimeType() { return this; }})}
  });
  vm.runInContext(source, context);
  context.initializeMaster();
  const item = ['test-person', 'テスト人物', '["別表記"]', 'person', '哲学', 'ギリシア', '古代', '1', '[]', '[]', 'テスト用データ', '[]', '[{"title":"テスト出典","url":"https://example.org/"}]', '暫定分類・テスト用', 'provisional', date, '1', 'FALSE'];
  const card = ['test-card', 'test-person', 'context', 'テスト問題', 'テスト解答', '', '', '', date, '1', 'FALSE'];
  sheets.get('Knowledge').rows.push(item);
  sheets.get('Cards').rows.push(card);
  return {context, sheets, item, card};
}

describe('Apps Script exporter (local service stubs)', () => {
  it('publishes typed Catalog compatible with frontend validation', () => {
    const {context} = harness();
    expect(context.publishCatalog().version).toBe(12);
    const catalog = JSON.parse(context.doGet().text);
    expect(validateCatalog(catalog).items[0].deleted).toBe(false);
    expect(catalog.items[0].level).toBe(1);
    expect(catalog.items[0].aliases).toEqual(['別表記']);
    expect(catalog.cards[0].imageId).toBeUndefined();
  });
  it('holds drafts and malformed arrays out of the public catalog', () => {
    const {context, item} = harness();
    expect(JSON.parse(context.doGet().text).error).toBe('catalog_unavailable');
    item[2] = 'not json';
    expect(() => context.publishCatalog()).toThrow();
    expect(JSON.parse(context.doGet().text).schemaVersion).toBeUndefined();
  });
  it('rejects duplicate names and invalid related references, but supports a bundled-item card delta', () => {
    const {context, sheets, item, card} = harness();
    sheets.get('Knowledge').rows.push([...item]);
    sheets.get('Knowledge').rows[2][0] = 'other-person';
    expect(() => context.publishCatalog()).toThrow(/Duplicate name/);
    sheets.get('Knowledge').rows.pop();
    // Cards may refer to an item already bundled in the PWA but absent from this
    // delta; its reference is checked when merging the final catalog on-device.
    card[1] = 'bundled-person';
    const published = context.publishCatalog();
    expect(published.version).toBe(12);
    expect(validateCatalog(JSON.parse(context.doGet().text), true).cards[0].knowledgeId).toBe('bundled-person');
    card[1] = 'test-person';
    item[8] = '["missing-related"]';
    expect(() => context.publishCatalog()).toThrow(/Unknown related item/);
  });
  it('does not silently convert invalid boolean values or overwrite headers', () => {
    const {context, item, sheets} = harness();
    item[17] = '';
    expect(() => context.publishCatalog()).toThrow(/TRUE or FALSE/);
    item[17] = 'FALSE';
    sheets.get('Cards').rows[0][0] = 'wrongHeader';
    expect(() => context.initializeMaster()).toThrow(/Wrong headers/);
  });
  it('supports tombstones and version publication, and beginEdit stops serving', () => {
    const {context, item, card} = harness();
    item[17] = 'TRUE'; card[10] = 'TRUE';
    expect(context.publishCatalog().version).toBe(12);
    expect(context.publishCatalog().version).toBe(13);
    expect(JSON.parse(context.doGet().text).cards[0].deleted).toBe(true);
    context.beginEdit();
    expect(JSON.parse(context.doGet().text).error).toBe('catalog_unavailable');
  });
});
