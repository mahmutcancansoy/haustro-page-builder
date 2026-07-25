const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/depo-sube-detayi-page-extensions.css'
);
const HERO_FILE = path.join(__dirname, '../../templates/depo-sube-detayi-hero.html');

const PAGE_CONFIG = {
  pageId: '604517cb4fe5a500660a9642',
  layoutName: 'Depo / Şube Detayı Layout',
};

const UI_TYPES = new Set(['grid', 'acordion']);

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
  return btns.some((t) => t === 'Geri') && btns.some((t) => /düzenle|edit/i.test(t));
}

function isProductContainerGrid(grid) {
  return grid.type === 'grid' && propVal(grid, 'display-name') === 'Product Container';
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

function sectionsHeadBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__list-head">
  <div class="ass__list-head-icon"><i class="pi pi-th-large"></i></div>
  <div>
    <h2>Şube içeriği</h2>
    <p>Envanterler, transferler, sayım raporları ve aylık sonuçlar.</p>
  </div>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Bölüm başlık',
      },
    ],
  };
}

function patchTransferSummaryLabels(blocks) {
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'label') {
        const text = String(propVal(n, 'text') || '');
        if (text.includes('Transferler Toplam Fiyat')) {
          setProp(n, 'classes', 'ass__transfer-summary');
          const styles = prop(n, 'styles');
          const colorProp = styles?.children?.find((c) => c.key === 'color');
          if (colorProp) colorProp.value = '#4557a3';
        }
      }
      walk(n.children);
    }
  }
  walk(blocks);
}

function styleAccordion(accordion) {
  if (!accordion) return accordion;
  setProp(accordion, 'classes', 'ass__accordion');
  patchTransferSummaryLabels(accordion.children);
  return accordion;
}

function wrapAccordion(accordion) {
  return simpleContainer(
    [sectionsHeadBlock(), styleAccordion(accordion)],
    'ass__sections-card',
    'Bölümler kartı'
  );
}

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const accordion = blocks.find((b) => b.type === 'acordion');

  for (const g of toolbarGrids) setGridClass(g, 'ass__toolbar');

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(heroBlock());
  if (accordion) ordered.push(wrapAccordion(accordion));

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
      String(propVal(b, 'classes') || '').includes('ass__sections-card')
    ) {
      const accordion = (b.children || []).find((c) => c.type === 'acordion');
      if (accordion) {
        setProp(accordion, 'classes', '');
        out.push(accordion);
      }
      continue;
    }

    if (b.type === 'grid') {
      if (isProductContainerGrid(b)) {
        out.push(b);
        continue;
      }

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

    if (b.type === 'acordion') {
      setProp(b, 'classes', '');
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
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${ext}`;
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
