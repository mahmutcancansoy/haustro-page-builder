#!/usr/bin/env node
/**
 * sube-limitleri: Kart grid boşlukları — loop'u gerçek sl-grid container içine alır.
 * Kullanım: node scripts/fix-sube-limitleri-layout.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = '69c305ff5170eb001c6a8bd3';
const TEMPLATE_PATH = path.join(__dirname, '../templates/sube-limitleri-content.json');
const PAGE_CSS = fs.readFileSync(
  path.join(__dirname, '../templates/sube-limitleri-page-styles.css'),
  'utf8'
);

const HERO_HTML = `<div class="sl-page__hero">
  <h1>Şube Satın Alma Limitleri</h1>
  <p>Onaylı teklif tutarlarına göre aylık ve yıllık kullanım özeti</p>
</div>`;

function prop(block, key, value) {
  const p = (block.properties || []).find((x) => x.key === key);
  if (p) p.value = value;
  else {
    block.properties = block.properties || [];
    block.properties.push({
      key,
      header: key === 'classes' ? 'Classes' : 'Styles',
      type: key === 'classes' ? 'textarea-property' : 'code-editor',
      value,
      autoComplete: true,
      autoCompleteMode: 'template',
    });
  }
}

function fixLayout(blocks) {
  for (const b of blocks || []) {
    if (b.type !== 'simple-container') {
      if (fixLayout(b.children)) return true;
      continue;
    }

    const loopIdx = (b.children || []).findIndex((c) => c.type === 'loop');
    if (loopIdx < 0) {
      if (fixLayout(b.children)) return true;
      continue;
    }

    const loop = b.children[loopIdx];
    const heroRt = b.children.find(
      (c) => c.type === 'render-template' && !String(c.content || '').trim().startsWith('</')
    );

    if (heroRt) {
      heroRt.content = HERO_HTML;
    }

    prop(b, 'classes', 'sl-page');
    prop(b, 'styles', '{}');

    const gridContainer = {
      type: 'simple-container',
      isContainer: true,
      children: [loop],
      properties: [
        {
          key: 'display-name',
          header: 'Display name',
          type: 'input-text-property',
          value: 'Kart grid',
        },
        {
          key: 'classes',
          header: 'Classes',
          type: 'textarea-property',
          value: 'sl-grid',
          autoComplete: true,
          autoCompleteMode: 'template',
        },
        {
          key: 'styles',
          header: 'Styles',
          type: 'code-editor',
          value: '{}',
          autoComplete: true,
          autoCompleteMode: 'template',
        },
      ],
    };

    b.children = [heroRt, gridContainer].filter(Boolean);
    return true;
  }
  return false;
}

(async () => {
  try {
    const doc = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
    if (!fixLayout(doc.content)) {
      throw new Error('Kart grid simple-container bulunamadı');
    }

    doc.styles = '\n' + PAGE_CSS;
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    loadEnv();
    await connect();
    const r = await getDb().collection('pageContents').updateOne(
      { pageId: PAGE_ID },
      { $set: { content: doc.content, styles: doc.styles } }
    );

    console.log('pageId:', PAGE_ID);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('Layout düzeltildi: loop artık sl-grid simple-container içinde.');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
