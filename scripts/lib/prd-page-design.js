const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/periyotlar-page-extensions.css'
);

const PAGE_CONFIG = {
  pageId: '6571c439b03e360e6a018a02',
  layoutName: 'Periyotlar Layout',
};

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
    content: `<div class="ass__hero prd-hero">
  <div class="ass__hero-main">
    <span class="ass__eyebrow">İnsan kaynakları</span>
    <h1>Performans Değerlendirme Periyotları</h1>
    <p class="ass__hero-sub">Değerlendirme dönemlerini oluşturun, yönetin ve sonuçları takip edin.</p>
  </div>
  <div class="ass__hero-meta">
    {{#if performanceEvaluations.length}}
      <span class="ass__chip"><i class="pi pi-calendar"></i> {{performanceEvaluations.length}} periyot</span>
    {{/if}}
    {{#if performanceEvaluationsStatus.length}}
      <span class="ass__chip prd-chip--active"><i class="pi pi-circle-fill"></i> {{performanceEvaluationsStatus.length}} açık dönem</span>
    {{/if}}
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
  <div class="ass__list-head-icon"><i class="pi pi-calendar"></i></div>
  <div>
    <h2>Periyot listesi</h2>
    <p>Açık ve kapatılmış değerlendirme dönemlerini görüntüleyin.</p>
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
}

function isToolbarGrid(block) {
  return block.type === 'grid' && propVal(block, 'display-name') === 'Toolbar container';
}

function findCreateCondition(grid) {
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'condition' && String(propVal(n, 'condition') || '').includes('performanceEvaluationsStatus')) {
        return n;
      }
      const nested = walk(n.children);
      if (nested) return nested;
    }
    return null;
  }
  return walk(grid?.children);
}

function wrapSimpleTable(table) {
  appendClass(table, 'classes', 'prd-data-table');
  appendClass(table, 'classes', 'ass__data-table');
  setProp(table, 'empty-message', 'Henüz periyot bulunmuyor.');
  return simpleContainer([listHeadBlock(), table], 'ass__list-card', 'Periyot listesi');
}

function patchTableContent(nodes) {
  for (const n of nodes || []) {
    if (n.type === 'label') {
      const text = String(propVal(n, 'text') || '');
      if (text.includes('periodText')) {
        appendClass(n, 'classes', 'prd-period-name');
      }
      if (text === 'Açık') {
        appendClass(n, 'classes', 'prd-status prd-status--open');
      }
      if (text === 'Kapalı') {
        appendClass(n, 'classes', 'prd-status prd-status--closed');
      }
    }
    if (n.type === 'button') {
      appendClass(n, 'classes', 'prd-table-btn');
      const text = String(propVal(n, 'text') || '');
      if (text.includes('Görüntüle')) appendClass(n, 'classes', 'prd-table-btn--view');
      if (text.includes('Sonlandır')) appendClass(n, 'classes', 'prd-table-btn--close');
    }
    if (n.type === 'form-container') {
      appendClass(n, 'classes', 'prd-inline-form');
    }
    patchTableContent(n.children);
  }
}

function patchUiBlocks(blocks) {
  const toolbarGrid = blocks.find(isToolbarGrid);
  const simpleTable = blocks.find((b) => b.type === 'simple-table');
  const createCondition = toolbarGrid ? findCreateCondition(toolbarGrid) : null;

  if (toolbarGrid) {
    function walk(nodes) {
      for (const n of nodes || []) {
        if (n.type === 'page-header') hidePageHeader(n);
        walk(n.children);
      }
    }
    walk(toolbarGrid.children);
  }

  if (simpleTable) {
    patchTableContent(simpleTable.children);
  }

  const ordered = [heroBlock()];
  if (createCondition) {
    ordered.push(simpleContainer([createCondition], 'ass__actions', 'Sayfa aksiyonları'));
  }
  if (simpleTable) ordered.push(wrapSimpleTable(simpleTable));
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
      String(propVal(b, 'classes') || '').includes('ass__actions')
    ) {
      for (const child of b.children || []) {
        if (child.type === 'condition') out.push(child);
      }
      continue;
    }

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__list-card')
    ) {
      const table = (b.children || []).find((c) => c.type === 'simple-table');
      if (table) {
        const cls = String(propVal(table, 'classes') || '')
          .replace(/\bprd-data-table\b/g, '')
          .replace(/\bass__data-table\b/g, '')
          .trim();
        setProp(table, 'classes', cls);
        out.push(table);
      }
      continue;
    }

    if (isToolbarGrid(b)) {
      out.push(b);
      continue;
    }

    if (b.type === 'simple-table') {
      out.push(b);
    }
  }

  return out;
}

function patchDataSources(blocks) {
  for (const b of blocks || []) {
    if (b.type === 'data-source') {
      const settings = prop(b, 'settings');
      if (settings?.value) settings.value.debug = false;
    }
    patchDataSources(b.children);
  }
}

function applyLayout(content) {
  patchDataSources(content);

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
    if (block.type === 'data-source') {
      dataBlocks.push(block);
    } else if (['grid', 'simple-table'].includes(block.type)) {
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
