const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aktif-transfer-raporlari-page-extensions.css'
);

const PAGE_CONFIG = {
  pageId: '69b0e3585170eb02c2497202',
  layoutName: 'Aktif Transfer Raporları Layout',
  title: 'Aktif Transfer Raporları',
  url: 'aktif-transfer-raporlari',
  heroSub: 'Onay bekleyen, yoldaki ve teslim onayı bekleyen transferlerin canlı listesi.',
  listSub: 'Envanter, şube, adet ve güncel durum bilgileriyle aktif transferleri görüntüleyin.',
  emptyMessage: 'Aktif transfer bulunamadı.',
  chipLabel: 'aktif transfer',
  chipFallback: 'Aktif transferler',
  tableFilters: `{
  "$and": [
    { "delete": { "$ne": 1 } },
    {
      "$or": [
        { "status": { "$in": [0, 2, 3, 4] } },
        { "status": { "$in": ["0", "2", "3", "4"] } }
      ]
    }
  ],
  "sort": { "_id": -1 }
}`,
  statusDefs: [
    {
      name: 'status == 0',
      condition: '"{{input.status}}" == "0"',
      text: 'Onay bekliyor',
      className: 'atr-status atr-status--pending',
    },
    {
      name: 'kargo status == 2',
      condition:
        '"{{input.transferMethods}}" == "kargo" && "{{input.status}}" == "2"',
      text: 'Çıkış bekleniyor',
      className: 'atr-status atr-status--waiting',
    },
    {
      name: 'kargo status == 3',
      condition:
        '"{{input.transferMethods}}" == "kargo" && "{{input.status}}" == "3"',
      text: 'Varışta bekliyor',
      className: 'atr-status atr-status--cargo',
    },
    {
      name: 'sofor status == 2',
      condition:
        '"{{input.transferMethods}}" != "kargo" && "{{input.status}}" == "2"',
      text: 'Şoför bekleniyor',
      className: 'atr-status atr-status--waiting',
    },
    {
      name: 'sofor status == 3',
      condition:
        '"{{input.transferMethods}}" != "kargo" && "{{input.status}}" == "3"',
      text: 'Yolda',
      className: 'atr-status atr-status--transit',
    },
    {
      name: 'sofor status == 4',
      condition:
        '"{{input.transferMethods}}" != "kargo" && "{{input.status}}" == "4"',
      text: 'Şube onayı bekliyor',
      className: 'atr-status atr-status--arrive',
    },
  ],
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

function appendClass(block, key, className) {
  const current = String(propVal(block, key) || '').trim();
  if (!current.split(/\s+/).includes(className)) {
    setProp(block, key, `${current} ${className}`.trim());
  }
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function walkBlocks(nodes, fn) {
  for (const node of nodes || []) {
    fn(node);
    walkBlocks(node.children, fn);
  }
}

function findByType(nodes, type) {
  for (const n of nodes || []) {
    if (n.type === type) return n;
    const found = findByType(n.children, type);
    if (found) return found;
  }
  return null;
}

function findColumn(nodes, name) {
  for (const n of nodes || []) {
    if (n.type === 'table-column' && propVal(n, 'display-name') === name) {
      return n;
    }
    const found = findColumn(n.children, name);
    if (found) return found;
  }
  return null;
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
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__hero atr-hero">
  <div class="ass__hero-main">
    <span class="ass__eyebrow">Envanter</span>
    <h1>${config.title}</h1>
    <p class="ass__hero-sub">${config.heroSub}</p>
  </div>
  <div class="ass__hero-meta">
    {{#if transfers.length}}
      <span class="ass__chip"><i class="pi pi-send"></i> {{transfers.length}} ${config.chipLabel}</span>
    {{else}}
      <span class="ass__chip"><i class="pi pi-send"></i> ${config.chipFallback}</span>
    {{/if}}
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
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__list-head">
  <div class="ass__list-head-icon"><i class="pi pi-list"></i></div>
  <div>
    <h2>Transfer listesi</h2>
    <p>${config.listSub}</p>
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

function buildStatusLabel(templateLabel, text, className) {
  const label = deepClone(templateLabel);
  setProp(label, 'display-name', text);
  setProp(label, 'text', text);
  setProp(label, 'classes', className);

  // Eski inline stil/padding rozetin arka planını metinden kısa bırakabiliyor
  const styles = prop(label, 'styles');
  if (styles?.children) {
    for (const child of styles.children) {
      if (child.key === 'font-size') child.value = '';
      if (child.key === 'color') child.value = '';
    }
  }
  if (Object.prototype.hasOwnProperty.call(label, 'paddings')) {
    label.paddings = [0, 0, 0, 0];
  }
  if (Object.prototype.hasOwnProperty.call(label, 'margins')) {
    label.margins = [0, 0, 0, 0];
  }
  const spacings = prop(label, 'spacings');
  if (spacings) {
    spacings.paddings = [0, 0, 0, 0];
    spacings.margins = [0, 0, 0, 0];
  }

  return label;
}

function buildStatusCondition(templateCondition, def, labelTemplate) {
  const condition = deepClone(templateCondition);
  setProp(condition, 'display-name', def.name);
  setProp(condition, 'condition', def.condition);
  condition.children = [buildStatusLabel(labelTemplate, def.text, def.className)];
  return condition;
}

function replaceStatusColumn(table, statusDefs) {
  const column = findColumn([table], 'Durum');
  if (!column) throw new Error('Durum sütunu bulunamadı');

  const firstCondition = (column.children || []).find((c) => c.type === 'condition');
  const labelTemplate =
    (firstCondition?.children || []).find((c) => c.type === 'label') ||
    (() => {
      throw new Error('Durum etiketi şablonu bulunamadı');
    })();

  const templateCondition = firstCondition || {
    type: 'condition',
    isContainer: true,
    children: [],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'status',
      },
      {
        key: 'condition',
        header: 'Condition',
        type: 'textarea-property',
        value: 'true',
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
    ],
  };

  column.children = statusDefs.map((def) =>
    buildStatusCondition(templateCondition, def, labelTemplate)
  );
}

function patchDetailButtons(nodes) {
  walkBlocks(nodes, (n) => {
    if (n.type !== 'button' || propVal(n, 'display-name') !== 'Detay') return;
    appendClass(n, 'classes', 'atr-detail-btn');
    setProp(n, 'severity', 'p-button-secondary');
    setProp(n, 'icon', 'pi pi-arrow-right');
    setProp(n, 'icon-position', 'right');
    setProp(n, 'url', '/d/transfer-detay-beta?_id={{input._id}}');
    const settings = prop(n, 'settings');
    if (settings?.value) {
      settings.value.hasIcon = true;
      settings.value.hasOutline = false;
      settings.value.textButton = false;
    }
  });
}

function patchTableContent(nodes) {
  for (const n of nodes || []) {
    if (n.type === 'label') {
      const name = String(propVal(n, 'display-name') || '');
      const text = String(propVal(n, 'text') || '').trim();

      if (name === 'Product Name') appendClass(n, 'classes', 'atr-inventory');
      if (name === 'Adet') appendClass(n, 'classes', 'atr-amount');
      if (name === 'New Label 1' && text.includes('departments')) {
        appendClass(n, 'classes', 'atr-dept');
      }
    }
    patchTableContent(n.children);
  }
}

function wrapTable(table, config) {
  appendClass(table, 'classes', 'ass__data-table');
  appendClass(table, 'classes', 'atr-data-table');
  setProp(table, 'empty-message', config.emptyMessage);
  replaceStatusColumn(table, config.statusDefs);
  patchTableContent(table.children);
  patchDetailButtons([table]);
  return simpleContainer(
    [listHeadBlock(config), table],
    'ass__list-card',
    'Transfer tablosu'
  );
}

function patchUiBlocks(blocks, config) {
  const table = blocks.find((b) => b.type === 'table');
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
          .replace(/\batr-data-table\b/g, '')
          .trim();
        setProp(table, 'classes', cls);
        out.push(table);
      }
      continue;
    }

    if (b.type === 'table') out.push(b);
  }

  return out;
}

function patchDataSources(blocks, filters) {
  for (const b of blocks || []) {
    if (b.type === 'data-source') {
      setProp(b, 'table-filters', filters);
      const settings = prop(b, 'settings');
      if (settings?.value) settings.value.debug = false;
    }
    patchDataSources(b.children, filters);
  }
}

function applyLayout(content, config = PAGE_CONFIG) {
  const next = deepClone(content);
  patchDataSources(next, config.tableFilters);

  const existingWrap = findLayoutWrapper(next);
  if (existingWrap) {
    const inner = unwrapUiBlocks(existingWrap.children || []);
    existingWrap.children = patchUiBlocks(inner, config);
    setProp(existingWrap, 'display-name', config.layoutName);
    return next;
  }

  const dataBlocks = [];
  const uiBlocks = [];

  for (const block of next) {
    if (block.type === 'data-source') dataBlocks.push(block);
    else if (block.type === 'table') uiBlocks.push(block);
    else if (block.type !== 'simple-container') dataBlocks.push(block);
  }

  if (!uiBlocks.length) return next;

  const layout = simpleContainer(
    patchUiBlocks(uiBlocks, config),
    'ass-page',
    config.layoutName
  );
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
  deepClone,
  prop,
  propVal,
  setProp,
  findByType,
  findColumn,
  walkBlocks,
};
