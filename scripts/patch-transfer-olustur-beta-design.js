#!/usr/bin/env node
/**
 * transfer-olustur-beta: modern sayfa düzeni (modal yok, inline envanter önizleme)
 *
 *   node scripts/patch-transfer-olustur-beta-design.js
 *   node scripts/patch-transfer-olustur-beta-design.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const { applyLayout, loadStyles, PAGE_CONFIG } = require('./lib/tob-page-design');

const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/transfer-olustur-beta-content.json'
);
const BACKUP_PATH = path.join(
  __dirname,
  '../templates/transfer-olustur-beta-content.original.json'
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

    if (!push) {
      console.log('DB push atlandı. Canlıya almak için: --push');
      console.log('template:', TEMPLATE_PATH);
      console.log('styles bytes:', styles.length);
      return;
    }

    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content, styles } }
    );

    console.log('sayfa: transfer-olustur-beta');
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
