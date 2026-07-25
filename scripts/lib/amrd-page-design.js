const fs = require('fs');
const path = require('path');

const STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-maliyet-raporu-detayi-page-styles.css'
);
const METRICS_TABLE_FILE = path.join(
  __dirname,
  '../../templates/aylik-maliyet-raporu-detayi-metrics-table.html'
);
const META_LINKS_FILE = path.join(
  __dirname,
  '../../templates/aylik-maliyet-raporu-detayi-meta-links.html'
);

const METRICS_RT_NAME = 'Metrik tablosu';
const META_RT_NAME = 'Sayfa linkleri';

const PAGE_CONFIG = {
  pageId: '64231193b03e360018567e62',
  layoutName: 'Aylık Maliyet Raporu Detayı Layout',
};

const UI_TYPES = new Set(['grid', 'page-header', 'form-container', 'condition']);

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

function isToolbarGrid(grid) {
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
  return btns.some((t) => t === 'Geri') && btns.some((t) => /yazdır/i.test(t));
}

function isMetaGrid(grid) {
  const name = String(propVal(grid, 'display-name') || '');
  if (!/^Row1/i.test(name)) return false;
  // Şube ve dönem hero bandında gösterilir
  return name !== 'Row1' && name !== 'Row1 Copy';
}

function isMetricsGrid(grid) {
  if (grid.type !== 'grid') return false;
  const name = String(propVal(grid, 'display-name') || '');
  if (name !== 'Row1') return false;
  const cols = grid.children || [];
  if (cols.length < 6) return false;
  const texts = cols.flatMap((col) =>
    (col.children || [])
      .filter((c) => c.type === 'label')
      .map((c) => String(propVal(c, 'text') || ''))
  );
  return texts.some((t) => t.includes('Açılış Envanteri'));
}

function isActionsGrid(grid) {
  return String(propVal(grid, 'display-name') || '') === 'New Grid 2';
}

function isReportsCondition(block) {
  return block.type === 'condition' && propVal(block, 'display-name') === 'report not empty';
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
    content: `<div class="amrd__hero">
  <div class="amrd__hero-main">
    <span class="amrd__eyebrow">Maliyet kontrol</span>
    <h1>Aylık Maliyet Raporu Detayı</h1>
    <p class="amrd__hero-sub">{{monthlyCostReports.:departments:.label}} ({{monthlyCostReports.:departments:.short}}) · {{monthlyCostReports.period}}</p>
  </div>
  <div class="amrd__hero-status">
    {{#cIf monthlyCostReports.confirmation "==" "done"}}
      <span class="amrd__badge amrd__badge--done"><i class="pi pi-check-circle"></i> Rapor onaylandı</span>
    {{/cIf}}
    {{#cIf monthlyCostReports.confirmation "==" "manager"}}
      <span class="amrd__badge amrd__badge--pending"><i class="pi pi-clock"></i> Müdür onayı bekliyor</span>
    {{/cIf}}
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

function metricsHeadBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="amrd__metrics-head">
  <div class="amrd__metrics-head-icon"><i class="pi pi-chart-bar"></i></div>
  <div>
    <h2>Maliyet Raporu Sonucu</h2>
    <p>Açılış ve kapanış envanteri arasındaki hareket özeti</p>
  </div>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Metrik başlık',
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

function loadMetricsTableHtml() {
  return fs.readFileSync(METRICS_TABLE_FILE, 'utf8').trim();
}

function loadMetaLinksHtml() {
  return fs.readFileSync(META_LINKS_FILE, 'utf8').trim();
}

function metaLinksBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: loadMetaLinksHtml(),
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: META_RT_NAME,
      },
    ],
  };
}

function metricsTableBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: loadMetricsTableHtml(),
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: METRICS_RT_NAME,
      },
    ],
  };
}

function replaceMetricsWithTemplate(form) {
  const formGroup = (form.children || []).find((c) => c.type === 'form-group-container');
  if (!formGroup) return;

  const existing = (formGroup.children || []).find(
    (b) => b.type === 'render-template' && propVal(b, 'display-name') === METRICS_RT_NAME
  );
  if (existing) {
    existing.content = loadMetricsTableHtml();
    return;
  }

  const metricsGrid = (formGroup.children || []).find(isMetricsGrid);
  const scrollWrap = (formGroup.children || []).find(
    (c) =>
      c.type === 'simple-container' &&
      String(propVal(c, 'classes') || '').includes('amrd__metrics-scroll')
  );
  const rest = (formGroup.children || []).filter(
    (c) => c !== metricsGrid && c !== scrollWrap
  );

  formGroup.children = [metricsTableBlock(), ...rest];
}

function wrapMetricsForm(form) {
  replaceMetricsWithTemplate(form);

  const formGroup = (form.children || []).find((c) => c.type === 'form-group-container');
  for (const b of formGroup?.children || []) {
    if (isActionsGrid(b)) setGridClass(b, 'amrd__actions');
  }

  return simpleContainer(
    [metricsHeadBlock(), form],
    'amrd__metrics-card',
    'Maliyet metrik kartı'
  );
}

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const pageHeader = blocks.find((b) => b.type === 'page-header');
  const form = blocks.find((b) => b.type === 'form-container');

  if (pageHeader) hidePageHeader(pageHeader);

  for (const g of toolbarGrids) setGridClass(g, 'amrd__toolbar');

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(heroBlock());
  ordered.push(simpleContainer([metaLinksBlock()], 'amrd__meta-card', 'Rapor linkleri'));

  if (form) ordered.push(wrapMetricsForm(form));

  return ordered;
}

function findLayoutWrapper(content) {
  return content.find(
    (b) =>
      b.type === 'simple-container' && prop(b, 'classes')?.value?.includes('amrd-page')
  );
}

function unwrapUiBlocks(blocks) {
  const out = [];
  let toolbarKept = false;

  for (const b of blocks) {
    if (b.type === 'render-template') continue;

    if (isReportsCondition(b)) continue;

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('amrd__meta-card')
    ) {
      continue;
    }

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('amrd__metrics-card')
    ) {
      const form = (b.children || []).find((c) => c.type === 'form-container');
      if (form) out.push(form);
      continue;
    }

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('amrd__logs-card')
    ) {
      continue;
    }

    if (b.type === 'grid') {
      const cls = String(propVal(b, 'custom-classes') || '');
      const isToolbar = cls.includes('amrd__toolbar') || isToolbarGrid(b);
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
    if (isReportsCondition(block)) continue;
    if (UI_TYPES.has(block.type) || block.type === 'page-header') {
      uiBlocks.push(block);
    } else if (block.type !== 'simple-container') {
      dataBlocks.push(block);
    }
  }

  if (!uiBlocks.length) return content;

  const layout = simpleContainer(patchUiBlocks(uiBlocks), 'amrd-page', PAGE_CONFIG.layoutName);
  return [...dataBlocks, layout];
}

function loadStyles() {
  return fs.readFileSync(STYLES_FILE, 'utf8').trim();
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
