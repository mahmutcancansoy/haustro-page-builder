#!/usr/bin/env node
/**
 * pageVisitLogs koleksiyon index'lerini oluşturur.
 * Kullanım: node scripts/ensure-page-visit-indexes.js
 */
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

async function main() {
  loadEnv();
  await connect();
  const col = getDb().collection('pageVisitLogs');
  const indexes = [
    { key: { userId: 1, enteredAt: -1 }, name: 'userId_1_enteredAt_-1' },
    { key: { userId: 1, status: 1 }, name: 'userId_1_status_1' },
    { key: { pageId: 1, enteredAt: -1 }, name: 'pageId_1_enteredAt_-1' },
  ];
  for (const spec of indexes) {
    const name = await col.createIndex(spec.key, { name: spec.name });
    console.log('index:', name);
  }
  console.log('count:', await col.countDocuments());
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
