#!/usr/bin/env node
/**
 * onaylanan-teklifler (Teklifler)
 * Aktif-transfer ile aynı layout modeli:
 *   data-source
 *   simple-container.ass-page
 *     render-template hero
 *     loop
 *       simple-container.ass__list-card
 *         render-template özet
 *         simple-container.ot-offers
 *           render-template teklif başlık
 *           simple-table
 *
 * Kullanım:
 *   node scripts/patch-onaylanan-teklifler-design.js
 *   node scripts/patch-onaylanan-teklifler-design.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = '696f72095170eb0016418f24';
const PUSH = process.argv.includes('--push');
const ROOT = path.join(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT, 'templates/onaylanan-teklifler-content.json');

const HERO_HTML = fs.readFileSync(path.join(ROOT, 'templates/onaylanan-teklifler-hero.html'), 'utf8');
const CARD_HEAD_HTML = fs.readFileSync(path.join(ROOT, 'templates/onaylanan-teklifler-card-head.html'), 'utf8');
const OFFERS_TITLE_HTML = fs.readFileSync(path.join(ROOT, 'templates/onaylanan-teklifler-offers-title.html'), 'utf8');
const OFFER_STATUS_HTML = fs.readFileSync(path.join(ROOT, 'templates/onaylanan-teklifler-offer-status.html'), 'utf8');
const PAGE_CSS = fs.readFileSync(path.join(ROOT, 'templates/onaylanan-teklifler-page-styles.css'), 'utf8');

function prop(block, key) {
  return (block.properties || []).find((p) => p.key === key);
}

function setProp(block, key, value, meta = {}) {
  const p = prop(block, key);
  if (p) {
    p.value = value;
    return;
  }
  block.properties = block.properties || [];
  block.properties.push({
    key,
    header: meta.header || key,
    type: meta.type || (key === 'styles' ? 'code-editor' : 'textarea-property'),
    value,
    autoComplete: true,
    autoCompleteMode: 'template',
  });
}

function makeRT(content, displayName) {
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

function simpleContainer(children, classes, displayName) {
  return {
    type: 'simple-container',
    isContainer: true,
    children,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
      {
        key: 'classes',
        header: 'Classes',
        type: 'textarea-property',
        value: classes,
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
}

function makeTableColumn(displayName, variable, children) {
  return {
    type: 'table-column',
    isContainer: true,
    children,
    properties: [
      { key: 'display-name', header: 'Display name', type: 'input-text-property', value: displayName },
      { key: 'variable', header: 'Variable name', type: 'input-text-property', value: variable },
      { key: 'header', header: 'Header', type: 'input-text-property', value: displayName },
      { key: 'width', header: 'Width', type: 'input-text-property', value: 'auto' },
      {
        key: 'content-direction',
        type: 'select-property',
        options: [
          { label: 'row', value: 'row' },
          { label: 'column', value: 'column' },
        ],
        header: 'Content direction',
        value: 'row',
      },
      {
        key: 'content-align',
        type: 'select-property',
        options: [
          { label: 'Start', value: 'flex-start' },
          { label: 'Center', value: 'center' },
          { label: 'End', value: 'flex-end' },
        ],
        header: 'Content Align',
        value: 'center',
      },
      {
        key: 'filter-type',
        header: 'Filter Type',
        type: 'select-property',
        options: [
          { label: 'No Filter', value: 'none' },
          { label: 'Text', value: 'text' },
          { label: 'Select', value: 'select' },
        ],
        value: 'none',
      },
      {
        key: 'settings',
        header: 'Settings',
        type: 'checkbox-property',
        options: [{ label: 'Hide in mobile', name: 'hideInMobile' }],
        value: { hideInMobile: false },
      },
    ],
  };
}

function hideContentHeader(block) {
  if (block.type !== 'content-header') return false;
  block.type = 'condition';
  block.isContainer = true;
  block.children = [];
  block.properties = [
    { key: 'display-name', header: 'Display name', type: 'input-text-property', value: 'Eski header gizli' },
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
  return true;
}

function styleApproveRejectButtons(formContainer) {
  const name = prop(formContainer, 'display-name')?.value;
  for (const child of formContainer.children || []) {
    if (child.type !== 'button') continue;
    if (name === 'Teklif Onaylama') {
      setProp(child, 'classes', 'p-button-success');
      const text = prop(child, 'text');
      if (text) text.value = 'Onayla';
    }
    if (name === 'Teklif Reddetme') {
      setProp(child, 'classes', 'p-button-danger p-button-outlined');
      const text = prop(child, 'text');
      if (text) text.value = 'Reddet';
    }
  }
}

function ensureOfferStatusColumn(table) {
  const cols = table.children || [];
  const existing = cols.find((c) => prop(c, 'display-name')?.value === 'Durumu');
  if (existing) {
    const rt = (existing.children || []).find((c) => c.type === 'render-template');
    if (rt) rt.content = OFFER_STATUS_HTML;
    else existing.children = [makeRT(OFFER_STATUS_HTML, 'Teklif durumu')];
    return 0;
  }
  const actionsIdx = cols.findIndex((c) => prop(c, 'display-name')?.value === 'İşlemler');
  const statusCol = makeTableColumn('Durumu', 'status', [
    makeRT(OFFER_STATUS_HTML, 'Teklif durumu'),
  ]);
  if (actionsIdx >= 0) cols.splice(actionsIdx, 0, statusCol);
  else cols.push(statusCol);
  return 1;
}

function findSimpleTable(nodes) {
  for (const n of nodes || []) {
    if (n.type === 'simple-table') return n;
    const found = findSimpleTable(n.children);
    if (found) return found;
  }
  return null;
}

function patchCard(card) {
  const stats = { labelsRemoved: 0, offerStatusCol: 0, buttons: 0, offersWrap: 0 };

  // Drop legacy labels + orphan open/close RTs
  const raw = [];
  for (const child of card.children || []) {
    if (child.type === 'label') {
      stats.labelsRemoved += 1;
      continue;
    }
    const dn = prop(child, 'display-name')?.value;
    if (
      child.type === 'render-template' &&
      (dn === 'Kart body kapat' || dn === 'Sayfa kapat' || String(child.content || '').trim() === '</div>')
    ) {
      continue;
    }
    raw.push(child);
  }

  // Tablo üst seviyede veya ot-offers içinde olabilir — kaybetme
  let table = findSimpleTable(raw);
  if (!table) {
    const savedPath = path.join(ROOT, 'templates/onaylanan-teklifler-offers-table.json');
    if (fs.existsSync(savedPath)) {
      table = JSON.parse(fs.readFileSync(savedPath, 'utf8'));
      stats.tableRestoredFromFile = 1;
    }
  }
  if (!table) {
    throw new Error('simple-table bulunamadı (teklif satırları kaybolur). Backup/restore gerekli.');
  }

  const headExisting = raw.find(
    (c) => c.type === 'render-template' && prop(c, 'display-name')?.value === 'Kart başlık + status'
  );

  setProp(table, 'classes', 'ot-offers-table');
  // mode/variable — mevcut property anahtarlarını koru
  const modeProp = prop(table, 'mode');
  if (modeProp) modeProp.value = 'variable';
  const varProp = prop(table, 'variable');
  if (varProp) varProp.value = 'input.offers';
  else setProp(table, 'variable', 'input.offers');

  stats.offerStatusCol = ensureOfferStatusColumn(table);

  const actionsCol = (table.children || []).find(
    (c) => prop(c, 'display-name')?.value === 'İşlemler'
  );
  if (actionsCol) {
    for (const wrap of actionsCol.children || []) {
      if (wrap.type === 'simple-container') {
        setProp(wrap, 'classes', 'ot-actions');
        setProp(wrap, 'styles', '{}', { type: 'code-editor', header: 'Styles' });
        for (const form of wrap.children || []) {
          if (form.type === 'form-container') {
            styleApproveRejectButtons(form);
            stats.buttons += 1;
          }
        }
      }
    }
  }

  // Persist table snapshot for future patches
  fs.writeFileSync(
    path.join(ROOT, 'templates/onaylanan-teklifler-offers-table.json'),
    JSON.stringify(table, null, 2) + '\n'
  );

  const headRt = headExisting
    ? ((headExisting.content = CARD_HEAD_HTML), headExisting)
    : makeRT(CARD_HEAD_HTML, 'Kart başlık + status');

  const offersWrap = simpleContainer(
    [makeRT(OFFERS_TITLE_HTML, 'Teklif grubu başlık'), table],
    'ot-offers',
    'Teklif grubu'
  );
  stats.offersWrap = 1;

  card.children = [headRt, offersWrap];
  setProp(card, 'classes', 'ass__list-card');
  setProp(card, 'styles', '{}', { type: 'code-editor', header: 'Styles' });
  setProp(card, 'display-name', 'Satın alma kartı');

  return stats;
}

function findAssPage(content) {
  return content.find(
    (b) =>
      b.type === 'simple-container' &&
      String(prop(b, 'classes')?.value || '').includes('ass-page')
  );
}

function extractLoop(nodes) {
  for (const n of nodes || []) {
    if (n.type === 'loop') return n;
    if (n.type === 'simple-container') {
      const found = extractLoop(n.children);
      if (found) return found;
    }
  }
  return null;
}

function patchPage(doc) {
  const stats = { headerHidden: 0, layout: 0, hero: 0, card: null };

  // Flatten previous broken HTML-wrap RTs and nested wraps
  let blocks = Array.isArray(doc.content) ? [...doc.content] : [];

  // If already wrapped in ass-page, work on its children + keep outer DS siblings
  const existingAss = findAssPage(blocks);
  let dataBlocks = [];
  let working = blocks;

  if (existingAss) {
    dataBlocks = blocks.filter((b) => b !== existingAss && b.type === 'data-source');
    working = [...(existingAss.children || [])];
  } else {
    dataBlocks = blocks.filter((b) => b.type === 'data-source');
    working = blocks.filter((b) => b.type !== 'data-source');
  }

  // Hide legacy content-header / conditions that replaced it
  working = working.filter((b) => {
    if (hideContentHeader(b)) {
      stats.headerHidden = 1;
      return false;
    }
    if (b.type === 'condition' && prop(b, 'display-name')?.value === 'Eski header gizli') {
      stats.headerHidden = 1;
      return false;
    }
    // Drop orphan open/close page wrappers
    if (b.type === 'render-template') {
      const dn = prop(b, 'display-name')?.value;
      if (dn === 'Sayfa kapat') return false;
      if (dn === 'Sayfa hero') return true; // keep, will refresh
      const c = String(b.content || '');
      if (c.includes('class="ass-page"') || c.includes("class='ass-page'") || c.includes('class="ot-page"')) {
        // old wrapping hero — replace below
        return true;
      }
      if (c.trim() === '</div></div>' || c.trim() === '</div>') return false;
    }
    return true;
  });

  const loop = extractLoop(working) || working.find((b) => b.type === 'loop');
  if (!loop) throw new Error('Talep Kartları loop bulunamadı');

  // Remove loop from working; rebuild layout
  const loopParent = working.find(
    (b) =>
      b.type === 'simple-container' &&
      (b.children || []).some((c) => c === loop || c.type === 'loop')
  );

  let loopBlock = loop;
  if (loopParent && loopParent !== loop) {
    loopBlock = (loopParent.children || []).find((c) => c.type === 'loop') || loop;
  }

  setProp(loopBlock, 'display-name', 'Talep Kartları');
  setProp(loopBlock, 'data-source', 'getPurchaseOffers');
  const card = (loopBlock.children || []).find((c) => c.type === 'simple-container');
  if (!card) throw new Error('Loop içinde satın alma kartı (simple-container) yok');
  stats.card = patchCard(card);

  const heroRt = makeRT(HERO_HTML, 'Sayfa hero');
  stats.hero = 1;

  const layout = simpleContainer([heroRt, loopBlock], 'ass-page', 'Teklifler Layout');
  stats.layout = 1;

  // Keep only DS + layout (and any non-UI DS helpers)
  doc.content = [...dataBlocks, layout];
  // Ensure DS present
  if (!doc.content.some((b) => b.type === 'data-source')) {
    throw new Error('data-source kayboldu');
  }

  doc.styles = '\n' + PAGE_CSS + '\n';
  return stats;
}

async function pushToDb(doc) {
  loadEnv();
  await connect();
  try {
    return await getDb().collection('pageContents').updateOne(
      { pageId: PAGE_ID },
      { $set: { content: doc.content, styles: doc.styles } }
    );
  } finally {
    await close().catch(() => {});
  }
}

(async () => {
  try {
    const doc = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
    const stats = patchPage(doc);
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');
    console.log('Template güncellendi:', TEMPLATE_PATH);
    console.log('stats:', JSON.stringify(stats, null, 2));

    // sanity outline
    const top = doc.content.map((b) => {
      const p = prop(b, 'classes')?.value || prop(b, 'display-name')?.value || b.type;
      return `${b.type}:${p}`;
    });
    console.log('top:', top.join(' | '));

    if (PUSH) {
      const r = await pushToDb(doc);
      console.log('DB push pageId:', PAGE_ID, 'matched:', r.matchedCount, 'modified:', r.modifiedCount);
    } else {
      console.log('DB yazılmadı. Canlıya almak için: --push');
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  }
})();
