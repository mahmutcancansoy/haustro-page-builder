#!/usr/bin/env node
/**
 * tesisat-teknik-ariza-personel: modern hero + liste + status rozetleri
 *
 *   node scripts/patch-tesisat-teknik-ariza-personel-design.js
 *   node scripts/patch-tesisat-teknik-ariza-personel-design.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const {
  PERSONEL_PAGE_CONFIG,
  applyLayout,
  loadStyles,
} = require('./lib/tta-page-design');

const PAGE_CONFIG = PERSONEL_PAGE_CONFIG;

const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/tesisat-teknik-ariza-personel-content.json'
);
const BACKUP_PATH = path.join(
  __dirname,
  '../templates/tesisat-teknik-ariza-personel-content.original.json'
);
const STYLES_PATH = path.join(
  __dirname,
  '../templates/tesisat-teknik-ariza-personel-page-styles.css'
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

    const content = applyLayout(
      JSON.parse(JSON.stringify(existing.content)),
      PAGE_CONFIG
    );
    const styles = loadStyles();

    const doc = {
      _id: existing._id,
      pageId: PAGE_CONFIG.pageId,
      content,
      styles,
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');
    fs.writeFileSync(STYLES_PATH, styles + '\n');

    console.log('sayfa: tesisat-teknik-ariza-personel');
    console.log('pageId:', PAGE_CONFIG.pageId);
    console.log('- hero + atanan talepler listesi');
    console.log('- status rozetleri modernize edildi');
    console.log('- data-source filtreleri korundu');
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
