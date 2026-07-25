#!/usr/bin/env node
/**
 * personeller / personeller-arsiv: tasarım ve filtre değişikliklerini geri alır.
 * Kullanım:
 *   node scripts/revert-personeller-design.js
 *   node scripts/revert-personeller-design.js arsiv
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getConfig } = require('./lib/per-page-design');

const PAGE_KEY = process.argv[2] || 'personeller';
const config = getConfig(PAGE_KEY);
const BACKUP_PATH = path.join(
  __dirname,
  `../templates/${config.templateBase}-content.original.json`
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
      { pageId: config.pageId },
      { $set: { content: doc.content, styles: doc.styles || '' } }
    );

    console.log('sayfa:', PAGE_KEY);
    console.log('pageId:', config.pageId);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('Orijinal içerik geri yüklendi.');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
