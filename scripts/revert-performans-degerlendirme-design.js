#!/usr/bin/env node
/**
 * performans-degerlendirme: modern tasarım değişikliklerini geri alır.
 * Kullanım: node scripts/revert-performans-degerlendirme-design.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { PAGE_CONFIG } = require('./lib/pdev-page-design');

const BACKUP_PATH = path.join(
  __dirname,
  '../templates/performans-degerlendirme-content.original.json'
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

    console.log('pageId:', PAGE_CONFIG.pageId);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('geri alındı: performans-degerlendirme');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
