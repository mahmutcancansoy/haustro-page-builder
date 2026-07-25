const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const PROFILE_EXT_FILE = path.join(
  __dirname,
  '../../templates/personel-detay-page-extensions.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/performans-degerlendirme-rapor-ozeti-page-extensions.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/performans-degerlendirme-rapor-ozeti-hero.html'
);

const PAGE_CONFIG = {
  pageId: '657c3b8fb03e3600147cd7b2',
  layoutName: 'Performans Değerlendirme Rapor Özeti Layout',
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

function setColumnClass(column, className) {
  enableSetting(column, 'customClasses');
  setProp(column, 'custom-classes', className);
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

function isProductBlockGrid(grid) {
  return grid.type === 'grid' && propVal(grid, 'display-name') === 'Product Block';
}

function isProductContainerGrid(grid) {
  return grid.type === 'grid' && propVal(grid, 'display-name') === 'Product Container';
}

function findHeaderLabel(grid) {
  for (const col of grid.children || []) {
    for (const child of col.children || []) {
      if (child.type === 'label' && propVal(child, 'display-name') === 'Header') {
        return child;
      }
    }
  }
  return null;
}

function isPeriodHeaderBlock(grid) {
  if (!isProductBlockGrid(grid)) return false;
  const label = findHeaderLabel(grid);
  return (
    !!label &&
    String(propVal(label, 'text') || '').includes('evaluationPeriod.periodText')
  );
}

function isFormResultHeaderBlock(grid, index = 0) {
  if (!isProductBlockGrid(grid)) return false;
  const label = findHeaderLabel(grid);
  return (
    !!label &&
    String(propVal(label, 'text') || '').includes(
      `performanceEvaluations.${index}.formName`
    )
  );
}

function isSecondFormCondition(block) {
  return block.type === 'condition' && propVal(block, 'display-name') === '2. form check';
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
        value: 'Dönem hero',
      },
    ],
  };
}

function columnHasNameLabel(column) {
  return (column.children || []).some(
    (c) => c.type === 'label' && propVal(c, 'display-name') === 'Users Name'
  );
}

function patchProductGrid(grid) {
  setGridClass(grid, 'ass__profile-product');
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'image' && propVal(n, 'display-name') === 'Product Image') {
        setProp(n, 'classes', 'ass__profile-img');
        setProp(n, 'width', '');
        setProp(n, 'height', '');
      }
      if (n.type === 'label' && propVal(n, 'display-name') === 'Users Name') {
        setProp(n, 'classes', 'ass__profile-name');
      }
      if (n.type === 'grid' && propVal(n, 'display-name') === 'Details Inner Container') {
        setGridClass(n, 'ass__profile-details');
        for (const col of n.children || []) {
          if (col.type !== 'column') continue;
          if (columnHasNameLabel(col)) {
            setColumnClass(col, 'ass__profile-name-row');
          } else {
            setColumnClass(col, 'ass__profile-stat');
          }
        }
      }
      if (n.type === 'column') {
        const dn = propVal(n, 'display-name');
        if (dn === 'Details Container') {
          setColumnClass(n, 'ass__profile-main');
        } else if (dn === 'Image Container') {
          setColumnClass(n, 'ass__profile-media');
          const settings = prop(n, 'settings');
          if (settings?.value) settings.value.fixedWidth = false;
          setProp(n, 'width', '');
        } else {
          const hasImage = (n.children || []).some((c) => c.type === 'image');
          if (hasImage) setColumnClass(n, 'ass__profile-media');
        }
      }
      walk(n.children);
    }
  }
  walk(grid.children);
  return grid;
}

function restoreProductGrid(grid) {
  clearGridClass(grid);
  function walk(nodes) {
    for (const n of nodes || []) {
      if (n.type === 'image' && propVal(n, 'classes') === 'ass__profile-img') {
        setProp(n, 'classes', '');
      }
      if (n.type === 'label' && propVal(n, 'classes') === 'ass__profile-name') {
        setProp(n, 'classes', '');
      }
      if (n.type === 'column') {
        const cls = String(propVal(n, 'custom-classes') || '');
        if (
          cls.includes('ass__profile-media') ||
          cls.includes('ass__profile-main') ||
          cls.includes('ass__profile-stat') ||
          cls.includes('ass__profile-name-row')
        ) {
          setProp(n, 'custom-classes', '');
          const settings = prop(n, 'settings');
          if (settings?.value) settings.value.customClasses = false;
        }
      }
      if (n.type === 'grid') {
        const cls = String(propVal(n, 'custom-classes') || '');
        if (cls.includes('ass__profile-details')) {
          clearGridClass(n);
        }
      }
      walk(n.children);
    }
  }
  walk(grid.children);
}

