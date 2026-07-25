#!/usr/bin/env node
/**
 * tedarik-faturasi-detay (elogo) — modern ass-page
 * Liste sayfası /d/tedarik-faturasi-detay buraya gider.
 *
 * Kullanım:
 *   node scripts/patch-tedarik-faturasi-detay-design.js
 *   node scripts/patch-tedarik-faturasi-detay-design.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { applyLayout, loadStyles, PAGE_CONFIG } = require('./lib/tfdet-page-design');

const PUSH = process.argv.includes('--push');
const TEMPLATE_PATH = path.join(__dirname, '../templates/tedarik-faturasi-detay-content.json');
const STYLES_PATH = path.join(__dirname, '../templates/tedarik-faturasi-detay-page-styles.css');

(async () => {
  try {
    if (!fs.existsSync(TEMPLATE_PATH)) {
      throw new Error(`Şablon yok: ${TEMPLATE_PATH} — önce sync-page-from-db --url tedarik-faturasi-detay`);
    }

    const doc = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
    if (!doc.content?.length) throw new Error('content boş');

    const content = applyLayout(doc.content);
    const styles = loadStyles();

    doc.content = content;
    doc.styles = styles;
    doc.pageId = doc.pageId || PAGE_CONFIG.pageId;
    doc.updatedAt = new Date().toISOString();
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');
    fs.writeFileSync(STYLES_PATH, styles);

    const wrap = content.find(
      (b) =>
        b.type === 'simple-container' &&
        (b.properties || []).some((p) => p.key === 'classes' && p.value?.includes('ass-page'))
    );

    console.log('şablon güncellendi:', TEMPLATE_PATH);
    console.log('pageId:', PAGE_CONFIG.pageId, '(tedarik-faturasi-detay)');
    if (wrap) {
      console.log(
        'layout children:',
        (wrap.children || [])
          .map((c) => {
            const name = (c.properties || []).find((p) => p.key === 'display-name')?.value;
            return `${c.type}${name ? `(${name})` : ''}`;
          })
          .join(', ')
      );
    }
    console.log('styles bytes:', styles.length);

    if (!PUSH) {
      console.log('DB yazılmadı ( --push ile yazılır )');
      return;
    }

    loadEnv();
    await connect();
    const db = getDb();
    const existing = await db.collection('pageContents').findOne({ pageId: PAGE_CONFIG.pageId });
    if (!existing) throw new Error(`pageContents yok: ${PAGE_CONFIG.pageId}`);

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
