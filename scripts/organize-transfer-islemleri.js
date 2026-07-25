#!/usr/bin/env node
/**
 * Envanter > "Transfer İşlemleri" koleksiyonu oluşturur ve transfer sayfalarını
 * bu koleksiyon altına taşır. Ayrıca "transfer-talebi-olustur" sayfasını oluşturur.
 *
 * Kullanım:
 *   node scripts/organize-transfer-islemleri.js
 */
const { ObjectId } = require('mongodb');
const { loadEnv } = require('../src/config');
const { connect, close, getDb } = require('../src/db');
const { createPageFromTemplate, duplicatePage } = require('../src/pageService');
const { setPropertyValue, getPropertyValue } = require('../src/utils');

const ENVANTER_PARENT_ID = '5fef67624fe5a500175f7532'; // Envanter (main)
const COLLECTION_TITLE = 'Transfer İşlemleri';
const COLLECTION_TEMPLATE = 'transfer-islemleri';

// Mevcut "Transfer Raporu Oluştur" sayfasını baz alıyoruz.
const SOURCE_CREATE_TRANSFER_PAGE_ID = '64f86f78b03e36009546633f'; // transfer-raporu-olustur
const NEW_CREATE_PAGE_TITLE = 'Transfer Talebi Oluştur';
const NEW_CREATE_PAGE_URL = 'transfer-talebi-olustur';

loadEnv();

function prop(p, key) {
  return (p.properties || []).find((x) => x.key === key)?.value;
}

async function ensureTransferCollection() {
  const db = getDb();
  const existing = await db.collection('pages').findOne({
    parent: ENVANTER_PARENT_ID,
    type: 'main',
    properties: { $elemMatch: { key: 'display-name', value: COLLECTION_TITLE } },
  });

  if (existing) {
    // default-url drift etmiş olabilir, garanti altına alalım
    const updated = { ...existing, properties: JSON.parse(JSON.stringify(existing.properties || [])) };
    const du = getPropertyValue(existing, 'default-url');
    if (du !== NEW_CREATE_PAGE_URL) setPropertyValue(updated, 'default-url', NEW_CREATE_PAGE_URL);

    // createPageFromTemplate url alanını otomatik slug'ladığı için,
    // category sayfalarında url'yi boş tutuyoruz.
    if (getPropertyValue(existing, 'url') !== '') setPropertyValue(updated, 'url', '');

    await db.collection('pages').updateOne(
      { _id: existing._id },
      { $set: { properties: updated.properties } }
    );
    return String(existing._id);
  }

  const created = await createPageFromTemplate({
    templateName: COLLECTION_TEMPLATE,
    parentId: ENVANTER_PARENT_ID,
    title: COLLECTION_TITLE,
  });

  // createPageFromTemplate varsayılan olarak url'yi slug'lar; category sayfalarında istemiyoruz.
  const createdDoc = await db.collection('pages').findOne({ _id: ObjectId(created.pageId) });
  const updated = { ...createdDoc };
  setPropertyValue(updated, 'display-name', COLLECTION_TITLE);
  setPropertyValue(updated, 'label', COLLECTION_TITLE);
  setPropertyValue(updated, 'route-type', 'category');
  setPropertyValue(updated, 'url', '');
  setPropertyValue(updated, 'default-url', NEW_CREATE_PAGE_URL);
  await db.collection('pages').updateOne(
    { _id: ObjectId(created.pageId) },
    { $set: { properties: updated.properties } }
  );

  return created.pageId;
}

async function ensureCreatePage(parentId) {
  const db = getDb();
  const existing = await db.collection('pages').findOne({
    parent: parentId,
    properties: { $elemMatch: { key: 'url', value: NEW_CREATE_PAGE_URL } },
  });
  if (existing) return String(existing._id);

  const created = await duplicatePage(SOURCE_CREATE_TRANSFER_PAGE_ID, {
    title: NEW_CREATE_PAGE_TITLE,
    url: NEW_CREATE_PAGE_URL,
    parentId,
  });
  return created.pageId;
}

async function moveTransferPages(targetParentId) {
  const db = getDb();
  const toMove = await db
    .collection('pages')
    .find({
      parent: ENVANTER_PARENT_ID,
      _id: { $ne: ObjectId(targetParentId) },
      properties: { $elemMatch: { key: 'url', value: /transfer|sofor-transfer/i } },
    })
    .toArray();

  if (!toMove.length) return { moved: 0, pages: [] };

  const ids = toMove.map((p) => p._id);
  await db.collection('pages').updateMany(
    { _id: { $in: ids } },
    { $set: { parent: targetParentId } }
  );

  return {
    moved: toMove.length,
    pages: toMove.map((p) => ({
      id: String(p._id),
      display: prop(p, 'display-name') || prop(p, 'label') || '',
      url: prop(p, 'url') || '',
    })),
  };
}

(async () => {
  await connect();

  const collectionId = await ensureTransferCollection();
  const createPageId = await ensureCreatePage(collectionId);
  const moved = await moveTransferPages(collectionId);

  console.log(
    JSON.stringify(
      {
        envanterParentId: ENVANTER_PARENT_ID,
        transferCollectionId: collectionId,
        createdOrExistingCreatePageId: createPageId,
        movedFromEnvanterToCollection: moved,
      },
      null,
      2
    )
  );

  await close();
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});

