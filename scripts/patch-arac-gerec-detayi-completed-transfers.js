#!/usr/bin/env node
/**
 * araç-gereç-detayı: transfer listesinde yalnızca tamamlanan (status=1) kayıtlar.
 *
 *   node scripts/patch-arac-gerec-detayi-completed-transfers.js
 *   node scripts/patch-arac-gerec-detayi-completed-transfers.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const push = process.argv.includes('--push');
const pageId = '5ffb93104fe5a500783cd6a2';
const file = path.join(__dirname, '../templates/arac-gerec-detayi-content.json');
const FILTER =
  '{\n    ":inventory:": "{{params._id}}",\n    "delete": { "$ne": 1 },\n    "status": { "$in": [1, "1"] },\n    "sort": { "datetime": -1 }\n}';

function propVal(block, key) {
  return (block?.properties || []).find((p) => p.key === key)?.value;
}

function setProp(block, key, value) {
  const p = (block?.properties || []).find((x) => x.key === key);
  if (p) p.value = value;
}

function patch(content) {
  let patched = 0;
  for (const node of content || []) {
    if (node.type !== 'data-source') continue;
    if (propVal(node, 'variable-name') !== 'transfers') continue;
    if (propVal(node, 'table-name') !== 'transfers') continue;
    setProp(node, 'table-filters', FILTER);
    patched++;
  }
  return patched;
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  const patched = patch(raw.content);
  fs.writeFileSync(file, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  console.log('arac-gerec-detayi transfers filter patched:', patched);

  if (!push) {
    console.log('DB push atlandı. Canlıya almak için: --push');
    return;
  }

  loadEnv();
  await connect();
  const db = getDb();
  const update = { content: raw.content };
  if (raw.styles != null) update.styles = raw.styles;
  const r = await db.collection('pageContents').updateOne({ pageId }, { $set: update });
  console.log('DB push:', { matched: r.matchedCount, modified: r.modifiedCount });
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
