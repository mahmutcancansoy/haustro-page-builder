const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/hizmetler-page-extensions.css'
);
const HERO_FILE = path.join(__dirname, '../../templates/hizmetler-hero.html');
const TREE_FILE = path.join(__dirname, '../../templates/hizmetler-service-tree.html');

const PAGE_CONFIG = {
  pageId: '691709dc5170eb004e0ff7a9',
  layoutName: 'Hizmetler Layout',
};

const CUSTOM_TREE_NAME = 'Hizmet ağacı';

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

function removeClass(block, key, className) {
  setProp(
    block,
    key,
    String(propVal(block, key) || '')
      .split(/\s+/)
      .filter((c) => c && c !== className)
      .join(' ')
  );
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

function loadTreeHtml() {
  return fs.readFileSync(TREE_FILE, 'utf8').trim();
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

function listHeadBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__list-head hiz-list-head">
  <div class="ass__list-head-icon"><i class="pi pi-sitemap"></i></div>
  <div>
    <h2>Hizmet kategorileri</h2>
    <p>Hiyerarşik ağaç üzerinden kategorileri inceleyin, arayın ve yetkilendirme için seçim yapın.</p>
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

function customTreeBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: loadTreeHtml(),
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: CUSTOM_TREE_NAME,
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

function isServicesForm(block) {
  return (
    block?.type === 'form-container' &&
    /role categories form container/i.test(String(propVal(block, 'display-name') || ''))
  );
}

function isCustomTree(block) {
  return (
    block?.type === 'render-template' &&
    String(propVal(block, 'display-name') || '') === CUSTOM_TREE_NAME
  );
}

function findCustomTree(nodes) {
  for (const n of nodes || []) {
    if (isCustomTree(n)) return n;
    const nested = findCustomTree(n.children);
    if (nested) return nested;
  }
  return null;
}

function patchServicesForm(form) {
  appendClass(form, 'classes', 'hiz-form');

  const panel = (form.children || []).find(
    (c) =>
      c.type === 'simple-container' &&
      String(propVal(c, 'classes') || '').includes('hiz-tree-panel')
  );

  const custom = customTreeBlock();

  if (panel) {
    panel.children = [custom];
    return form;
  }

  const treeIdx = (form.children || []).findIndex(
    (c) => c.type === 'tree-view' || isCustomTree(c)
  );

  if (treeIdx >= 0) {
    form.children[treeIdx] = custom;
  } else {
    form.children = [custom];
  }

  return form;
}

function restoreServicesForm(form) {
  removeClass(form, 'classes', 'hiz-form');
  return form;
}

function wrapServicesForm(form) {
  const patched = patchServicesForm(form);
  const custom = findCustomTree(patched.children) || customTreeBlock();
  const treePanel = simpleContainer([custom], 'hiz-tree-panel', 'Ağaç paneli');
  patched.children = [treePanel];
  return simpleContainer(
    [listHeadBlock(), patched],
    'hiz-services-card',
    'Hizmet kartı'
  );
}

function unwrapServicesCard(card) {
  const form = (card.children || []).find(
    (c) =>
      c.type === 'form-container' &&
      (isServicesForm(c) || String(propVal(c, 'classes') || '').includes('hiz-form'))
  );
  if (!form) return null;

  const panel = (form.children || []).find(
    (c) =>
      c.type === 'simple-container' &&
      String(propVal(c, 'classes') || '').includes('hiz-tree-panel')
  );
  if (panel?.children?.length) {
    form.children = [panel.children[0]];
  }

  restoreServicesForm(form);
  return form;
}

function loadOriginalFormShell() {
  const backupPath = path.join(
    __dirname,
    '../../templates/hizmetler-content.original.json'
  );
  if (!fs.existsSync(backupPath)) {
    throw new Error('Orijinal form yedeği bulunamadı');
  }
  const doc = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
  const cond = doc.content.find(
    (b) =>
      b.type === 'condition' &&
      (b.children || []).some((c) => c.type === 'form-container')
  );
  const form = cond?.children?.find((c) => c.type === 'form-container');
  if (!form) throw new Error('Orijinal form bulunamadı');
  return JSON.parse(JSON.stringify(form));
}

function resolveServicesForm(cond) {
  const direct = (cond.children || []).find(
    (c) => isServicesForm(c) || (c.type === 'form-container' && String(propVal(c, 'classes') || '').includes('hiz-form'))
  );
  if (direct) return direct;

  const layout = findLayoutWrap(cond.children);
  if (layout) {
    const card = (layout.children || []).find((c) =>
      String(propVal(c, 'classes') || '').includes('hiz-services-card')
    );
    const form = card ? unwrapServicesCard(card) : null;
    if (form) return form;
  }

  return loadOriginalFormShell();
}

function findLayoutWrap(nodes) {
  for (const n of nodes || []) {
    if (
      n.type === 'simple-container' &&
      String(propVal(n, 'classes') || '').includes('ass-page')
    ) {
      return n;
    }
    const nested = findLayoutWrap(n.children);
    if (nested) return nested;
  }
  return null;
}

function findMainCondition(content) {
  return content.find((b) => {
    if (b.type !== 'condition') return false;
    return (b.children || []).some(
      (c) =>
        c.type === 'data-source' ||
        c.type === 'form-container' ||
        (c.type === 'simple-container' &&
          String(propVal(c, 'classes') || '').includes('ass-page'))
    );
  });
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

  const pageHeader = content.find((b) => b.type === 'page-header');
  if (pageHeader) hidePageHeader(pageHeader);

  const cond = findMainCondition(content);
  if (!cond) return content;

  const existingWrap = findLayoutWrap(cond.children);
  if (existingWrap) {
    const form = resolveServicesForm(cond);
    existingWrap.children = [heroBlock(), wrapServicesForm(form)];
    setProp(existingWrap, 'display-name', PAGE_CONFIG.layoutName);
    return content;
  }

  const formIdx = (cond.children || []).findIndex(
    (c) =>
      isServicesForm(c) ||
      c.type === 'form-container' ||
      (c.type === 'simple-container' &&
        String(propVal(c, 'classes') || '').includes('ass-page'))
  );

  const form = resolveServicesForm(cond);
  const layout = simpleContainer(
    [heroBlock(), wrapServicesForm(form)],
    'ass-page',
    PAGE_CONFIG.layoutName
  );

  if (formIdx >= 0) {
    cond.children[formIdx] = layout;
  } else {
    cond.children.push(layout);
  }

  return content;
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
