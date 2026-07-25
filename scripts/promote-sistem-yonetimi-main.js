#!/usr/bin/env node
/**
 * "Sistem Yönetimi" kategorisini Envanter gibi kök ana menü kategorisi yapar.
 *
 *   node scripts/promote-sistem-yonetimi-main.js
 *   node scripts/promote-sistem-yonetimi-main.js --dry-run
 */
const { ObjectId } = require('mongodb');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { setPropertyValue, getPropertyValue } = require('../src/utils');

const SISTEM_YONETIMI_ID = '6a4e3c8e8be23ac8cbb9af05';
const DEFAULT_URL = '/d/admin-sistem-durumu';
const ICON = 'mdi mdi-cog mdi-28px';

const DRY = process.argv.includes('--dry-run');

function summarize(doc) {
  return {
    id: String(doc._id),
    type: doc.type,
    parent: doc.parent,
    name: getPropertyValue(doc, 'display-name') || getPropertyValue(doc, 'label'),
    route: getPropertyValue(doc, 'route-type'),
    url: getPropertyValue(doc, 'url'),
    defaultUrl: getPropertyValue(doc, 'default-url'),
    icon: getPropertyValue(doc, 'icon'),
  };
}

async function ensureRootOrder(db, pageId) {
  const roots = await db
    .collection('pages')
    .find({ type: 'main', parent: '' })
    .project({ _id: 1 })
    .toArray();
  const rootIds = roots.map((r) => String(r._id));
  const orders = await db
    .collection('pageOrders')
    .find({ pageId: { $in: rootIds } })
    .toArray();
  const max = orders.reduce((m, o) => Math.max(m, Number(o.order) || 0), -1);
  // Sabit Veriler'den hemen sonra (13) görünmesi için 14'e yakın tut;
  // çakışma olursa max+1 kullan.
  let next = 14;
  const taken = new Set(orders.map((o) => Number(o.order)));
  while (taken.has(next)) next += 1;
  if (next <= max && taken.has(next)) next = max + 1;

  const existing = await db.collection('pageOrders').findOne({ pageId: String(pageId) });
  if (DRY) {
    console.log('pageOrder', existing ? 'update' : 'insert', {
      pageId,
      from: existing?.order,
      to: String(next),
    });
    return String(next);
  }

  if (existing) {
    await db
      .collection('pageOrders')
      .updateOne({ pageId: String(pageId) }, { $set: { order: String(next) } });
  } else {
    await db.collection('pageOrders').insertOne({
      pageId: String(pageId),
      order: String(next),
    });
  }
  return String(next);
}

(async () => {
  loadEnv();
  await connect();
  const db = getDb();

  const doc = await db.collection('pages').findOne({
    _id: new ObjectId(SISTEM_YONETIMI_ID),
  });
  if (!doc) {
    throw new Error('Sistem Yönetimi sayfası bulunamadı: ' + SISTEM_YONETIMI_ID);
  }

  console.log('Önce:', JSON.stringify(summarize(doc), null, 2));

  const updated = {
    ...doc,
    properties: JSON.parse(JSON.stringify(doc.properties || [])),
  };
  updated.parent = '';
  updated.type = 'main';
  setPropertyValue(updated, 'display-name', 'Sistem Yönetimi');
  setPropertyValue(updated, 'label', 'Sistem Yönetimi');
  setPropertyValue(updated, 'route-type', 'category');
  setPropertyValue(updated, 'url', '');
  setPropertyValue(updated, 'default-url', DEFAULT_URL);
  setPropertyValue(updated, 'icon', ICON);
  setPropertyValue(updated, 'settings', { hidden: false });

  console.log('Sonra:', JSON.stringify(summarize(updated), null, 2));

  if (DRY) {
    console.log('--dry-run: DB yazılmadı');
    await ensureRootOrder(db, SISTEM_YONETIMI_ID);
    await close();
    return;
  }

  await db.collection('pages').updateOne(
    { _id: new ObjectId(SISTEM_YONETIMI_ID) },
    {
      $set: {
        parent: '',
        type: 'main',
        properties: updated.properties,
      },
    }
  );

  const order = await ensureRootOrder(db, SISTEM_YONETIMI_ID);
  const children = await db
    .collection('pages')
    .countDocuments({ parent: SISTEM_YONETIMI_ID });

  console.log(
    JSON.stringify(
      {
        promoted: true,
        categoryId: SISTEM_YONETIMI_ID,
        parent: '',
        order,
        children,
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
