const { ObjectId } = require('mongodb');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = process.argv[2];
if (!PAGE_ID) {
  console.error('Kullanım: node scripts/fix-cards-page.js <pageId>');
  process.exit(1);
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const page = await db.collection('pages').findOne({ _id: ObjectId(PAGE_ID) });
    if (!page) throw new Error('Sayfa yok: ' + PAGE_ID);

    const unset = {};
    if ('url' in page) unset.url = '';
    if ('label' in page) unset.label = '';
    if ('delete' in page) unset.delete = '';
    if (Object.keys(unset).length) {
      await db.collection('pages').updateOne({ _id: page._id }, { $unset: unset });
      console.log('Top-level temizlendi:', Object.keys(unset).join(', '));
    } else {
      console.log('Temizlenecek top-level alan yok.');
    }

    const parentId = page.parent;
    const siblings = await db.collection('pages').find({ parent: parentId }).toArray();
    const siblingIds = siblings.map((s) => String(s._id));
    const orders = await db
      .collection('pageOrders')
      .find({ pageId: { $in: siblingIds } })
      .toArray();

    const otherMax = orders
      .filter((o) => o.pageId !== PAGE_ID)
      .reduce((m, o) => Math.max(m, Number(o.order) || 0), -1);

    const newOrder = String(otherMax + 1);
    const existingOrder = orders.find((o) => o.pageId === PAGE_ID);
    if (existingOrder) {
      await db
        .collection('pageOrders')
        .updateOne({ _id: existingOrder._id }, { $set: { order: newOrder } });
      console.log(`pageOrder güncellendi: ${existingOrder.order} -> ${newOrder}`);
    } else {
      await db
        .collection('pageOrders')
        .insertOne({ pageId: PAGE_ID, order: newOrder });
      console.log(`pageOrder eklendi: ${newOrder}`);
    }
  } catch (e) {
    console.error(e);
  } finally {
    await close();
  }
})();
