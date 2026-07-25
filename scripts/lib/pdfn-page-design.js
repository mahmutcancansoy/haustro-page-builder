const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/performans-degerlendirme-formu-renksiz-page-extensions.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/performans-degerlendirme-formu-renksiz-hero.html'
);

const PAGE_CONFIG = {
  pageId: '65776fc9b03e3602bc6498c1',
  layoutName: 'Performans Formu Renksiz Layout',
};

const PDFN_CLASSES = [
  'pdfn-form',
  'pdfn-form-array',
  'pdfn-form-intro',
  'pdfn-person-row',
  'pdfn-table-head',
  'pdfn-th-criteria',
  'pdfn-th-score',
  'pdfn-questions-loop',
  'pdfn-question-row',
  'pdfn-question-grid',
  'pdfn-q-label',
  'pdfn-score-col',
  'pdfn-meta-label',
  'pdfn-meta-value',
  'pdfn-actions',
  'pdfn-error',
  'pdfn-success-actions',
  'pdfn-success-result',
  'pdfn-form-wrap',
];

const UI_TYPES = new Set(['grid', 'content-header', 'condition']);

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

function ensureClasses(block, className) {
  if (!prop(block, 'classes')) {
    block.properties = block.properties || [];
    block.properties.push({
      key: 'classes',
      header: 'Classes',
      type: 'textarea-property',
      value: '',
    });
  }
  appendClass(block, 'classes', className);
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

function appendColumnClass(column, className) {
  enableSetting(column, 'customClasses');
  appendClass(column, 'custom-classes', className);
}

function removeColumnClass(column, className) {
  removeClass(column, 'custom-classes', className);
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

function clearGridClass(grid) {
  setProp(grid, 'custom-classes', '');
  const settings = prop(grid, 'settings');
  if (settings?.value) settings.value.customClasses = false;
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

function isLegacyTitleHeader(block) {
  return block.type === 'content-header' && propVal(block, 'display-name') === 'Title';
}

function isDetailForm(block) {
  return block.type === 'form-container' && propVal(block, 'display-name') === 'Form Detayı';
}

function isFormCondition(block) {
  return block.type === 'condition' && propVal(block, 'display-name') === 'insertedId false';
}

function isSuccessCondition(block) {
  return block.type === 'condition' && propVal(block, 'display-name') === 'insertedId true';
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

function formHeadBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__list-head pdfn-list-head">
  <div class="ass__list-head-icon"><i class="pi pi-star"></i></div>
  <div>
    <h2>Değerlendirme kriterleri</h2>
    <p>Her kriter için 1–5 arası puan verin.</p>
  </div>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Form başlık',
      },
    ],
  };
}

function isPersonRowGrid(grid) {
  return (grid.children || []).some((col) =>
    (col.children || []).some((c) => {
      const t = String(propVal(c, 'text') || '');
      return t.includes('Değerlendirilen Personel');
    })
  );
}

function isTableHeadGrid(grid) {
  return (grid.children || []).some((col) =>
    (col.children || []).some((c) => String(propVal(c, 'text') || '') === 'Kriterler')
  );
}

function isQuestionGrid(grid) {
  return (grid.children || []).some((col) =>
    (col.children || []).some((c) => c.type === 'input-select')
  );
}

function patchHeaderLabel(label) {
  const text = String(propVal(label, 'text') || '');
  if (text === 'Kriterler') appendClass(label, 'classes', 'pdfn-th-criteria');
  if (text === 'Değerlendirici Puanı') appendClass(label, 'classes', 'pdfn-th-score');
  if (text.includes('Değerlendirilen Personel')) appendClass(label, 'classes', 'pdfn-meta-label');
  if (text.includes('selectedUsers')) appendClass(label, 'classes', 'pdfn-meta-value');
  if (text.includes('input.criterion')) appendClass(label, 'classes', 'pdfn-q-label');
  if (text.includes('response.formPost.error')) appendClass(label, 'classes', 'pdfn-error');
}

