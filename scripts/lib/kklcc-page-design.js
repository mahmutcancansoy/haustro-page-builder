const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/kirik-kayip-listesi-cost-control-page-extensions.css'
);
const SUMMARY_FILE = path.join(
  __dirname,
  '../../templates/kirik-kayip-listesi-cost-control-summary.html'
);
const DECREASES_LIST_FILE = path.join(
  __dirname,
  '../../templates/kirik-kayip-listesi-cost-control-decreases-list.html'
);

const SUMMARY_RT_NAME = 'Stok fark özeti';
const DECREASES_RT_NAME = 'Eksilen stok listesi';

const PAGE_CONFIG = {
  pageId: '64fa8392b03e360159336cfc',
  layoutName: 'Kırık Kayıp Listesi Layout',
};

const UI_TYPES = new Set(['grid', 'page-header', 'form-container']);

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

function enableSetting(block, settingKey) {
  const settings = prop(block, 'settings');
  if (settings?.value && typeof settings.value === 'object') {
    settings.value[settingKey] = true;
  }
}

function setGridClass(grid, className) {
  enableSetting(grid, 'customClasses');
  setProp(grid, 'custom-classes', className);
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

function isToolbarGrid(grid) {
  if (grid.type !== 'grid') return false;
  const name = String(propVal(grid, 'display-name') || '').toLowerCase();
  if (name.includes('toolbar')) return true;
  const btns = [];
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'button') btns.push(String(propVal(n, 'text') || ''));
      walk(n.children);
    }
  }
  walk(grid.children);
  return btns.some((t) => t === 'Geri') && btns.some((t) => /excel|yazdır/i.test(t));
}

function isSummaryGrid(grid) {
  if (grid.type !== 'grid') return false;
  const texts = collectLabelTexts(grid).join(' ');
  return /Stok Fark Miktarı|Stok Fark Fiyatı/.test(texts);
}

function isFormHeaderGrid(grid) {
  if (grid.type !== 'grid') return false;
  if (String(propVal(grid, 'display-name') || '') !== 'Row1') return false;
  return collectLabelTexts(grid).some((t) => t.trim() === 'Envanter');
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
    <h1>Eksilen Stok Detayı</h1>
    <p class="ass__hero-sub">{{monthlyCostReports.:departments:.label}} · {{monthlyCostReports.period}}</p>
  </div>
  <div class="ass__hero-meta">
    <span class="ass__chip"><i class="pi pi-building"></i> {{monthlyCostReports.:departments:.label}}</span>
    <span class="ass__chip"><i class="pi pi-calendar"></i> {{monthlyCostReports.period}}</span>
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
  <div class="ass__list-head-icon"><i class="pi pi-exclamation-triangle"></i></div>
  <div>
    <h2>Eksilen Stok Kalemleri</h2>
    <p>Kırık, kayıp ve stok farkına neden olan envanter hareketleri.</p>
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

function hidePageHeader(block) {
  block.type = 'condition';
  block.isContainer = true;
  block.children = [];
  block.properties = [
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
  return block;
}

function loadSummaryHtml() {
  return fs.readFileSync(SUMMARY_FILE, 'utf8').trim();
}

function loadDecreasesListHtml() {
  return fs.readFileSync(DECREASES_LIST_FILE, 'utf8').trim();
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
        value: SUMMARY_RT_NAME,
      },
    ],
  };
}

function decreasesListBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: loadDecreasesListHtml(),
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: DECREASES_RT_NAME,
      },
    ],
  };
}

function replaceFormList(form) {
  const loop = (form.children || []).find((c) => c.type === 'loop');
  const headerGrid = (form.children || []).find(isFormHeaderGrid);
  const existing = (form.children || []).find(
    (b) => b.type === 'render-template' && propVal(b, 'display-name') === DECREASES_RT_NAME
  );

  if (existing) {
    existing.content = loadDecreasesListHtml();
  }

  const rest = (form.children || []).filter((c) => c !== loop && c !== headerGrid && c !== existing);
  form.children = existing
    ? [existing, ...rest]
    : [decreasesListBlock(), ...rest];
}

function wrapListForm(form) {
  replaceFormList(form);
  return simpleContainer([listHeadBlock(), form], 'ass__list-card', 'Eksilen stok kartı');
}

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const summaryGrids = blocks.filter((b) => b.type === 'grid' && isSummaryGrid(b));
  const pageHeader = blocks.find((b) => b.type === 'page-header');
  const form = blocks.find((b) => b.type === 'form-container');

  if (pageHeader) hidePageHeader(pageHeader);

  for (const g of toolbarGrids) setGridClass(g, 'ass__toolbar');

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(heroBlock());
  ordered.push(simpleContainer([summaryBlock()], 'ass__summary-card', 'Stok fark özeti kartı'));
  if (form) ordered.push(wrapListForm(form));

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
  let toolbarKept = false;

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
      String(propVal(b, 'classes') || '').includes('ass__list-card')
    ) {
      const form = (b.children || []).find((c) => c.type === 'form-container');
      if (form) out.push(form);
      continue;
    }

    if (b.type === 'grid') {
      if (isSummaryGrid(b)) continue;

      const cls = String(propVal(b, 'custom-classes') || '');
      const isToolbar = cls.includes('ass__toolbar') || isToolbarGrid(b);
      if (isToolbar) {
        if (toolbarKept) continue;
        toolbarKept = true;
        setProp(b, 'custom-classes', '');
        const settings = prop(b, 'settings');
        if (settings?.value) settings.value.customClasses = false;
      } else if (cls) {
        setProp(b, 'custom-classes', '');
        const settings = prop(b, 'settings');
        if (settings?.value) settings.value.customClasses = false;
      }
      out.push(b);
      continue;
    }

    if (b.type === 'page-header' || b.type === 'form-container') {
      out.push(b);
    } else if (b.type === 'condition' && propVal(b, 'display-name') === 'Header hidden') {
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
    if (UI_TYPES.has(block.type) || block.type === 'page-header') {
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
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${ext}`;
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
