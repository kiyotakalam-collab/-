/**
 * World History Culture Master — read-only JSON publication endpoint.
 * Bind this script to the master spreadsheet. No public write endpoint exists.
 * See docs/SHEETS_SETUP.md. Apps Script V8 runtime is required.
 */
const KNOWLEDGE_HEADERS = ['id', 'canonicalName', 'aliases', 'kind', 'field', 'region', 'era', 'level', 'relatedPeople', 'relatedWorks', 'description', 'images', 'sources', 'difficultyEvidence', 'verification', 'updatedAt', 'version', 'deleted'];
const CARD_HEADERS = ['id', 'knowledgeId', 'type', 'question', 'answer', 'explanation', 'imageId', 'fallbackPrompt', 'updatedAt', 'version', 'deleted'];

/** Run once in the bound script editor. Never overwrites existing content. */
function initializeMaster() {
  // Also support standalone Apps Script projects opened on mobile.
  // The explicit ID points to the dedicated culture-history Sheets master.
  const ss = SpreadsheetApp.openById('1RYkYvk82hqNEIgNGx-xd5B64byQbVaXw087-8F-C78U');
  PropertiesService.getScriptProperties().setProperty('MASTER_SPREADSHEET_ID', ss.getId());
  ensureSheet_(ss, 'Knowledge', KNOWLEDGE_HEADERS);
  ensureSheet_(ss, 'Cards', CARD_HEADERS);
  const meta = ensureSheet_(ss, 'Meta', ['key', 'value']);
  if (meta.getLastRow() === 1) {
    meta.getRange(2, 1, 4, 2).setValues([
      ['schemaVersion', '1'], ['version', '11'],
      ['updatedAt', new Date().toISOString()], ['status', 'draft']
    ]);
  }
}

/** Before a manual editing session. While draft, clients keep their local catalog. */
function beginEdit() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { setMeta_(spreadsheet_(), 'status', 'draft'); }
  finally { lock.releaseLock(); }
}

/**
 * Validate all working rows, bump catalog version and publish.
 * Set each changed row's version and updatedAt before this call.
 * With the current app bundled at catalog v11, the first published delta is v12.
 */
function publishCatalog() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const ss = spreadsheet_();
    const meta = readMeta_(ss);
    const nextVersion = integer_(meta.version, 'Meta.version', 0) + 1;
    const updatedAt = new Date().toISOString();
    const catalog = readCatalog_(ss, Object.assign({}, meta, {version: String(nextVersion), updatedAt: updatedAt}));
    validateCatalog_(catalog);
    // Status is published last. A failed validation never publishes a partial edit.
    setMeta_(ss, 'version', String(nextVersion));
    setMeta_(ss, 'updatedAt', updatedAt);
    setMeta_(ss, 'status', 'published');
    SpreadsheetApp.flush();
    return {version: nextVersion, items: catalog.items.length, cards: catalog.cards.length};
  } finally { lock.releaseLock(); }
}

