const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const LIST_EXT_FILE = path.join(
  __dirname,
  '../../templates/periyotlar-page-extensions.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/periyot-detay-page-extensions.css'
);

const PAGE_CONFIG = {
  pageId: '6571c61cb03e360b1170cd2b',
  layoutName: 'Periyot Detay Layout',
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

function pageHeadBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="prdd-page-head">
  <a class="prdd-back" href="/d/periyotlar">
    <i class="pi pi-arrow-left"></i>
    Periyotlar
  </a>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Sayfa navigasyon',
      },
    ],
  };
}

function heroBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__hero prd-hero prdd-hero">
  <div class="ass__hero-main">
    <span class="ass__eyebrow">İnsan kaynakları</span>
    <h1>{{evaluationPeriod.periodText}}</h1>
    <p class="ass__hero-sub">Değerlendirme yapan personeller ve dönem durumu</p>
  </div>
  <div class="ass__hero-meta">
    {{#cIf evaluationPeriod.status "==" "0"}}
      <span class="ass__chip prd-chip--active"><i class="pi pi-circle-fill"></i> Açık dönem</span>
    {{/cIf}}
    {{#cIf evaluationPeriod.status "==" "1"}}
      <span class="ass__chip prdd-chip--closed"><i class="pi pi-lock"></i> Kapalı dönem</span>
    {{/cIf}}
    {{#if performanceEvaluations.length}}
      <span class="ass__chip"><i class="pi pi-users"></i> {{performanceEvaluations.length}} personel</span>
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
  <div class="ass__list-head-icon"><i class="pi pi-users"></i></div>
  <div>
    <h2>Değerlendirme yapan personeller</h2>
    <p>Dönem içinde değerlendirme girişi yapan personel listesi.</p>
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

function hideBlock(block, displayName) {
  block.type = 'condition';
  block.isContainer = true;
  block.children = [];
  block.properties = [
    {
      key: 'display-name',
      header: 'Display name',
      type: 'input-text-property',
      value: displayName,
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

function isPageHeader(block) {
  return block.type === 'page-header';
}

function wrapSimpleTable(table) {
  appendClass(table, 'classes', 'prd-data-table');
  appendClass(table, 'classes', 'ass__data-table');
  setProp(table, 'empty-message', 'Henüz değerlendirme yapan personel bulunmuyor.');
  return simpleContainer([listHeadBlock(), table], 'ass__list-card', 'Personel listesi');
}

function patchTableContent(nodes) {
  for (const n of nodes || []) {
    if (n.type === 'label') {
      const text = String(propVal(n, 'text') || '');
      if (text.includes('evaluationPeriod.periodText')) {
        appendClass(n, 'classes', 'prd-period-name');
      }
      if (text.includes('input.user')) {
        appendClass(n, 'classes', 'prdd-person-name');
      }
      if (text.includes('input.insertCount')) {
        appendClass(n, 'classes', 'prdd-count');
      }
      if (text === 'Açık') {
        appendClass(n, 'classes', 'prd-status prd-status--open');
      }
      if (text === 'Kapalı') {
        appendClass(n, 'classes', 'prd-status prd-status--closed');
      }
      if (text === 'Başlatılmamış') {
        appendClass(n, 'classes', 'prd-status prdd-status--pending');
      }
    }
    if (n.type === 'button') {
      appendClass(n, 'classes', 'prd-table-btn');
      const text = String(propVal(n, 'text') || '');
      if (text.includes('Yeniden Aç')) {
        appendClass(n, 'classes', 'prdd-table-btn--reopen');
      }
    }
    if (n.type === 'form-container') {
      appendClass(n, 'classes', 'prd-inline-form');
    }
    patchTableContent(n.children);
  }
}

function patchUiBlocks(blocks) {
  const pageHeader = blocks.find(isPageHeader);
  const simpleTable = blocks.find((b) => b.type === 'simple-table');

  if (pageHeader) {
    hideBlock(pageHeader, 'Header hidden');
  }

  if (simpleTable) {
    patchTableContent(simpleTable.children);
  }

  const ordered = [pageHeadBlock(), heroBlock()];
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

    if (b.type === 'condition' && propVal(b, 'display-name') === 'Header hidden') {
      b.type = 'page-header';
      b.isContainer = false;
      b.children = undefined;
      b.properties = [
        {
          key: 'display-name',
          header: 'Display name',
          type: 'input-text-property',
          value: 'Page Title',
        },
        {
          key: 'classes',
          header: 'Classes',
          type: 'textarea-property',
          value: '',
        },
        {
          key: 'text',
          header: 'Text',
          type: 'textarea-property',
          value: 'Değerlendirme Yapan Personeller',
          autoComplete: true,
          autoCompleteMode: 'template',
        },
        {
          key: 'bg-color',
          header: 'Background color',
          type: 'color-picker-property',
          value: '#fff',
        },
        {
          key: 'text-color',
          header: 'Text color',
          type: 'color-picker-property',
          value: '#777777',
        },
      ];
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
    } else if (['page-header', 'simple-table'].includes(block.type)) {
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
  const listExt = fs.readFileSync(LIST_EXT_FILE, 'utf8').trim();
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${listExt}\n\n${ext}`;
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
