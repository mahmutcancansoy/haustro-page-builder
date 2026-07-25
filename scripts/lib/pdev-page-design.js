const fs = require('fs');
const path = require('path');

const BASE_STYLES_FILE = path.join(
  __dirname,
  '../../templates/aylik-sayim-sonucu-page-styles.css'
);
const SECTIONS_EXT_FILE = path.join(
  __dirname,
  '../../templates/depo-sube-detayi-page-extensions.css'
);
const EXT_STYLES_FILE = path.join(
  __dirname,
  '../../templates/performans-degerlendirme-page-extensions.css'
);
const HERO_FILE = path.join(
  __dirname,
  '../../templates/performans-degerlendirme-hero.html'
);

const PAGE_CONFIG = {
  pageId: '655dec3bb03e36099d24c02d',
  layoutName: 'Performans Değerlendirme Layout',
};

const UI_TYPES = new Set(['grid', 'content-header', 'condition']);

const PDEV_CLASSES = [
  'pdev-create-form',
  'pdev-select-form',
  'pdev-end-form',
  'pdev-simple-table',
  'pdev-inline-stat',
  'pdev-empty-msg',
  'pdev-actions',
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

function isActionsGrid(grid) {
  return grid.type === 'grid' && propVal(grid, 'display-name') === 'Toolbar Container Copy';
}

function isLegacyTitleHeader(block) {
  return (
    block.type === 'content-header' && propVal(block, 'display-name') === 'Performans Değerlendirme'
  );
}

function isInlineStatHeader(block) {
  if (block.type !== 'content-header') return false;
  const text = String(propVal(block, 'text') || '');
  return text.includes('completedReviews') || propVal(block, 'display-name') === 'Evaluation Title';
}

function isMainCondition(block) {
  return block.type === 'condition' && propVal(block, 'display-name') === '"{{evaluationPeriod._id}}"';
}

function isEmptyCondition(block) {
  return block.type === 'condition' && propVal(block, 'display-name') === '!"{{evaluationPeriod._id}}"';
}

function isDataOnlyCondition(block) {
  if (block.type !== 'condition') return false;
  const kids = block.children || [];
  return kids.length > 0 && kids.every((c) => c.type === 'data-source');
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

function sectionsHeadBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="ass__list-head pdev-list-head">
  <div class="ass__list-head-icon"><i class="pi pi-users"></i></div>
  <div>
    <h2>Değerlendirme süreci</h2>
    <p>Personel seçimi, değerlendirme listeleri ve dönem işlemleri.</p>
  </div>
</div>`,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Bölüm başlık',
      },
    ],
  };
}

function hideContentHeader(block) {
  block.type = 'condition';
  block.isContainer = true;
  block.children = [];
  block.properties = [
    {
      key: 'display-name',
      header: 'Display name',
      type: 'input-text-property',
      value: 'Stat header hidden',
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

function patchTableActionForm(form) {
  for (const cls of ['pdev-create-form', 'pdev-select-form', 'pdev-end-form']) {
    removeClass(form, 'classes', cls);
  }
  ensureClasses(form, 'pdev-table-action-form');
}

function patchContentTree(nodes, insideTable = false) {
  injectMandatoryRoleColumns(nodes);

  for (const n of nodes || []) {
    if (!n || typeof n !== 'object') continue;
    const dn = String(propVal(n, 'display-name') || '');

    if (n.type === 'grid') {
      if (isToolbarGrid(n) && dn.toLowerCase().includes('toolbar container')) {
        setGridClass(n, 'ass__toolbar');
      } else if (isActionsGrid(n)) {
        setGridClass(n, 'pdev-actions');
      }
      patchContentTree(n.children, insideTable);
    } else if (n.type === 'acordion') {
      setProp(n, 'classes', 'ass__accordion');
      patchContentTree(n.children, insideTable);
    } else if (n.type === 'simple-table') {
      ensureClasses(n, 'pdev-simple-table');
      patchContentTree(n.children, true);
    } else if (n.type === 'form-container') {
      if (insideTable) {
        patchTableActionForm(n);
      } else {
        if (dn === 'create period') ensureClasses(n, 'pdev-create-form');
        if (dn === 'Personel Seçimi') ensureClasses(n, 'pdev-select-form');
        if (dn === 'Değerlendirme Bitime Formu') ensureClasses(n, 'pdev-end-form');
      }
      patchContentTree(n.children, insideTable);
    } else if (isInlineStatHeader(n)) {
      hideContentHeader(n);
    } else if (n.type === 'label') {
      const text = String(propVal(n, 'text') || '');
      if (dn === 'New Label 6') ensureClasses(n, 'pdev-empty-msg');
      if (text.includes('Toplam Değerlendirme') && text.includes('totalUsers')) {
        ensureClasses(n, 'pdev-hidden-stat');
      }
      patchContentTree(n.children, insideTable);
    } else {
      patchContentTree(n.children, insideTable);
    }
  }
}

function restoreContentTree(nodes) {
  removeMandatoryRoleColumns(nodes);

  for (const n of nodes || []) {
    if (!n || typeof n !== 'object') continue;

    if (n.type === 'grid') {
      const cc = String(propVal(n, 'custom-classes') || '');
      if (cc.includes('ass__toolbar') || cc.includes('pdev-actions')) {
        clearGridClass(n);
      }
    } else if (n.type === 'acordion') {
      const cls = String(propVal(n, 'classes') || '');
      if (cls.includes('ass__accordion')) {
        setProp(n, 'classes', cls.replace(/\bass__accordion\b/g, '').trim());
      }
    } else if (n.type === 'simple-table') {
      removeClass(n, 'classes', 'pdev-simple-table');
    } else if (n.type === 'form-container') {
      for (const cls of [
        'pdev-create-form',
        'pdev-select-form',
        'pdev-end-form',
        'pdev-table-action-form',
      ]) {
        removeClass(n, 'classes', cls);
      }
    } else if (n.type === 'content-header') {
      removeClass(n, 'classes', 'pdev-inline-stat');
    } else if (n.type === 'label') {
      removeClass(n, 'classes', 'pdev-empty-msg');
      removeClass(n, 'classes', 'pdev-hidden-stat');
    }

    restoreContentTree(n.children);
  }
}

function wrapMainCondition(condition) {
  patchContentTree(condition.children);
  return simpleContainer(
    [sectionsHeadBlock(), condition],
    'pdev-content-card',
    'Değerlendirme içerik kartı'
  );
}

function wrapEmptyCondition(condition) {
  patchContentTree(condition.children);
  return simpleContainer([condition], 'pdev-empty-card', 'Boş durum kartı');
}

function cloneBlock(block) {
  return JSON.parse(JSON.stringify(block));
}

function tableColumnProps({ displayName, variable, header, width = 'auto' }) {
  return [
    {
      key: 'display-name',
      header: 'Display name',
      type: 'input-text-property',
      value: displayName,
    },
    {
      key: 'variable',
      header: 'Variable name',
      type: 'input-text-property',
      value: variable,
    },
    {
      key: 'header',
      header: 'Header',
      type: 'input-text-property',
      value: header,
    },
    {
      key: 'width',
      header: 'Width',
      type: 'input-text-property',
      value: width,
    },
    {
      key: 'content-direction',
      type: 'select-property',
      options: [
        { label: 'row', value: 'row' },
        { label: 'column', value: 'column' },
      ],
      header: 'Content direction',
      value: 'row',
    },
    {
      key: 'justify-content',
      header: 'Justify content',
      type: 'select-property',
      options: [
        { label: 'Unset', value: 'unset' },
        { label: 'Start', value: 'flex-start' },
        { label: 'Center', value: 'center' },
        { label: 'End', value: 'flex-end' },
      ],
      value: 'center',
    },
    {
      key: 'align-items',
      header: 'Align items',
      type: 'select-property',
      options: [
        { label: 'Unset', value: 'unset' },
        { label: 'Start', value: 'flex-start' },
        { label: 'Center', value: 'center' },
        { label: 'End', value: 'flex-end' },
      ],
      value: '',
    },
    {
      key: 'filter-type',
      header: 'Filter Type',
      type: 'select-property',
      options: [
        { label: 'No Filter', value: 'none' },
        { label: 'Text', value: 'text' },
        { label: 'Select', value: 'select' },
      ],
      value: 'none',
    },
    {
      key: 'filter-select',
      header: 'Filter Select Options',
      type: 'textarea-property',
      value: [],
    },
    {
      key: 'settings',
      header: 'Settings',
      type: 'checkbox-property',
      options: [{ label: 'Hide in mobile', name: 'hideInMobile' }],
      value: { hideInMobile: false },
    },
  ];
}

function labelBlock({ displayName, text, classes = '', color = '#777777', bold = false }) {
  return {
    type: 'label',
    isContainer: false,
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
        key: 'text',
        header: 'Text',
        type: 'textarea-property',
        value: text,
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'action',
        type: 'select-property',
        options: [
          { label: 'No action', value: 'noAction' },
          { label: 'Link', value: 'link' },
          { label: 'Route', value: 'route' },
          { label: 'Download', value: 'download' },
        ],
        header: 'Action',
        value: 'noAction',
      },
      {
        key: 'styles',
        header: 'Styles',
        type: 'group-property',
        children: [
          {
            key: 'font-size',
            header: 'Font size',
            type: 'input-text-property',
            value: '15px',
            inGroup: true,
          },
          {
            key: 'color',
            header: 'Color',
            type: 'color-picker-property',
            value: color,
            inGroup: true,
          },
          {
            key: 'font-style',
            type: 'checkbox-property',
            header: 'Font styles',
            options: [
              { label: 'Bold', name: 'bold' },
              { label: 'Italic', name: 'italic' },
            ],
            value: { bold, italic: false },
            inGroup: true,
          },
        ],
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [{ label: 'In form', name: 'inForm' }],
        value: { inForm: false },
      },
    ],
  };
}

function conditionBlock({ displayName, condition, children }) {
  return {
    type: 'condition',
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
        key: 'condition',
        header: 'Condition',
        type: 'textarea-property',
        value: condition,
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
}

function roleDescriptionColumn() {
  return {
    type: 'table-column',
    isContainer: true,
    children: [
      labelBlock({
        displayName: 'Rol',
        text: '{{input.roleDescription}}',
      }),
    ],
    properties: tableColumnProps({
      displayName: 'Rol',
      variable: 'roleDescription',
      header: 'Rol',
    }),
  };
}

function mandatoryStatusColumn() {
  return {
    type: 'table-column',
    isContainer: true,
    children: [
      conditionBlock({
        displayName: 'Zorunlu değerlendirme',
        condition: '{{input.mandatoryEvaluateStatus}} == true',
        children: [
          labelBlock({
            displayName: 'Zorunlu',
            text: 'Zorunlu',
            classes: 'pdev-mandatory-badge',
            color: '#b45309',
            bold: true,
          }),
        ],
      }),
      conditionBlock({
        displayName: 'İsteğe bağlı değerlendirme',
        condition: '{{input.mandatoryEvaluateStatus}} == false',
        children: [
          labelBlock({
            displayName: 'İsteğe bağlı',
            text: 'İsteğe bağlı',
            classes: 'pdev-optional-badge',
            color: '#64748b',
          }),
        ],
      }),
    ],
    properties: tableColumnProps({
      displayName: 'Değerlendirme zorunluluğu',
      variable: 'mandatoryEvaluateStatus',
      header: 'Değerlendirme',
      width: '9rem',
    }),
  };
}

function mandatoryRolesHintBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content:
      '<div class="pdev-mandatory-hint"><i class="pi pi-info-circle"></i><span>Tabloda <strong>Zorunlu</strong> olarak işaretlenen satırlar, rol tanımına göre değerlendirilmesi zorunlu personel gruplarını gösterir. {{#if performanceEvaluationsUserStats.mandatoryTotalUsers}}Bu dönemde <strong>{{performanceEvaluationsUserStats.mandatoryTotalUsers}}</strong> zorunlu değerlendirme hedefi var (tamamlanan: {{performanceEvaluationsUserStats.mandatoryCompletedUsers}}).{{/if}}</span></div>',
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Zorunlu değerlendirme bilgisi',
      },
    ],
  };
}

function isPersonnelTable(block) {
  return (
    block?.type === 'simple-table' &&
    propVal(block, 'variable') === 'performanceEvaluationsUsers.results'
  );
}

function hasMandatoryRoleColumns(table) {
  return (table.children || []).some(
    (col) =>
      col.type === 'table-column' &&
      (propVal(col, 'variable') === 'mandatoryEvaluateStatus' ||
        propVal(col, 'variable') === 'roleDescription')
  );
}

function findPersonnelAccordionTab(nodes) {
  for (const node of nodes || []) {
    if (node?.type === 'acordion-tab') {
      const header = propVal(node, 'header');
      const table = (node.children || []).find(isPersonnelTable);
      if (table && String(header).includes('Değerlendirilecek Personeller')) {
        return node;
      }
    }
    const nested = findPersonnelAccordionTab(node.children);
    if (nested) return nested;
  }
  return null;
}

function injectMandatoryRoleColumns(nodes) {
  const tab = findPersonnelAccordionTab(nodes);
  if (!tab) return;

  const table = (tab.children || []).find(isPersonnelTable);
  if (!table || hasMandatoryRoleColumns(table)) return;

  const columns = table.children || [];
  const actionIdx = columns.findIndex(
    (col) =>
      col.type === 'table-column' &&
      (col.children || []).some((child) => child.type === 'form-container')
  );
  const insertAt = actionIdx >= 0 ? actionIdx : columns.length;

  columns.splice(insertAt, 0, roleDescriptionColumn(), mandatoryStatusColumn());

  const hasHint = (tab.children || []).some(
    (child) => propVal(child, 'display-name') === 'Zorunlu değerlendirme bilgisi'
  );
  if (!hasHint) {
    const tableIdx = tab.children.indexOf(table);
    tab.children.splice(tableIdx, 0, mandatoryRolesHintBlock());
  }
}

function removeMandatoryRoleColumns(nodes) {
  for (const node of nodes || []) {
    if (node?.type === 'acordion-tab') {
      node.children = (node.children || []).filter(
        (child) => propVal(child, 'display-name') !== 'Zorunlu değerlendirme bilgisi'
      );
    }

    if (isPersonnelTable(node) && hasMandatoryRoleColumns(node)) {
      node.children = (node.children || []).filter(
        (col) =>
          !(
            col.type === 'table-column' &&
            (propVal(col, 'variable') === 'mandatoryEvaluateStatus' ||
              propVal(col, 'variable') === 'roleDescription')
          )
      );
    }

    removeMandatoryRoleColumns(node.children);
  }
}

function findCondition13(content) {
  return content.find((b) => propVal(b, 'display-name') === 'New Condition 13');
}

function injectStatsDataSource(content) {
  const cond13 = findCondition13(content);
  if (!cond13) return;

  const children = cond13.children || [];
  const peuIdx = children.findIndex(
    (b) => b.type === 'data-source' && propVal(b, 'variable-name') === 'performanceEvaluationsUsers'
  );
  if (peuIdx < 0) return;

  const existingIdx = children.findIndex(
    (b) =>
      b.type === 'data-source' && propVal(b, 'variable-name') === 'performanceEvaluationsUserStats'
  );

  if (existingIdx >= 0) {
    const settings = prop(children[existingIdx], 'settings');
    if (settings?.value) {
      settings.value.single = true;
      settings.value.debug = false;
    }
    return;
  }

  const statsDs = cloneBlock(children[peuIdx]);
  setProp(statsDs, 'display-name', 'performanceEvaluationsUserStats');
  setProp(statsDs, 'variable-name', 'performanceEvaluationsUserStats');
  const settings = prop(statsDs, 'settings');
  if (settings?.value) {
    settings.value.single = true;
    settings.value.debug = false;
  }
  children.splice(peuIdx + 1, 0, statsDs);
}

function restoreDataSources(content) {
  function walk(blocks) {
    for (let i = blocks.length - 1; i >= 0; i--) {
      const b = blocks[i];
      if (b.type === 'data-source') {
        const vn = propVal(b, 'variable-name');
        const settings = prop(b, 'settings');
        if (vn === 'performanceEvaluationsUsers' || vn === 'performanceEvaluations') {
          if (settings?.value) settings.value.single = false;
        }
        if (vn === 'performanceEvaluationsUserStats') {
          blocks.splice(i, 1);
          continue;
        }
      }
      walk(b.children || []);
    }
  }
  walk(content);
}

function wrapHeroSection() {
  return simpleContainer([heroBlock()], 'pdev-hero-wrap', 'Hero bölümü');
}

function patchDataSources(blocks) {
  for (const b of blocks || []) {
    if (b.type === 'data-source') {
      const vn = propVal(b, 'variable-name');
      const settings = prop(b, 'settings');
      if (settings?.value) {
        settings.value.debug = false;
        if (vn === 'performanceEvaluationsUsers' || vn === 'performanceEvaluations') {
          settings.value.single = false;
        }
      }
    }
    patchDataSources(b.children);
  }
}

function patchUiBlocks(blocks) {
  const toolbarGrids = blocks.filter((b) => b.type === 'grid' && isToolbarGrid(b));
  const mainCondition = blocks.find(isMainCondition);
  const emptyCondition = blocks.find(isEmptyCondition);

  for (const g of toolbarGrids) setGridClass(g, 'ass__toolbar');

  const ordered = [];
  for (const g of toolbarGrids) ordered.push(g);
  ordered.push(wrapHeroSection());
  if (mainCondition) ordered.push(wrapMainCondition(mainCondition));
  if (emptyCondition) ordered.push(wrapEmptyCondition(emptyCondition));
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
      if (cls.includes('pdev-hero-wrap')) continue;
      if (cls.includes('pdev-content-card')) {
        const condition = (b.children || []).find(isMainCondition);
        if (condition) {
          restoreContentTree(condition.children);
          out.push(condition);
        }
        continue;
      }
      if (cls.includes('pdev-empty-card')) {
        const condition = (b.children || []).find(isEmptyCondition);
        if (condition) {
          restoreContentTree(condition.children);
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
      } else if (cls.includes('pdev-actions')) {
        clearGridClass(b);
      } else if (cls) {
        clearGridClass(b);
      }
      out.push(b);
      continue;
    }

    if (isMainCondition(b)) {
      restoreContentTree(b.children);
      out.push(b);
      continue;
    }

    if (isEmptyCondition(b)) {
      restoreContentTree(b.children);
      out.push(b);
    }
  }

  return out;
}

function applyLayout(content) {
  restoreDataSources(content);
  patchDataSources(content);
  injectStatsDataSource(content);

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
    } else if (isDataOnlyCondition(block)) {
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
  const sections = fs.readFileSync(SECTIONS_EXT_FILE, 'utf8').trim();
  const ext = fs.readFileSync(EXT_STYLES_FILE, 'utf8').trim();
  return `${base}\n\n${sections}\n\n${ext}`;
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
