const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/fatura-takibi-olustur-page-extensions.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/fatura-takibi-olustur-hero.html'
);
const FORM_HEAD_FILE = path.join(
  __dirname,
  '../../templates/fatura-takibi-olustur-form-head.html'
);

const PAGE_CONFIG = {
  pageId: '698ca6325170eb001549b6d0',
  layoutName: 'Fatura Takibi Oluştur Layout',
};

const UI_TYPES = new Set(['grid', 'content-header', 'condition', 'page-header', 'form-container']);

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
    type: 'input-text-property',
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

function isMainForm(block) {
  if (block.type !== 'form-container') return false;
  const name = String(propVal(block, 'display-name') || '');
  return /contractInvoices/i.test(name) || /contractinvoices/i.test(name);
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

function formHeadBlock() {
  return renderTemplate('Form başlık', fs.readFileSync(FORM_HEAD_FILE, 'utf8'));
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

function styleToolbarButtons(grid) {
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'button' && String(propVal(n, 'text') || '') === 'Geri') {
        setProp(n, 'severity', 'p-button-secondary');
        setProp(n, 'size', 'p-button');
        setProp(n, 'icon', 'pi pi-chevron-left');
        setProp(n, 'icon-position', 'left');
        const settings = prop(n, 'settings');
        if (settings?.value && typeof settings.value === 'object') {
          Object.assign(settings.value, {
            hasIcon: true,
            textButton: true,
            hasOutline: false,
            rounded: false,
          });
        }
      }
      walk(n.children);
    }
  }
  walk(grid.children);
}

function wrapFormCard(form) {
  return simpleContainer(
    [formHeadBlock(), form],
    'ass__form-card',
    'Fatura takibi formu kartı'
  );
}

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const pageHeader = blocks.find((b) => b.type === 'page-header');
  const mainForm =
    blocks.find(isMainForm) || blocks.find((b) => b.type === 'form-container');

  if (pageHeader) hidePageHeader(pageHeader);

  for (const g of toolbarGrids) {
    setGridClass(g, 'ass__toolbar');
    styleToolbarButtons(g);
  }

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(heroBlock());
  if (mainForm) ordered.push(wrapFormCard(mainForm));

  return ordered;
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
  let toolbarKept = false;

  for (const b of blocks) {
    if (b.type === 'render-template') continue;

    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass__form-card')
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
      } else if (cls) {
        setProp(b, 'custom-classes', '');
        const settings = prop(b, 'settings');
        if (settings?.value) settings.value.customClasses = false;
      }
      out.push(b);
      continue;
    }

    if (b.type === 'form-container' || b.type === 'page-header') {
      out.push(b);
      continue;
    }

    if (b.type === 'condition' && propVal(b, 'display-name') === 'Header hidden') {
      // Re-layout will recreate hide; drop stale hidden header
      continue;
    }
  }

  return out;
}

/**
 * Form-safe fingerprint: field/condition/data-source shape inside form trees.
 * Used to assert applyLayout did not mutate form internals.
 */
function formFingerprint(content) {
  const rows = [];

  function walk(nodes, path) {
    for (let i = 0; i < (nodes || []).length; i++) {
      const n = nodes[i];
      const here = `${path}/${n.type}[${i}]`;
      const name = String(propVal(n, 'display-name') || '');

      if (n.type === 'form-container') {
        rows.push({
          kind: 'form',
          path: here,
          name,
          table: propVal(n, 'table'),
          action: propVal(n, 'action'),
        });
      }

      if (
        n.type === 'input-select' ||
        n.type === 'input-date-time' ||
        n.type === 'input-number' ||
        n.type === 'input-textarea' ||
        n.type === 'input-text' ||
        n.type === 'button'
      ) {
        rows.push({
          kind: 'field',
          path: here,
          type: n.type,
          name,
          fieldId: propVal(n, 'field-id'),
          label: propVal(n, 'label'),
          text: propVal(n, 'text'),
          defaultValue: propVal(n, 'default-value'),
          dynamicDefault: propVal(n, 'dynamic-default-value'),
        });
      }

      if (n.type === 'condition') {
        rows.push({
          kind: 'condition',
          path: here,
          name,
          condition: propVal(n, 'condition'),
        });
      }

      if (n.type === 'data-source') {
        rows.push({
          kind: 'data-source',
          path: here,
          name,
          variable: propVal(n, 'variable'),
          table: propVal(n, 'table'),
          filters: propVal(n, 'filters'),
          single: propVal(n, 'single'),
        });
      }

      walk(n.children, here);
      if (n.customContents) {
        for (let j = 0; j < n.customContents.length; j++) {
          walk(n.customContents[j].children, `${here}/cc[${j}]`);
        }
      }
    }
  }

  // Only fingerprint main form trees (and nested), not page chrome
  for (const b of content || []) {
    if (b.type === 'form-container') walk([b], '');
    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass-page')
    ) {
      for (const child of b.children || []) {
        if (
          child.type === 'simple-container' &&
          String(propVal(child, 'classes') || '').includes('ass__form-card')
        ) {
          const form = (child.children || []).find((c) => c.type === 'form-container');
          if (form) walk([form], '');
        } else if (child.type === 'form-container') {
          walk([child], '');
        }
      }
    }
  }

  return JSON.stringify(rows);
}

function findMainForm(content) {
  for (const b of content || []) {
    if (isMainForm(b) || b.type === 'form-container') return b;
    if (
      b.type === 'simple-container' &&
      String(propVal(b, 'classes') || '').includes('ass-page')
    ) {
      for (const child of b.children || []) {
        if (
          child.type === 'simple-container' &&
          String(propVal(child, 'classes') || '').includes('ass__form-card')
        ) {
          const form = (child.children || []).find((c) => c.type === 'form-container');
          if (form) return form;
        }
        if (child.type === 'form-container') return child;
      }
    }
  }
  return null;
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
    } else if (UI_TYPES.has(block.type) || block.type === 'grid') {
      uiBlocks.push(block);
    } else if (block.type !== 'simple-container') {
      // Keep unknown non-container blocks outside layout (safe)
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
  formFingerprint,
  findMainForm,
  isMainForm,
};
