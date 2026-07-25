#!/usr/bin/env node
/**
 * Mail Alıcıları sayfalarını "Mail Yönetimi" kategorisi altına taşır.
 * Kullanım: node scripts/move-mail-alicilari-to-category.js
 */
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { grantAdminRole } = require('../src/pageService');
const { nowUtcDate } = require('../src/utils');
const { LIST_PAGE, EDIT_PAGE } = require('./lib/mr-page-design');

const SABIT_VERILER_ID = '5fef75324fe5a5001340f982';
const CATEGORY_TITLE = 'Mail Yönetimi';

function makeCategoryPage() {
  return {
    isExpanded: false,
    type: 'main',
    parent: SABIT_VERILER_ID,
    children: [],
    createdAt: nowUtcDate(),
    properties: [
      {
        key: 'display-name',
        type: 'input-text-property',
        header: 'Display Name',
        value: CATEGORY_TITLE,
      },
      {
        key: 'label',
        type: 'input-text-property',
        header: 'Label',
        value: CATEGORY_TITLE,
      },
      {
        key: 'icon',
        type: 'input-text-property',
        header: 'Icon',
        value: 'pi pi-envelope',
      },
      {
        key: 'route-type',
        type: 'select-property',
        options: [
          { label: 'Category', value: 'category' },
          { label: 'Static', value: 'static' },
          { label: 'External', value: 'external' },
        ],
        header: 'Route Type',
        value: 'category',
      },
      {
        key: 'url-targer',
        type: 'select-property',
        options: [
          { label: '_self', value: '_self' },
          { label: '_blank', value: '_blank' },
        ],
        header: 'Target',
        value: '_self',
        conditions: [{ key: 'route-type', rule: "value == 'external'" }],
      },
      {
        key: 'url',
        type: 'input-text-property',
        header: 'Url',
        value: '',
        conditions: [{ key: 'route-type', rule: "value != 'category'" }],
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [{ label: 'Hidden', name: 'hidden' }],
        value: { hidden: false },
      },
      {
        key: 'default-url',
        header: 'Default Url',
        type: 'input-text-property',
        value: LIST_PAGE.url,
        conditions: [{ key: 'route-type', rule: "value == 'category'" }],
      },
    ],
  };
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

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    let category = await db.collection('pages').findOne({
      parent: SABIT_VERILER_ID,
      'properties': { $elemMatch: { key: 'label', value: CATEGORY_TITLE } },
    });

    if (!category) {
      const insert = await db.collection('pages').insertOne(makeCategoryPage());
      category = await db.collection('pages').findOne({ _id: insert.insertedId });
      console.log('Kategori oluşturuldu:', category._id.toString());
    } else {
      console.log('Kategori mevcut:', category._id.toString());
    }

    const categoryId = category._id.toString();

    await grantAdminRole(categoryId);

    const orderResult = await ensurePageOrder(db, categoryId, SABIT_VERILER_ID);
    console.log('Kategori sırası:', orderResult);

    for (const pageId of [LIST_PAGE.pageId, EDIT_PAGE.pageId]) {
      const r = await db.collection('pages').updateOne(
        { _id: require('mongodb').ObjectId(pageId) },
        { $set: { parent: categoryId } }
      );
      console.log('Taşındı', pageId, 'matched:', r.matchedCount);
      await ensurePageOrder(db, pageId, categoryId);
    }

    const children = await db
      .collection('pages')
      .find({ parent: categoryId })
      .toArray();
    console.log(
      'Mail Yönetimi altı:',
      children.map((p) => {
        const label = (p.properties || []).find((x) => x.key === 'label')?.value;
        const url = (p.properties || []).find((x) => x.key === 'url')?.value;
        return `${label} (${url || 'category'})`;
      }).join(', ')
    );
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
