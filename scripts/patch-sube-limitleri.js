#!/usr/bin/env node
/**
 * sube-limitleri: departmentsLimit custom DS + modern kart grid
 * Kullanım: node scripts/patch-sube-limitleri.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = '69c305ff5170eb001c6a8bd3';
const TEMPLATE_PATH = path.join(__dirname, '../templates/sube-limitleri-content.json');
const CARD_HTML = fs.readFileSync(
  path.join(__dirname, '../templates/sube-limitleri-loop-card.html'),
  'utf8'
);
const PAGE_CSS = fs.readFileSync(
  path.join(__dirname, '../templates/sube-limitleri-page-styles.css'),
  'utf8'
);

const HERO_HTML = `<div class="sl-page">
  <div class="sl-page__hero">
    <h1>Şube Satın Alma Limitleri</h1>
    <p>Onaylı teklif tutarlarına göre aylık ve yıllık kullanım özeti</p>
  </div>
  <div class="sl-grid">`;

const HERO_CLOSE = `</div></div>`;

function patchDepartmentsDataSource(block) {
  if (block.type !== 'data-source') return false;
  const vn = (block.properties || []).find((p) => p.key === 'variable-name');
  if (vn?.value !== 'departments') return false;

  for (const p of block.properties || []) {
    if (p.key === 'function') p.value = 'custom';
    if (p.key === 'custom-function-name') p.value = 'departmentsLimit';
    if (p.key === 'table-name') p.value = '';
    if (p.key === 'table-filters') p.value = '{\n "oprType": "list"\n}';
    if (p.key === 'post-params') p.value = '{\n "oprType": "list"\n}';
  }
  return true;
}

function makeRenderTemplate(content, displayName) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content,
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

function patchLoop(loopBlock) {
  const cardRt = makeRenderTemplate(CARD_HTML, 'Şube limit kartı');
  loopBlock.children = [cardRt];

  const styles = (loopBlock.properties || []).find((p) => p.key === 'styles');
  if (styles) {
    styles.value = '{}';
  }

  const sc = loopBlock.children[0];
  // wrap grid: put open hero before loop's parent container
  return true;
}

function findAndPatch(blocks, stats) {
  for (const b of blocks || []) {
    if (patchDepartmentsDataSource(b)) stats.dsCustom = 1;

    if (b.type === 'loop') {
      const ds = (b.properties || []).find((p) => p.key === 'data-source');
      if (ds?.value === 'departments') {
        patchLoop(b);
        stats.loop = 1;
      }
    }

    if (b.type === 'simple-container') {
      const styles = (b.properties || []).find((p) => p.key === 'styles');
      const dn = (b.properties || []).find((p) => p.key === 'display-name');
      if (
        styles &&
        String(styles.value).includes('flex-wrap') &&
        b.children?.some((c) => c.type === 'loop')
      ) {
        styles.value = JSON.stringify({ display: 'contents' }, null, 2);
        const loopIdx = b.children.findIndex((c) => c.type === 'loop');
        if (loopIdx >= 0) {
          const openRt = makeRenderTemplate(HERO_HTML, 'Sayfa üst');
          const closeRt = makeRenderTemplate(HERO_CLOSE, 'Sayfa alt');
          b.children.splice(loopIdx, 0, openRt);
          b.children.splice(loopIdx + 2, 0, closeRt);
          stats.gridWrap = 1;
        }
      }
    }

    if (b.type === 'page-header') {
      b.type = 'condition';
      b.isContainer = true;
      b.children = [];
      b.properties = [
        {
          key: 'display-name',
          header: 'Display name',
          type: 'input-text-property',
          value: 'Header hidden',
        },
        {
          key: 'condition',
          header: 'Condition',
          type: 'textarea-property',
          value: 'false',
          autoComplete: true,
          autoCompleteMode: 'template',
        },
        {
          key: 'oneTimeCheck',
          header: 'One Time Check',
          type: 'checkbox-property',
          options: [{ label: 'Check on Create Only', name: 'once' }],
          value: { once: false },
        },
      ];
      stats.headerHidden = 1;
    }

    findAndPatch(b.children, stats);
  }
}

(async () => {
  try {
    const doc = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
    const stats = {};
    findAndPatch(doc.content, stats);

    doc.styles = (doc.styles || '') + '\n' + PAGE_CSS;

    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    loadEnv();
    await connect();
    const db = getDb();
    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_ID },
      { $set: { content: doc.content, styles: doc.styles } }
    );

    console.log('pageId:', PAGE_ID);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('stats:', stats);
    console.log('\nBackend: HaustroBackend/Backend/src/routes/custom/departmentsLimit.php deploy edilmeli.');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
