const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/personeller-page-extensions.css'
);

const PAGE_CONFIGS = {
  personeller: {
    pageId: '6031be124fe5a500cf780045',
    layoutName: 'Personeller Layout',
    templateBase: 'personeller',
    hero: {
      eyebrow: 'İnsan kaynakları',
      title: 'Personeller',
      sub: 'Aktif personel özlük dosyalarını listeleyin ve detay sayfasına gidin.',
      chip: 'Personel listesi',
      chipIcon: 'pi-users',
    },
    list: {
      title: 'Personel kayıtları',
      sub: 'Sütun başlıklarındaki filtrelerle arama yapabilirsiniz.',
      icon: 'pi-id-card',
    },
    tableWrapName: 'Personel tablosu',
  },
  arsiv: {
    pageId: '657f974db03e36038b125101',
    layoutName: 'Personeller Arşiv Layout',
    templateBase: 'personeller-arsiv',
    hero: {
      eyebrow: 'İnsan kaynakları',
      title: 'Çıkışı Yapılan Personeller',
      sub: 'İşten ayrılan personellerin özlük kayıtlarını görüntüleyin ve detay sayfasına gidin.',
      chip: 'Personel arşivi',
      chipIcon: 'pi-inbox',
    },
    list: {
      title: 'Arşiv kayıtları',
      sub: 'Sütun başlıklarındaki filtrelerle arama yapabilirsiniz.',
      icon: 'pi-briefcase',
    },
    tableWrapName: 'Arşiv tablosu',
  },
};

function getConfig(key) {
  const cfg = PAGE_CONFIGS[key];
  if (!cfg) {
    throw new Error(`Bilinmeyen sayfa: ${key}. Geçerli: ${Object.keys(PAGE_CONFIGS).join(', ')}`);
  }
  return cfg;
}

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

function heroBlock(config) {
  const h = config.hero;
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__hero">
  <div class="ass__hero-main">
    <span class="ass__eyebrow">${h.eyebrow}</span>
    <h1>${h.title}</h1>
    <p class="ass__hero-sub">${h.sub}</p>
  </div>
  <div class="ass__hero-meta">
    <span class="ass__chip"><i class="pi ${h.chipIcon}"></i> ${h.chip}</span>
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

function listHeadBlock(config) {
  const l = config.list;
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__list-head">
  <div class="ass__list-head-icon"><i class="pi ${l.icon}"></i></div>
  <div>
    <h2>${l.title}</h2>
    <p>${l.sub}</p>
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

function gridHasOnlyPageHeader(grid) {
  if (grid.type !== 'grid') return false;
  let hasHeader = false;
  let hasOther = false;
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'page-header') hasHeader = true;
      else if (n.type === 'button') hasOther = true;
      else if (n.type !== 'column' && n.type !== 'grid') hasOther = true;
      walk(n.children);
    }
  }
  walk(grid.children);
  return hasHeader && !hasOther;
}

function wrapTable(table, config) {
  appendClass(table, 'classes', 'ass__data-table');
  return simpleContainer(
    [listHeadBlock(config), table],
    'ass__list-card',
    config.tableWrapName
  );
}

function patchUiBlocks(blocks, config) {
  const table = blocks.find((b) => b.type === 'table');
  const headerGrid = blocks.find((b) => b.type === 'grid' && gridHasOnlyPageHeader(b));

  if (headerGrid) {
    function walk(nodes) {
      for (const n of nodes || []) {
        if (n.type === 'page-header') hidePageHeader(n);
        walk(n.children);
      }
    }
    walk(headerGrid.children);
  }

  const ordered = [heroBlock(config)];
  if (table) ordered.push(wrapTable(table, config));
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

  for (const b of blocks) {
    if (b.type === 'render-template') continue;

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__list-card')
    ) {
      const table = (b.children || []).find((c) => c.type === 'table');
      if (table) {
        const cls = String(propVal(table, 'classes') || '')
          .replace(/\bass__data-table\b/g, '')
          .trim();
        setProp(table, 'classes', cls);
        out.push(table);
      }
      continue;
    }

    if (b.type === 'table') {
      out.push(b);
    }
  }

  return out;
}

function findTable(blocks) {
  for (const b of blocks || []) {
    if (b.type === 'table') return b;
    const nested = findTable(b.children);
    if (nested) return nested;
  }
  return null;
}

function buildDeptOptions(depts) {
  return depts
    .map((d) => ({
      value: d._id.toString(),
      label: d.short ? `${d.label} (${d.short})` : d.label,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
}

function buildRoleOptions(roles) {
  return roles
    .map((r) => ({
      value: r._id.toString(),
      label: r.description || r.name || String(r._id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'tr'));
}

function patchFilters(content, { deptOptions, roleOptions }) {
  const table = findTable(content);
  if (!table) throw new Error('table bloğu bulunamadı');

  for (const col of table.children || []) {
    if (col.type !== 'table-column') continue;
    const name = propVal(col, 'display-name');

    if (name === 'İsim Soyisim' || name === 'Email' || name === 'Çıkış Tarihi') {
      setProp(col, 'filter-type', 'none');
      setProp(col, 'filter-select', []);
    }
    if (name === 'Rol') {
      setProp(col, 'variable', ':roleTypes:');
      setProp(col, 'filter-type', 'select');
      setProp(col, 'filter-select', JSON.stringify(roleOptions));
    }
    if (name === 'Departman') {
      setProp(col, 'filter-type', 'select');
      setProp(col, 'filter-select', JSON.stringify(deptOptions));
    }
  }

  setProp(table, 'filter-fields', '');
  const settings = prop(table, 'settings');
  if (settings?.value) {
    settings.value.filtering = false;
    settings.value.clearAllFilterBtn = false;
  }
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

function applyLayout(content, config) {
  patchDataSources(content);

  const existingWrap = findLayoutWrapper(content);
  if (existingWrap) {
    const inner = unwrapUiBlocks(existingWrap.children || []);
    existingWrap.children = patchUiBlocks(inner, config);
    setProp(existingWrap, 'display-name', config.layoutName);
    return content;
  }

  const dataBlocks = [];
  const uiBlocks = [];

  for (const block of content) {
    if (block.type === 'data-source') {
      dataBlocks.push(block);
    } else if (['grid', 'page-header', 'table'].includes(block.type)) {
      uiBlocks.push(block);
    } else if (block.type !== 'simple-container') {
      dataBlocks.push(block);
    }
  }

  if (!uiBlocks.length) return content;

  const layout = simpleContainer(patchUiBlocks(uiBlocks, config), 'ass-page', config.layoutName);
  return [...dataBlocks, layout];
}

function loadStyles() {
  const base = fs.readFileSync(BASE_STYLES_FILE, 'utf8').trim();
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${ext}`;
}

module.exports = {
  PAGE_CONFIGS,
  getConfig,
  applyLayout,
  loadStyles,
  patchFilters,
  buildDeptOptions,
  buildRoleOptions,
  findTable,
};
