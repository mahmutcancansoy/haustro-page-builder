#!/usr/bin/env node
/**
 * Araç Gereç Envanteri — custom filtre paneli + data-source reload
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = '5fef676e4fe5a500117b0852';
const TEMPLATE_FILES = [
  path.join(__dirname, '../templates/inventory-list-content.json'),
  path.join(__dirname, '../templates/sample-inventory-list-content.json'),
];

const TABLE_FILTERS = `{
    "delete": 0,
    ":inventoryCats:category": "{{forms.inventoryFilter.:inventoryCats:category.value}}",
    "name": {
        "$regex": "{{forms.inventoryFilter.name.value}}",
        "$options": "i"
    }
}`;

function clone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function findBlock(content, type, predicate) {
  for (const b of content || []) {
    if (b.type === type && (!predicate || predicate(b))) return b;
    if (b.children) {
      const f = findBlock(b.children, type, predicate);
      if (f) return f;
    }
  }
  return null;
}

function hasFilterPanel(content) {
  return !!findBlock(content, 'form-container', (b) => {
    const key = b.properties?.find((p) => p.key === 'key')?.value;
    return key === 'inventoryFilter';
  });
}

function inventoryCatsListDataSource() {
  return {
    type: 'data-source',
    isContainer: false,
    children: [],
    properties: [
      { key: 'display-name', header: 'Display name', type: 'input-text-property', value: 'Kategori listesi' },
      { key: 'variable-name', header: 'Variable name', type: 'input-text-property', value: 'inventoryCatsList' },
      {
        key: 'function',
        header: 'Function',
        type: 'select-property',
        options: [
          { label: 'Get', value: 'get' },
          { label: 'Custom', value: 'custom' },
        ],
        value: 'get',
      },
      {
        key: 'table-name',
        header: 'Table name',
        type: 'input-text-property',
        value: 'inventoryCats',
        conditions: [{ key: 'function', rule: "value == 'get'" }],
      },
      {
        key: 'custom-function-name',
        header: 'Custom function name',
        type: 'input-text-property',
        value: '',
        conditions: [{ key: 'function', rule: "value == 'custom'" }],
      },
      {
        key: 'table-filters',
        header: 'Table filters',
        type: 'code-editor',
        value: '{\n    "delete": 0\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'post-params',
        header: 'Post',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'function', rule: "value == 'custom'" }],
      },
      {
        key: 'debug-type',
        header: 'Debug type',
        type: 'select-property',
        options: [
          { label: 'Log', value: 'log' },
          { label: 'Table', value: 'table' },
        ],
        value: 'log',
        conditions: [{ key: 'settings', rule: 'value.debug' }],
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [
          { label: 'Single data', name: 'single' },
          { label: 'Debug', name: 'debug' },
          { label: 'Can reload', name: 'canReload' },
          { label: 'For table', name: 'forTable' },
        ],
        value: { single: false, debug: false, canReload: false, forTable: false },
      },
    ],
  };
}

function buildCategorySelect(templateSelect) {
  const sel = clone(templateSelect);
  const set = (key, val) => {
    const p = sel.properties.find((x) => x.key === key);
    if (p) p.value = val;
  };
  set('display-name', 'Filtre Kategori');
  set('name', ':inventoryCats:category');
  set('label', 'Kategori:');
  set('placeholder', 'Kategori seçin...');
  set('search-placeholder', 'Kategori ara...');
  set('width', '100%');
  set('type', 'dynamic');
  set('mode', 'dataSource');
  set('data-source', 'inventoryCatsList');
  set('dynamic-default-value', 'all');
  set('on-change', 'post');
  const settings = sel.properties.find((p) => p.key === 'settings');
  if (settings?.value) {
    settings.value.search = true;
    settings.value.clearButton = false;
    settings.value.inContainer = true;
    settings.value.selectFirst = false;
  }
  const optLabel = sel.properties
    .find((p) => p.key === 'option-data')
    ?.children?.find((c) => c.key === 'label');
  if (optLabel) optLabel.value = '{{option.name}}';
  const optVal = sel.properties
    .find((p) => p.key === 'option-data')
    ?.children?.find((c) => c.key === 'value');
  if (optVal) optVal.value = 'option._id';
  return sel;
}

function buildNameInput() {
  return {
    type: 'input-text',
    isContainer: false,
    properties: [
      { key: 'display-name', header: 'Display name', type: 'input-text-property', value: 'Filtre Ad' },
      { key: 'classes', header: 'Classes', type: 'textarea-property', value: '' },
      { key: 'name', header: 'Name', type: 'input-text-property', value: 'name' },
      {
        key: 'label',
        header: 'Label',
        type: 'input-text-property',
        value: 'Araç Gereç Adı:',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'settings', rule: '!value.inContainer' }],
      },
      { key: 'mask', header: 'Mask', type: 'input-text-property', value: '' },
      {
        key: 'placeholder',
        header: 'Placeholder',
        type: 'input-text-property',
        value: 'Ad, model veya kod ara...',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      { key: 'default-value', header: 'Default value', type: 'input-text-property', value: '' },
      { key: 'icon', header: 'Icon', type: 'input-text-property', value: '' },
      { key: 'width', header: 'Width', type: 'input-text-property', value: '100%' },
      {
        key: 'spacings',
        header: 'Spacings',
        type: 'spacings',
        unit: 'px',
        margins: [0, 0, 0, 0],
        paddings: [0, 0, 0, 0],
      },
      {
        key: 'on-change',
        header: 'On change',
        type: 'select-property',
        options: [
          { label: 'Nothing', value: 'nothing' },
          { label: 'Post', value: 'post' },
        ],
        value: 'nothing',
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [
          { label: 'Disabled', name: 'disabled' },
          { label: 'Readonly', name: 'readonly' },
          { label: 'Has icon', name: 'hasIcon' },
          { label: 'In container', name: 'inContainer' },
        ],
        value: { inContainer: true, disabled: false, readonly: false, hasIcon: false },
      },
    ],
  };
}

const FORM_SHELL_SKIP = new Set(['display-name', 'key']);

function findFormByKey(content, formKey) {
  return findBlock(content, 'form-container', (b) => {
    const key = b.properties?.find((p) => p.key === 'key')?.value;
    return key === formKey;
  });
}

/** Panel form-container action vb. zorunlu alanları olmadan render kırılıyor */
function ensureFilterFormProps(content) {
  const shell = findFormByKey(content, 'inventorySearch');
  const filter = findFormByKey(content, 'inventoryFilter');
  if (!shell || !filter) return false;

  const existing = new Set(filter.properties.map((p) => p.key));
  const settingsIdx = filter.properties.findIndex((p) => p.key === 'settings');

  for (const prop of shell.properties) {
    if (FORM_SHELL_SKIP.has(prop.key) || existing.has(prop.key)) continue;
    const insertAt = settingsIdx >= 0 ? settingsIdx : filter.properties.length;
    filter.properties.splice(insertAt, 0, clone(prop));
    existing.add(prop.key);
  }

  const set = (key, val) => {
    const p = filter.properties.find((x) => x.key === key);
    if (p) p.value = val;
  };
  set('action', 'get');
  set('table-name', 'inventory');
  set('on-success', 'nothing');
  set('url', '');
  set('query-params', '{\n\n}');
  set('response-name', '');
  const hidden = filter.properties.find((p) => p.key === 'hidden-values');
  if (hidden) hidden.value = '{\n    \n}';

  const settings = filter.properties.find((p) => p.key === 'settings');
  if (settings?.value) {
    settings.value.expose = true;
    settings.value.hidden = false;
  }
  return true;
}

