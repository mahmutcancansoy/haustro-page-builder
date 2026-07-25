#!/usr/bin/env node
/**
 * Araç Gereç Envanteri — Kategori sütun filtresine inventoryCats listesini yükler.
 * Araç Gereç Adı: metin filtresi (yazarak ara).
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

function buildCategoryFilterOptions(cats) {
  const byId = new Map(cats.map((c) => [c._id.toString(), c]));

  function labelFor(c) {
    const parts = [];
    let cur = c;
    let guard = 0;
    while (cur && guard++ < 6) {
      parts.unshift(cur.name);
      const pid = cur[':inventoryCats:parent'];
      cur = pid ? byId.get(String(pid)) : null;
    }
    return parts.join(' - ');
  }

  return cats
    .map((c) => ({ value: c._id.toString(), label: labelFor(c) }))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
}

function patchContent(content, filterSelectJson) {
  const table = content.find((b) => b.type === 'table');
  if (!table) throw new Error('table bloğu bulunamadı');

  for (const col of table.children || []) {
    if (col.type !== 'table-column') continue;
    const props = col.properties || [];
    const displayName = props.find((p) => p.key === 'display-name');
    if (!displayName) continue;

    if (displayName.value === 'Kategori') {
      setProp(props, 'variable', ':inventoryCats:category');
      setProp(props, 'filter-type', 'select');
      setProp(props, 'filter-select', filterSelectJson);
    }

    if (displayName.value === 'Araç Gereç Adı') {
      setProp(props, 'filter-type', 'text');
      setProp(props, 'filter-select', []);
    }
  }

  setProp(table.properties || [], 'filter-fields', '["name",":inventoryCats:category"]');
  const settingsProp = (table.properties || []).find((p) => p.key === 'settings');
  if (settingsProp?.value) {
    settingsProp.value.clearAllFilterBtn = true;
  }
}

function setProp(props, key, value) {
  const prop = props.find((p) => p.key === key);
  if (prop) prop.value = value;
  else props.push({ key, header: key, type: 'textarea-property', value });
}

function patchFile(filePath, filterSelectJson) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  patchContent(raw.content, filterSelectJson);
  fs.writeFileSync(filePath, JSON.stringify(raw, null, 2) + '\n');
  console.log('Şablon güncellendi:', filePath);
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();
    const cats = await db.collection('inventoryCats').find({ delete: { $ne: 1 } }).toArray();

    const options = buildCategoryFilterOptions(cats);
    const filterSelectJson = JSON.stringify(options);
    console.log(`Kategori seçenekleri: ${options.length} adet`);

    for (const file of TEMPLATE_FILES) {
      patchFile(file, filterSelectJson);
    }

    const doc = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
    if (!doc) throw new Error(`pageContents bulunamadı: ${PAGE_ID}`);

    patchContent(doc.content, filterSelectJson);
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
