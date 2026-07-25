#!/usr/bin/env node
/**
 * Transfer Taleplerim — personelin kendi oluşturduğu transferler
 *
 *   node scripts/setup-transfer-taleplerim.js
 *   node scripts/setup-transfer-taleplerim.js --push
 */
const path = require('path');
const { ObjectId } = require('mongodb');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const {
  getPageById,
  getPageContent,
  findPageByName,
  grantAdminRole,
} = require('../src/pageService');
const { nowUtcDate } = require('../src/utils');
const {
  PAGE_CONFIG,
  applyPersonalLayout,
  loadStyles,
  writeTemplateFiles,
  makePageMeta,
  makePageMetaFromSibling,
} = require('./lib/ptr-page-design');

const push = process.argv.includes('--push');
const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/transfer-taleplerim-content.json'
);

const MENU_ORDERS = {
  create: '1',
  personal: '2',
  active: '3',
  history: '4',
};

const ACTIVE_PAGE_ID = '69b0e3585170eb02c2497202';
const HISTORY_PAGE_ID = '6a56d97a8357f560312dabcc';
const CREATE_PAGE_ID = PAGE_CONFIG.sourceCreatePageId;

async function upsertPageContent(db, pageId, content, styles) {
  const existing = await db.collection('pageContents').findOne({
    pageId: String(pageId),
  });
  const payload = { content, styles };
  if (existing) {
    const r = await db.collection('pageContents').updateOne(
      { pageId: String(pageId) },
      { $set: payload }
    );
    return {
      action: 'updated',
      matched: r.matchedCount,
      modified: r.modifiedCount,
    };
  }
  await db
    .collection('pageContents')
    .insertOne({ pageId: String(pageId), ...payload });
  return { action: 'inserted' };
}

async function ensurePageOrder(db, pageId, order) {
  await db
    .collection('pageOrders')
    .updateOne(
      { pageId: String(pageId) },
      { $set: { order: String(order) } },
      { upsert: true }
    );
  return String(order);
}

async function copyRoleLogs(db, sourcePageId, targetPageId) {
  const roles = await db
    .collection('roleLogs')
    .find({ pageId: String(sourcePageId) })
    .toArray();
  let inserted = 0;
  for (const role of roles) {
    const exists = await db.collection('roleLogs').findOne({
      pageId: String(targetPageId),
      userId: role.userId,
    });
    if (exists) continue;
    await db.collection('roleLogs').insertOne({
      userId: role.userId,
      pageId: String(targetPageId),
    });
    inserted += 1;
  }
  return { sourceRoles: roles.length, inserted };
}

async function findExistingPersonalPage(db) {
  const byUrl = await db.collection('pages').findOne({
    parent: PAGE_CONFIG.parentId,
    properties: { $elemMatch: { key: 'url', value: PAGE_CONFIG.url } },
  });
  if (byUrl) return byUrl;

  const byName = await findPageByName(PAGE_CONFIG.title, {
    parentId: PAGE_CONFIG.parentId,
  });
  return byName[0] || null;
}

async function createPersonalPage(db) {
  const sibling = await db.collection('pages').findOne({
    _id: ObjectId(CREATE_PAGE_ID),
  });
  const pageDoc = sibling
    ? makePageMetaFromSibling(sibling)
    : makePageMeta();
  pageDoc.createdAt = nowUtcDate();
  const r = await db.collection('pages').insertOne(pageDoc);
  const pageId = String(r.insertedId);
  await grantAdminRole(pageId);
  await ensurePageOrder(db, pageId, MENU_ORDERS.personal);
  return pageId;
}

async function syncExistingPageMeta(db, page) {
  const sibling = await db.collection('pages').findOne({
    _id: ObjectId(CREATE_PAGE_ID),
  });
  if (!sibling) return;

  const nextMeta = makePageMetaFromSibling(sibling);
  await db.collection('pages').updateOne(
    { _id: page._id },
    {
      $set: {
        type: 'sub',
        isExpanded: false,
        parent: PAGE_CONFIG.parentId,
        children: [],
        properties: nextMeta.properties,
      },
    }
  );
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const parent = await getPageById(PAGE_CONFIG.parentId);
    if (!parent) {
      throw new Error(
        `Transfer İşlemleri kategorisi bulunamadı: ${PAGE_CONFIG.parentId}`
      );
    }

    const source = await getPageContent(PAGE_CONFIG.sourcePageId);
    if (!source?.content?.length) {
      throw new Error(
        `Kaynak aktif transfer içeriği bulunamadı: ${PAGE_CONFIG.sourcePageId}`
      );
    }

    const content = applyPersonalLayout(
      JSON.parse(JSON.stringify(source.content))
    );
    const styles = loadStyles();
    writeTemplateFiles(content, styles);

    console.log('sayfa:', PAGE_CONFIG.title);
    console.log('url:', PAGE_CONFIG.url);
    console.log('parent:', PAGE_CONFIG.parentId);
    console.log('- filtre: :users:Creator = {{info._id}}, delete != 1');
    console.log('- durumlar: tümü (0–5)');
    console.log('- detay: /d/transfer-detay-beta');
    console.log('template:', TEMPLATE_PATH);

    if (!push) {
      console.log('DB push atlandı. Canlıya almak için: --push');
      return;
    }

    let page = await findExistingPersonalPage(db);
    let pageId;
    let created = false;
    if (page) {
      pageId = String(page._id);
      console.log('mevcut sayfa:', pageId);
      await syncExistingPageMeta(db, page);
    } else {
      pageId = await createPersonalPage(db);
      created = true;
      console.log('sayfa oluşturuldu:', pageId);
    }

    PAGE_CONFIG.pageId = pageId;
    writeTemplateFiles(content, styles);

    const contentResult = await upsertPageContent(db, pageId, content, styles);
    const roleResult = await copyRoleLogs(
      db,
      PAGE_CONFIG.sourceCreatePageId,
      pageId
    );

    // Menü sırası: Oluştur(1) → Taleplerim(2) → Aktif(3) → Geçmiş(4)
    await ensurePageOrder(db, CREATE_PAGE_ID, MENU_ORDERS.create);
    await ensurePageOrder(db, pageId, MENU_ORDERS.personal);
    await ensurePageOrder(db, ACTIVE_PAGE_ID, MENU_ORDERS.active);
    await ensurePageOrder(db, HISTORY_PAGE_ID, MENU_ORDERS.history);

    console.log('created:', created);
    console.log('pageContents:', contentResult);
    console.log('roleLogs:', roleResult);
    console.log('pageOrders:', MENU_ORDERS);
    console.log('styles bytes:', styles.length);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
