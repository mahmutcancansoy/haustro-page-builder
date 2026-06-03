#!/usr/bin/env node
/**
 * Belirtilen sayfalara tüm roleTypes için roleTypesLogs erişimi verir.
 * Kullanım:
 *   node scripts/grant-page-all-roles.js <pageId> [pageId...]
 *   node scripts/grant-page-all-roles.js --ours
 */
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const OUR_PAGES = {
  'anasayfa-copy': '6a1f79785170eb067118bdc8',
  profilim: '6a1f7b59b1ddfb5646dea36f',
};

async function grantAllRoles(pageIds, { add = true, edit = true } = {}) {
  const db = getDb();
  const roleTypes = await db
    .collection('roleTypes')
    .find({ delete: { $ne: 1 } })
    .toArray();

  let upserted = 0;
  for (const pageId of pageIds) {
    const page = await db.collection('pages').findOne({ _id: require('mongodb').ObjectId(pageId) });
    if (!page) {
      console.warn('Sayfa bulunamadı, atlanıyor:', pageId);
      continue;
    }
    const title =
      page.properties?.find((p) => p.key === 'label')?.value ||
      page.properties?.find((p) => p.key === 'display-name')?.value ||
      pageId;

    for (const role of roleTypes) {
      const roleId = String(role._id);
      await db.collection('roleTypesLogs').updateOne(
        { roleId, pageId: String(pageId) },
        { $set: { roleId, pageId: String(pageId), add, edit } },
        { upsert: true }
      );
      upserted += 1;
    }
    console.log(`✓ ${title} (${pageId}) → ${roleTypes.length} rol`);
  }
  return { roleTypeCount: roleTypes.length, upserted };
}

(async () => {
  const args = process.argv.slice(2);
  let pageIds = args;

  if (args[0] === '--ours') {
    pageIds = Object.values(OUR_PAGES);
  }

  if (!pageIds.length) {
    console.error('Kullanım: node scripts/grant-page-all-roles.js <pageId> ...');
    console.error('       node scripts/grant-page-all-roles.js --ours');
    process.exit(1);
  }

  try {
    loadEnv();
    await connect();
    const result = await grantAllRoles(pageIds);
    console.log('Toplam upsert:', result.upserted, `(rol başına ${result.roleTypeCount})`);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close();
  }
})();
