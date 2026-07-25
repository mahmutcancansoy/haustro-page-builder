#!/usr/bin/env node
/**
 * arac-gerec-duzenle sayfasını arac-gerec-ekle ile aynı modern düzen + stiller ile günceller.
 * Kullanım: node scripts/patch-arac-gerec-duzenle-design.js
 */
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const { applyLayout, loadStyles, getConfig } = require('./lib/hp-age-page-design');

const config = getConfig('duzenle');

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const existing = await getPageContent(config.pageId);
    if (!existing?.content?.length) throw new Error('Sayfa içeriği bulunamadı');

    const content = applyLayout(existing.content, config);
    const styles = loadStyles();

    const r = await db.collection('pageContents').updateOne(
      { pageId: config.pageId },
      { $set: { content, styles } }
    );

    console.log('sayfa: arac-gerec-duzenle');
    console.log('pageId:', config.pageId);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    const wrap = content.find(
      (b) => b.type === 'simple-container' && (b.properties || []).some((p) => p.key === 'classes' && p.value?.includes('hp-age-page'))
    );
    if (wrap) {
      console.log('layout children:', (wrap.children || []).map((c) => c.type).join(', '));
    }
    console.log('styles bytes:', styles.length);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close();
  }
})();
