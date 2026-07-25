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
  '../../templates/performans-degerlendirme-rapor-detayi-page-extensions.css'
);

const PAGE_CONFIG = {
  pageId: '6572f7aeb03e3600fa0e88cc',
  layoutName: 'Performans Değerlendirme Rapor Detayı Layout',
};

const FILTER_DATA_CONDITIONS = new Set([
  'Tümü',
  'Değerlendirilenler',
  'Değerlendirilmeyenler',
]);

const STATUS_CLASS = {
  başarısız: 'prda-status--fail',
  vasat: 'prda-status--poor',
  orta: 'prda-status--mid',
  iyi: 'prda-status--good',
  başarılı: 'prda-status--great',
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
    content: `<div class="prda-page-head">
  <a class="prda-back" href="/d/performans-degerlendirme-raporlari">
    <i class="pi pi-arrow-left"></i>
    Raporlar
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
    content: `<div class="ass__hero prd-hero prda-hero">
  <div class="ass__hero-main">
    <span class="ass__eyebrow">Performans değerlendirme</span>
    <h1>{{evaluationPeriod.periodText}}</h1>
    <p class="ass__hero-sub">Dönem personel değerlendirme sonuçları ve rapor özeti erişimi</p>
  </div>
  <div class="ass__hero-meta">
    {{#cIf evaluationPeriod.status "==" "1"}}
      <span class="ass__chip prda-chip--closed"><i class="pi pi-lock"></i> Kapalı dönem</span>
    {{/cIf}}
    {{#if performanceEvaluations.length}}
      <span class="ass__chip"><i class="pi pi-users"></i> {{performanceEvaluations.length}} kayıt</span>
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
    <h2>Personel listesi</h2>
    <p>Değerlendirme sonuçlarına göre filtreleyin ve rapor özetini görüntüleyin.</p>
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

function isFilterDataCondition(block) {
  return block.type === 'condition' && FILTER_DATA_CONDITIONS.has(propVal(block, 'display-name'));
}

function isTableResultCondition(block) {
  return block.type === 'condition' && propVal(block, 'display-name') === 'Filtre Formu Kontrol';
}

function isToolbarGrid(block) {
  return block.type === 'grid' && propVal(block, 'display-name') === 'Toolbar container';
}

function containerHasForms(container) {
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'form-container') return true;
      if (walk(n.children)) return true;
    }
    return false;
  }
  return walk(container.children);
}

function extractFiltersContainer(grid) {
  for (const child of grid?.children || []) {
    if (child.type === 'simple-container' && containerHasForms(child)) {
      return child;
    }
  }
  return null;
}

function hidePageHeaderInGrid(grid) {
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'page-header') hideBlock(n, 'Header hidden');
      walk(n.children);
    }
  }
  walk(grid?.children);
}

function patchFiltersContainer(container) {
  appendClass(container, 'classes', 'prda-filters-panel');
  setProp(container, 'styles', '{\n\n}');
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'form-container') appendClass(n, 'classes', 'prd-inline-form');
      walk(n.children);
    }
  }
  walk(container.children);
  return container;
}

function patchTableContent(nodes) {
  for (const n of nodes || []) {
    if (n.type === 'image' && propVal(n, 'display-name') === 'photo') {
      appendClass(n, 'classes', 'prda-avatar');
      setProp(n, 'width', '44px');
      setProp(n, 'height', '44px');
    }
    if (n.type === 'label') {
      const text = String(propVal(n, 'text') || '');
      if (text.includes('input.user')) appendClass(n, 'classes', 'prda-person-name');
      if (text.includes('input.departments') || text.includes('input.roleTypes')) {
        appendClass(n, 'classes', 'prda-meta');
      }
    }
    if (n.type === 'button') {
      appendClass(n, 'classes', 'prd-table-btn');
      if (String(propVal(n, 'text') || '').includes('Görüntüle')) {
        appendClass(n, 'classes', 'prd-table-btn--view prda-table-btn--view');
      }
    }
    if (n.type === 'condition') {
      const statusClass = STATUS_CLASS[propVal(n, 'display-name')];
      if (statusClass) {
        for (const child of n.children || []) {
          if (child.type === 'label') {
            appendClass(child, 'classes', `prd-status prda-status ${statusClass}`);
          }
        }
      }
    }
    patchTableContent(n.children);
  }
}

function patchResultTable(table) {
  appendClass(table, 'classes', 'prd-data-table');
  appendClass(table, 'classes', 'ass__data-table');
  setProp(table, 'empty-message', 'Bu filtre için kayıt bulunamadı.');
  patchTableContent(table.children);
  return table;
}

function patchTableCondition(condition) {
  const next = [];
  for (const child of condition.children || []) {
    if (child.type === 'table') {
      next.push(simpleContainer([listHeadBlock(), patchResultTable(child)], 'ass__list-card', 'Personel listesi'));
    } else {
      next.push(child);
    }
  }
  condition.children = next;
  return condition;
}

