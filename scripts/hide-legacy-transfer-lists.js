#!/usr/bin/env node
/**
 * Eski transfer liste sayfalarını menüden gizler (silmez).
 *
 *   node scripts/hide-legacy-transfer-lists.js
 *   node scripts/hide-legacy-transfer-lists.js --push
 */
const { ObjectId } = require('mongodb');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const push = process.argv.includes('--push');

const PAGES = [
  { pageId: '62fb5dfcb03e360012464f72', title: 'Şoför Transferler', url: 'sofor-transferler' },
  { pageId: '62158fd9b03e3600161adce4', title: 'Yoldaki Transferler', url: 'yoldaki-transferler' },
  {
    pageId: '64f86f78b03e36009546633f',
    title: 'Transfer Raporu Oluştur',
    url: 'transfer-raporu-olustur',
  },
  {
    pageId: '6a3145913941e762df5f9a63',
    title: 'Transfer Talebi Oluştur',
    url: 'transfer-talebi-olustur-old',
  },
];

function getSettingsProp(page) {
  return (page.properties || []).find((p) => p.key === 'settings');
}

function setHidden(page, hidden) {
  const settings = getSettingsProp(page);
  if (!settings) {
    throw new Error(`${page._id}: settings property bulunamadı`);
  }
  if (!settings.value || typeof settings.value !== 'object') {
    settings.value = {};
  }
  settings.value.hidden = hidden;
  return settings.value;
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    for (const item of PAGES) {
      const page = await db.collection('pages').findOne({ _id: ObjectId(item.pageId) });
      if (!page) {
        console.log('ATLANDI (bulunamadı):', item.title, item.pageId);
        continue;
      }

      const before = getSettingsProp(page)?.value?.hidden;
      setHidden(page, true);
      console.log(
        `${item.title} (${item.url}): hidden ${before} → true` +
          (push ? '' : ' [dry-run]')
      );

      if (!push) continue;

      await db.collection('pages').updateOne(
        { _id: ObjectId(item.pageId) },
        { $set: { properties: page.properties } }
      );
    }

    if (!push) {
      console.log('DB push atlandı. Canlıya almak için: --push');
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
