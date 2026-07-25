const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/mutfak-kapanis-kontrol-olustur-page-extensions.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/mutfak-kapanis-kontrol-olustur-hero.html'
);

const PAGE_CONFIG = {
  pageId: '66630df5b03e3606af54f295',
  layoutName: 'Mutfak Kapanış Kontrol Oluştur Layout',
};

const MKKO_CLASSES = [
  'mkko-form',
  'mkko-form-array',
  'mkko-meta',
  'mkko-table-head-wrap',
  'mkko-table-head',
  'mkko-th-question',
  'mkko-th-answers',
  'mkko-th-photo',
  'mkko-questions-loop',
  'mkko-question-row',
  'mkko-question-grid',
  'mkko-q-label',
  'mkko-radio-col',
  'mkko-photo-col',
  'mkko-section-title',
  'mkko-section-app',
  'mkko-notes-section',
  'mkko-notes-body',
  'mkko-text-question-row',
  'mkko-text-question-grid',
  'mkko-warning',
  'mkko-actions',
  'mkko-hidden-field',
];

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
  const current = String(propVal(column, 'custom-classes') || '').trim();
  if (!current.split(/\s+/).includes(className)) {
    setProp(column, 'custom-classes', `${current} ${className}`.trim());
  }
}

function enableSetting(block, settingKey) {
  const settings = prop(block, 'settings');
  if (settings?.value && typeof settings.value === 'object') {
    settings.value[settingKey] = true;
  }
}

function removeColumnClass(column, className) {
  removeClass(column, 'custom-classes', className);
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
  return block.type === 'content-header' && propVal(block, 'display-name') === 'title';
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

function checklistHeadBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__list-head mkko-list-head">
  <div class="ass__list-head-icon"><i class="pi pi-check-square"></i></div>
  <div>
    <h2>Kontrol maddeleri</h2>
    <p>Her madde için Evet/Hayır işaretleyin; gerekiyorsa fotoğraf ekleyin.</p>
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

function patchHeaderLabel(label) {
  const text = String(propVal(label, 'text') || '').trim();
  if (text === 'KONTROL İŞLEMİ') appendClass(label, 'classes', 'mkko-th-question');
  if (text === 'Evet' || text === 'Hayır') appendClass(label, 'classes', 'mkko-th-answers');
  if (text === 'Fotoğraf') appendClass(label, 'classes', 'mkko-th-photo');
  if (text.includes('input.question') || text.includes('{{input.question}}')) {
    appendClass(label, 'classes', 'mkko-q-label');
  }
}

function patchChecklistTree(nodes) {
  for (const n of nodes || []) {
    if (!n || typeof n !== 'object') continue;
    const dn = String(propVal(n, 'display-name') || '');

    if (n.type === 'form-container') {
      appendClass(n, 'classes', 'mkko-form');
    } else if (n.type === 'form-array-container') {
      appendClass(n, 'classes', 'mkko-form-array');
    } else if (n.type === 'form-group-container') {
      if (dn === 'container departments') appendClass(n, 'classes', 'mkko-meta');
      if (dn === 'container Scale') appendClass(n, 'classes', 'mkko-table-head-wrap');
      if (dn === 'results container') appendClass(n, 'classes', 'mkko-question-row');
      if (dn === 'container36') appendClass(n, 'classes', 'mkko-notes-body');
      if (dn === 'container43') appendClass(n, 'classes', 'mkko-text-question-row');

      const labelChild = (n.children || [])
        .flatMap((c) => (c?.type === 'grid' ? c.children || [] : c ? [c] : []))
        .find((c) => c?.type === 'label');
      const labelText = labelChild
        ? String(propVal(labelChild, 'text') || '')
        : '';
      if (labelText === 'UYGULAMA') appendClass(n, 'classes', 'mkko-section-app');
      if (labelText.startsWith('Checklistler;')) appendClass(n, 'classes', 'mkko-warning');
      if (labelText === 'Diğer Kontroller ve Bilgiler') {
        appendClass(n, 'classes', 'mkko-section-title');
      }
    } else if (n.type === 'grid') {
      if (dn === 'Row1' && String(propVal(n, 'custom-classes') || '').includes('mkko-table-head')) {
        // already patched
      } else if (
        dn === 'Row1' &&
        (n.children || []).some((col) =>
          (col.children || []).some((c) => {
            const t = String(propVal(c, 'text') || '');
            return t === 'KONTROL İŞLEMİ' || t === 'Fotoğraf';
          })
        )
      ) {
        setGridClass(n, 'mkko-table-head');
      } else if (dn === 'Row1' && isQuestionGrid(n)) {
        setGridClass(n, 'mkko-question-grid');
      } else if (dn === 'Row1' && isTextQuestionGrid(n)) {
        setGridClass(n, 'mkko-text-question-grid');
      } else if (dn === 'Butonlar') {
        setGridClass(n, 'mkko-actions');
      }
    } else if (n.type === 'loop') {
      if (String(propVal(n, 'variable') || '') === 'operationChecklistsForms.questions') {
        ensureClasses(n, 'mkko-questions-loop');
      }
    } else if (n.type === 'condition') {
      if (dn === 'if type question') appendClass(n, 'classes', 'mkko-q-type-question');
      if (dn === 'if type description') appendClass(n, 'classes', 'mkko-notes-section');
      if (dn === 'if type title') appendClass(n, 'classes', 'mkko-section-title-wrap');
      if (dn === 'if type questionType2') appendClass(n, 'classes', 'mkko-text-question-wrap');
    } else if (n.type === 'label') {
      patchHeaderLabel(n);
    } else if (n.type === 'column') {
      const colDn = dn.toLowerCase();
      if (colDn === 'radio') appendColumnClass(n, 'mkko-radio-col');
      if (colDn === 'answer' && hasPhotoChild(n)) appendColumnClass(n, 'mkko-photo-col');
    } else if (n.type === 'input-hidden') {
      ensureClasses(n, 'mkko-hidden-field');
    }

    patchChecklistTree(n.children);
  }
}

function isQuestionGrid(grid) {
  return (grid.children || []).some((col) =>
    (col.children || []).some(
      (c) => c.type === 'input-radio' || String(propVal(c, 'display-name') || '') === 'Evet / Hayır'
    )
  );
}

function isTextQuestionGrid(grid) {
  return (grid.children || []).some((col) =>
    (col.children || []).some((c) => c.type === 'input-text')
  );
}

function hasPhotoChild(col) {
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'camera-file-upload') return true;
      if (walk(n.children)) return true;
    }
    return false;
  }
  return walk(col.children);
}

