const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();
    const docs = await db.collection('inventory').find({ delete: 0 }).limit(3).toArray();
    docs.forEach((d, i) => {
      console.log(`--- Kayıt ${i + 1} ---`);
      console.log('Keys:', Object.keys(d).join(', '));
      console.log('name:', d.name);
      console.log(':inventoryCats:category:', JSON.stringify(d[':inventoryCats:category']));
      console.log('Tüm doc:', JSON.stringify(d).slice(0, 800));
      console.log();
    });
  } catch (e) {
    console.error(e);
  } finally {
    await close();
  }
})();