function doGet() {
  const lock = LockService.getScriptLock();
  try {
    if (!lock.tryLock(10000)) throw new Error('Catalog is busy; retry later.');
    const ss = spreadsheet_();
    const before = readMeta_(ss);
    if (before.status !== 'published') throw new Error('Catalog is draft; not published.');
    const catalog = readCatalog_(ss, before);
    validateCatalog_(catalog);
    const after = readMeta_(ss);
    if (after.status !== 'published' || after.version !== before.version || after.updatedAt !== before.updatedAt) {
      throw new Error('Catalog changed during read; retry later.');
    }
    return json_(catalog);
  } catch (error) {
    // ContentService has no status-code setter. Missing schemaVersion makes this
    // an invalid Catalog; the app rejects it and retains the previous data.
    console.error(String(error));
    return json_({error: 'catalog_unavailable', message: '用語データは未公開か、検証に失敗しました。既存データを利用してください。'});
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function readCatalog_(ss, meta) {
  if (integer_(meta.schemaVersion, 'Meta.schemaVersion', 1) !== 1) throw new Error('Unsupported schemaVersion');
  return {
    schemaVersion: 1,
    version: integer_(meta.version, 'Meta.version', 1),
    updatedAt: date_(meta.updatedAt, 'Meta.updatedAt'),
    items: readRows_(ss, 'Knowledge', KNOWLEDGE_HEADERS).map(function(row) {
      return {
        id: row.id, canonicalName: row.canonicalName, aliases: array_(row.aliases, 'aliases'),
        kind: row.kind, field: row.field, region: row.region, era: row.era,
        level: integer_(row.level, 'level', 1),
        relatedPeople: array_(row.relatedPeople, 'relatedPeople'), relatedWorks: array_(row.relatedWorks, 'relatedWorks'),
        description: row.description, images: array_(row.images, 'images'), sources: array_(row.sources, 'sources'),
        difficultyEvidence: row.difficultyEvidence, verification: row.verification,
        updatedAt: date_(row.updatedAt, 'updatedAt'), version: integer_(row.version, 'version', 1),
        deleted: boolean_(row.deleted, 'deleted')
      };
    }),
    cards: readRows_(ss, 'Cards', CARD_HEADERS).map(function(row) {
      const card = {
        id: row.id, knowledgeId: row.knowledgeId, type: row.type,
        question: row.question, answer: row.answer, explanation: row.explanation,
        updatedAt: date_(row.updatedAt, 'updatedAt'), version: integer_(row.version, 'version', 1),
        deleted: boolean_(row.deleted, 'deleted')
      };
      if (row.imageId) card.imageId = row.imageId;
      if (row.fallbackPrompt) card.fallbackPrompt = row.fallbackPrompt;
      return card;
    })
  };
}

function validateCatalog_(catalog) {
  if (catalog.items.length > 20000 || catalog.cards.length > 100000) throw new Error('Catalog too large');
  const items = new Map();
  const names = new Map();
  catalog.items.forEach(function(item) {
    id_(item.id); unique_(items, item.id, item, 'knowledge id');
    ['canonicalName', 'field', 'region', 'era', 'difficultyEvidence'].forEach(function(key) { text_(item[key], key); });
    if (['person', 'work', 'concept', 'building'].indexOf(item.kind) < 0) throw new Error('Invalid kind');
    if (['verified', 'provisional', 'needs-review'].indexOf(item.verification) < 0) throw new Error('Invalid verification');
    if (item.level > 4) throw new Error('level must be 1–4');
    ['aliases', 'relatedPeople', 'relatedWorks'].forEach(function(key) {
      item[key].forEach(function(value) { text_(value, key); });
    });
    if (!item.deleted) [item.canonicalName].concat(item.aliases).forEach(function(value) {
      const normalized = normalize_(value);
      if (!normalized) throw new Error('Empty normalized name');
      if (names.has(normalized) && names.get(normalized) !== item.id) throw new Error('Duplicate name or alias: ' + value);
      names.set(normalized, item.id);
    });
    if (!item.sources.length) throw new Error('Knowledge sources required');
    item.sources.forEach(function(source) { text_(source.title, 'source title'); if (source.url !== undefined) url_(source.url, false); });
    const imageIds = new Set();
    item.images.forEach(function(image) {
      id_(image.id);
      if (imageIds.has(image.id)) throw new Error('Duplicate image id');
      imageIds.add(image.id);
      url_(image.url, true); url_(image.sourceUrl, false); url_(image.licenseUrl, false);
      ['author', 'license', 'caption'].forEach(function(key) { text_(image[key], 'image ' + key); });
    });
  });
  catalog.items.forEach(function(item) {
    item.relatedPeople.concat(item.relatedWorks).forEach(function(reference) {
      id_(reference);
      if (!items.has(reference)) throw new Error('Unknown related item: ' + reference);
    });
  });
  const cards = new Map();
  const signatures = new Set();
  catalog.cards.forEach(function(card) {
    id_(card.id); unique_(cards, card.id, card, 'card id');
    // Delta catalogs can add a card to an existing bundled item not present
    // in this sheet. The PWA verifies references again after the merge.
    id_(card.knowledgeId);
    const item = items.get(card.knowledgeId);
    if (item && !card.deleted && item.deleted) throw new Error('Active card references deleted knowledge');
    if (['achievement-person', 'person-work', 'work-author', 'theory-person', 'image', 'context'].indexOf(card.type) < 0) throw new Error('Invalid card type');
    ['question', 'answer'].forEach(function(key) { text_(card[key], key); });
    if (typeof card.explanation !== 'string') throw new Error('Invalid explanation');
    if (card.type === 'image') {
      text_(card.fallbackPrompt, 'fallbackPrompt');
      id_(card.imageId);
      if (item && !item.images.some(function(image) { return image.id === card.imageId; })) throw new Error('Unknown imageId');
    }
    if (!card.deleted) {
      const signature = card.knowledgeId + '\n' + card.type + '\n' + (card.type === 'image' ? card.imageId : '') + '\n' + normalize_(card.question) + '\n' + normalize_(card.answer);
      if (signatures.has(signature)) throw new Error('Duplicate card question');
      signatures.add(signature);
    }
  });
  return catalog;
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else readRows_(ss, name, headers);
  return sheet;
}

function readRows_(ss, name, expectedHeaders) {
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Missing sheet: ' + name);
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() !== expectedHeaders.length) throw new Error('Wrong columns: ' + name);
  const values = sheet.getRange(1, 1, sheet.getLastRow(), expectedHeaders.length).getDisplayValues();
  const headers = values.shift().map(function(value) { return value.trim(); });
  if (headers.some(function(value, index) { return !value || value !== expectedHeaders[index]; })) throw new Error('Wrong headers: ' + name);
  return values.filter(function(row) { return row.some(function(value) { return value.trim() !== ''; }); }).map(function(row) {
    const result = {};
    headers.forEach(function(key, index) { result[key] = row[index].trim(); });
    if (!result[headers[0]]) throw new Error('Missing first-column key: ' + name);
    return result;
  });
}

function readMeta_(ss) {
  const result = {};
  readRows_(ss, 'Meta', ['key', 'value']).forEach(function(row) {
    if (Object.prototype.hasOwnProperty.call(result, row.key)) throw new Error('Duplicate meta key');
    result[row.key] = row.value;
  });
  ['schemaVersion', 'version', 'updatedAt', 'status'].forEach(function(key) { text_(result[key], 'Meta.' + key); });
  return result;
}

function setMeta_(ss, key, value) {
  const sheet = ss.getSheetByName('Meta');
  if (!sheet) throw new Error('Run initializeMaster first');
  const rows = sheet.getRange(1, 1, sheet.getLastRow(), 2).getDisplayValues();
  const index = rows.findIndex(function(row) { return row[0] === key; });
  if (index < 1) throw new Error('Missing meta key: ' + key);
  sheet.getRange(index + 1, 2).setValue(String(value));
}

function integer_(value, label, min) {
  if (!/^\d+$/.test(String(value))) throw new Error('Invalid integer: ' + label);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min) throw new Error('Invalid integer: ' + label);
  return result;
}
function boolean_(value, label) {
  if (String(value).toLowerCase() === 'true') return true;
  if (String(value).toLowerCase() === 'false') return false;
  throw new Error('Use TRUE or FALSE: ' + label);
}
function array_(value, label) {
  const result = JSON.parse(value);
  if (!Array.isArray(result)) throw new Error('Expected JSON array: ' + label);
  return result;
}
function date_(value, label) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Invalid UTC ISO date: ' + label);
  return value;
}
function text_(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > 20000) throw new Error('Invalid text: ' + label);
}
function id_(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value)) throw new Error('Invalid stable id');
}
function normalize_(value) { return value.normalize('NFKC').toLowerCase().replace(/[\s・･·「」『』“”"'’.,，。\-‐‑–—―ー]/g, ''); }
function unique_(map, key, value, label) {
  if (map.has(key)) throw new Error('Duplicate ' + label + ': ' + key);
  map.set(key, value);
}
function url_(value, allowLocal) {
  if (typeof value !== 'string' || (!/^https:\/\/[^\s]+$/.test(value) && !(allowLocal && /^\.\/images\/[A-Za-z0-9._/-]+$/.test(value) && !value.includes('..')))) throw new Error('Invalid URL');
  const authority = value.match(/^https:\/\/([^/?#]+)/);
  if (authority && authority[1].includes('@')) throw new Error('URL credentials are not allowed');
}
function json_(value) { return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON); }
function spreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('MASTER_SPREADSHEET_ID');
  if (!id) throw new Error('Run initializeMaster first');
  return SpreadsheetApp.openById(id);
}
