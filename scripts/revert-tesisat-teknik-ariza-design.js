#!/usr/bin/env node
/**
 * tesisat-teknik-ariza: tasarım değişikliklerini geri alır.
 * Kullanım: node scripts/revert-tesisat-teknik-ariza-design.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { PAGE_CONFIG } = require('./lib/tta-page-design');

const BACKUP_PATH = path.join(
  __dirname,
  '../templates/tesisat-teknik-ariza-content.original.json'
);
const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/tesisat-teknik-ariza-content.json'
);

(async () => {
  try {
    if (!fs.existsSync(BACKUP_PATH)) {
      throw new Error(`Yedek bulunamadı: ${BACKUP_PATH}`);
    }

    const doc = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));

    loadEnv();
    await connect();
    const r = await getDb().collection('pageContents').updateOne(
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content: doc.content, styles: doc.styles || '' } }
    );

    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    console.log('sayfa: tesisat-teknik-ariza');
    console.log('pageId:', PAGE_CONFIG.pageId);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('Orijinal içerik geri yüklendi.');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
