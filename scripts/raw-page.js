const { ObjectId } = require('mongodb');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const ID = process.argv[2];
if (!ID) {
  console.error('Kullanım: node scripts/raw-page.js <pageId>');
  process.exit(1);
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();
    const doc = await db.collection('pages').findOne({ _id: ObjectId(ID) });
    console.log(JSON.stringify(doc, null, 2));
  } catch (e) {
    console.error(e);
  } finally {
    await close();
  }
})();
