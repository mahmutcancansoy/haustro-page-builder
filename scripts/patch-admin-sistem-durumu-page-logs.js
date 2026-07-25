#!/usr/bin/env node
/**
 * Admin Sistem Durumu — şablon senkronu (tek render-template)
 *
 *   node scripts/patch-admin-sistem-durumu-page-logs.js
 *   node scripts/patch-admin-sistem-durumu-page-logs.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { inspectPageContent } = require('./lib/sync-page-from-db');

const PAGE_ID = '6a4e3b63811889b624701420';
const TEMPLATE = 'admin-sistem-durumu';
const RT_NAME = 'Kullanıcı özeti dashboard';

const DASHBOARD_HTML = path.join(
  __dirname,
  '../templates/admin-sistem-durumu-kullan-c-zeti-dashboard.html'
);
const STYLES_FILE = path.join(__dirname, '../templates/admin-sistem-durumu-page-styles.css');
const CONTENT_FILE = path.join(__dirname, '../templates/admin-sistem-durumu-content.json');

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function prop(key, type, value, extra = {}) {
  return { key, header: key, type, value, ...extra };
}

function findRenderTemplate(blocks, displayName) {
  for (const b of blocks || []) {
    if (b.type === 'render-template') {
      const name = (b.properties || []).find((p) => p.key === 'display-name')?.value;
      if (name === displayName) return b;
    }
    const found = findRenderTemplate(b.children, displayName);
    if (found) return found;
  }
  return null;
}

function findDataSource(blocks, variableName) {
  for (const b of blocks || []) {
    if (b.type === 'data-source') {
      if (!variableName) return b;
      const name = (b.properties || []).find((p) => p.key === 'variable-name')?.value;
      if (name === variableName) return b;
    }
    const found = findDataSource(b.children, variableName);
    if (found) return found;
  }
  return null;
}

function setProp(block, key, value) {
  if (!block?.properties) return false;
  const p = block.properties.find((x) => x.key === key);
  if (!p) return false;
  p.value = value;
  return true;
}

function makeHeaderHiddenCondition() {
  return {
    type: 'condition',
    isContainer: true,
    children: [],
    properties: [
      prop('display-name', 'input-text-property', 'Header hidden'),
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
    ],
  };
}

function makeCondition(displayName, condition, children) {
  return {
    type: 'condition',
    isContainer: true,
    children,
    properties: [
      prop('display-name', 'input-text-property', displayName),
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

function makeOverviewDs() {
  return {
    type: 'data-source',
    isContainer: false,
    children: [],
    properties: [
      prop('display-name', 'input-text-property', 'Admin kullanıcı özeti'),
      prop('variable-name', 'input-text-property', 'adminOverview'),
      {
        key: 'function',
        header: 'Function',
        type: 'select-property',
        options: [
          { label: 'Get', value: 'get' },
          { label: 'Custom', value: 'custom' },
        ],
        value: 'custom',
      },
      prop('table-name', 'input-text-property', '', {
        conditions: [{ key: 'function', rule: "value == 'get'" }],
      }),
      prop('custom-function-name', 'input-text-property', 'adminUserOverview', {
        conditions: [{ key: 'function', rule: "value == 'custom'" }],
      }),
      {
        key: 'table-filters',
        header: 'Table filters',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'function', rule: "value == 'get'" }],
      },
      {
        key: 'post-params',
        header: 'Post',
        type: 'code-editor',
        value:
          '{\n  "userId": "{{params._id}}",\n  "pageId": "{{params.pageId}}",\n  "pvPage": "{{params.pvPage}}",\n  "filter": "",\n  "view": "{{params.view}}"\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'function', rule: "value == 'custom'" }],
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
        value: { single: false, debug: false, canReload: true, forTable: false },
      },
    ],
  };
}

function makeRenderTemplate(content, displayName) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: content.trim(),
    properties: [prop('display-name', 'input-text-property', displayName)],
  };
}

function makeSimpleContainer(children, displayName, classes = '') {
  return {
    type: 'simple-container',
    isContainer: true,
    children,
    properties: [
      prop('display-name', 'input-text-property', displayName),
      prop('classes', 'textarea-property', classes),
      prop('styles', 'code-editor', '{\n\n}'),
    ],
  };
}

function stripNativeTableStyles(styles) {
  const start = '/* Native panel table — sayfa ziyaretleri */';
  const idx = styles.indexOf(start);
  if (idx >= 0) {
    return styles.slice(0, idx).trimEnd() + '\n';
  }
  return styles;
}

function buildContent(html) {
  return [
    makeOverviewDs(),
    makeHeaderHiddenCondition(),
    makeCondition('Ana içerik', 'true', [
      makeSimpleContainer(
        [makeRenderTemplate(html, RT_NAME)],
        'Sistem Durumu Layout',
        'auo-page'
      ),
    ]),
  ];
}

function applyLocalTemplate() {
  if (!fs.existsSync(CONTENT_FILE)) {
    throw new Error(`Şablon yok: ${CONTENT_FILE}`);
  }
  if (!fs.existsSync(DASHBOARD_HTML)) {
    throw new Error(`HTML yok: ${DASHBOARD_HTML}`);
  }
  if (!fs.existsSync(STYLES_FILE)) {
    throw new Error(`CSS yok: ${STYLES_FILE}`);
  }

  const existing = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  const html = fs.readFileSync(DASHBOARD_HTML, 'utf8').trim();
  const styles = stripNativeTableStyles(fs.readFileSync(STYLES_FILE, 'utf8'));

  const payload = {
    ...existing,
    content: buildContent(html),
    styles,
    syncedAt: new Date().toISOString(),
  };

  fs.writeFileSync(STYLES_FILE, styles);
  fs.writeFileSync(CONTENT_FILE, JSON.stringify(payload, null, 2) + '\n');

  return { payload, inspection: inspectPageContent(payload.content) };
}

async function pushToDb(payload) {
  loadEnv();
  await connect();
  const db = getDb();
  const r = await db.collection('pageContents').updateOne(
    { pageId: PAGE_ID },
    {
      $set: {
        content: payload.content,
        styles: payload.styles || '',
      },
    }
  );
  await close();
  return r;
}

async function main() {
  const { payload, inspection } = applyLocalTemplate();
  console.log(`Şablon güncellendi: ${TEMPLATE}-content.json`);
  console.log('data-sources:', JSON.stringify(inspection.dataSources, null, 2));
  console.log(
    'render-templates:',
    inspection.renderTemplates.map((r) => r.displayName || r).join(', ')
  );

  if (!hasFlag('push')) {
    console.log('\nDB yazılmadı. Canlıya almak için: --push');
    return;
  }

  const r = await pushToDb(payload);
  console.log(
    `\nDB güncellendi: matched=${r.matchedCount} modified=${r.modifiedCount} pageId=${PAGE_ID}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
