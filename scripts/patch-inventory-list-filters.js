#!/usr/bin/env node
/**
 * Araç Gereç Envanteri — en basit filtre modu:
 * - General Filter: tek arama kutusu (ad + kategori)
 * - Sütun filtreleri: metin (yazarak ara)
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = '5fef676e4fe5a500117b0852';
const TEMPLATE_FILES = [
  path.join(__dirname, '../templates/inventory-list-content.json'),
  path.join(__dirname, '../templates/sample-inventory-list-content.json'),
];

function patchContent(content) {
  const table = content.find((b) => b.type === 'table');
  if (!table) throw new Error('table bloğu bulunamadı');

  for (const col of table.children || []) {
    if (col.type !== 'table-column') continue;
    const props = col.properties || [];
    const displayName = props.find((p) => p.key === 'display-name');
    if (!displayName) continue;

    if (displayName.value === 'Kategori') {
      setProp(props, 'variable', ':inventoryCats:category:name');
      setProp(props, 'filter-type', 'text');
      setProp(props, 'filter-select', []);
    }

    if (displayName.value === 'Araç Gereç Adı') {
      setProp(props, 'filter-type', 'text');
      setProp(props, 'filter-select', []);
    }
  }

  setProp(table.properties || [], 'filter-fields', '["name",":inventoryCats:category:name"]');
  const settingsProp = (table.properties || []).find((p) => p.key === 'settings');
  if (settingsProp?.value) {
    settingsProp.value.clearAllFilterBtn = true;
    settingsProp.value.filtering = true;
  }
}

function setProp(props, key, value) {
  const prop = props.find((p) => p.key === key);
  if (prop) prop.value = value;
  else props.push({ key, header: key, type: 'textarea-property', value });
}

function patchFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  patchContent(raw.content);
  fs.writeFileSync(filePath, JSON.stringify(raw, null, 2) + '\n');
  console.log('Şablon güncellendi:', filePath);
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    for (const file of TEMPLATE_FILES) {
      patchFile(file);
    }

    const doc = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
    if (!doc) throw new Error(`pageContents bulunamadı: ${PAGE_ID}`);

    patchContent(doc.content);
    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_ID },
      { $set: { content: doc.content } }
    );
    console.log('DB güncellendi — matched:', r.matchedCount, 'modified:', r.modifiedCount);

    await close();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
