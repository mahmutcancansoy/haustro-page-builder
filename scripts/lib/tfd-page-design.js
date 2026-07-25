const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/tedarik-faturasi-detayi-page-extensions.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/tedarik-faturasi-detayi-hero.html'
);

const PAGE_CONFIG = {
  pageId: '6001b50a4fe5a50074123ed2',
  layoutName: 'Tedarik Faturası Detayı Layout',
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
        } else if (/yazdır/i.test(text) || /printer/i.test(String(propVal(n, 'icon') || ''))) {
          applyButton(n, {
            classes: '',
            severity: 'p-button-success',
            size: 'p-button-sm',
            icon: 'mdi mdi-printer mdi-18px',
            iconPosition: 'left',
            settings: {
              hasIcon: true,
              textButton: false,
              hasOutline: true,
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
  return btns.some((t) => t === 'Geri') && btns.some((t) => /yazdır|print/i.test(t));
}

function isProductBlockGrid(grid) {
  return grid.type === 'grid' && propVal(grid, 'display-name') === 'Product Block';
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

function detailHeadBlock(isService) {
  const title = isService ? 'Hizmet Fatura Bilgileri' : 'Envanter Fatura Bilgileri';
  const sub = isService
    ? 'Hizmet, tedarikçi, tutar, ödeme durumu ve fatura taraması.'
    : 'Ürün, stok, tedarikçi, tutar, ödeme durumu ve fatura taraması.';
  const icon = isService ? 'pi pi-cog' : 'pi pi-box';

  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__list-head">
  <div class="ass__list-head-icon"><i class="${icon}"></i></div>
  <div>
    <h2>${title}</h2>
    <p>${sub}</p>
  </div>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: isService ? 'Hizmet detay başlık' : 'Envanter detay başlık',
      },
    ],
  };
}

function wrapDetailForm(form, isService) {
  return simpleContainer(
    [detailHeadBlock(isService), form],
    'ass__detail-card',
    isService ? 'Hizmet fatura kartı' : 'Envanter fatura kartı'
  );
}

function patchCondition(condition) {
  const name = String(propVal(condition, 'display-name') || '');
  const isService = /hizmet/i.test(name);
  const form = (condition.children || []).find((c) => c.type === 'form-container');
  if (!form) return condition;
  condition.children = [wrapDetailForm(form, isService)];
  return condition;
}

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const conditions = blocks.filter((b) => b.type === 'condition');

  for (const g of toolbarGrids) {
    setGridClass(g, 'ass__toolbar');
    patchToolbarButtons(g);
  }

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(heroBlock());
  for (const c of conditions) ordered.push(patchCondition(c));

  return ordered;
}

function findLayoutWrapper(content) {
  return content.find(
    (b) =>
      b.type === 'simple-container' && prop(b, 'classes')?.value?.includes('ass-page')
  );
}

function unwrapCondition(condition) {
  const outChildren = [];
  for (const child of condition.children || []) {
    if (
      child.type === 'simple-container' &&
      String(propVal(child, 'classes') || '').includes('ass__detail-card')
    ) {
      const form = (child.children || []).find((c) => c.type === 'form-container');
      if (form) outChildren.push(form);
      continue;
    }
    if (child.type === 'form-container') outChildren.push(child);
    // Product Block ve RT başlık atılır
  }
  condition.children = outChildren;
  return condition;
}

function unwrapUiBlocks(blocks) {
  const out = [];
  let toolbarKept = false;

  for (const b of blocks) {
    if (b.type === 'render-template') continue;

    if (b.type === 'condition') {
      out.push(unwrapCondition(b));
      continue;
    }

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__detail-card')
    ) {
      const form = (b.children || []).find((c) => c.type === 'form-container');
      if (form) out.push(form);
      continue;
    }

    if (b.type === 'grid') {
      if (isProductBlockGrid(b)) continue;

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
    } else if (
      block.type === 'grid' ||
      block.type === 'condition' ||
      block.type === 'form-container'
    ) {
      uiBlocks.push(block);
    } else if (block.type === 'simple-container') {
      // eski tf-product-block vb. atlanır; form/condition içinden çıkarılacak değil
      const cls = String(propVal(block, 'classes') || '');
      if (cls.includes('ass-page')) {
        // handled above
      } else {
        uiBlocks.push(block);
      }
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
