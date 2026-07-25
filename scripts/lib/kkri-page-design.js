const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const SUMMARY_EXT_FILE = path.join(
  __dirname,
  '../../templates/kirik-kayip-listesi-cost-control-page-extensions.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/kirik-kayip-raporlari-ic-page-extensions.css'
);
const SUMMARY_FILE = path.join(
  __dirname,
  '../../templates/kirik-kayip-raporlari-ic-summary.html'
);

const PAGE_CONFIG = {
  pageId: '66048462b03e3600166665a3',
  layoutName: 'Kırık Kayıp Raporları Layout',
};

const UI_TYPES = new Set(['grid', 'page-header', 'condition']);

function prop(block, key) {
  return (block.properties || []).find((p) => p.key === key);
}

function propVal(block, key) {
  const p = prop(block, key);
  return p == null ? '' : p.value;
}

function setProp(block, key, value) {
  const p = prop(block, key);
  if (p) p.value = value;
}

function appendClass(block, key, className) {
  const current = String(propVal(block, key) || '').trim();
  if (!current.split(/\s+/).includes(className)) {
    setProp(block, key, `${current} ${className}`.trim());
  }
}

function collectLabelTexts(block) {
  const texts = [];
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'label') texts.push(String(propVal(n, 'text') || ''));
      walk(n.children);
    }
  }
  walk(block.children);
  return texts;
}

function findButtons(blocks) {
  const buttons = [];
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'button') buttons.push(n);
      walk(n.children);
    }
  }
  for (const b of blocks) walk(b.children ? [b] : []);
  for (const b of blocks) walk(b.children);
  return buttons;
}

function isHeaderToolbarGrid(block) {
  if (block.type !== 'grid') return false;
  const name = String(propVal(block, 'display-name') || '');
  if (name === 'Toolbar container') return true;
  return collectLabelTexts(block).some((t) => t.includes('Kırık Kayıp Raporları'));
}

function isTableCondition(block) {
  if (block.type !== 'condition') return false;
  return (block.children || []).some((c) => c.type === 'simple-table');
}

function isCreateButton(block) {
  return block.type === 'button' && String(propVal(block, 'text') || '') === 'Yeni Form Oluştur';
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
        value: '{\n\n}',
      },
    ],
  };
}

function heroBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__hero">
  <div class="ass__hero-main">
    <span class="ass__eyebrow">Maliyet kontrol</span>
    <h1>Kırık Kayıp Raporları</h1>
    <p class="ass__hero-sub">Dönem: {{params.month}}</p>
  </div>
  <div class="ass__hero-meta">
    <span class="ass__chip"><i class="pi pi-calendar"></i> {{params.month}}</span>
  </div>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Sayfa hero',
      },
    ],
  };
}

function listHeadBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__list-head">
  <div class="ass__list-head-icon"><i class="pi pi-file-edit"></i></div>
  <div>
    <h2>Kırık Kayıp Kayıt Formları</h2>
    <p>Onay bekleyen ve tamamlanan rapor kayıtlarını inceleyebilirsiniz.</p>
  </div>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Liste başlık',
      },
    ],
  };
}

function loadSummaryHtml() {
  return fs.readFileSync(SUMMARY_FILE, 'utf8').trim();
}

function summaryBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: loadSummaryHtml(),
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Rapor özeti',
      },
    ],
  };
}

function styleTableCondition(condition) {
  const table = (condition.children || []).find((c) => c.type === 'simple-table');
  if (table) appendClass(table, 'classes', 'ass__data-table');
  return condition;
}

function wrapTableCondition(condition) {
  styleTableCondition(condition);
  return simpleContainer([listHeadBlock(), condition], 'ass__list-card', 'Rapor tablosu kartı');
}

function extractCreateButton(blocks) {
  for (const block of blocks) {
    if (isCreateButton(block)) return block;
    if (block.type === 'grid' || block.type === 'simple-container') {
      for (const child of block.children || []) {
        if (isCreateButton(child)) return child;
      }
    }
  }
  const all = findButtons(blocks);
  return all.find((b) => String(propVal(b, 'text') || '') === 'Yeni Form Oluştur') || null;
}

function patchUiBlocks(blocks) {
  const headerGrid = blocks.find(isHeaderToolbarGrid);
  const tableCondition = blocks.find(isTableCondition);
  const createBtn = extractCreateButton(blocks);

  const ordered = [];
  ordered.push(heroBlock());
  ordered.push(simpleContainer([summaryBlock()], 'ass__summary-card', 'Rapor özeti kartı'));

  if (createBtn) {
    ordered.push(simpleContainer([createBtn], 'ass__actions', 'Sayfa aksiyonları'));
  }

  if (tableCondition) ordered.push(wrapTableCondition(tableCondition));

  return ordered;
}

function findLayoutWrapper(content) {
  return content.find(
    (b) =>
      b.type === 'simple-container' && prop(b, 'classes')?.value?.includes('ass-page')
  );
}

function unwrapUiBlocks(blocks) {
  const out = [];

  for (const b of blocks) {
    if (b.type === 'render-template') continue;

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__summary-card')
    ) {
      continue;
    }

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__actions')
    ) {
      for (const child of b.children || []) {
        if (child.type === 'button') out.push(child);
      }
      continue;
    }

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__list-card')
    ) {
      const condition = (b.children || []).find(isTableCondition);
      if (condition) {
        const table = (condition.children || []).find((c) => c.type === 'simple-table');
        if (table) {
          const cls = String(propVal(table, 'classes') || '')
            .replace(/\bass__data-table\b/g, '')
            .trim();
          setProp(table, 'classes', cls);
        }
        out.push(condition);
      }
      continue;
    }

    if (isHeaderToolbarGrid(b)) {
      out.push(b);
      continue;
    }

    if (isTableCondition(b)) {
      out.push(b);
      continue;
    }

    if (b.type === 'button' && isCreateButton(b)) {
      out.push(b);
    }
  }

  return out;
}

function applyLayout(content) {
  const existingWrap = findLayoutWrapper(content);
  if (existingWrap) {
    const inner = unwrapUiBlocks(existingWrap.children || []);
    existingWrap.children = patchUiBlocks(inner);
    setProp(existingWrap, 'display-name', PAGE_CONFIG.layoutName);
    return content;
  }

  const dataBlocks = [];
  const uiBlocks = [];

  for (const block of content) {
    if (UI_TYPES.has(block.type)) {
      uiBlocks.push(block);
    } else if (block.type === 'grid') {
      uiBlocks.push(block);
    } else if (block.type !== 'simple-container') {
      dataBlocks.push(block);
    }
  }

  if (!uiBlocks.length) return content;

  const layout = simpleContainer(patchUiBlocks(uiBlocks), 'ass-page', PAGE_CONFIG.layoutName);
  return [...dataBlocks, layout];
}

function loadStyles() {
  const base = fs.readFileSync(BASE_STYLES_FILE, 'utf8').trim();
  const summaryExt = fs.readFileSync(SUMMARY_EXT_FILE, 'utf8').trim();
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${summaryExt}\n\n${ext}`;
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