function buildFilterForm(templateSelect) {
  return {
    type: 'form-container',
    isContainer: true,
    children: [buildCategorySelect(templateSelect), buildNameInput()],
    properties: [
      { key: 'display-name', header: 'Display name', type: 'input-text-property', value: 'Envanter Filtre' },
      { key: 'formId', header: 'Form ID', type: 'input-text-property', value: '' },
      { key: 'submitId', header: 'Submit Button ID', type: 'input-text-property', value: '' },
      {
        key: 'key',
        header: 'Key',
        type: 'input-text-property',
        value: 'inventoryFilter',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'settings', rule: 'value.expose' }],
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [
          { label: 'Hidden', name: 'hidden' },
          { label: 'Has confirm', name: 'hasConfirm' },
          { label: 'Debug', name: 'debug' },
          { label: 'Debug response', name: 'debugResponse' },
          { label: 'Expose', name: 'expose' },
          { label: 'At Least Required Fields', name: 'minReqFields' },
        ],
        value: {
          hidden: false,
          hasConfirm: false,
          debug: false,
          debugResponse: false,
          expose: true,
          minReqFields: false,
        },
      },
    ],
  };
}

function buildFilterGrid(filterForm) {
  return {
    type: 'grid',
    isContainer: true,
    children: [
      {
        type: 'column',
        isContainer: true,
        children: [filterForm],
        properties: [
          { key: 'display-name', header: 'Display name', type: 'input-text-property', value: 'Filtre kolon' },
          { key: 'custom-classes', header: 'Custom classes', type: 'textarea-property', value: '' },
          {
            key: 'content-direction',
            header: 'Content direction',
            type: 'select-property',
            options: [
              { label: 'Row', value: 'row' },
              { label: 'Column', value: 'column' },
            ],
            value: 'row',
          },
          { key: 'width', header: 'Width', type: 'input-text-property', value: '' },
          {
            key: 'justify-content',
            header: 'Justify content',
            type: 'select-property',
            options: [
              { label: 'Unset', value: 'unset' },
              { label: 'Start', value: 'flex-start' },
              { label: 'Center', value: 'center' },
              { label: 'End', value: 'flex-end' },
              { label: 'Space between', value: 'space-between' },
            ],
            value: 'flex-start',
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
              { label: 'Stretch', value: 'stretch' },
            ],
            value: 'flex-end',
          },
          {
            key: 'flex-wrap',
            header: 'Flex wrap',
            type: 'select-property',
            options: [
              { label: 'Unset', value: 'unset' },
              { label: 'No wrap', value: 'nowrap' },
              { label: 'Wrap', value: 'wrap' },
            ],
            value: 'wrap',
          },
          {
            key: 'spacings',
            header: 'Spacings',
            type: 'spacings',
            unit: 'px',
            margins: [0, 0, 12, 0],
            paddings: [12, 12, 12, 12],
          },
          {
            key: 'settings',
            header: 'Settings',
            type: 'checkbox-property',
            options: [
              { label: 'No gutter', name: 'noGutter' },
              { label: 'Fixed width', name: 'fixedWidth' },
              { label: 'Custom classes', name: 'customClasses' },
            ],
            value: { noGutter: false, fixedWidth: false, customClasses: false },
          },
        ],
      },
    ],
    properties: [
      { key: 'display-name', header: 'Display name', type: 'input-text-property', value: 'Envanter filtre paneli' },
      { key: 'custom-classes', header: 'Custom classes', type: 'textarea-property', value: '' },
      {
        key: 'content-direction',
        header: 'Content direction',
        type: 'select-property',
        options: [
          { label: 'Row', value: 'row' },
          { label: 'Column', value: 'column' },
        ],
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
        value: 'flex-start',
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
        value: 'stretch',
      },
      {
        key: 'spacings',
        header: 'Spacings',
        type: 'spacings',
        unit: 'px',
        margins: [0, 0, 0, 0],
        paddings: [0, 0, 0, 0],
      },
      {
        key: 'settings',
        header: 'Settings',
        type: 'checkbox-property',
        options: [
          { label: 'No gutter', name: 'noGutter' },
          { label: 'Reverse rows', name: 'reverseRows' },
          { label: 'Reverse columns', name: 'reverseColumns' },
          { label: 'Custom classes', name: 'customClasses' },
        ],
        value: { noGutter: false, reverseRows: false, reverseColumns: false, customClasses: false },
      },
    ],
  };
}

