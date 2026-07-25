#!/usr/bin/env node
/**
 * sozlesmeli-faturalar: ass-page liste düzeni + stiller
 *
 * Kullanım:
 *   node scripts/patch-sozlesmeli-faturalar-design.js
 *   node scripts/patch-sozlesmeli-faturalar-design.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const { PAGE_CONFIG, applyLayout, loadStyles } = require('./lib/sf-page-design');

const PUSH = process.argv.includes('--push');
const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/sozlesmeli-faturalar-content.json'
);
const BACKUP_PATH = path.join(
  __dirname,
  '../templates/sozlesmeli-faturalar-content.original.json'
);
const STYLES_PATH = path.join(
  __dirname,
  '../templates/sozlesmeli-faturalar-page-styles.css'
);

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

(async () => {
  try {
    loadEnv();
    await connect();

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

    const content = applyLayout(deepClone(existing.content));
    const styles = loadStyles();
    fs.writeFileSync(STYLES_PATH, styles);

    const doc = {
      _id: existing._id,
      pageId: PAGE_CONFIG.pageId,
      content,
      styles,
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    const wrap = content.find(
      (b) =>
        b.type === 'simple-container' &&
        (b.properties || []).some(
          (p) => p.key === 'classes' && String(p.value || '').includes('ass-page')
        )
    );

    console.log('sayfa: sozlesmeli-faturalar');
    console.log('pageId:', PAGE_CONFIG.pageId);
    if (wrap) {
      console.log(
        'layout children:',
        (wrap.children || []).map((c) => c.type).join(', ')
      );
    }
    console.log('styles bytes:', styles.length);
    console.log('template:', TEMPLATE_PATH);

    if (!PUSH) {
      console.log('DB yazılmadı ( --push ile yazılır )');
      return;
    }

    const db = getDb();
    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content, styles } }
    );
    console.log('DB push: matched', r.matchedCount, 'modified', r.modifiedCount);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
