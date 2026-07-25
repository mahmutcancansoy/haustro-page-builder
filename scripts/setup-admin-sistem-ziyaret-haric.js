#!/usr/bin/env node
/**
 * Ziyaret logu hariç tutulanlar — panel sayfası
 *
 *   node scripts/setup-admin-sistem-ziyaret-haric.js
 *   node scripts/setup-admin-sistem-ziyaret-haric.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { grantAdminRole, findPageByName, getPageById } = require('../src/pageService');
const { nowUtcDate } = require('../src/utils');
const {
  PAGE,
  DASHBOARD_PAGE_ID,
  SABIT_VERILER_ID,
  buildContent,
  loadStyles,
  makePageMeta,
} = require('./lib/pve-page-design');

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function setPropValue(pageDoc, key, value) {
  if (!pageDoc.properties) return;
  const p = pageDoc.properties.find((x) => x.key === key);
  if (p) p.value = value;
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

  // Kök ana kategori (Envanter gibi)
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

async function findOrCreatePage(db, parentId) {
  const existing = await findPageByName(PAGE.title, { parentId: String(parentId) });
  if (existing.length) {
    const pageId = String(existing[0]._id);
    console.log('Mevcut sayfa:', PAGE.url, pageId);
    return pageId;
  }

  const pageDoc = makePageMeta({
    title: PAGE.title,
    url: PAGE.url,
    showInMenu: true,
    icon: PAGE.icon,
  });
  setPropValue(pageDoc, 'icon', PAGE.icon);
  pageDoc.parent = String(parentId);
  pageDoc.createdAt = nowUtcDate();
  pageDoc.children = [];

  const r = await db.collection('pages').insertOne(pageDoc);
  const pageId = String(r.insertedId);
  await grantAdminRole(pageId);
  await ensurePageOrder(db, pageId, parentId);
  console.log('Oluşturuldu:', PAGE.url, pageId);
  return pageId;
}

async function ensureIndex(db) {
  try {
    await db.collection('pageVisitExcludedUsers').createIndex(
      { userId: 1 },
      { unique: true, name: 'userId_unique' }
    );
    console.log('Index: pageVisitExcludedUsers.userId unique');
  } catch (e) {
    console.log('Index (atlandı):', e.message);
  }
}

async function main() {
  const content = buildContent();
  const styles = loadStyles();
  const templatePath = path.join(
    __dirname,
    '../templates/admin-sistem-ziyaret-haric-content.json'
  );

  const snapshot = {
    templateName: 'admin-sistem-ziyaret-haric',
    title: PAGE.title,
    url: PAGE.url,
    content,
    styles,
    syncedAt: new Date().toISOString(),
  };
  fs.writeFileSync(templatePath, JSON.stringify(snapshot, null, 2) + '\n');
  console.log('Şablon yazıldı:', templatePath);

  if (!hasFlag('push')) {
    console.log('DB yazılmadı. Canlıya almak için: --push');
    return;
  }

  loadEnv();
  await connect();
  const db = getDb();

  try {
    await ensureIndex(db);
    const categoryId = arg('parent') || (await findCategoryId(db));
    const pageId = await findOrCreatePage(db, categoryId);
    const contentResult = await upsertPageContent(db, pageId, content, styles);

    snapshot.pageId = pageId;
    fs.writeFileSync(templatePath, JSON.stringify(snapshot, null, 2) + '\n');

    console.log('\nTamamlandı:');
    console.log(`  /d/${PAGE.url}`);
    console.log(`  pageId=${pageId}`);
    console.log(`  content=${contentResult.action}`);
  } finally {
    await close().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
