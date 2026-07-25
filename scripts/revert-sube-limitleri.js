#!/usr/bin/env node
/**
 * sube-limitleri: modern kart / custom DS / layout değişikliklerini geri alır.
 * Kullanım: node scripts/revert-sube-limitleri.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = '69c305ff5170eb001c6a8bd3';
const TEMPLATE_PATH = path.join(__dirname, '../templates/sube-limitleri-content.json');

const LABEL_ACTION = {
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
};

function makeLabel(displayName, text) {
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
      { key: 'classes', header: 'Classes', type: 'textarea-property', value: '' },
      {
        key: 'text',
        header: 'Text',
        type: 'textarea-property',
        value: text,
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'label',
        header: 'Form label',
        type: 'input-text-property',
        value: '',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'settings', rule: 'value.inForm' }],
      },
      LABEL_ACTION,
      {
        key: 'url',
        header: 'Url',
        type: 'textarea-property',
        value: '',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'action', rule: "value != 'noAction'" }],
      },
    ],
  };
}

function makeDepartmentsDataSource(existing) {
  const block = JSON.parse(JSON.stringify(existing));
  for (const p of block.properties || []) {
    if (p.key === 'function') p.value = 'get';
    if (p.key === 'table-name') p.value = 'departments';
    if (p.key === 'custom-function-name') p.value = '';
    if (p.key === 'table-filters') p.value = '{\n "status": "active"\n}';
    if (p.key === 'post-params') p.value = '{\n\n}';
  }
  return block;
}

function makePageHeader() {
  return {
    type: 'page-header',
    isContainer: false,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Şube Limitleri',
      },
      { key: 'classes', header: 'Classes', type: 'textarea-property', value: '' },
      {
        key: 'text',
        header: 'Text',
        type: 'textarea-property',
        value: 'Şube Limitleri',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'bg-color',
        header: 'Background color',
        type: 'color-picker-property',
        value: '#980056',
      },
      {
        key: 'text-color',
        header: 'Text color',
        type: 'color-picker-property',
        value: '#fff',
      },
    ],
  };
}

function makeListSection(loopTemplate) {
  const loop = JSON.parse(JSON.stringify(loopTemplate));
  loop.children = [
    {
      type: 'simple-container',
      isContainer: true,
      children: [
        makeLabel('Şube adı', '{{input.label}} ({{input.short}})'),
        makeLabel(
          'Müdür',
          '{{input.:users:manager.name}} {{input.:users:manager.surname}}'
        ),
        makeLabel(
          'Satın alım başı limit',
          '{{input.purchaseLimits.perTransactionLimit}} ₺'
        ),
        makeLabel('Aylık limit', '{{input.purchaseLimits.monthlyLimit}} ₺'),
        makeLabel('Yıllık limit', '{{input.purchaseLimits.yearlyLimit}} ₺'),
      ],
      properties: [
        {
          key: 'display-name',
          header: 'Display name',
          type: 'input-text-property',
          value: 'Şube limit kartı',
        },
        { key: 'classes', header: 'Classes', type: 'textarea-property', value: '' },
        {
          key: 'styles',
          header: 'Styles',
          type: 'code-editor',
          value:
            '{\n  "border": "1px solid #ddd",\n  "border-radius": "8px",\n  "padding": "16px",\n  "min-width": "280px",\n  "flex": "1 1 300px",\n  "box-sizing": "border-box"\n}',
          autoComplete: true,
          autoCompleteMode: 'template',
        },
      ],
    },
  ];

  return {
    type: 'simple-container',
    isContainer: true,
    children: [loop],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'New Simple Container 1',
      },
      { key: 'classes', header: 'Classes', type: 'textarea-property', value: '' },
      {
        key: 'styles',
        header: 'Styles',
        type: 'code-editor',
        value:
          '{\n  "display": "flex",\n  "flex-wrap": "wrap",\n  "gap": "16px",\n  "padding": "16px"\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
    ],
  };
}

function findLoop(blocks) {
  for (const b of blocks || []) {
    if (b.type === 'loop') {
      const ds = (b.properties || []).find((p) => p.key === 'data-source');
      if (ds?.value === 'departments') return b;
    }
    const found = findLoop(b.children);
    if (found) return found;
  }
  return null;
}

function revertFormSubmit(blocks) {
  for (const b of blocks || []) {
    if (b.type === 'form-container') {
      for (const p of b.properties || []) {
        if (p.key === 'action' && p.value === 'custom') {
          p.value = 'update';
        }
        if (p.key === 'custom-function-name') {
          p.value = '';
        }
        if (p.key === 'table-name' && !p.conditions?.length) {
          p.value = 'departments';
        }
        if (p.key === 'field-id') {
          p.value = '{{forms.formExpo.:departments:.value}}';
        }
        if (p.key === 'hidden-values') {
          p.value = '{\n\n}';
        }
      }
    }
    revertFormSubmit(b.children);
  }
}

function revertContent(doc) {
  const ds = doc.content.find((b) => b.type === 'data-source');
  const loop = findLoop(doc.content);
  if (!ds || !loop) throw new Error('departments data-source veya loop bulunamadı');

  const tail = doc.content.slice(3);
  revertFormSubmit(tail);

  doc.content = [
    makeDepartmentsDataSource(ds),
    makePageHeader(),
    makeListSection(loop),
    ...tail,
  ];
  doc.styles = '';
}

(async () => {
  try {
    const doc = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
    revertContent(doc);
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    const cssPath = path.join(__dirname, '../templates/sube-limitleri-page-styles.css');
    if (fs.existsSync(cssPath)) fs.writeFileSync(cssPath, '');

    loadEnv();
    await connect();
    const r = await getDb().collection('pageContents').updateOne(
      { pageId: PAGE_ID },
      { $set: { content: doc.content, styles: doc.styles } }
    );

    console.log('pageId:', PAGE_ID);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('Şube limitleri sayfası eski yapıya döndürüldü.');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
