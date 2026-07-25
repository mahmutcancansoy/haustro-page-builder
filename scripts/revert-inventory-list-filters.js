#!/usr/bin/env node
/**
 * Araç Gereç Envanteri filtrelerini prompt öncesi duruma döndürür.
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

const KATEGORI_FILTER_SELECT = '[{"label": "Silinmemiş", "delete": 0}]';

function revertContent(content) {
  const table = content.find((b) => b.type === 'table');
  if (!table) throw new Error('table bloğu bulunamadı');

  for (const col of table.children || []) {
    if (col.type !== 'table-column') continue;
    const props = col.properties || [];
    const displayName = props.find((p) => p.key === 'display-name');
    if (!displayName) continue;

    if (displayName.value === 'Kategori') {
      setProp(props, 'variable', ':inventoryCats:category:name');
      setProp(props, 'filter-type', 'select');
      setProp(props, 'filter-select', KATEGORI_FILTER_SELECT);
    }

    if (displayName.value === 'Araç Gereç Adı') {
      setProp(props, 'filter-type', 'text');
      setProp(props, 'filter-select', []);
    }
  }

  setProp(table.properties || [], 'filter-fields', '["name",":inventoryCats:category:name"]');
  const settingsProp = (table.properties || []).find((p) => p.key === 'settings');
  if (settingsProp?.value) {
    settingsProp.value.clearAllFilterBtn = false;
    settingsProp.value.filtering = false;
  }
}

function setProp(props, key, value) {
  const prop = props.find((p) => p.key === key);
  if (prop) prop.value = value;
  else props.push({ key, header: key, type: 'textarea-property', value });
}

function syncTemplates(content) {
  for (const file of TEMPLATE_FILES) {
    const raw = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : { styles: '' };
    raw.content = JSON.parse(JSON.stringify(content));
    if (raw.styles == null) raw.styles = '';
    fs.writeFileSync(file, JSON.stringify(raw, null, 2) + '\n');
    console.log('Şablon senkron:', file);
  }
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();
    const doc = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
    if (!doc) throw new Error(`pageContents bulunamadı: ${PAGE_ID}`);

    revertContent(doc.content);
    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_ID },
      { $set: { content: doc.content } }
    );
    console.log('DB geri alındı — matched:', r.matchedCount, 'modified:', r.modifiedCount);

    syncTemplates(doc.content);
    await close();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
