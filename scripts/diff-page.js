const { ObjectId } = require('mongodb');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const A = process.argv[2];
const B = process.argv[3];
if (!A || !B) {
  console.error('Kullanım: node scripts/diff-page.js <pageId-A> <pageId-B>');
  process.exit(1);
}

function summary(label, doc) {
  console.log(`--- ${label} (${doc._id}) ---`);
  console.log('top-level keys:', Object.keys(doc).join(', '));
  console.log('parent:', JSON.stringify(doc.parent));
  console.log('type:', JSON.stringify(doc.type));
  console.log('isExpanded:', JSON.stringify(doc.isExpanded));
  console.log('children:', JSON.stringify(doc.children));
  console.log('delete:', JSON.stringify(doc.delete));
  console.log('createdAt:', JSON.stringify(doc.createdAt));
  console.log('properties count:', (doc.properties || []).length);
  const propKeys = (doc.properties || []).map((p) => p.key);
  console.log('property keys:', propKeys.join(', '));
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();
    const a = await db.collection('pages').findOne({ _id: ObjectId(A) });
    const b = await db.collection('pages').findOne({ _id: ObjectId(B) });
    if (!a) console.log('A bulunamadı:', A);
    if (!b) console.log('B bulunamadı:', B);
    if (a) summary('A', a);
    if (b) summary('B', b);

    const aOrder = await db.collection('pageOrders').findOne({ pageId: A });
    const bOrder = await db.collection('pageOrders').findOne({ pageId: B });
    console.log('A pageOrder:', JSON.stringify(aOrder));
    console.log('B pageOrder:', JSON.stringify(bOrder));

    const aRoles = await db.collection('roleLogs').find({ pageId: A }).toArray();
    const bRoles = await db.collection('roleLogs').find({ pageId: B }).toArray();
    console.log('A roleLogs:', aRoles.length, '-', JSON.stringify(aRoles.map((r) => r.userId)));
    console.log('B roleLogs:', bRoles.length, '-', JSON.stringify(bRoles.map((r) => r.userId)));
  } catch (e) {
    console.error(e);
  } finally {
    await close();
  }
})();
