#!/usr/bin/env node
/**
 * Araç Gereç Envanteri sayfasına Kart / Tablo görünüm seçimi ekler.
 *
 * Geçiş URL parametresi ile yapılır (?view=table). Panel render-template
 * içindeki <script> çalıştırmadığı için JS toggle kullanılmaz.
 *
 *   node scripts/patch-arac-gerec-envanteri-dual-view.js
 *   node scripts/patch-arac-gerec-envanteri-dual-view.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = '5fef676e4fe5a500117b0852';
const CONTENT_FILE = path.join(
  __dirname,
  '../templates/arac-gerec-envanteri-content.json'
);
const LEGACY_FILE = path.join(__dirname, '../templates/sample-inventory-list-content.json');
const CARDS_FILE = path.join(
  __dirname,
  '../templates/arac-gerec-envanteri-envanter-kart-listesi.html'
);
const TABLE_HEADER_FILE = path.join(
  __dirname,
  '../templates/arac-gerec-envanteri-table-header.html'
);
const push = process.argv.includes('--push');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function prop(node, key) {
  return (node.properties || []).find((item) => item.key === key);
}

function propValue(node, key) {
  return prop(node, key)?.value;
}

function setProp(node, key, value) {
  const item = prop(node, key);
  if (!item) throw new Error(`${node.type} bloğunda property bulunamadı: ${key}`);
  item.value = value;
}

function makeCondition(displayName, condition, children) {
  return {
    type: 'condition',
    isContainer: true,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
      {
        key: 'condition',
        header: 'Condition',
        type: 'textarea-property',
        value: condition,
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'oneTimeCheck',
        header: 'One Time Check',
        type: 'checkbox-property',
        options: [{ label: 'Check on Create Only', name: 'once' }],
        value: { once: false },
      },
    ],
    children,
  };
}

function makeRenderTemplate(content, displayName) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: String(content || '').trim(),
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
    ],
  };
}

function findInventorySource(content) {
  return (content || []).find(
    (node) =>
      node.type === 'data-source' &&
      propValue(node, 'variable-name') === 'inventory' &&
      propValue(node, 'table-name') === 'inventory'
  );
}

function makeTableSource(content) {
  const cardsSource = findInventorySource(content);
  if (!cardsSource) throw new Error('inventory data-source bulunamadı');

  const source = clone(cardsSource);
  setProp(source, 'display-name', 'envanter tablo db');
  setProp(source, 'variable-name', 'inventoryTable');
  const settings = prop(source, 'settings');
  if (!settings?.value) throw new Error('inventory settings bulunamadı');
  settings.value.single = false;
  settings.value.canReload = true;
  settings.value.forTable = true;
  return source;
}

function makeLegacyTable() {
  const legacy = JSON.parse(fs.readFileSync(LEGACY_FILE, 'utf8'));
  const table = (legacy.content || []).find((node) => node.type === 'table');
  if (!table) throw new Error('Eski tablo bloğu bulunamadı');

  const result = clone(table);
  setProp(result, 'display-name', 'envanter tablo görünümü');
  setProp(result, 'data-source', 'inventoryTable');
  setProp(result, 'classes', 'inv-legacy-table-wrap');
  return result;
}

function stripPreviousDualView(content) {
  const removeIf = (node) => {
    if (!node) return false;
    const name = String(propValue(node, 'display-name') || '');
    const variable = String(propValue(node, 'variable-name') || '');
    const source = String(propValue(node, 'data-source') || '');
    const html = String(node.content || '');

    if (node.type === 'data-source' && variable === 'inventoryTable') return true;
    if (node.type === 'table' && (name === 'envanter tablo görünümü' || source === 'inventoryTable')) {
      return true;
    }
    if (
      node.type === 'condition' &&
      (name.includes('Kart görünümü') || name.includes('Tablo görünümü'))
    ) {
      return true;
    }
    if (
      node.type === 'render-template' &&
      (html.includes('inv-cards-root') || html.includes('inv-table-header'))
    ) {
      return true;
    }
    return false;
  };

  for (let i = content.length - 1; i >= 0; i -= 1) {
    if (removeIf(content[i])) content.splice(i, 1);
  }
}

function applyDualView(content) {
  stripPreviousDualView(content);

  const cards = makeRenderTemplate(
    fs.readFileSync(CARDS_FILE, 'utf8'),
    'Envanter kart listesi'
  );
  const tableHeader = makeRenderTemplate(
    fs.readFileSync(TABLE_HEADER_FILE, 'utf8'),
    'Tablo görünüm başlığı'
  );
  const source = makeTableSource(content);
  const table = makeLegacyTable();

  const cardsView = makeCondition(
    'Kart görünümü',
    '"{{params.view}}" != "table"',
    [cards]
  );
  const tableView = makeCondition(
    'Tablo görünümü',
    '"{{params.view}}" == "table"',
    [source, tableHeader, table]
  );

  content.push(cardsView, tableView);

  return {
    cards: 1,
    table: 1,
    tableSource: 1,
  };
}

async function main() {
  const local = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  const localResult = applyDualView(local.content);
  fs.writeFileSync(CONTENT_FILE, `${JSON.stringify(local, null, 2)}\n`);
  console.log('Şablon güncellendi:', localResult);

  if (!push) {
    console.log('DB push atlandı. Canlıya almak için: --push');
    return;
  }

  loadEnv();
  await connect();
  const db = getDb();
  const live = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
  if (!live?.content) throw new Error(`pageContents bulunamadı: ${PAGE_ID}`);

  const dbResult = applyDualView(live.content);
  const result = await db
    .collection('pageContents')
    .updateOne({ pageId: PAGE_ID }, { $set: { content: live.content } });
  console.log('DB güncellendi:', {
    ...dbResult,
    matched: result.matchedCount,
    modified: result.modifiedCount,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => close().catch(() => {}));
