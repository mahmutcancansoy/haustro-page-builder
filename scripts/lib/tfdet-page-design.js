const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/tedarik-faturasi-detay-page-extensions.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/tedarik-faturasi-detay-hero.html'
);

const PAGE_CONFIG = {
  pageId: '697204055170eb0120749092',
  layoutName: 'Tedarik Faturası Detay Layout',
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
  if (p) {
    p.value = value;
    return;
  }
  block.properties = block.properties || [];
  block.properties.push({
    key,
    header: key,
    type: key === 'custom-classes' ? 'textarea-property' : 'input-text-property',
    value,
  });
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

function patchButtonSettings(block, patch) {
  const settings = prop(block, 'settings');
  if (!settings) return;
  if (!settings.value || typeof settings.value !== 'object') settings.value = {};
  Object.assign(settings.value, patch);
}

function applyButton(block, cfg) {
  if (cfg.classes != null) setProp(block, 'classes', cfg.classes);
  if (cfg.severity != null) setProp(block, 'severity', cfg.severity);
  if (cfg.size != null) setProp(block, 'size', cfg.size);
  if (cfg.icon != null) setProp(block, 'icon', cfg.icon);
  if (cfg.iconPosition != null) setProp(block, 'icon-position', cfg.iconPosition);
  if (cfg.settings) patchButtonSettings(block, cfg.settings);
}

function patchToolbarButtons(toolbar) {
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'button') {
        const name = String(propVal(n, 'display-name') || '');
        const text = String(propVal(n, 'text') || '');
        if (name === 'Geri' || text === 'Geri') {
          applyButton(n, {
            classes: '',
            severity: 'p-button-secondary',
            size: 'p-button',
            icon: 'pi pi-chevron-left',
            iconPosition: 'left',
            settings: {
              hasIcon: true,
              textButton: true,
              hasOutline: false,
              rounded: false,
            },
          });
        }
      }
      walk(n.children);
    }
  }
  walk(toolbar.children);
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

function heroBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: fs.readFileSync(HERO_FILE, 'utf8').trim(),
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
  <div class="ass__list-head-icon"><i class="pi pi-file"></i></div>
  <div>
    <h2>Fatura Bilgileri</h2>
    <p>Tedarikçi, tutar ve fatura kalemleri.</p>
  </div>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Detay başlık',
      },
    ],
  };
}

function wrapDetailForm(form) {
  // kalem container'larına class ekle (inline styles kalsın ama CSS override eder)
  function markLineItems(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'simple-container') {
        const cls = String(propVal(n, 'classes') || '');
        if (!cls.includes('tf-line-item')) {
          setProp(n, 'classes', (cls ? cls + ' ' : '') + 'tf-line-item');
        }
      }
      markLineItems(n.children);
    }
  }
  markLineItems(form.children);
  return simpleContainer([detailHeadBlock(), form], 'ass__detail-card', 'Fatura detay kartı');
}

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const form = blocks.find((b) => b.type === 'form-container');

  for (const g of toolbarGrids) {
    setGridClass(g, 'ass__toolbar');
    patchToolbarButtons(g);
  }

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

function unwrapUiBlocks(blocks) {
  const out = [];
  let toolbarKept = false;

  for (const b of blocks) {
    if (b.type === 'render-template') continue;
    if (b.type === 'content-header') continue;

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__detail-card')
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
      }
      out.push(b);
      continue;
    }

    if (b.type === 'form-container') out.push(b);
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
    if (block.type === 'data-source') {
      dataBlocks.push(block);
    } else if (block.type === 'content-header') {
      // hero ile değiştirilir
      continue;
    } else if (
      block.type === 'grid' ||
      block.type === 'form-container' ||
      block.type === 'condition'
    ) {
      uiBlocks.push(block);
    } else if (block.type === 'simple-container') {
      const cls = String(propVal(block, 'classes') || '');
      if (!cls.includes('ass-page')) uiBlocks.push(block);
    } else {
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
  return `${base}\n\n${ext}\n`;
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
