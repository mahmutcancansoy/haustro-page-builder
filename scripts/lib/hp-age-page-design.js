const fs = require('fs');
const path = require('path');

const UI_TYPES = new Set(['grid', 'content-header', 'form-container']);
const STYLES_FILE = path.join(__dirname, '../../templates/arac-gerec-ekle-page-styles.css');

const PAGE_CONFIGS = {
  ekle: {
    pageId: '63388034b03e3600d0230e02',
    layoutName: 'Araç Gereç Ekle Layout',
    heroDisplayName: 'Araç Gereç Ekle — Bilgi',
    eyebrow: 'Envanter yönetimi',
    lead: 'Yeni araç veya gereç kaydı oluşturun. Seçtiğiniz kategoriye göre form alanları otomatik güncellenir.',
    defaultTitle: 'Araç Gereç Ekle',
  },
  duzenle: {
    pageId: '5ffa14bf4fe5a5010a30d142',
    layoutName: 'Araç Gereç Düzenle Layout',
    heroDisplayName: 'Araç Gereç Düzenle — Bilgi',
    eyebrow: 'Envanter yönetimi',
    lead: 'Kayıtlı araç veya gereç bilgilerini güncelleyin. Kategori ve envanter seçimine göre form alanları otomatik güncellenir.',
    defaultTitle: 'Araç Gereç Düzenle',
  },
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

function setGroupChild(block, groupKey, childKey, value) {
  const group = (block.properties || []).find((p) => p.key === groupKey);
  if (!group?.children) return;
  const child = group.children.find((c) => c.key === childKey);
  if (child) child.value = value;
}

function appendClass(block, key, className) {
  const current = String(propVal(block, key) || '').trim();
  if (!current.split(/\s+/).includes(className)) {
    setProp(block, key, `${current} ${className}`.trim());
  }
}

function enableSetting(block, settingKey) {
  const settings = prop(block, 'settings');
  if (settings?.value && typeof settings.value === 'object') {
    settings.value[settingKey] = true;
  }
}

function gridButtons(grid) {
  const texts = [];
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'button') texts.push(propVal(n, 'text') || '');
      if (n.children) walk(n.children);
    }
  }
  walk(grid.children);
  return texts;
}

function isToolbarGrid(grid) {
  const name = String(propVal(grid, 'display-name') || '').toLowerCase();
  if (name.includes('toolbar')) return true;
  const btns = gridButtons(grid);
  return btns.some((t) => t === 'Geri') && btns.some((t) => /yazdır/i.test(t));
}

function heroBlock(config) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="hp-age__intro">
  <span class="hp-age__eyebrow">${config.eyebrow}</span>
  <p class="hp-age__lead">${config.lead}</p>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: config.heroDisplayName,
      },
    ],
  };
}

function createHeader(text) {
  return {
    type: 'content-header',
    isContainer: false,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: text,
      },
      {
        key: 'classes',
        header: 'Classes',
        type: 'textarea-property',
        value: 'hp-age__header',
      },
      {
        key: 'text',
        header: 'Text',
        type: 'textarea-property',
        value: text,
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'bg-color',
        header: 'Background color',
        type: 'color-picker-property',
        value: '#ffffff',
      },
      {
        key: 'text-color',
        header: 'Text color',
        type: 'color-picker-property',
        value: '#586495',
      },
    ],
  };
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

function extractFormBlock(blocks) {
  const direct = blocks.find((b) => b.type === 'form-container');
  if (direct) return direct;
  const wrap = blocks.find(
    (b) =>
      b.type === 'simple-container' && prop(b, 'classes')?.value?.includes('hp-age__form')
  );
  return wrap?.children?.find((c) => c.type === 'form-container') || null;
}

function patchToolbarGrid(grid) {
  enableSetting(grid, 'customClasses');
  setProp(grid, 'custom-classes', 'hp-age__toolbar');
  setProp(grid, 'display-name', 'Üst Araç Çubuğu');
  return grid;
}

function patchProductGrid(grid) {
  enableSetting(grid, 'customClasses');
  setProp(grid, 'custom-classes', 'hp-age__product');
  const name = String(propVal(grid, 'display-name') || '');
  if (/üst araç|toolbar/i.test(name)) {
    setProp(grid, 'display-name', 'Product Block');
  }
  return grid;
}

function patchHeader(header) {
  setProp(header, 'classes', 'hp-age__header');
  setProp(header, 'bg-color', '#ffffff');
  setProp(header, 'text-color', '#586495');
  return header;
}

function patchForm(form) {
  const cat = (form.children || []).find((c) => c.type === 'template');
  if (cat) setProp(cat, 'classes', 'hp-age__category');
  return simpleContainer([form], 'hp-age__form', 'Araç Gereç Form Kartı');
}

