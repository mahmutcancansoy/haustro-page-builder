const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/kayip-raporu-detayi-page-extensions.css'
);
const PAGE_EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/transfer-detayi-page-extensions.css'
);
const HERO_FILE = path.join(__dirname, '../../templates/transfer-detayi-hero.html');

const PAGE_CONFIG = {
  pageId: '600386804fe5a5011d6ca482',
  layoutName: 'Transfer Detayı Layout',
};

const MAIN_FORM_NAME = 'Transfer Detayı';
const UI_TYPES = new Set(['grid', 'form-container', 'condition']);

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
  return btns.some((t) => t === 'Geri') && btns.some((t) => /yazdır|print/i.test(t));
}

function isProductBlockGrid(grid) {
  return grid.type === 'grid' && propVal(grid, 'display-name') === 'Product Block';
}

function isRootActionCondition(block) {
  if (block.type !== 'condition') return false;
  if (propVal(block, 'display-name') !== 'status check') return false;
  return (block.children || []).some((c) => c.type === 'form-container');
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
  <div class="ass__list-head-icon"><i class="pi pi-sync"></i></div>
  <div>
    <h2>Transfer Bilgileri</h2>
    <p>Envanter, miktar, gönderen / alan şube ve transfer durumu.</p>
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

function actionHeadBlock(title, description, icon) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__action-head">
  <div class="ass__action-head-icon"><i class="pi ${icon}"></i></div>
  <div>
    <h2>${title}</h2>
    <p>${description}</p>
  </div>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: `${title} başlık`,
      },
    ],
  };
}

function actionMeta(formName) {
  if (formName === 'Teslim Aldım Formu') {
    return {
      title: 'Teslim Aldım',
      description: 'Transferi teslim aldığınızı onaylayın ve açıklama ekleyin.',
      icon: 'pi-download',
    };
  }
  if (formName === 'Teslim Ettim Formu') {
    return {
      title: 'Teslim Ettim',
      description: 'Transferi teslim ettiğinizi onaylayın ve açıklama ekleyin.',
      icon: 'pi-upload',
    };
  }
  return {
    title: formName,
    description: 'Transfer işlemini tamamlamak için formu doldurun.',
    icon: 'pi-check',
  };
}

function wrapDetailForm(form) {
  return simpleContainer([detailHeadBlock(), form], 'ass__detail-card', 'Transfer detay kartı');
}

function wrapActionCondition(cond) {
  const form = (cond.children || []).find((c) => c.type === 'form-container');
  const formName = propVal(form, 'display-name') || 'İşlem';
  const meta = actionMeta(formName);
  return simpleContainer(
    [actionHeadBlock(meta.title, meta.description, meta.icon), cond],
    'ass__action-card',
    `${formName} kartı`
  );
}

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const mainForm = blocks.find(
    (b) => b.type === 'form-container' && propVal(b, 'display-name') === MAIN_FORM_NAME
  );
  const actionConditions = blocks.filter(isRootActionCondition);

  for (const g of toolbarGrids) setGridClass(g, 'ass__toolbar');

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(heroBlock());
  if (mainForm) ordered.push(wrapDetailForm(mainForm));
  for (const cond of actionConditions) ordered.push(wrapActionCondition(cond));

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
      String(propVal(b, 'classes') || '').includes('ass__detail-card')
    ) {
      const form = (b.children || []).find((c) => c.type === 'form-container');
      if (form) out.push(form);
      continue;
    }

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__action-card')
    ) {
      const cond = (b.children || []).find((c) => c.type === 'condition');
      if (cond) out.push(cond);
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

    if (b.type === 'form-container' || b.type === 'condition') {
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
  const krdExt = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  const pageExt = fs.readFileSync(PAGE_EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${krdExt}\n\n${pageExt}`;
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
