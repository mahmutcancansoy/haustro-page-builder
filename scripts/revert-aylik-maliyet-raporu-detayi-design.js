#!/usr/bin/env node
/**
 * aylik-maliyet-raporu-detayi: modern tasarım değişikliklerini geri alır.
 * Kullanım: node scripts/revert-aylik-maliyet-raporu-detayi-design.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { PAGE_CONFIG } = require('./lib/amrd-page-design');

const PAGE_ID = PAGE_CONFIG.pageId;
const BACKUP_PATH = path.join(
  __dirname,
  '../templates/aylik-maliyet-raporu-detayi-content.original.json'
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
      { pageId: PAGE_ID },
      { $set: { content: doc.content, styles: doc.styles || '' } }
    );

    console.log('pageId:', PAGE_ID);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('Orijinal içerik geri yüklendi.');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
