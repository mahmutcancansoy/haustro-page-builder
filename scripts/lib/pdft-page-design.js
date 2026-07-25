const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/performans-degerlendirme-formu-tum-sonuclar-page-extensions.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/performans-degerlendirme-formu-tum-sonuclar-hero.html'
);

const PAGE_CONFIG = {
  pageId: '65f75d69b03e360f4a2c32b5',
  layoutName: 'Performans Formu Tüm Sonuçlar Layout',
};

const PDFT_CLASSES = [
  'pdft-results-form',
  'pdft-form-array',
  'pdft-form-group',
  'pdft-matrix-meta',
  'pdft-matrix-header',
  'pdft-matrix-body',
  'pdft-matrix-loop',
  'pdft-question-loop',
  'pdft-scores-loop',
  'pdft-criterion',
  'pdft-score-chip',
  'pdft-avg-score',
  'pdft-grand-avg',
  'pdft-evaluator-row',
  'pdft-total-row',
  'pdft-scroll-col',
  'pdft-criteria-col',
  'pdft-avg-col',
  'pdft-matrix-row',
  'pdft-matrix-rows-loop',
  'pdft-matrix-footer',
  'pdft-row-criterion',
  'pdft-row-scores',
  'pdft-row-avg',
  'pdft-footer-spacer',
  'pdft-filter-grid',
  'pdft-hidden-field',
];

function cloneBlock(block) {
  return JSON.parse(JSON.stringify(block));
}

function cloneColumnShell(templateCol, children, customClass) {
  const col = cloneBlock(templateCol);
  col.children = children;
  if (customClass) {
    enableSetting(col, 'customClasses');
    setProp(col, 'custom-classes', customClass);
  }
  return col;
}

function isRestructuredMatrix(grid) {
  const first = (grid.children || [])[0];
  if (!first || first.type !== 'loop') return false;
  if (String(propVal(first, 'variable')) !== 'performanceEvaluations.questions') {
    return false;
  }
  const inner = (first.children || [])[0];
  if (!inner || inner.type !== 'grid') return false;
  const cc = String(propVal(inner, 'custom-classes') || '');
  const dn = String(propVal(inner, 'display-name') || '');
  return cc.includes('pdft-matrix-row') || dn === 'Matrix Row';
}

function restructureMatrixGrid(grid) {
  if (!grid || propVal(grid, 'display-name') !== 'Grid') return grid;
  if (isRestructuredMatrix(grid)) return grid;

  const cols = (grid.children || []).filter((c) => c.type === 'column');
  if (cols.length !== 3) return grid;

  const col0Loop = cols[0].children?.find((c) => c.type === 'loop');
  const col1Loop = cols[1].children?.find((c) => c.type === 'loop');
  const col1Footer = cols[1].children?.find(
    (c) =>
      c.type === 'simple-container' &&
      propVal(c, 'display-name') === 'New Simple Container 2'
  );
  const col2Loop = cols[2].children?.find((c) => c.type === 'loop');
  const col2Footer = cols[2].children?.find((c) => c.type === 'label');

  if (!col0Loop || !col1Loop || !col2Loop) return grid;

  const criterionParts = cloneBlock(col0Loop.children || []);
  const scoresShell = cloneBlock(col1Loop.children[0]);
  const avgParts = cloneBlock(col2Loop.children || []);

  const rowGrid = cloneBlock(grid);
  setProp(rowGrid, 'display-name', 'Matrix Row');
  enableSetting(rowGrid, 'customClasses');
  setProp(rowGrid, 'custom-classes', 'pdft-matrix-row');
  rowGrid.children = [
    cloneColumnShell(cols[0], criterionParts, 'pdft-row-criterion'),
    cloneColumnShell(cols[1], [scoresShell], 'pdft-row-scores'),
    cloneColumnShell(cols[2], avgParts, 'pdft-row-avg'),
  ];

  const questionLoop = cloneBlock(col0Loop);
  questionLoop.children = [rowGrid];
  ensureClasses(questionLoop, 'pdft-matrix-rows-loop');

  const footerGrid = cloneBlock(grid);
  setProp(footerGrid, 'display-name', 'Matrix Footer');
  enableSetting(footerGrid, 'customClasses');
  setProp(footerGrid, 'custom-classes', 'pdft-matrix-footer');
  footerGrid.children = [
    cloneColumnShell(cols[0], [], 'pdft-row-criterion pdft-footer-spacer'),
    cloneColumnShell(
      cols[1],
      col1Footer ? [cloneBlock(col1Footer)] : [],
      'pdft-row-scores'
    ),
    cloneColumnShell(
      cols[2],
      col2Footer ? [cloneBlock(col2Footer)] : [],
      'pdft-row-avg'
    ),
  ];

  grid.children = [questionLoop, footerGrid];
  return grid;
}