function wrapProduct(grid) {
  return simpleContainer([patchProductGrid(grid)], 'ass__profile-card', 'Personel profil kartı');
}

function patchFormHeaderGrid(grid) {
  setGridClass(grid, 'pdro-section-head-grid');
  const label = findHeaderLabel(grid);
  if (label) appendClass(label, 'classes', 'pdro-section-title');
  return grid;
}

function restoreFormHeaderGrid(grid) {
  clearGridClass(grid);
  const label = findHeaderLabel(grid);
  if (label) {
    setProp(
      label,
      'classes',
      String(propVal(label, 'classes') || '')
        .replace('pdro-section-title', '')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }
}

function patchSummaryForm(form) {
  for (const child of form.children || []) {
    if (child.type !== 'label') continue;
    appendClass(child, 'classes', 'pdro-summary-row');
    const text = String(propVal(child, 'text') || '');
    const action = String(propVal(child, 'action') || '');
    if (text === 'Görüntüle' && action === 'route') {
      appendClass(child, 'classes', 'pdro-summary-action');
    }
  }
  appendClass(form, 'classes', 'pdro-summary-form');
  return form;
}

function restoreSummaryForm(form) {
  setProp(
    form,
    'classes',
    String(propVal(form, 'classes') || '')
      .replace('pdro-summary-form', '')
      .replace(/\s+/g, ' ')
      .trim()
  );
  for (const child of form.children || []) {
    if (child.type !== 'label') continue;
    setProp(
      child,
      'classes',
      String(propVal(child, 'classes') || '')
        .replace('pdro-summary-row', '')
        .replace('pdro-summary-action', '')
        .replace(/\s+/g, ' ')
        .trim()
    );
  }
}

function wrapFormSection(headerGrid, form, cardClass = 'pdro-summary-card') {
  const parts = [];
  if (headerGrid) parts.push(patchFormHeaderGrid(headerGrid));
  if (form) parts.push(patchSummaryForm(form));
  return simpleContainer(parts, cardClass, 'Değerlendirme özeti kartı');
}

function unwrapSummaryCard(card) {
  const out = [];
  for (const child of card.children || []) {
    if (isProductBlockGrid(child)) {
      restoreFormHeaderGrid(child);
      out.push(child);
    } else if (child.type === 'form-container') {
      restoreSummaryForm(child);
      out.push(child);
    }
  }
  return out;
}

function patchSecondFormCondition(condition) {
  const kids = condition.children || [];
  const headerGrid = kids.find(isProductBlockGrid);
  const form = kids.find((c) => c.type === 'form-container');
  condition.children = [
    wrapFormSection(
      headerGrid,
      form,
      'pdro-summary-card pdro-summary-card--alt'
    ),
  ];
  return condition;
}

function unwrapSecondFormCondition(condition) {
  if (
    condition.children?.length === 1 &&
    condition.children[0].type === 'simple-container' &&
    String(propVal(condition.children[0], 'classes') || '').includes('pdro-summary-card')
  ) {
    condition.children = unwrapSummaryCard(condition.children[0]);
  }
  return condition;
}

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const productGrid = blocks.find(isProductContainerGrid);
  const form1Header = blocks.find((b) => isFormResultHeaderBlock(b, 0));
  const form1 = blocks.find(
    (b) => b.type === 'form-container' && propVal(b, 'display-name') === 'Form 1'
  );
  const form2Cond = blocks.find(isSecondFormCondition);

  for (const g of toolbarGrids) setGridClass(g, 'ass__toolbar');

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(heroBlock());
  if (productGrid) ordered.push(wrapProduct(productGrid));
  if (form1Header || form1) ordered.push(wrapFormSection(form1Header, form1));
  if (form2Cond) ordered.push(patchSecondFormCondition(form2Cond));

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

    if (b.type === 'simple-container') {
      const cls = String(propVal(b, 'classes') || '');
      if (cls.includes('ass__profile-card')) {
        const product = (b.children || []).find(isProductContainerGrid);
        if (product) {
          restoreProductGrid(product);
          out.push(product);
        }
        continue;
      }
      if (cls.includes('pdro-summary-card')) {
        out.push(...unwrapSummaryCard(b));
        continue;
      }
    }

    if (isSecondFormCondition(b)) {
      out.push(unwrapSecondFormCondition(b));
      continue;
    }

    if (b.type === 'grid') {
      if (isPeriodHeaderBlock(b)) continue;
      if (isProductContainerGrid(b)) {
        out.push(b);
        continue;
      }

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

    if (b.type === 'form-container') {
      restoreSummaryForm(b);
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
  const profile = fs.readFileSync(PROFILE_EXT_FILE, 'utf8').trim();
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${profile}\n\n${ext}`;
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
