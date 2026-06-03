const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PARENT = process.argv[2];
if (!PARENT) {
  console.error('Kullanım: node scripts/orders-of-parent.js <parentId>');
  process.exit(1);
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();
    const kids = await db.collection('pages').find({ parent: PARENT }).toArray();
    const orders = await db.collection('pageOrders').find({}).toArray();
    const orderMap = Object.fromEntries(orders.map((o) => [o.pageId, o.order]));
    console.log(`Parent ${PARENT} altında ${kids.length} sayfa`);
    kids
      .map((k) => ({
        id: String(k._id),
        title: (k.properties || []).find((p) => p.key === 'display-name')?.value,
        order: orderMap[String(k._id)],
      }))
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .forEach((k) => console.log(`  order=${String(k.order).padStart(4)} id=${k.id} ${k.title}`));
  } catch (e) {
    console.error(e);
  } finally {
    await close();
  }
})();
