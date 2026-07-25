#!/usr/bin/env node
/**
 * aylik-maliyet-raporu-detayi: modern detay sayfası düzeni + stiller
 * Kullanım: node scripts/patch-aylik-maliyet-raporu-detayi-design.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const { applyLayout, loadStyles, PAGE_CONFIG } = require('./lib/amrd-page-design');

const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/aylik-maliyet-raporu-detayi-content.json'
);

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const existing = await getPageContent(PAGE_CONFIG.pageId);
    if (!existing?.content?.length) {
      throw new Error(`pageContents bulunamadı: ${PAGE_CONFIG.pageId}`);
    }

    const content = applyLayout(existing.content);
    const styles = loadStyles();

    const doc = {
      _id: existing._id,
      pageId: PAGE_CONFIG.pageId,
      content,
      styles,
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content, styles } }
    );

    const wrap = content.find(
      (b) =>
        b.type === 'simple-container' &&
        (b.properties || []).some((p) => p.key === 'classes' && p.value?.includes('amrd-page'))
    );

    console.log('sayfa: aylik-maliyet-raporu-detayi');
    console.log('pageId:', PAGE_CONFIG.pageId);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    if (wrap) {
      console.log('layout children:', (wrap.children || []).map((c) => c.type).join(', '));
    }
    console.log('styles bytes:', styles.length);
    console.log('template:', TEMPLATE_PATH);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