function restoreChecklistTree(nodes) {
  for (const n of nodes || []) {
    if (!n || typeof n !== 'object') continue;
    if (n.type === 'form-container') removeClass(n, 'classes', 'mkko-form');
    else if (n.type === 'form-array-container') removeClass(n, 'classes', 'mkko-form-array');
    else if (n.type === 'form-group-container') {
      for (const cls of [
        'mkko-meta',
        'mkko-table-head-wrap',
        'mkko-question-row',
        'mkko-notes-body',
        'mkko-text-question-row',
        'mkko-section-app',
        'mkko-warning',
        'mkko-section-title',
      ]) {
        removeClass(n, 'classes', cls);
      }
    } else if (n.type === 'grid') {
      const cc = String(propVal(n, 'custom-classes') || '');
      if (MKKO_CLASSES.some((c) => cc.includes(c))) {
        const cleaned = cc
          .split(/\s+/)
          .filter((c) => c && !MKKO_CLASSES.includes(c))
          .join(' ');
        setProp(n, 'custom-classes', cleaned);
        const settings = prop(n, 'settings');
        if (settings?.value && !cleaned) settings.value.customClasses = false;
      }
    } else if (n.type === 'loop') {
      removeClass(n, 'classes', 'mkko-questions-loop');
    } else if (n.type === 'condition') {
      for (const cls of [
        'mkko-q-type-question',
        'mkko-notes-section',
        'mkko-section-title-wrap',
        'mkko-text-question-wrap',
      ]) {
        removeClass(n, 'classes', cls);
      }
    } else if (n.type === 'label') {
      for (const cls of ['mkko-th-question', 'mkko-th-answers', 'mkko-th-photo', 'mkko-q-label']) {
        removeClass(n, 'classes', cls);
      }
    } else if (n.type === 'column') {
      removeColumnClass(n, 'mkko-radio-col');
      removeColumnClass(n, 'mkko-photo-col');
    } else if (n.type === 'input-hidden') {
      removeClass(n, 'classes', 'mkko-hidden-field');
    }
    restoreChecklistTree(n.children);
  }
}

function isDetailForm(block) {
  return block.type === 'form-container' && propVal(block, 'display-name') === 'Form Detayı';
}

function patchChecklistForm(form) {
  patchChecklistTree(form.children);
  return form;
}

function restoreChecklistForm(form) {
  restoreChecklistTree(form.children);
  return form;
}

function wrapChecklistForm(form) {
  patchChecklistForm(form);
  return simpleContainer(
    [checklistHeadBlock(), form],
    'mkko-checklist-card',
    'Kontrol listesi kartı'
  );
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
  const detailForm = blocks.find(isDetailForm);

  for (const g of toolbarGrids) setGridClass(g, 'ass__toolbar');

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(heroBlock());
  if (detailForm) ordered.push(wrapChecklistForm(detailForm));
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
      if (cls.includes('mkko-checklist-card')) {
        const form = (b.children || []).find(isDetailForm);
        if (form) {
          restoreChecklistForm(form);
          out.push(form);
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

    if (isDetailForm(b)) {
      restoreChecklistForm(b);
      out.push(b);
    }
  }

  return out;
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
    if (block.type === 'data-source') {
      dataBlocks.push(block);
    } else if (block.type === 'grid' || block.type === 'form-container') {
      uiBlocks.push(block);
    } else if (block.type !== 'simple-container' && block.type !== 'content-header') {
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
