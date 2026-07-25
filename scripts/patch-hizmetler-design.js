#!/usr/bin/env node
/**
 * hizmetler: kategori ağacı düzeni + stiller
 * Kullanım: node scripts/patch-hizmetler-design.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const { PAGE_CONFIG, applyLayout, loadStyles } = require('./lib/hiz-page-design');

const TEMPLATE_PATH = path.join(__dirname, '../templates/hizmetler-content.json');
const BACKUP_PATH = path.join(__dirname, '../templates/hizmetler-content.original.json');

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const existing = await getPageContent(PAGE_CONFIG.pageId);
    if (!existing?.content?.length) {
      throw new Error(`pageContents bulunamadı: ${PAGE_CONFIG.pageId}`);
    }

    if (!fs.existsSync(BACKUP_PATH)) {
      fs.writeFileSync(
        BACKUP_PATH,
        JSON.stringify(
          {
            _id: existing._id,
            pageId: PAGE_CONFIG.pageId,
            content: existing.content,
            styles: existing.styles || '',
          },
          null,
          2
        ) + '\n'
      );
      console.log('yedek:', BACKUP_PATH);
    }

    const content = applyLayout(existing.content);
    const styles = loadStyles();

    const doc = {
      _id: existing._id,
      pageId: PAGE_CONFIG.pageId,
      content,
      styles,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content, styles } }
    );

    const wrap = findLayout(content);

    console.log('sayfa: hizmetler');
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

function findLayout(content) {
  function walk(nodes) {
    for (const n of nodes || []) {
      if (
        n.type === 'simple-container' &&
        (n.properties || []).some((p) => p.key === 'classes' && p.value?.includes('ass-page'))
      ) {
        return n;
      }
      const f = walk(n.children);
      if (f) return f;
    }
    return null;
  }
  return walk(content);
}
