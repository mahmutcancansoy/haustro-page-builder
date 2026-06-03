#!/usr/bin/env node
/**
 * anasayfa-copy sayfasının Profile Section render-template'ini günceller.
 * Kullanım: node scripts/patch-anasayfa-copy-design.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = '6a1f79785170eb067118bdc8';
const ROOT = path.join(__dirname, '..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8').trim();
}

function addFeedClass(blocks) {
  for (const block of blocks) {
    if (block.type === 'simple-container') {
      const nameProp = (block.properties || []).find((p) => p.key === 'display-name');
      if (nameProp && nameProp.value === 'New Simple Container 2') {
        const classesProp = (block.properties || []).find((p) => p.key === 'classes');
        if (classesProp && !classesProp.value.includes('hp-copy-feed')) {
          classesProp.value = `${classesProp.value} hp-copy-feed`.trim();
        }
      }
    }
    if (block.children?.length) addFeedClass(block.children);
  }
}

function lastLoginDataSource() {
  return {
    type: 'data-source',
    isContainer: false,
    children: [],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Previous Login',
      },
      {
        key: 'variable-name',
        header: 'Variable name',
        type: 'input-text-property',
        value: 'lastLogin',
      },
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
      {
        key: 'table-name',
        header: 'Table name',
        type: 'input-text-property',
        value: '',
        conditions: [{ key: 'function', rule: "value == 'get'" }],
      },
      {
        key: 'custom-function-name',
        header: 'Custom function name',
        type: 'input-text-property',
        value: 'getPreviousLogin',
        conditions: [{ key: 'function', rule: "value == 'custom'" }],
      },
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
        value: {
          single: false,
          debug: false,
          canReload: false,
          forTable: false,
        },
      },
    ],
  };
}

function patchLastLoginDataSource(ds) {
  if (!ds) return;

  const set = (key, value, conditions) => {
    let prop = ds.properties.find((p) => p.key === key);
    if (!prop) {
      prop = { key, header: key, type: 'input-text-property', value };
      if (conditions) prop.conditions = conditions;
      ds.properties.push(prop);
    } else {
      prop.value = value;
    }
  };

  set('display-name', 'Previous Login');
  set('variable-name', 'lastLogin');
  set('function', 'custom');
  set('custom-function-name', 'getPreviousLogin', [{ key: 'function', rule: "value == 'custom'" }]);
  set('post-params', '{\n\n}', [{ key: 'function', rule: "value == 'custom'" }]);
  set('table-filters', '{\n\n}', [{ key: 'function', rule: "value == 'get'" }]);

  const settings = ds.properties.find((p) => p.key === 'settings');
  if (settings) {
    settings.value = { single: false, debug: false, canReload: false, forTable: false };
  }
}

function ensureLastLoginDataSource(content) {
  const ds = content.find(
    (b) =>
      b.type === 'data-source' &&
      b.properties?.find((p) => p.key === 'variable-name')?.value === 'lastLogin'
  );

  if (ds) {
    patchLastLoginDataSource(ds);
    return content;
  }

  const usersIdx = content.findIndex(
    (b) =>
      b.type === 'data-source' &&
      b.properties?.find((p) => p.key === 'variable-name')?.value === 'users'
  );
  const insertAt = usersIdx >= 0 ? usersIdx + 1 : content.length;
  content.splice(insertAt, 0, lastLoginDataSource());
  return content;
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const doc = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
    if (!doc) throw new Error(`pageContents bulunamadı: ${PAGE_ID}`);

    const html = read('templates/anasayfa-copy-body.html');
    const styles = read('templates/anasayfa-copy-styles.css');

    const content = JSON.parse(JSON.stringify(doc.content || []));
    const rt = content.find((b) => b.type === 'render-template');
    if (!rt) throw new Error('render-template bloğu bulunamadı');

    rt.content = html;
    addFeedClass(content);
    ensureLastLoginDataSource(content);

    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_ID },
      { $set: { content, styles } }
    );

    console.log('pageId:', PAGE_ID);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('render-template length:', html.length, 'char');
    console.log('styles length:', styles.length, 'char');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close();
  }
})();
