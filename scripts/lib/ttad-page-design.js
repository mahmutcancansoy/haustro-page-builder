const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/tesisat-teknik-ariza-detayi-page-extensions.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/tesisat-teknik-ariza-detayi-hero.html'
);

const PAGE_CONFIG = {
  pageId: '6480c6ddb03e3605614b83bf',
  layoutName: 'Tesisat Teknik Arıza Detayı Layout',
  url: 'tesisat-teknik-ariza-detayi',
};

const STATUS_DEFS = [
  { name: 'status 0', value: '0', text: 'Beklemede', className: 'tta-status tta-status--pending' },
  { name: 'status 1', value: '1', text: 'Teknisyen Atandı', className: 'tta-status tta-status--assigned' },
  { name: 'status 2', value: '2', text: 'Arıza İnceleniyor', className: 'tta-status tta-status--inspect' },
  { name: 'status 3', value: '3', text: 'Teklif Bekleniyor', className: 'tta-status tta-status--waiting' },
  { name: 'status 4', value: '4', text: 'Onay Bekleniyor', className: 'tta-status tta-status--approval' },
  { name: 'status 5', value: '5', text: 'Servis Bekleniyor', className: 'tta-status tta-status--waiting' },
  { name: 'status 6', value: '6', text: 'Parça Bekleniyor', className: 'tta-status tta-status--waiting' },
  { name: 'status 7', value: '7', text: 'Onarım Sürecinde', className: 'tta-status tta-status--progress' },
  { name: 'status 8', value: '8', text: 'Arıza Giderildi', className: 'tta-status tta-status--done' },
  { name: 'status 9', value: '9', text: 'Arıza Giderildi (Onay Bekliyor)', className: 'tta-status tta-status--approval' },
  { name: 'status 10', value: '10', text: 'Onarımı Planlandı', className: 'tta-status tta-status--planned' },
];

const META_LABELS = new Set([
  'Şube',
  'Personel',
  'Oluşturma Tarihi',
  'Açıklama',
  'Atanan Teknisyen',
  'Teknisyen Açıklaması',
]);

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
  if (!block.properties) block.properties = [];
  block.properties.push({
    key,
    header: key,
    type: key === 'classes' ? 'textarea-property' : 'input-text-property',
    value,
  });
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
  let hasBack = false;
  walkBlocks(grid.children, (n) => {
    if (n.type === 'button' && propVal(n, 'text') === 'Geri') hasBack = true;
  });
  return hasBack;
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

function sectionHead(title, sub, icon, displayName) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__list-head">
  <div class="ass__list-head-icon"><i class="pi ${icon}"></i></div>
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
        value: displayName,
      },
    ],
  };
}

function buildStatusLabel(templateLabel, text, className) {
  const label = deepClone(templateLabel);
  setProp(label, 'display-name', text);
  setProp(label, 'text', text);
  setProp(label, 'classes', className);
  return label;
}

function patchStatusConditions(column, fieldKey) {
  const firstCondition = (column.children || []).find((c) => c.type === 'condition');
  const labelTemplate =
    (firstCondition?.children || []).find((c) => c.type === 'label') || null;
  if (!firstCondition || !labelTemplate) return;

  column.children = STATUS_DEFS.map((def) => {
    const condition = deepClone(firstCondition);
    setProp(condition, 'display-name', def.name);
    setProp(condition, 'condition', `"{{input.${fieldKey}}}" == "${def.value}"`);
    condition.children = [
      buildStatusLabel(labelTemplate, def.text, def.className),
    ];
    return condition;
  });
}

function patchLogsTable(table) {
  appendClass(table, 'classes', 'ass__data-table');
  appendClass(table, 'classes', 'ttad-logs-table');

  walkBlocks([table], (n) => {
    if (n.type !== 'table-column') return;
    const name = String(propVal(n, 'display-name') || propVal(n, 'header') || '');
    if (name === 'Eski Durumu') patchStatusConditions(n, 'oldStatus');
    if (name === 'Yeni Durumu') patchStatusConditions(n, 'newStatus');
  });
}

