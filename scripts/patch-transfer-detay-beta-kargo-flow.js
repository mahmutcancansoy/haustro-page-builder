#!/usr/bin/env node
/**
 * transfer-detay-beta: kargo ve şoför akışları + modern durum/görsel
 *
 *   node scripts/patch-transfer-detay-beta-kargo-flow.js
 *   node scripts/patch-transfer-detay-beta-kargo-flow.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const {
  PAGE_CONFIG,
  applyKargoFlow,
  loadActionStyles,
} = require('./lib/tdb-page-design');

const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/transfer-detay-beta-content.json'
);

const push = process.argv.includes('--push');

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const existing = await getPageContent(PAGE_CONFIG.pageId);
    if (!existing?.content?.length) {
      throw new Error(`pageContents bulunamadı: ${PAGE_CONFIG.pageId}`);
    }

    const content = applyKargoFlow(JSON.parse(JSON.stringify(existing.content)));
    const styles = loadActionStyles();

    const doc = {
      _id: existing._id,
      pageId: PAGE_CONFIG.pageId,
      content,
      styles,
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    console.log('sayfa: transfer-detay-beta (kargo akışı + modern UI)');
    console.log('pageId:', PAGE_CONFIG.pageId);
    console.log('- durum banner (kargo / şoför ayrımı + adım göstergesi)');
    console.log('- modern transfer görseli');
    console.log('- kargo çıkış formu (cargoDeparted → status 3)');
    console.log('- kargo teslim formu (delivered → status 1)');
    console.log('- şoför teslim alma (driverReceived → status 3)');
    console.log('- şoför teslim etme (driverDelivered → status 4)');
    console.log('- varış şubesi teslim onayı (delivered → status 1)');
    console.log('- ass-page layout + ass__actions-stack');
    console.log('- şoför formları yalnızca transferMethods=sofor');
    console.log('template:', TEMPLATE_PATH);

    if (!push) {
      console.log('DB push atlandı. Canlıya almak için: --push');
      return;
    }

    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content, styles } }
    );

    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
