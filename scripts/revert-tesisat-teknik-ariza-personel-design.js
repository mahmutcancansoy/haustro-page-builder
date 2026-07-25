#!/usr/bin/env node
/**
 * tesisat-teknik-ariza-personel: tasarım değişikliklerini geri alır.
 * Kullanım: node scripts/revert-tesisat-teknik-ariza-personel-design.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { PERSONEL_PAGE_CONFIG } = require('./lib/tta-page-design');

const BACKUP_PATH = path.join(
  __dirname,
  '../templates/tesisat-teknik-ariza-personel-content.original.json'
);
const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/tesisat-teknik-ariza-personel-content.json'
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
      { pageId: PERSONEL_PAGE_CONFIG.pageId },
      { $set: { content: doc.content, styles: doc.styles || '' } }
    );

    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    console.log('sayfa: tesisat-teknik-ariza-personel');
    console.log('pageId:', PERSONEL_PAGE_CONFIG.pageId);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('Orijinal içerik geri yüklendi.');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
