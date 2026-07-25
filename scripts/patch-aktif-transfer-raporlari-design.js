#!/usr/bin/env node
/**
 * aktif-transfer-raporlari: aktif filtre + güncel status etiketleri + modern liste
 *
 *   node scripts/patch-aktif-transfer-raporlari-design.js
 *   node scripts/patch-aktif-transfer-raporlari-design.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
} = require('./lib/atr-page-design');

const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/aktif-transfer-raporlari-content.json'
);
const BACKUP_PATH = path.join(
  __dirname,
  '../templates/aktif-transfer-raporlari-content.original.json'
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

    if (!fs.existsSync(BACKUP_PATH)) {
      fs.writeFileSync(
        BACKUP_PATH,
        JSON.stringify(
          {
            _id: existing._id,
            pageId: PAGE_CONFIG.pageId,
            content: existing.content,
            styles: existing.styles || '',
          },
          null,
          2
        ) + '\n'
      );
    }

    const content = applyLayout(JSON.parse(JSON.stringify(existing.content)));
    const styles = loadStyles();

    const doc = {
      _id: existing._id,
      pageId: PAGE_CONFIG.pageId,
      content,
      styles,
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    console.log('sayfa: aktif-transfer-raporlari');
    console.log('pageId:', PAGE_CONFIG.pageId);
    console.log('- filtre: status ∈ [0,2,3,4], delete != 1');
    console.log('- status etiketleri: kargo/şoför ayrımı ile güncellendi');
    console.log('- detay: /d/transfer-detay-beta');
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
    console.log('styles bytes:', styles.length);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
