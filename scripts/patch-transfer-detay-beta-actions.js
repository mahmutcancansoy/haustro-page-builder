#!/usr/bin/env node
/**
 * transfer-detay-beta: onay + teslim akışını transfer-detayi'den taşır
 *
 *   node scripts/patch-transfer-detay-beta-actions.js
 *   node scripts/patch-transfer-detay-beta-actions.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const {
  PAGE_CONFIG,
  applyActions,
  extractActionBlocks,
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

    const [betaDoc, sourceDoc] = await Promise.all([
      getPageContent(PAGE_CONFIG.pageId),
      getPageContent(PAGE_CONFIG.sourcePageId),
    ]);

    if (!betaDoc?.content?.length) {
      throw new Error(`pageContents bulunamadı: ${PAGE_CONFIG.pageId}`);
    }
    if (!sourceDoc?.content?.length) {
      throw new Error(`kaynak pageContents bulunamadı: ${PAGE_CONFIG.sourcePageId}`);
    }

    const { approvalCard, deliveryCards } = extractActionBlocks(sourceDoc.content);
    const content = applyActions(betaDoc.content, approvalCard, deliveryCards);
    const styles = loadActionStyles();

    const doc = {
      _id: betaDoc._id,
      pageId: PAGE_CONFIG.pageId,
      content,
      styles,
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    console.log('sayfa: transfer-detay-beta (onay + teslim akışı)');
    console.log('pageId:', PAGE_CONFIG.pageId);
    console.log('eklenen kartlar: onayla, Teslim Aldım, Teslim Ettim');
    console.log('template:', TEMPLATE_PATH);
    console.log('styles bytes:', styles.length);

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
