const fs = require('fs');
const path = require('path');

const STYLES_FILE = path.join(
  __dirname,
  '../../templates/denetleme-raporlari-page-styles.css'
);
const CARD_FILE = path.join(
  __dirname,
  '../../templates/denetleme-raporlari-loop-card.html'
);
const ORIGINAL_PATH = path.join(
  __dirname,
  '../../templates/denetleme-raporlari-content.original.json'
);

const PAGE_CONFIG = {
  pageId: '64aeb149b03e360015135611',
  layoutName: 'Denetleme Raporları Layout',
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

function patchDepartmentsDataSource(block) {
  if (block.type !== 'data-source') return false;
  if (propVal(block, 'variable-name') !== 'departments') return false;

  setProp(block, 'function', 'custom');
  setProp(block, 'custom-function-name', 'departmentsLastInspection');
  setProp(block, 'table-name', '');
  return true;
}

function patchDataSources(blocks) {
  for (const b of blocks || []) {
    patchDepartmentsDataSource(b);
    patchDataSources(b.children);
  }
}

function heroBlock() {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: `<div class="dr__hero">
  <div class="dr__hero-main">
    <span class="dr__eyebrow">Operasyon denetimi</span>
    <h1>Denetleme Raporları</h1>
    <p>Şubelerin son denetleme tarihi ve puan özeti</p>
  </div>
  {{#if departments.length}}<span class="dr__count">{{departments.length}} şube</span>{{/if}}
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

function findDepartmanColumn(content) {
  let found;
  function walk(blocks) {
    for (const b of blocks || []) {
      if (
        b.type === 'table-column' &&
        propVal(b, 'display-name') === 'Departman'
      ) {
        found = b;
        return;
      }
      walk(b.children);
    }
  }
  walk(content);
  return found;
}

function makeRenderTemplate(content, displayName) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content,
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

function findViewButton(content) {
  let found;
  function walk(blocks) {
    for (const b of blocks || []) {
      if (b.type === 'button' && propVal(b, 'display-name') === 'Görüntüle') {
        found = b;
        return;
      }
      walk(b.children);
    }
  }
  walk(content);
  return found;
}

function patchViewButton(button) {
  setProp(button, 'display-name', 'Raporu görüntüle');
  setProp(button, 'text', 'Raporu görüntüle');
  setProp(button, 'classes', 'dr-card__action-btn');
  setProp(button, 'severity', 'p-button-secondary');
  setProp(button, 'size', 'p-button-sm');
  setProp(button, 'icon', 'pi pi-arrow-right');
  setProp(button, 'icon-position', 'right');

  const settings = prop(button, 'settings');
  if (settings?.value) {
    settings.value.hasIcon = true;
    settings.value.hasOutline = false;
    settings.value.textButton = false;
  }
}

function patchTableAsCards(table, templateCol, viewButton, cardHtml) {
  const col = JSON.parse(JSON.stringify(templateCol));
  setProp(col, 'display-name', 'Şube kartı');
  setProp(col, 'header', '');
  setProp(col, 'variable', '');

  const btn = JSON.parse(JSON.stringify(viewButton));
  patchViewButton(btn);

  const card = simpleContainer(
    [makeRenderTemplate(cardHtml, 'Şube kart içeriği'), btn],
    'dr-card',
    'Şube kartı'
  );
  col.children = [card];

  table.children = [col];
  setProp(table, 'display-name', 'Şube kart grid');
  setProp(table, 'classes', 'dr-table');
  setProp(table, 'empty-message', 'Gösterilecek şube bulunamadı.');
  setProp(table, 'data-source', 'departments');
  setProp(table, 'row-count', 100);

  const settings = prop(table, 'settings');
  if (settings?.value) {
    settings.value.pagination = false;
    settings.value.sorting = false;
    settings.value.filtering = false;
  }
}

function loadOriginalContent() {
  if (!fs.existsSync(ORIGINAL_PATH)) {
    throw new Error(`Orijinal yedek bulunamadı: ${ORIGINAL_PATH}`);
  }
  return JSON.parse(fs.readFileSync(ORIGINAL_PATH, 'utf8')).content;
}

function applyLayout() {
  const original = loadOriginalContent();
  const conditions = JSON.parse(
    JSON.stringify(original.filter((b) => b.type === 'condition'))
  );
  patchDataSources(conditions);

  const table = original.find((b) => b.type === 'table');
  if (!table) throw new Error('Orijinal tablo bulunamadı');

  const templateCol = findDepartmanColumn(original);
  if (!templateCol) throw new Error('Departman kolonu bulunamadı');

  const viewButton = findViewButton(original);
  if (!viewButton) throw new Error('Görüntüle butonu bulunamadı');

  const tableCopy = JSON.parse(JSON.stringify(table));
  const cardHtml = fs.readFileSync(CARD_FILE, 'utf8').trim();
  patchTableAsCards(tableCopy, templateCol, viewButton, cardHtml);

  const layout = simpleContainer(
    [heroBlock(), tableCopy],
    'dr-page',
    PAGE_CONFIG.layoutName
  );

  return [...conditions, layout];
}

function loadStyles() {
  return fs.readFileSync(STYLES_FILE, 'utf8').trim();
}

module.exports = {
  PAGE_CONFIG,
  applyLayout,
  loadStyles,
};
