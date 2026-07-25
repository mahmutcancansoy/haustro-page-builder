#!/usr/bin/env node
/**
 * transfer-olustur-beta: modal + modern tasarım değişikliklerini geri alır.
 *
 *   node scripts/revert-transfer-olustur-beta-design.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { PAGE_CONFIG } = require('./lib/tob-page-design');

const BACKUP_PATH = path.join(
  __dirname,
  '../templates/transfer-olustur-beta-content.original.json'
);
const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/transfer-olustur-beta-content.json'
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

    console.log('sayfa: transfer-olustur-beta');
    console.log('pageId:', PAGE_CONFIG.pageId);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('Orijinal içerik geri yüklendi (modal kaldırıldı).');
    console.log('template:', TEMPLATE_PATH);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
