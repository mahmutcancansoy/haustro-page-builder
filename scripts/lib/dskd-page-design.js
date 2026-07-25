const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/devirsiz-sayim-karsilastirma-detayi-page-extensions.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/devirsiz-sayim-karsilastirma-detayi-hero.html'
);

const PAGE_CONFIG = {
  pageId: '646cae3fb03e3600da4b51da',
  layoutName: 'Devirsiz Sayım Karşılaştırma Detayı Layout',
};

const UI_TYPES = new Set(['grid', 'form-container', 'content-header']);

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
  return btns.some((t) => t === 'Geri');
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

function loadHeroHtml() {
  return fs.readFileSync(HERO_FILE, 'utf8').trim();
}

function heroBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: loadHeroHtml(),
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

function detailHeadBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__list-head">
  <div class="ass__list-head-icon"><i class="pi pi-table"></i></div>
  <div>
    <h2>Envanter karşılaştırması</h2>
    <p>Önceki ve güncel dönem adet / fiyat farkları envanter bazında listelenir.</p>
  </div>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Tablo başlık',
      },
    ],
  };
}

function patchCompareForm(form) {
  const headerGrid = (form.children || []).find((c) => c.type === 'grid');
  const loop = (form.children || []).find((c) => c.type === 'loop');

  if (headerGrid) setGridClass(headerGrid, 'ass__compare-head');

  if (loop) {
    setProp(loop, 'classes', 'ass__compare-loop');
    for (const row of loop.children || []) {
      if (row.type === 'grid') setGridClass(row, 'ass__compare-row');
    }
  }

  const tableChildren = [headerGrid, loop].filter(Boolean);
  if (!tableChildren.length) return form;

  const tableWrap = simpleContainer(tableChildren, 'ass__compare-table', 'Karşılaştırma tablosu');
  form.children = [tableWrap];
  return form;
}

function wrapDetailForm(form) {
  return simpleContainer(
    [detailHeadBlock(), patchCompareForm(form)],
    'ass__detail-card',
    'Karşılaştırma kartı'
  );
}

function patchDataSource(blocks) {
  for (const b of blocks) {
    if (b.type !== 'data-source') continue;
    const settings = prop(b, 'settings');
    if (settings?.value) settings.value.debug = false;
  }
}

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const form = blocks.find((b) => b.type === 'form-container');

  for (const g of toolbarGrids) setGridClass(g, 'ass__toolbar');

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(heroBlock());
  if (form) ordered.push(wrapDetailForm(form));

  return ordered;
}

function findLayoutWrapper(content) {
  return content.find(
    (b) =>
      b.type === 'simple-container' && prop(b, 'classes')?.value?.includes('ass-page')
  );
}

function unwrapCompareForm(form) {
  const tableWrap = (form.children || []).find(
    (c) =>
      c.type === 'simple-container' &&
      String(propVal(c, 'classes') || '').includes('ass__compare-table')
  );

  if (!tableWrap) return form;

  const children = [];
  for (const c of tableWrap.children || []) {
    if (c.type === 'grid') {
      setProp(c, 'custom-classes', '');
      const settings = prop(c, 'settings');
      if (settings?.value) settings.value.customClasses = false;
      children.push(c);
      continue;
    }
    if (c.type === 'loop') {
      setProp(c, 'classes', '');
      for (const row of c.children || []) {
        if (row.type === 'grid') {
          setProp(row, 'custom-classes', '');
          const settings = prop(row, 'settings');
          if (settings?.value) settings.value.customClasses = false;
        }
      }
      children.push(c);
    }
  }

  form.children = children;
  return form;
}

function unwrapUiBlocks(blocks) {
  const out = [];
  let toolbarKept = false;

  for (const b of blocks) {
    if (b.type === 'render-template') continue;

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__detail-card')
    ) {
      const form = (b.children || []).find((c) => c.type === 'form-container');
      if (form) out.push(unwrapCompareForm(form));
      continue;
    }

    if (b.type === 'content-header') {
      out.push(b);
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

    if (b.type === 'form-container') {
      out.push(unwrapCompareForm(b));
    }
  }

  return out;
}

function applyLayout(content) {
  patchDataSource(content);

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
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${ext}`;
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
