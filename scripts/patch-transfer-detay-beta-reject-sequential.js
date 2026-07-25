#!/usr/bin/env node
/**
 * transfer-detay-beta: reddet formu + teslim adımları sıralı görünürlük
 *
 *   node scripts/patch-transfer-detay-beta-reject-sequential.js
 *   node scripts/patch-transfer-detay-beta-reject-sequential.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const {
  PAGE_CONFIG,
  applyActionEnhancements,
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

    const content = applyActionEnhancements(JSON.parse(JSON.stringify(existing.content)));
    const styles = loadActionStyles();

    const doc = {
      _id: existing._id,
      pageId: PAGE_CONFIG.pageId,
      content,
      styles,
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    console.log('sayfa: transfer-detay-beta');
    console.log('pageId:', PAGE_CONFIG.pageId);
    console.log('eklendi: reddet formu (multiTransfer reject)');
    console.log('güncellendi: Teslim Aldım / Teslim Ettim sıralı görünürlük');
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
