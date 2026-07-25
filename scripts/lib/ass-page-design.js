const fs = require('fs');
const path = require('path');

const STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const INVENTORY_LIST_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-inventory-list.html'
);

const INVENTORY_RT_NAME = 'Envanter listesi';

const PAGE_CONFIG = {
  pageId: '6422faf0b03e36001574f605',
  layoutName: 'Aylık Sayım Sonucu Layout',
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
  return btns.some((t) => t === 'Geri') && btns.some((t) => /excel|yazdır/i.test(t));
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
    <span class="ass__eyebrow">Envanter sayımı</span>
    <h1>Aylık Sayım Sonucu</h1>
    <p class="ass__hero-sub">{{departments.label}}{{#if departments.short}} ({{departments.short}}){{/if}} · {{getMonthlyCountings.period}}</p>
  </div>
  <div class="ass__hero-meta">
    <span class="ass__chip"><i class="pi pi-building"></i> {{departments.label}}</span>
    <span class="ass__chip"><i class="pi pi-calendar"></i> {{getMonthlyCountings.period}}</span>
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
  <div class="ass__list-head-icon"><i class="pi pi-list"></i></div>
  <div>
    <h2>Sayım Kalemleri</h2>
    <p>Her envanter satırına tıklayarak detay sayfasına gidebilirsiniz.</p>
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

function loadInventoryListHtml() {
  return fs.readFileSync(INVENTORY_LIST_FILE, 'utf8').trim();
}

function inventoryListBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: loadInventoryListHtml(),
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: INVENTORY_RT_NAME,
      },
    ],
  };
}

function replaceLoopWithTemplate(form) {
  const loop = (form.children || []).find((c) => c.type === 'loop');
  const existing = (form.children || []).find(
    (b) => b.type === 'render-template' && propVal(b, 'display-name') === INVENTORY_RT_NAME
  );

  if (existing) {
    existing.content = loadInventoryListHtml();
    if (loop) {
      setGridClass(loop.children?.[0], 'ass__legacy-row');
    }
    return;
  }

  if (loop) {
    form.children = (form.children || []).filter((c) => c !== loop);
  }

  form.children = [inventoryListBlock(), ...(form.children || [])];
}

function wrapListForm(form) {
  replaceLoopWithTemplate(form);
  return simpleContainer([listHeadBlock(), form], 'ass__list-card', 'Sayım listesi kartı');
}

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const pageHeader = blocks.find((b) => b.type === 'page-header');
  const form = blocks.find((b) => b.type === 'form-container');

  if (pageHeader) hidePageHeader(pageHeader);

  for (const g of toolbarGrids) setGridClass(g, 'ass__toolbar');

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(heroBlock());
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
      String(propVal(b, 'classes') || '').includes('ass__list-card')
    ) {
      const form = (b.children || []).find((c) => c.type === 'form-container');
      if (form) out.push(form);
      continue;
    }

    if (b.type === 'grid') {
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
  return fs.readFileSync(STYLES_FILE, 'utf8').trim();
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
