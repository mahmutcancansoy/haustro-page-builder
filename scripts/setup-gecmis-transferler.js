#!/usr/bin/env node
/**
 * Geçmiş Transferler sayfası — Transfer İşlemleri altında
 *
 *   node scripts/setup-gecmis-transferler.js
 *   node scripts/setup-gecmis-transferler.js --push
 */
const path = require('path');
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
  applyHistoryLayout,
  loadStyles,
  writeTemplateFiles,
  makePageMeta,
} = require('./lib/gtr-page-design');

const push = process.argv.includes('--push');
const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/gecmis-transferler-content.json'
);

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

async function findExistingHistoryPage(db) {
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

async function createHistoryPage(db) {
  const pageDoc = makePageMeta();
  pageDoc.createdAt = nowUtcDate();
  const r = await db.collection('pages').insertOne(pageDoc);
  const pageId = String(r.insertedId);
  await grantAdminRole(pageId);
  await ensurePageOrder(db, pageId, PAGE_CONFIG.parentId);
  return pageId;
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const parent = await getPageById(PAGE_CONFIG.parentId);
    if (!parent) {
      throw new Error(`Transfer İşlemleri kategorisi bulunamadı: ${PAGE_CONFIG.parentId}`);
    }

    const source = await getPageContent(PAGE_CONFIG.sourcePageId);
    if (!source?.content?.length) {
      throw new Error(
        `Kaynak aktif transfer içeriği bulunamadı: ${PAGE_CONFIG.sourcePageId}`
      );
    }

    const content = applyHistoryLayout(JSON.parse(JSON.stringify(source.content)));
    const styles = loadStyles();
    writeTemplateFiles(content, styles);

    console.log('sayfa:', PAGE_CONFIG.title);
    console.log('url:', PAGE_CONFIG.url);
    console.log('parent:', PAGE_CONFIG.parentId);
    console.log('- filtre: status ∈ [1,5], delete != 1');
    console.log('- detay: /d/transfer-detay-beta');
    console.log('template:', TEMPLATE_PATH);

    if (!push) {
      console.log('DB push atlandı. Canlıya almak için: --push');
      return;
    }

    let page = await findExistingHistoryPage(db);
    let pageId;
    let created = false;
    if (page) {
      pageId = String(page._id);
      console.log('mevcut sayfa:', pageId);
    } else {
      pageId = await createHistoryPage(db);
      created = true;
      console.log('sayfa oluşturuldu:', pageId);
    }

    PAGE_CONFIG.pageId = pageId;
    writeTemplateFiles(content, styles);

    const contentResult = await upsertPageContent(db, pageId, content, styles);
    const roleResult = await copyRoleLogs(db, PAGE_CONFIG.sourcePageId, pageId);

    // Menü sırası: Aktif Transfer Raporları'nın hemen yanına yaklaştır
    const activeOrder = await db
      .collection('pageOrders')
      .findOne({ pageId: PAGE_CONFIG.sourcePageId });
    if (activeOrder && created) {
      const desired = String(Number(activeOrder.order) + 1);
      await db
        .collection('pageOrders')
        .updateOne({ pageId }, { $set: { order: desired } }, { upsert: true });
      console.log('pageOrder:', desired);
    }

    console.log('pageContents:', contentResult);
    console.log('roleLogs:', roleResult);
    console.log('styles bytes:', styles.length);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