function patchInventoryDataSource(content) {
  const ds = content.find(
    (b) =>
      b.type === 'data-source' &&
      b.properties?.find((p) => p.key === 'variable-name')?.value === 'inventory' &&
      b.properties?.find((p) => p.key === 'settings')?.value?.forTable
  );
  if (!ds) throw new Error('inventory forTable data-source bulunamadı');

  const tf = ds.properties.find((p) => p.key === 'table-filters');
  if (tf) tf.value = TABLE_FILTERS;

  const settings = ds.properties.find((p) => p.key === 'settings');
  if (settings?.value) {
    settings.value.canReload = true;
    settings.value.forTable = true;
  }
}

function patchTable(content) {
  const table = content.find((b) => b.type === 'table');
  if (!table) throw new Error('table bulunamadı');

  for (const col of table.children || []) {
    if (col.type !== 'table-column') continue;
    const dn = col.properties?.find((p) => p.key === 'display-name')?.value;
    if (dn === 'Kategori' || dn === 'Araç Gereç Adı') {
      const ft = col.properties.find((p) => p.key === 'filter-type');
      if (ft) ft.value = 'none';
      const fs = col.properties.find((p) => p.key === 'filter-select');
      if (fs) fs.value = [];
    }
  }

  const settings = table.properties.find((p) => p.key === 'settings');
  if (settings?.value) {
    settings.value.filtering = false;
    settings.value.clearAllFilterBtn = true;
  }
}