/** Sıra: toolbar → bilgi → ek gridler → başlık → form */
function patchUiBlocks(blocks, config) {
  const grids = blocks.filter((b) => b.type === 'grid');
  const toolbarGrids = grids.filter(isToolbarGrid);
  const header = blocks.find((b) => b.type === 'content-header');
  const form = extractFormBlock(blocks);

  let otherGrids;
  if (toolbarGrids.length) {
    otherGrids = grids.filter((g) => !toolbarGrids.includes(g));
  } else if (grids.length) {
    toolbarGrids.push(grids[0]);
    otherGrids = grids.slice(1);
  } else {
    otherGrids = [];
  }

  if (otherGrids.length > 1) {
    const keep =
      otherGrids.find((g) => /product block/i.test(String(propVal(g, 'display-name') || ''))) ||
      otherGrids[otherGrids.length - 1];
    otherGrids = [keep];
  }

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(patchToolbarGrid(g));
  ordered.push(heroBlock(config));
  for (const g of otherGrids) ordered.push(patchProductGrid(g));
  if (header) ordered.push(patchHeader(header));
  else ordered.push(createHeader(config.defaultTitle));
  if (form) ordered.push(patchForm(form));
  return ordered;
}

function findLayoutWrapper(content) {
  return content.find(
    (b) =>
      b.type === 'simple-container' && prop(b, 'classes')?.value?.includes('hp-age-page')
  );
}

function unwrapUiBlocks(blocks) {
  const out = [];
  let toolbarKept = false;

  for (const b of blocks) {
    if (
      b.type === 'simple-container' &&
      prop(b, 'classes')?.value?.includes('hp-age__form')
    ) {
      const form = (b.children || []).find((c) => c.type === 'form-container');
      if (form) out.push(form);
      else out.push(b);
      continue;
    }
    if (b.type === 'render-template') continue;

    if (b.type === 'grid') {
      const cls = String(propVal(b, 'custom-classes') || '');
      const isToolbar = cls.includes('hp-age__toolbar') || isToolbarGrid(b);
      if (isToolbar) {
        if (toolbarKept) continue;
        toolbarKept = true;
      }
      out.push(b);
      continue;
    }

    if (b.type === 'content-header' || b.type === 'form-container') {
      out.push(b);
    }
  }
  return out;
}

/** Kategori modal — panel varsayılanı (özel stil / boyut yok) */
function patchKategoriModalBlock(modal) {
  setProp(modal, 'classes', '');
  setGroupChild(modal, 'openWay', 'openBtnClass', '');
  setGroupChild(modal, 'stylesGroups', 'maskStyleClass', '');
  setGroupChild(modal, 'stylesGroups', 'contentStyleClass', '');
  setGroupChild(modal, 'stylesGroups', 'contentStyle', '');
}

function patchKategoriModal(content) {
  function walk(blocks) {
    for (const b of blocks || []) {
      if (
        b.type === 'modal' &&
        /kategori düzenleme/i.test(
          String(propVal(b, 'display-name') || propVal(b, 'header') || '')
        )
      ) {
        patchKategoriModalBlock(b);
      }
      walk(b.children);
    }
  }
  walk(content);
  return content;
}

function applyLayout(content, config) {
  const existingWrap = findLayoutWrapper(content);
  if (existingWrap) {
    const inner = unwrapUiBlocks(existingWrap.children || []);
    existingWrap.children = patchUiBlocks(inner, config);
    setProp(existingWrap, 'display-name', config.layoutName);
    patchKategoriModal(content);
    return content;
  }

  const dataBlocks = [];
  const uiBlocks = [];

  for (const block of content) {
    if (UI_TYPES.has(block.type)) uiBlocks.push(block);
    else if (block.type !== 'simple-container') dataBlocks.push(block);
  }

  if (!uiBlocks.length) return content;

  const layout = simpleContainer(patchUiBlocks(uiBlocks, config), 'hp-age-page', config.layoutName);
  const merged = [...dataBlocks, layout];
  patchKategoriModal(merged);
  return merged;
}

function loadStyles() {
  return fs.readFileSync(STYLES_FILE, 'utf8').trim();
}

function getConfig(key) {
  const cfg = PAGE_CONFIGS[key];
  if (!cfg) {
    throw new Error(`Bilinmeyen sayfa: ${key}. Geçerli: ${Object.keys(PAGE_CONFIGS).join(', ')}`);
  }
  return cfg;
}

module.exports = {
  PAGE_CONFIGS,
  applyLayout,
  loadStyles,
  getConfig,
  patchKategoriModal,
};
