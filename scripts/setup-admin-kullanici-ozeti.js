#!/usr/bin/env node
/**
 * Admin Kullanıcı Özeti sayfası — Sabit Veriler altında admin-only
 *
 * Kullanım:
 *   node scripts/setup-admin-kullanici-ozeti.js
 *   node scripts/setup-admin-kullanici-ozeti.js --push
 *   node scripts/setup-admin-kullanici-ozeti.js --push --parent <pageId>
 *   node scripts/setup-admin-kullanici-ozeti.js --update
 */
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const {
  createPageFromTemplate,
  getPageById,
  findPageByName,
  grantAdminRole,
} = require('../src/pageService');
const { nowUtcDate } = require('../src/utils');
const {
  PAGE,
  CATEGORY,
  SABIT_VERILER_ID,
  buildContent,
  loadStyles,
  makePageMeta,
  makeCategoryPageMeta,
  writeTemplateFiles,
} = require('./lib/auo-page-design');

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
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

async function findOrCreateCategory(db, parentId) {
  const existing = await findPageByName(CATEGORY.title, { parentId: String(parentId) });
  if (existing.length) {
    const categoryId = String(existing[0]._id);
    console.log('Kategori mevcut:', categoryId);
    return categoryId;
  }

  const pageDoc = makeCategoryPageMeta();
  pageDoc.parent = String(parentId);
  pageDoc.createdAt = nowUtcDate();
  pageDoc.children = [];

  const r = await db.collection('pages').insertOne(pageDoc);
  const categoryId = String(r.insertedId);
  await grantAdminRole(categoryId);
  await ensurePageOrder(db, categoryId, parentId);
  console.log('Kategori oluşturuldu:', categoryId);
  return categoryId;
}

async function findOrCreatePage(db, parentId) {
  const existing = await findPageByName(PAGE.title, { parentId: String(parentId) });
  if (existing.length) {
    const pageId = String(existing[0]._id);
    console.log('Sayfa mevcut:', pageId);
    return pageId;
  }

  writeTemplateFiles();
  const created = await createPageFromTemplate({
    templateName: PAGE.templateName,
    parentId: String(parentId),
    title: PAGE.title,
    url: PAGE.url,
    grantAdmin: true,
  });

  const pageId = created.pageId;
  await grantAdminRole(pageId);
  await ensurePageOrder(db, pageId, parentId);
  console.log('Sayfa oluşturuldu:', pageId);
  return pageId;
}

async function updateExistingPage(db) {
  let pageId = PAGE.pageId ? String(PAGE.pageId) : '';
  const byId = pageId ? await getPageById(pageId) : null;
  if (!byId) {
    const existing = await findPageByName(PAGE.title);
    if (!existing.length) {
      throw new Error(`Sayfa bulunamadı: ${PAGE.title} (${PAGE.pageId})`);
    }
    pageId = String(existing[0]._id);
  }

  const content = buildContent();
  const styles = loadStyles();
  const result = await upsertPageContent(db, pageId, content, styles);
  console.log('pageContents:', result);
  return pageId;
}

(async () => {
  try {
    writeTemplateFiles();
    console.log('Şablonlar yazıldı:', PAGE.templateName);

    if (!hasFlag('push') && !hasFlag('update')) {
      console.log('DB push için: node scripts/setup-admin-kullanici-ozeti.js --push');
      return;
    }

    loadEnv();
    await connect();
    const db = getDb();

    if (hasFlag('update')) {
      const pageId = await updateExistingPage(db);
      console.log('Güncellendi:', PAGE.url, pageId);
      return;
    }

    const parentId = arg('parent') || SABIT_VERILER_ID;
    const parent = await getPageById(parentId);
    if (!parent) throw new Error(`Parent bulunamadı: ${parentId}`);

    const categoryId = await findOrCreateCategory(db, parentId);
    await grantAdminRole(categoryId);

    const pageId = await findOrCreatePage(db, categoryId);
    const content = buildContent();
    const styles = loadStyles();
    const result = await upsertPageContent(db, pageId, content, styles);

    console.log('sayfa:', PAGE.url);
    console.log('pageId:', pageId);
    console.log('parent:', parentId);
    console.log('category:', categoryId);
    console.log('pageContents:', result);
    console.log('styles bytes:', styles.length);
    console.log('');
    console.log('Backend deploy gerekli:');
    console.log('  deploy/adminUserOverview.php → Backend/src/routes/custom/adminUserOverview.php');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
