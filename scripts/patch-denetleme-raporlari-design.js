#!/usr/bin/env node
/**
 * denetleme-raporlari: son denetleme tarihi/puanı + modern liste
 * Kullanım: node scripts/patch-denetleme-raporlari-design.js
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
} = require('./lib/dr-page-design');

const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/denetleme-raporlari-content.json'
);
const BACKUP_PATH = path.join(
  __dirname,
  '../templates/denetleme-raporlari-content.original.json'
);

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

    const content = applyLayout();
    const styles = loadStyles();

    const doc = {
      _id: existing._id,
      pageId: PAGE_CONFIG.pageId,
      content,
      styles,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content, styles } }
    );

    console.log('sayfa: denetleme-raporlari');
    console.log('pageId:', PAGE_CONFIG.pageId);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('styles bytes:', styles.length);
    console.log('template:', TEMPLATE_PATH);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
