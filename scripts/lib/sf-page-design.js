const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/sozlesmeli-faturalar-page-extensions.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/sozlesmeli-faturalar-hero.html'
);
const LIST_HEAD_FILE = path.join(
  __dirname,
  '../../templates/sozlesmeli-faturalar-liste-baslik.html'
);

const PAGE_CONFIG = {
  pageId: '698cb3c15170eb01b44d723f',
  layoutName: 'Sözleşmeli Faturalar Layout',
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
    type: key === 'custom-classes' || key === 'classes' ? 'textarea-property' : 'input-text-property',
    value,
  });
}

function appendClass(block, key, className) {
  const current = String(propVal(block, key) || '').trim();
  if (!current.split(/\s+/).includes(className)) {
    setProp(block, key, `${current} ${className}`.trim());
  }
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

function renderTemplate(displayName, html) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: html.trim(),
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

function heroBlock() {
  return renderTemplate('Sayfa hero', fs.readFileSync(HERO_FILE, 'utf8'));
}

function listHeadBlock() {
  return renderTemplate('Liste başlık', fs.readFileSync(LIST_HEAD_FILE, 'utf8'));
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

function styleTableButtons(table) {
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'button') {
        const name = String(propVal(n, 'display-name') || '');
        const text = String(propVal(n, 'text') || '');
        if (name === 'Görüntüle' || text === 'Görüntüle') {
          applyButton(n, {
            classes: 'sf-detail-btn',
            severity: 'p-button-secondary',
            size: 'p-button-sm',
            icon: 'pi pi-arrow-right',
            iconPosition: 'right',
            settings: {
              hasIcon: true,
              textButton: false,
              hasOutline: false,
              rounded: false,
            },
          });
        }
      }
      walk(n.children);
    }
  }
  walk(table.children);
}

function wrapTable(table) {
  appendClass(table, 'classes', 'ass__data-table');
  styleTableButtons(table);
  return simpleContainer([listHeadBlock(), table], 'ass__list-card', 'Sözleşmeli faturalar tablosu');
}

function findLayoutWrapper(content) {
  return content.find(
    (b) =>
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass-page')
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
    if (b.type === 'table' || b.type === 'page-header') out.push(b);
    if (b.type === 'condition' && propVal(b, 'display-name') === 'Header hidden') continue;
  }
  return out;
}

function patchUiBlocks(blocks) {
  const pageHeader = blocks.find((b) => b.type === 'page-header');
  const table = blocks.find((b) => b.type === 'table');

  if (pageHeader) hidePageHeader(pageHeader);

  const ordered = [];
  ordered.push(heroBlock());
  if (table) ordered.push(wrapTable(table));
  return ordered;
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
    if (block.type === 'data-source') dataBlocks.push(block);
    else if (block.type === 'page-header' || block.type === 'table') uiBlocks.push(block);
    else if (block.type !== 'simple-container') dataBlocks.push(block);
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
