const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { ObjectId } = require('mongodb');

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();
    const doc = {
      isExpanded: false,
      type: 'sub',
      properties: [
        { key: 'display-name', value: 'TEST' },
        { key: 'label', value: 'TEST L' },
        { key: 'url', value: 'test-url' },
      ],
      parent: 'TEST_PARENT',
      children: [],
    };
    console.log('PRE keys:', Object.keys(doc).join(', '));
    const r = await db.collection('pages').insertOne(doc);
    console.log('POST keys:', Object.keys(doc).join(', '));
    const got = await db.collection('pages').findOne({ _id: r.insertedId });
    console.log('DB keys:', Object.keys(got).join(', '));
    console.log('DB doc:', JSON.stringify(got, null, 2));
    await db.collection('pages').deleteOne({ _id: r.insertedId });
  } catch (e) {
    console.error(e);
  } finally {
    await close();
  }
})();
