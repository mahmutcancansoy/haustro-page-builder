#!/usr/bin/env node
/**
 * Rapor özetine son 2-3 dönem trend mini tablosu ekler.
 *
 *   node scripts/patch-performans-degerlendirme-rapor-ozeti-trend.js
 *   node scripts/patch-performans-degerlendirme-rapor-ozeti-trend.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { PAGE_CONFIG, loadStyles } = require('./lib/pdro-page-design');

const contentFile = path.join(__dirname, '../templates/performans-degerlendirme-rapor-ozeti-content.json');
const trendFile = path.join(__dirname, '../templates/performans-degerlendirme-rapor-ozeti-trend.html');
const push = process.argv.includes('--push');

function propVal(block, key) {
  return (block?.properties || []).find((p) => p.key === key)?.value;
}

function setProp(block, key, value) {
  const p = (block?.properties || []).find((x) => x.key === key);
  if (p) p.value = value;
}

function makeTrendBlock(html, displayName) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: html.trim(),
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
    ],
  };
}

function insertTrendTable(form, html, index) {
  const children = form.children || [];
  const deltaIdx = children.findIndex(
    (c) => c.type === 'label' && propVal(c, 'display-name') === 'Puan Farkı'
  );
  if (deltaIdx < 0) {
    return false;
  }

  const next = children[deltaIdx + 1];
  if (next?.type === 'render-template' && String(propVal(next, 'display-name') || '').includes('Trend')) {
    setProp(next, 'display-name', `Form ${index + 1} trend tablosu`);
    next.content = html.replace(/INDEX/g, String(index)).trim();
    return true;
  }

  const blockHtml = html.replace(/INDEX/g, String(index));
  children.splice(deltaIdx + 1, 0, makeTrendBlock(blockHtml, `Form ${index + 1} trend tablosu`));
  return true;
}

function patchForms(content) {
  const trendHtml = fs.readFileSync(trendFile, 'utf8');
  let patched = 0;

  function walk(blocks) {
    for (const block of blocks || []) {
      if (block.type === 'form-container') {
        const name = propVal(block, 'display-name');
        if (name === 'Form 1' && insertTrendTable(block, trendHtml, 0)) patched++;
        if (name === 'Form 2' && insertTrendTable(block, trendHtml, 1)) patched++;
      }
      walk(block.children);
    }
  }

  walk(content);
  return patched;
}

(async () => {
  try {
    if (!fs.existsSync(contentFile)) {
      throw new Error('Sablon yok — once sync-page-from-db calistirin');
    }

    const doc = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
    const patchedForms = patchForms(doc.content);
    doc.styles = loadStyles();
    doc.patchedAt = new Date().toISOString();

    fs.writeFileSync(contentFile, JSON.stringify(doc, null, 2) + '\n');
    console.log('Sablon guncellendi:', contentFile);
    console.log('Trend tablosu eklenen form:', patchedForms);

    if (!push) {
      console.log('DB push atlandi. Canliya almak icin: --push');
      return;
    }

    loadEnv();
    await connect();
    const db = getDb();
    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content: doc.content, styles: doc.styles } }
    );
    console.log('performans-degerlendirme-rapor-ozeti DB push:', r.matchedCount, 'matched,', r.modifiedCount, 'modified');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
