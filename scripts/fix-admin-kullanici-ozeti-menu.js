#!/usr/bin/env node
/**
 * admin-kullanici-ozeti: menü hiyerarşisi ve route-type düzeltmesi
 * Kullanım: node scripts/fix-admin-kullanici-ozeti-menu.js
 */
const { ObjectId } = require('mongodb');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { findPageByName, grantAdminRole } = require('../src/pageService');
const { nowUtcDate } = require('../src/utils');
const {
  PAGE,
  CATEGORY,
  SABIT_VERILER_ID,
  makePageMeta,
  makeCategoryPageMeta,
  writeTemplateFiles,
} = require('./lib/auo-page-design');

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

async function findOrCreateCategory(db) {
  const existing = await findPageByName(CATEGORY.title, { parentId: SABIT_VERILER_ID });
  if (existing.length) {
    const categoryId = String(existing[0]._id);
    await db.collection('pages').updateOne(
      { _id: ObjectId(categoryId) },
      { $set: { properties: makeCategoryPageMeta().properties } }
    );
    console.log('Kategori mevcut, meta güncellendi:', categoryId);
    return categoryId;
  }

  const pageDoc = makeCategoryPageMeta();
  pageDoc.parent = SABIT_VERILER_ID;
  pageDoc.createdAt = nowUtcDate();
  pageDoc.children = [];

  const r = await db.collection('pages').insertOne(pageDoc);
  const categoryId = String(r.insertedId);
  await grantAdminRole(categoryId);
  await ensurePageOrder(db, categoryId, SABIT_VERILER_ID);
  console.log('Kategori oluşturuldu:', categoryId);
  return categoryId;
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const categoryId = await findOrCreateCategory(db);
    await grantAdminRole(categoryId);

    const pageMeta = makePageMeta({ title: PAGE.title, url: PAGE.url });
    const r = await db.collection('pages').updateOne(
      { _id: ObjectId(PAGE.pageId) },
      {
        $set: {
          parent: categoryId,
          type: 'sub',
          properties: pageMeta.properties,
        },
      }
    );

    await grantAdminRole(PAGE.pageId);
    await ensurePageOrder(db, PAGE.pageId, categoryId);

    writeTemplateFiles();

    console.log('sayfa:', PAGE.url);
    console.log('pageId:', PAGE.pageId);
    console.log('yeni parent (Sistem Yönetimi):', categoryId);
    console.log('pages matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('');
    console.log('Menü: Sabit Veriler → Sistem Yönetimi → Kullanıcı Özeti');
    console.log('Doğrudan URL: /d/admin-kullanici-ozeti');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