function patchForm(form) {
  appendClass(form, 'classes', 'ttad-form');

  walkBlocks([form], (n) => {
    if (n.type === 'label') {
      const name = String(propVal(n, 'display-name') || '');
      if (META_LABELS.has(name)) appendClass(n, 'classes', 'ttad-meta');
    }

    if (n.type === 'button' && propVal(n, 'text') === 'Güncelle') {
      appendClass(n, 'classes', 'ttad-update-btn');
      setProp(n, 'severity', 'p-button-success');
      setProp(n, 'icon', 'pi pi-check');
      setProp(n, 'icon-position', 'left');
      const settings = prop(n, 'settings');
      if (settings?.value) {
        settings.value.hasIcon = true;
        settings.value.hasOutline = false;
        settings.value.textButton = false;
      }
    }

    if (
      n.type === 'form-fields-container' ||
      n.type === 'input-text' ||
      n.type === 'condition'
    ) {
      appendClass(n, 'classes', 'ttad-span-2');
    }
  });
}

function wrapForm(form) {
  patchForm(form);
  return simpleContainer(
    [
      sectionHead(
        'Talep detayı',
        'Durum güncellemesi, teknisyen ataması ve ek dosyalar.',
        'pi-wrench',
        'Detay başlık'
      ),
      form,
    ],
    'ass__detail-card',
    'Talep detay kartı'
  );
}

function wrapLogs(condition) {
  const table = (condition.children || []).find(
    (c) => c.type === 'simple-table' || c.type === 'table'
  );
  if (table) patchLogsTable(table);
  return simpleContainer(
    [
      sectionHead(
        'Değişiklik geçmişi',
        'Durum geçişleri ve teknisyen notları.',
        'pi-history',
        'Log başlık'
      ),
      condition,
    ],
    'ass__list-card',
    'Log geçmişi kartı'
  );
}

function patchUiBlocks(blocks) {
  const toolbar = blocks.find((b) => isToolbarGrid(b));
  const form = blocks.find((b) => b.type === 'form-container');
  const logs = blocks.find(
    (b) =>
      b.type === 'condition' &&
      (propVal(b, 'display-name') === 'logs check' ||
        findTable(b))
  );

  if (toolbar) setGridClass(toolbar, 'ass__toolbar');

  const ordered = [];
  if (toolbar) ordered.push(toolbar);
  ordered.push(heroBlock());
  if (form) ordered.push(wrapForm(form));
  if (logs) ordered.push(wrapLogs(logs));
  return ordered;
}

function findTable(block) {
  let found = false;
  walkBlocks([block], (n) => {
    if (n.type === 'simple-table' || n.type === 'table') found = true;
  });
  return found;
}

function findLayoutWrapper(content) {
  return content.find(
    (b) =>
      b.type === 'simple-container' &&
      prop(b, 'classes')?.value?.includes('ass-page')
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
      String(propVal(b, 'classes') || '').includes('ass__list-card')
    ) {
      const condition = (b.children || []).find((c) => c.type === 'condition');
      if (condition) {
        const table = (condition.children || []).find(
          (c) => c.type === 'simple-table' || c.type === 'table'
        );
        if (table) {
          const cls = String(propVal(table, 'classes') || '')
            .replace(/\bass__data-table\b/g, '')
            .replace(/\bttad-logs-table\b/g, '')
            .trim();
          setProp(table, 'classes', cls);
        }
        out.push(condition);
      }
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
      }
      out.push(b);
      continue;
    }

    if (b.type === 'form-container' || b.type === 'condition') out.push(b);
  }

  return out;
}

function applyLayout(content, config = PAGE_CONFIG) {
  const next = deepClone(content);

  const existingWrap = findLayoutWrapper(next);
  if (existingWrap) {
    const inner = unwrapUiBlocks(existingWrap.children || []);
    existingWrap.children = patchUiBlocks(inner);
    setProp(existingWrap, 'display-name', config.layoutName);
    return next;
  }

  const dataBlocks = [];
  const uiBlocks = [];

  for (const block of next) {
    if (block.type === 'data-source') {
      dataBlocks.push(block);
    } else if (block.type === 'grid' && isProductBlockGrid(block)) {
      continue;
    } else if (
      block.type === 'grid' ||
      block.type === 'form-container' ||
      block.type === 'condition'
    ) {
      uiBlocks.push(block);
    } else {
      dataBlocks.push(block);
    }
  }

  if (!uiBlocks.length) return next;

  const layout = simpleContainer(
    patchUiBlocks(uiBlocks),
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
};
