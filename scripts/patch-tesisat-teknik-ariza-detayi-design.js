#!/usr/bin/env node
/**
 * tesisat-teknik-ariza-detayi: modern detay + form + log geçmişi
 *
 *   node scripts/patch-tesisat-teknik-ariza-detayi-design.js
 *   node scripts/patch-tesisat-teknik-ariza-detayi-design.js --push
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
} = require('./lib/ttad-page-design');

const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/tesisat-teknik-ariza-detayi-content.json'
);
const BACKUP_PATH = path.join(
  __dirname,
  '../templates/tesisat-teknik-ariza-detayi-content.original.json'
);
const STYLES_PATH = path.join(
  __dirname,
  '../templates/tesisat-teknik-ariza-detayi-page-styles.css'
);

const push = process.argv.includes('--push');

(async () => {
  try {
    loadEnv();
    await connect();

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
    fs.writeFileSync(STYLES_PATH, styles + '\n');

    console.log('sayfa: tesisat-teknik-ariza-detayi');
    console.log('pageId:', PAGE_CONFIG.pageId);
    console.log('- hero + detay formu + log geçmişi');
    console.log('- form field-id / koşullar korundu');
    console.log('template:', TEMPLATE_PATH);

    if (!push) {
      console.log('DB push atlandı. Canlıya almak için: --push');
      return;
    }

    const r = await getDb()
      .collection('pageContents')
      .updateOne({ pageId: PAGE_CONFIG.pageId }, { $set: { content, styles } });

    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('styles bytes:', styles.length);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