function patchFormTree(nodes) {
  for (const n of nodes || []) {
    if (!n || typeof n !== 'object') continue;
    const dn = String(propVal(n, 'display-name') || '');

    if (n.type === 'form-container') {
      ensureClasses(n, 'pdfn-form');
    } else if (n.type === 'form-array-container') {
      ensureClasses(n, 'pdfn-form-array');
    } else if (n.type === 'form-group-container') {
      if (dn === 'container Title') ensureClasses(n, 'pdfn-form-intro');
      if (dn === 'container1') ensureClasses(n, 'pdfn-question-row');
    } else if (n.type === 'grid') {
      if (dn === 'Butonlar') {
        setGridClass(n, 'pdfn-actions');
      } else if (isPersonRowGrid(n)) {
        setGridClass(n, 'pdfn-person-row');
      } else if (isTableHeadGrid(n)) {
        setGridClass(n, 'pdfn-table-head');
      } else if (isQuestionGrid(n)) {
        setGridClass(n, 'pdfn-question-grid');
      }
    } else if (n.type === 'loop') {
      if (String(propVal(n, 'variable') || '').includes('questions')) {
        ensureClasses(n, 'pdfn-questions-loop');
      }
    } else if (n.type === 'label') {
      patchHeaderLabel(n);
    } else if (n.type === 'column') {
      const colDn = String(dn || '').toLowerCase();
      if (colDn === 'answer' && hasSelectChild(n)) appendColumnClass(n, 'pdfn-score-col');
    }

    patchFormTree(n.children);
  }
}

function hasSelectChild(col) {
  return (col.children || []).some((c) => c.type === 'input-select');
}

function patchSuccessTree(nodes) {
  for (const n of nodes || []) {
    if (!n || typeof n !== 'object') continue;
    const dn = String(propVal(n, 'display-name') || '');

    if (n.type === 'grid' && dn === 'Butonlar') {
      setGridClass(n, 'pdfn-success-actions');
    } else if (n.type === 'page-header' && dn === 'Results') {
      appendClass(n, 'classes', 'pdfn-success-result');
    }

    patchSuccessTree(n.children);
  }
}

function restoreFormTree(nodes) {
  for (const n of nodes || []) {
    if (!n || typeof n !== 'object') continue;

    if (n.type === 'form-container') removeClass(n, 'classes', 'pdfn-form');
    else if (n.type === 'form-array-container') removeClass(n, 'classes', 'pdfn-form-array');
    else if (n.type === 'form-group-container') {
      removeClass(n, 'classes', 'pdfn-form-intro');
      removeClass(n, 'classes', 'pdfn-question-row');
    } else if (n.type === 'grid') {
      const cc = String(propVal(n, 'custom-classes') || '');
      if (PDFN_CLASSES.some((c) => cc.includes(c))) {
        const cleaned = cc
          .split(/\s+/)
          .filter((c) => c && !PDFN_CLASSES.includes(c))
          .join(' ');
        setProp(n, 'custom-classes', cleaned);
        const settings = prop(n, 'settings');
        if (settings?.value && !cleaned) settings.value.customClasses = false;
      }
    } else if (n.type === 'loop') {
      removeClass(n, 'classes', 'pdfn-questions-loop');
    } else if (n.type === 'label') {
      for (const cls of [
        'pdfn-th-criteria',
        'pdfn-th-score',
        'pdfn-meta-label',
        'pdfn-meta-value',
        'pdfn-q-label',
        'pdfn-error',
      ]) {
        removeClass(n, 'classes', cls);
      }
    } else if (n.type === 'column') {
      removeColumnClass(n, 'pdfn-score-col');
    } else if (n.type === 'page-header') {
      removeClass(n, 'classes', 'pdfn-success-result');
    } else if (n.type === 'condition') {
      removeClass(n, 'classes', 'pdfn-form-wrap');
    }

    restoreFormTree(n.children);
  }
}

function wrapFormCondition(condition) {
  const form = (condition.children || []).find(isDetailForm);
  if (form) patchFormTree(form.children);
  ensureClasses(condition, 'pdfn-form-wrap');
  return simpleContainer([formHeadBlock(), condition], 'pdfn-form-card', 'Değerlendirme formu kartı');
}

