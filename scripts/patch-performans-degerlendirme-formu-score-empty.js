#!/usr/bin/env node
/**
 * Puan seçiminde "-" kaldırır; boş bırakılabilir (zorunlu olmayan sorular).
 *
 *   node scripts/patch-performans-degerlendirme-formu-score-empty.js
 *   node scripts/patch-performans-degerlendirme-formu-score-empty.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const { PAGE_CONFIG, patchScoreSelects } = require('./lib/pdfn-page-design');

const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/performans-degerlendirme-formu-renksiz-content.json'
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

    const content = JSON.parse(JSON.stringify(existing.content));
    patchScoreSelects(content);

    const doc = {
      _id: existing._id,
      pageId: PAGE_CONFIG.pageId,
      content,
      styles: existing.styles || '',
      patchedAt: new Date().toISOString(),
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');
    console.log('Şablon güncellendi:', TEMPLATE_PATH);

    if (!push) {
      console.log('DB push atlandı. Canlıya almak için: --push');
      return;
    }

    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content } }
    );
    console.log(
      'performans-degerlendirme-formu-renksiz DB push:',
      r.matchedCount,
      'matched,',
      r.modifiedCount,
      'modified'
    );
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
