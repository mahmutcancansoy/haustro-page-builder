#!/usr/bin/env node
/**
 * Admin Sistem Durumu — filtre kartları için ayrı liste sayfaları
 *
 *   node scripts/setup-admin-sistem-kullanici-listeleri.js
 *   node scripts/setup-admin-sistem-kullanici-listeleri.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { grantAdminRole, findPageByName, getPageById } = require('../src/pageService');
const { nowUtcDate } = require('../src/utils');
const {
  makeHeaderHiddenCondition,
  makeCondition,
  makeSimpleContainer,
  makeRenderTemplate,
  makePageMeta,
  SABIT_VERILER_ID,
} = require('./lib/auo-page-design');

const LIST_PAGES = [
  {
    filter: 'active',
    title: 'Aktif Kullanıcılar',
    url: 'admin-sistem-aktif-kullanicilar',
    icon: 'pi pi-users',
  },
  {
    filter: 'today',
    title: 'Bugün Giriş Yapanlar',
    url: 'admin-sistem-bugun-giris',
    icon: 'pi pi-sign-in',
  },
  {
    filter: 'pending',
    title: 'Bekleyen Bildirimi Olanlar',
    url: 'admin-sistem-bekleyen-bildirim',
    icon: 'pi pi-bell',
  },
  {
    filter: 'messages',
    title: 'Okunmamış Mesajı Olanlar',
    url: 'admin-sistem-okunmamis-mesaj',
    icon: 'pi pi-envelope',
  },
  {
    filter: 'never',
    title: 'Hiç Giriş Yapmamışlar',
    url: 'admin-sistem-hic-giris-yok',
    icon: 'pi pi-history',
  },
];

const BODY_FILE = path.join(
  __dirname,
  '../templates/admin-sistem-kullanici-listesi-body.html'
);
const STYLES_FILE = path.join(
  __dirname,
  '../templates/admin-sistem-durumu-page-styles.css'
);
const DASHBOARD_PAGE_ID = '6a4e3b63811889b624701420';

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function makeListDataSource(filter) {
  return {
    type: 'data-source',
    isContainer: false,
    children: [],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Admin kullanıcı listesi',
      },
      {
        key: 'variable-name',
        header: 'Variable name',
        type: 'input-text-property',
        value: 'adminOverview',
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
        value: 'adminUserOverview',
        conditions: [{ key: 'function', rule: "value == 'custom'" }],
      },
      {
        key: 'table-filters',
        header: 'Table filters',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'post-params',
        header: 'Post',
        type: 'code-editor',
        value: `{\n  "filter": "${filter}"\n}`,
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
        value: {
          single: false,
          debug: false,
          canReload: true,
          forTable: false,
        },
      },
    ],
  };
}

function buildListContent(filter) {
  const body = fs.readFileSync(BODY_FILE, 'utf8').trim();
  return [
    makeListDataSource(filter),
    makeHeaderHiddenCondition(),
    makeCondition('Ana içerik', 'true', [
      makeSimpleContainer(
        [makeRenderTemplate(body, 'Kullanıcı filtre listesi')],
        'Liste Layout',
        'auo-page'
      ),
    ]),
  ];
}

function loadStyles() {
  return fs.readFileSync(STYLES_FILE, 'utf8').trim();
}

async function ensurePageOrder(db, pageId, parentId) {
  const pid = String(pageId);
  const existing = await db.collection('pageOrders').findOne({ pageId: pid });
  if (existing) return existing.order;

  const siblings = await db.collection('pages').find({ parent: String(parentId) }).toArray();
  const siblingIds = siblings.map((s) => String(s._id));
  const orders = await db
    .collection('pageOrders')
    .find({ pageId: { $in: siblingIds } })
    .toArray();
  const max = orders.reduce((m, o) => Math.max(m, Number(o.order) || 0), -1);
  const nextOrder = String(max + 1);
  await db.collection('pageOrders').insertOne({ pageId: pid, order: nextOrder });
  return nextOrder;
}

async function findCategoryId(db) {
  const dash = await getPageById(DASHBOARD_PAGE_ID);
  if (dash && dash.parent) return String(dash.parent);

  const root = await findPageByName('Sistem Yönetimi', { parentId: '' });
  if (root.length) return String(root[0]._id);

  const found = await findPageByName('Sistem Yönetimi', { parentId: SABIT_VERILER_ID });
  if (found.length) return String(found[0]._id);

  throw new Error('Sistem Yönetimi kategorisi bulunamadı');
}

async function upsertPageContent(db, pageId, content, styles) {
  const existing = await db.collection('pageContents').findOne({ pageId: String(pageId) });
  const payload = { content, styles };
  if (existing) {
    const r = await db.collection('pageContents').updateOne(
      { pageId: String(pageId) },
      { $set: payload }
    );
    return { action: 'updated', matched: r.matchedCount, modified: r.modifiedCount };
  }
  await db.collection('pageContents').insertOne({ pageId: String(pageId), ...payload });
  return { action: 'inserted' };
}

function setPropValue(pageDoc, key, value) {
  if (!pageDoc.properties) return;
  const p = pageDoc.properties.find((x) => x.key === key);
  if (p) p.value = value;
}

async function findOrCreateListPage(db, parentId, def) {
  const existing = await findPageByName(def.title, { parentId: String(parentId) });
  if (existing.length) {
    const pageId = String(existing[0]._id);
    console.log('Mevcut:', def.url, pageId);
    return pageId;
  }

  const pageDoc = makePageMeta({
    title: def.title,
    url: def.url,
    showInMenu: false,
  });
  setPropValue(pageDoc, 'icon', def.icon);
  pageDoc.parent = String(parentId);
  pageDoc.createdAt = nowUtcDate();
  pageDoc.children = [];

  const r = await db.collection('pages').insertOne(pageDoc);
  const pageId = String(r.insertedId);
  await grantAdminRole(pageId);
  await ensurePageOrder(db, pageId, parentId);
  console.log('Oluşturuldu:', def.url, pageId);
  return pageId;
}

async function main() {
  if (!fs.existsSync(BODY_FILE)) {
    throw new Error(`Şablon yok: ${BODY_FILE}`);
  }

  console.log('Liste sayfaları:', LIST_PAGES.map((p) => p.url).join(', '));

  if (!hasFlag('push')) {
    console.log('\nDB yazılmadı. Oluşturmak için: --push');
    return;
  }

  loadEnv();
  await connect();
  const db = getDb();

  try {
    const categoryId = arg('parent') || (await findCategoryId(db));
    const styles = loadStyles();
    const results = [];

    for (const def of LIST_PAGES) {
      const pageId = await findOrCreateListPage(db, categoryId, def);
      const content = buildListContent(def.filter);
      const contentResult = await upsertPageContent(db, pageId, content, styles);
      results.push({ ...def, pageId, contentResult });
    }

    // Write a content snapshot for the shared list template
    const snapshot = {
      templateName: 'admin-sistem-kullanici-listesi',
      pages: results.map((r) => ({
        pageId: r.pageId,
        url: r.url,
        title: r.title,
        filter: r.filter,
      })),
      content: buildListContent('active'),
      styles,
      syncedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(__dirname, '../templates/admin-sistem-kullanici-listesi-content.json'),
      JSON.stringify(snapshot, null, 2) + '\n'
    );

    console.log('\nTamamlandı:');
    for (const r of results) {
      console.log(`  /d/${r.url}  (${r.filter})  pageId=${r.pageId}  ${r.contentResult.action}`);
    }
  } finally {
    await close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