function prepareSuccessCondition(condition) {
  patchSuccessTree(condition.children);
  return condition;
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

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const formCondition = blocks.find(isFormCondition);
  const successCondition = blocks.find(isSuccessCondition);

  for (const g of toolbarGrids) setGridClass(g, 'ass__toolbar');

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(heroBlock());
  if (formCondition) ordered.push(wrapFormCondition(formCondition));
  if (successCondition) ordered.push(prepareSuccessCondition(successCondition));
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
    if (isLegacyTitleHeader(b)) continue;

    if (b.type === 'simple-container') {
      const cls = String(propVal(b, 'classes') || '');
      if (cls.includes('pdfn-form-card')) {
        const condition = (b.children || []).find(isFormCondition);
        if (condition) {
          removeClass(condition, 'classes', 'pdfn-form-wrap');
          const form = (condition.children || []).find(isDetailForm);
          if (form) restoreFormTree(form.children);
          out.push(condition);
        }
        continue;
      }
      if (cls.includes('pdfn-success-card')) {
        const condition = (b.children || []).find(isSuccessCondition);
        if (condition) {
          restoreFormTree(condition.children);
          out.push(condition);
        }
        continue;
      }
    }

    if (b.type === 'grid') {
      const cls = String(propVal(b, 'custom-classes') || '');
      const isToolbar = cls.includes('ass__toolbar') || isToolbarGrid(b);
      if (isToolbar) {
        if (toolbarKept) continue;
        toolbarKept = true;
        clearGridClass(b);
      } else if (cls) {
        clearGridClass(b);
      }
      out.push(b);
      continue;
    }

    if (isFormCondition(b)) {
      const form = (b.children || []).find(isDetailForm);
      if (form) restoreFormTree(form.children);
      removeClass(b, 'classes', 'pdfn-form-wrap');
      out.push(b);
      continue;
    }

    if (isSuccessCondition(b)) {
      restoreFormTree(b.children);
      out.push(b);
    }
  }

  return out;
}

function isLegacyEmptyScoreOption(option) {
  const label = String(propVal(option, 'label') || '');
  const value = String(propVal(option, 'value') || '');
  const displayName = String(propVal(option, 'display-name') || '');
  return label === '-' || displayName === '-' || value === '-' || value === ' ';
}

function isLeaveEmptyScoreOption(option) {
  const label = String(propVal(option, 'label') || '');
  const value = String(propVal(option, 'value') || '');
  return value === '' && label === 'Boş bırak';
}

function emptyScoreOption() {
  return {
    type: 'input-select-option',
    isContainer: false,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Boş bırak',
      },
      {
        key: 'label',
        header: 'Label',
        type: 'input-text-property',
        value: 'Boş bırak',
      },
      {
        key: 'value',
        header: 'Value',
        type: 'input-text-property',
        value: '',
      },
      {
        key: 'icon',
        header: 'Icon',
        type: 'input-text-property',
        value: 'pi pi-check',
      },
    ],
  };
}

function patchScoreSelects(blocks) {
  for (const block of blocks || []) {
    if (block.type === 'input-select' && propVal(block, 'name') === 'score') {
      const options = (block.children || []).filter((opt) => !isLegacyEmptyScoreOption(opt));
      const hasLeaveEmpty = options.some(isLeaveEmptyScoreOption);
      block.children = hasLeaveEmpty ? options : [emptyScoreOption(), ...options];
      setProp(block, 'placeholder', '');
      const settings = prop(block, 'settings');
      if (settings?.value) {
        settings.value.selectFirst = false;
        settings.value.clearButton = false;
      }
    }
    patchScoreSelects(block.children);
  }
}

function applyLayout(content) {
  patchScoreSelects(content);
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
    if (block.type === 'data-source') {
      dataBlocks.push(block);
    } else if (UI_TYPES.has(block.type)) {
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
  patchScoreSelects,
};