function patchUiBlocks(blocks) {
  const grid = blocks.find(isToolbarGrid);
  const tableCondition = blocks.find(isTableResultCondition);

  if (grid) hidePageHeaderInGrid(grid);

  const filters = grid ? extractFiltersContainer(grid) : null;
  if (filters) patchFiltersContainer(filters);

  if (tableCondition) patchTableCondition(tableCondition);

  const ordered = [pageHeadBlock(), heroBlock()];
  if (filters) ordered.push(simpleContainer([filters], 'prda-filters-wrap', 'Filtreler'));
  if (tableCondition) ordered.push(tableCondition);
  return ordered;
}

function findLayoutWrapper(content) {
  return content.find(
    (b) =>
      b.type === 'simple-container' && prop(b, 'classes')?.value?.includes('ass-page')
  );
}

function unwrapListCard(card) {
  const table = (card.children || []).find(
    (c) => c.type === 'table' || c.type === 'simple-table'
  );
  if (!table) return null;
  const cls = String(propVal(table, 'classes') || '')
    .replace(/\bprd-data-table\b/g, '')
    .replace(/\bass__data-table\b/g, '')
    .trim();
  setProp(table, 'classes', cls);
  return table;
}

function unwrapTableCondition(condition) {
  const next = [];
  for (const child of condition.children || []) {
    if (
      child.type === 'simple-container' &&
      String(propVal(child, 'classes') || '').includes('ass__list-card')
    ) {
      const table = unwrapListCard(child);
      if (table) next.push(table);
    } else {
      next.push(child);
    }
  }
  condition.children = next;
  return condition;
}

function unwrapFiltersWrap(wrap) {
  const panel = (wrap.children || []).find((c) =>
    String(propVal(c, 'classes') || '').includes('prda-filters-panel')
  );
  if (panel) {
    setProp(
      panel,
      'classes',
      String(propVal(panel, 'classes') || '')
        .replace('prda-filters-panel', '')
        .trim()
    );
    setProp(panel, 'styles', '{\n "display":"flex",\n "align-items":"center"\n}');
  }
  return panel;
}

function rebuildToolbarGrid(filtersPanel) {
  const headerContainer = simpleContainer(
    [
      {
        type: 'column',
        isContainer: true,
        children: [
          {
            type: 'page-header',
            isContainer: false,
            properties: [
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
                value: 'Performans Değerlendirme Rapor Detayı',
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
            ],
          },
        ],
        properties: [
          {
            key: 'display-name',
            header: 'Display name',
            type: 'input-text-property',
            value: 'Left container',
          },
          {
            key: 'content-direction',
            header: 'Content direction',
            type: 'select-property',
            options: [
              { label: 'Row', value: 'row' },
              { label: 'Column', value: 'column' },
            ],
            value: 'column',
          },
          {
            key: 'justify-content',
            header: 'Justify content',
            type: 'select-property',
            options: [
              { label: 'Unset', value: 'unset' },
              { label: 'Start', value: 'flex-start' },
              { label: 'Center', value: 'center' },
              { label: 'End', value: 'flex-end' },
              { label: 'Space between', value: 'space-between' },
            ],
            value: 'flex-start',
          },
          {
            key: 'align-items',
            header: 'Align items',
            type: 'select-property',
            options: [
              { label: 'Unset', value: 'unset' },
              { label: 'Start', value: 'flex-start' },
              { label: 'Center', value: 'center' },
              { label: 'End', value: 'flex-end' },
              { label: 'Stretch', value: 'stretch' },
            ],
            value: 'center',
          },
          {
            key: 'settings',
            header: 'Settings',
            type: 'checkbox-property',
            options: [
              { label: 'No gutter', name: 'noGutter' },
              { label: 'Fixed width', name: 'fixedWidth' },
              { label: 'Custom classes', name: 'customClasses' },
            ],
            value: { noGutter: false, fixedWidth: false, customClasses: false },
          },
        ],
      },
    ],
    '',
    'New Simple Container 1'
  );

  return {
    type: 'grid',
    isContainer: true,
    children: [headerContainer, filtersPanel].filter(Boolean),
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Toolbar container',
      },
      {
        key: 'settings',
        header: 'Settings',
        type: 'checkbox-property',
        options: [
          { label: 'No gutter', name: 'noGutter' },
          { label: 'Reverse rows', name: 'reverseRows' },
          { label: 'Reverse columns', name: 'reverseColumns' },
          { label: 'Custom classes', name: 'customClasses' },
        ],
        value: {
          noGutter: false,
          reverseRows: false,
          reverseColumns: false,
          customClasses: false,
        },
      },
    ],
  };
}

function unwrapUiBlocks(blocks) {
  const out = [];
  let filtersPanel = null;
  let tableCondition = null;

  for (const b of blocks) {
    if (b.type === 'render-template') continue;

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('prda-filters-wrap')
    ) {
      filtersPanel = unwrapFiltersWrap(b);
      continue;
    }

    if (isTableResultCondition(b)) {
      tableCondition = unwrapTableCondition(b);
      continue;
    }
  }

  if (filtersPanel || tableCondition) {
    if (filtersPanel) out.push(rebuildToolbarGrid(filtersPanel));
    if (tableCondition) out.push(tableCondition);
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
    if (block.type === 'data-source' || isFilterDataCondition(block)) {
      dataBlocks.push(block);
    } else if (block.type !== 'simple-container') {
      uiBlocks.push(block);
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