function patchContent(content) {
  const templateSelect = findBlock(content, 'input-select');
  if (!templateSelect) throw new Error('input-select şablonu bulunamadı');

  if (!content.find((b) => b.type === 'data-source' && b.properties?.some((p) => p.key === 'variable-name' && p.value === 'inventoryCatsList'))) {
    const tempIdx = content.findIndex((b) => b.type === 'data-source' && b.properties?.some((p) => p.key === 'variable-name' && p.value === 'tempSearch'));
    const insertAt = tempIdx >= 0 ? tempIdx + 1 : content.findIndex((b) => b.type === 'template') + 1;
    content.splice(insertAt, 0, inventoryCatsListDataSource());
  }

  if (!hasFilterPanel(content)) {
    const tableIdx = content.findIndex((b) => b.type === 'table');
    if (tableIdx < 0) throw new Error('table bulunamadı');
    content.splice(tableIdx, 0, buildFilterGrid(buildFilterForm(templateSelect)));
  }

  ensureFilterFormProps(content);
  patchNameInputOnChange(content);
  patchInventoryDataSource(content);
  patchTable(content);
}

function patchNameInputOnChange(content) {
  const filter = findFormByKey(content, 'inventoryFilter');
  if (!filter) return;
  for (const child of filter.children || []) {
    if (child.type !== 'input-text') continue;
    const name = child.properties?.find((p) => p.key === 'name')?.value;
    if (name !== 'name') continue;
    const onChange = child.properties?.find((p) => p.key === 'on-change');
    if (onChange) onChange.value = 'nothing';
  }
}

function patchFile(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  patchContent(raw.content);
  fs.writeFileSync(filePath, JSON.stringify(raw, null, 2) + '\n');
  console.log('Şablon güncellendi:', filePath);
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    for (const f of TEMPLATE_FILES) patchFile(f);

    const doc = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
    if (!doc) throw new Error(`pageContents yok: ${PAGE_ID}`);
    patchContent(doc.content);
    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_ID },
      { $set: { content: doc.content } }
    );
    console.log('DB — matched:', r.matchedCount, 'modified:', r.modifiedCount);
    await close();
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