function patchMatrixRow(rowGrid) {
  const cols = (rowGrid.children || []).filter((c) => c.type === 'column');
  if (cols[0]) appendColumnClass(cols[0], 'pdft-row-criterion');
  if (cols[1]) appendColumnClass(cols[1], 'pdft-row-scores');
  if (cols[2]) appendColumnClass(cols[2], 'pdft-row-avg');
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

function appendColumnClass(column, className) {
  enableSetting(column, 'customClasses');
  appendClass(column, 'custom-classes', className);
}

function removeColumnClass(column, className) {
  removeClass(column, 'custom-classes', className);
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

function isFilterGrid(grid) {
  return grid.type === 'grid' && propVal(grid, 'display-name') === 'Row1 Copy Copy Copy';
}

function isTitleHeader(block) {
  return block.type === 'content-header' && propVal(block, 'display-name') === 'Title';
}

function isDetailForm(block) {
  return block.type === 'form-container' && propVal(block, 'display-name') === 'Form Detayı';
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

function patchLabelByText(label) {
  const text = String(propVal(label, 'text') || '');
  const cls = String(propVal(label, 'classes') || '');

  if (text.includes('input.criterion')) {
    appendClass(label, 'classes', 'pdft-criterion');
    removeClass(label, 'classes', 'h-40');
    removeClass(label, 'classes', 'w-40');
    removeClass(label, 'classes', 'pdft-score-chip');
    return;
  }

  if (
    text.includes('input.averageScore') ||
    text.includes('performanceEvaluations.averageEvaluationScores')
  ) {
    appendClass(label, 'classes', 'pdft-avg-score');
    if (text.includes('performanceEvaluations.averageEvaluationScores')) {
      appendClass(label, 'classes', 'pdft-grand-avg');
    }
    removeClass(label, 'classes', 'h-40');
    removeClass(label, 'classes', 'w-40');
    removeClass(label, 'classes', 'pdft-score-chip');
    return;
  }

  if (cls.includes('h-40') || cls.includes('w-40')) {
    appendClass(label, 'classes', 'pdft-score-chip');
  }
}

function clearColumnBg(column) {
  const bg = prop(column, 'bg');
  const colorProp = bg?.children?.find((c) => c.key === 'color');
  if (colorProp) colorProp.value = 'rgba(0,0,0,0)';
}

function patchMatrixBodyColumns(grid) {
  const cols = (grid.children || []).filter((c) => c.type === 'column');
  if (!cols.length) return;

  appendColumnClass(cols[0], 'pdft-criteria-col');

  const scrollCol = cols.find((c) =>
    String(propVal(c, 'custom-classes') || '').includes('col-scroll')
  );
  if (scrollCol) appendColumnClass(scrollCol, 'pdft-scroll-col');

  if (cols.length > 1) {
    const avgCol = cols[cols.length - 1];
    appendColumnClass(avgCol, 'pdft-avg-col');
    clearColumnBg(avgCol);
  }
}

function restoreMatrixBodyColumns(grid) {
  for (const col of (grid.children || []).filter((c) => c.type === 'column')) {
    removeColumnClass(col, 'pdft-criteria-col');
    removeColumnClass(col, 'pdft-scroll-col');
    removeColumnClass(col, 'pdft-avg-col');
  }
}

function restoreLabel(label) {
  for (const cls of [
    'pdft-criterion',
    'pdft-avg-score',
    'pdft-grand-avg',
    'pdft-score-chip',
  ]) {
    removeClass(label, 'classes', cls);
  }
}

function patchResultsTree(nodes) {
  for (const n of nodes || []) {
    if (n.type === 'form-group-container') {
      appendClass(n, 'classes', 'pdft-form-group');
    } else if (n.type === 'grid') {
      const dn = propVal(n, 'display-name');
      if (dn === 'Row1 Copy Copy') setGridClass(n, 'pdft-matrix-meta');
      if (dn === 'Row1') setGridClass(n, 'pdft-matrix-header');
      if (dn === 'Grid') {
        restructureMatrixGrid(n);
        setGridClass(n, 'pdft-matrix-body');
        if (!isRestructuredMatrix(n)) {
          patchMatrixBodyColumns(n);
        }
      }
      if (dn === 'Matrix Row') {
        setGridClass(n, 'pdft-matrix-row');
        patchMatrixRow(n);
      }
      if (dn === 'Matrix Footer') {
        setGridClass(n, 'pdft-matrix-footer');
        patchMatrixRow(n);
      }
    } else if (n.type === 'loop') {
      appendClass(n, 'classes', 'pdft-matrix-loop');
      const variable = String(propVal(n, 'variable') || '');
      if (variable === 'performanceEvaluations.questions') {
        appendClass(n, 'classes', 'pdft-question-loop');
      }
      if (
        variable === 'input.scores' ||
        variable === 'performanceEvaluations.evaluationScores'
      ) {
        appendClass(n, 'classes', 'pdft-scores-loop');
      }
    } else if (n.type === 'label') {
      patchLabelByText(n);
    } else if (n.type === 'simple-container') {
      const cls = String(propVal(n, 'classes') || '');
      const dn = propVal(n, 'display-name');
      if (cls.includes('rowFlex')) appendClass(n, 'classes', 'pdft-evaluator-row');
      if (dn === 'New Simple Container 2') appendClass(n, 'classes', 'pdft-total-row');
    } else if (n.type === 'input-hidden') {
      ensureClasses(n, 'pdft-hidden-field');
    }
    patchResultsTree(n.children);
  }
}

function restoreResultsTree(nodes) {
  for (const n of nodes || []) {
    if (n.type === 'form-group-container') {
      removeClass(n, 'classes', 'pdft-form-group');
    } else if (n.type === 'grid') {
      const dn = propVal(n, 'display-name');
      if (dn === 'Grid') restoreMatrixBodyColumns(n);

      const cc = String(propVal(n, 'custom-classes') || '');
      if (PDFT_CLASSES.some((c) => cc === c || cc.startsWith(`${c} `) || cc.includes(` ${c}`))) {
        const cleaned = cc
          .split(/\s+/)
          .filter((c) => c && !PDFT_CLASSES.includes(c))
          .join(' ');
        setProp(n, 'custom-classes', cleaned);
        const settings = prop(n, 'settings');
        if (settings?.value && !cleaned) settings.value.customClasses = false;
      }
    } else if (n.type === 'column') {
      removeColumnClass(n, 'pdft-criteria-col');
      removeColumnClass(n, 'pdft-scroll-col');
      removeColumnClass(n, 'pdft-avg-col');
      removeColumnClass(n, 'pdft-row-criterion');
      removeColumnClass(n, 'pdft-row-scores');
      removeColumnClass(n, 'pdft-row-avg');
      removeColumnClass(n, 'pdft-footer-spacer');
    } else if (n.type === 'loop') {
      for (const cls of [
        'pdft-matrix-loop',
        'pdft-question-loop',
        'pdft-scores-loop',
        'pdft-matrix-rows-loop',
      ]) {
        removeClass(n, 'classes', cls);
      }
    } else if (n.type === 'label') {
      restoreLabel(n);
    } else if (n.type === 'simple-container') {
      removeClass(n, 'classes', 'pdft-evaluator-row');
      removeClass(n, 'classes', 'pdft-total-row');
    } else if (n.type === 'input-hidden') {
      removeClass(n, 'classes', 'pdft-hidden-field');
    }
    restoreResultsTree(n.children);
  }
}

function patchResultsForm(form) {
  appendClass(form, 'classes', 'pdft-results-form');
  for (const child of form.children || []) {
    if (child.type === 'form-array-container') {
      appendClass(child, 'classes', 'pdft-form-array');
      patchResultsTree(child.children);
    }
  }
  return form;
}

function restoreResultsForm(form) {
  removeClass(form, 'classes', 'pdft-results-form');
  for (const child of form.children || []) {
    if (child.type === 'form-array-container') {
      removeClass(child, 'classes', 'pdft-form-array');
      restoreResultsTree(child.children);
    }
  }
}

function patchFilterGrid(grid) {
  setGridClass(grid, 'pdft-filter-grid');
  return grid;
}

function restoreFilterGrid(grid) {
  clearGridClass(grid);
}

function wrapFilterSection(grid) {
  return simpleContainer([patchFilterGrid(grid)], 'pdft-filter-card', 'Filtre kartı');
}

function wrapResultsForm(form) {
  patchResultsForm(form);
  return simpleContainer([form], 'pdft-results-card', 'Sonuç tablosu kartı');
}

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const filterGrid = blocks.find(isFilterGrid);
  const detailForm = blocks.find(isDetailForm);

  for (const g of toolbarGrids) setGridClass(g, 'ass__toolbar');

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(heroBlock());
  if (filterGrid) ordered.push(wrapFilterSection(filterGrid));
  if (detailForm) ordered.push(wrapResultsForm(detailForm));
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
    if (isTitleHeader(b)) continue;

    if (b.type === 'simple-container') {
      const cls = String(propVal(b, 'classes') || '');
      if (cls.includes('pdft-filter-card')) {
        const grid = (b.children || []).find(isFilterGrid);
        if (grid) {
          restoreFilterGrid(grid);
          out.push(grid);
        }
        continue;
      }
      if (cls.includes('pdft-results-card')) {
        const form = (b.children || []).find(isDetailForm);
        if (form) {
          restoreResultsForm(form);
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
      } else if (isFilterGrid(b)) {
        restoreFilterGrid(b);
      } else if (cls) {
        clearGridClass(b);
      }
      out.push(b);
      continue;
    }

    if (isDetailForm(b)) {
      restoreResultsForm(b);
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
    if (block.type === 'data-source') {
      dataBlocks.push(block);
    } else if (block.type !== 'simple-container') {
      uiBlocks.push(block);
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
