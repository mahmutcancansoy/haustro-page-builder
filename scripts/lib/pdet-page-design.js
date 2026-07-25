const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const SECTIONS_EXT_FILE = path.join(
  __dirname,
  '../../templates/depo-sube-detayi-page-extensions.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/personel-detay-page-extensions.css'
);

const PAGE_CONFIG = {
  pageId: '605a92344fe5a5001c725afb',
  layoutName: 'Personel Detay Layout',
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

function setColumnClass(column, className) {
  enableSetting(column, 'customClasses');
  setProp(column, 'custom-classes', className);
}

function isToolbarGrid(grid) {
  if (grid.type !== 'grid') return false;
  const name = String(propVal(grid, 'display-name') || '').toLowerCase();
  if (name.includes('toolbar')) {
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

function sectionsHeadBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__list-head">
  <div class="ass__list-head-icon"><i class="pi pi-folder-open"></i></div>
  <div>
    <h2>Personel dosyası</h2>
    <p>Özlük bilgileri, eğitimler, zimmetler, puantaj ve çıkış işlemleri.</p>
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

function columnHasNameLabel(column) {
  return (column.children || []).some(
    (c) => c.type === 'label' && propVal(c, 'display-name') === 'Users Name'
  );
}

function patchProductGrid(grid) {
  setGridClass(grid, 'ass__profile-product');
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'image' && propVal(n, 'display-name') === 'Product Image') {
        setProp(n, 'classes', 'ass__profile-img');
        setProp(n, 'width', '');
        setProp(n, 'height', '');
      }
      if (n.type === 'label' && propVal(n, 'display-name') === 'Users Name') {
        setProp(n, 'classes', 'ass__profile-name');
      }
      if (n.type === 'grid' && propVal(n, 'display-name') === 'Details Inner Container') {
        setGridClass(n, 'ass__profile-details');
        for (const col of n.children || []) {
          if (col.type !== 'column') continue;
          if (columnHasNameLabel(col)) {
            setColumnClass(col, 'ass__profile-name-row');
          } else {
            setColumnClass(col, 'ass__profile-stat');
          }
        }
      }
      if (n.type === 'column') {
        const dn = propVal(n, 'display-name');
        if (dn === 'Details Container') {
          setColumnClass(n, 'ass__profile-main');
        } else if (dn === 'Image Container') {
          setColumnClass(n, 'ass__profile-media');
          const settings = prop(n, 'settings');
          if (settings?.value) settings.value.fixedWidth = false;
          setProp(n, 'width', '');
        } else {
          const hasImage = (n.children || []).some((c) => c.type === 'image');
          if (hasImage) setColumnClass(n, 'ass__profile-media');
        }
      }
      walk(n.children);
    }
  }
  walk(grid.children);
  return grid;
}

function wrapProduct(grid) {
  return simpleContainer([patchProductGrid(grid)], 'ass__profile-card', 'Profil kartı');
}

function styleAccordion(accordion) {
  setProp(accordion, 'classes', 'ass__accordion');
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
  const productGrid = blocks.find(isProductContainerGrid);
  const accordion = blocks.find((b) => b.type === 'acordion');

  for (const g of toolbarGrids) setGridClass(g, 'ass__toolbar');

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  if (productGrid) ordered.push(wrapProduct(productGrid));
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
      String(propVal(b, 'classes') || '').includes('ass__profile-card')
    ) {
      const product = (b.children || []).find(isProductContainerGrid);
      if (product) {
        setProp(product, 'custom-classes', '');
        const settings = prop(product, 'settings');
        if (settings?.value) settings.value.customClasses = false;
        function walk(nodes) {
          for (const n of nodes || []) {
            if (n.type === 'image' && propVal(n, 'classes') === 'ass__profile-img') {
              setProp(n, 'classes', '');
            }
            if (n.type === 'label' && propVal(n, 'classes') === 'ass__profile-name') {
              setProp(n, 'classes', '');
            }
            if (n.type === 'column') {
              const cls = String(propVal(n, 'custom-classes') || '');
              if (
                cls.includes('ass__profile-media') ||
                cls.includes('ass__profile-main') ||
                cls.includes('ass__profile-stat') ||
                cls.includes('ass__profile-name-row')
              ) {
                setProp(n, 'custom-classes', '');
                const settings = prop(n, 'settings');
                if (settings?.value) settings.value.customClasses = false;
              }
            }
            if (n.type === 'grid') {
              const cls = String(propVal(n, 'custom-classes') || '');
              if (cls.includes('ass__profile-details')) {
                setProp(n, 'custom-classes', '');
                const settings = prop(n, 'settings');
                if (settings?.value) settings.value.customClasses = false;
              }
            }
            walk(n.children);
          }
        }
        walk(product.children);
        out.push(product);
      }
      continue;
    }

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
    if (block.type === 'data-source' || block.type === 'condition') {
      dataBlocks.push(block);
    } else if (UI_TYPES.has(block.type)) {
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
  const sections = fs.readFileSync(SECTIONS_EXT_FILE, 'utf8').trim();
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${sections}\n\n${ext}`;
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
