#!/usr/bin/env node
/**
 * Ziyaret hariç formu düzeltmesi (select + oprType hidden-values)
 *
 *   node scripts/patch-admin-sistem-ziyaret-haric-form.js
 *   node scripts/patch-admin-sistem-ziyaret-haric-form.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { inspectPageContent } = require('./lib/sync-page-from-db');
const { PAGE, buildContent, loadStyles } = require('./lib/pve-page-design');

const CONTENT_FILE = path.join(
  __dirname,
  '../templates/admin-sistem-ziyaret-haric-content.json'
);

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function applyLocal() {
  const existing = fs.existsSync(CONTENT_FILE)
    ? JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'))
    : {};
  const content = buildContent();
  const styles = loadStyles();
  const payload = {
    ...existing,
    pageId: PAGE.pageId || existing.pageId || '6a609df1128b12dbfc6d0408',
    content,
    styles,
    syncedAt: new Date().toISOString(),
  };
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(payload, null, 2) + '\n');
  return { payload, inspection: inspectPageContent(content) };
}

async function pushToDb(payload) {
  loadEnv();
  await connect();
  const db = getDb();
  const pageId = String(payload.pageId || '6a609df1128b12dbfc6d0408');
  const r = await db.collection('pageContents').updateOne(
    { pageId },
    { $set: { content: payload.content, styles: payload.styles || '' } }
  );
  await close();
  return { ...r, pageId };
}

async function main() {
  const { payload, inspection } = applyLocal();
  console.log('Şablon güncellendi: admin-sistem-ziyaret-haric-content.json');
  console.log('forms:', JSON.stringify(inspection.forms, null, 2));
  console.log('data-sources:', JSON.stringify(inspection.dataSources, null, 2));

  // sanity: select mode/type
  const blob = JSON.stringify(payload.content);
  if (!blob.includes('"value":"dataSource"') && !blob.includes('"value": "dataSource"')) {
    console.warn('UYARI: dataSource mode bulunamadı');
  }
  if (!blob.includes('"oprType": "add"') && !blob.includes('"oprType":"add"')) {
    console.warn('UYARI: hidden oprType add bulunamadı');
  }

  if (!hasFlag('push')) {
    console.log('\nDB yazılmadı. Canlıya: --push');
    console.log('Backend: deploy/pageVisitExcludedUsers.php → routes/custom/');
    return;
  }

  const r = await pushToDb(payload);
  console.log(`\nDB: matched=${r.matchedCount} modified=${r.modifiedCount} pageId=${r.pageId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
