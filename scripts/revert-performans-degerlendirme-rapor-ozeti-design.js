#!/usr/bin/env node
/**
 * performans-degerlendirme-rapor-ozeti: modern tasarım değişikliklerini geri alır.
 * Kullanım: node scripts/revert-performans-degerlendirme-rapor-ozeti-design.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { PAGE_CONFIG } = require('./lib/pdro-page-design');

const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/performans-degerlendirme-rapor-ozeti-content.json'
);
const BACKUP_PATH = path.join(
  __dirname,
  '../templates/performans-degerlendirme-rapor-ozeti-content.original.json'
);

(async () => {
  try {
    if (!fs.existsSync(BACKUP_PATH)) {
      throw new Error(`Orijinal yedek bulunamadı: ${BACKUP_PATH}`);
    }

    const original = JSON.parse(fs.readFileSync(BACKUP_PATH, 'utf8'));

    loadEnv();
    await connect();
    const db = getDb();

    const doc = {
      _id: original._id,
      pageId: PAGE_CONFIG.pageId,
      content: original.content,
      styles: original.styles || '',
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content: doc.content, styles: doc.styles } }
    );

    console.log('geri alındı: performans-degerlendirme-rapor-ozeti');
    console.log('pageId:', PAGE_CONFIG.pageId);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
