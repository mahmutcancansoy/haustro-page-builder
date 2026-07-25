#!/usr/bin/env node
/**
 * arac-gerec-detayi: üst envanter kartını (.inventory-card) responsive yapar.
 *  - Dar ekranda görsel üste geçer ve tam genişlik olur.
 *  - Bilgi satırları mobilde alt alta dizilir.
 *  - Uzun "Özel Kod" metni satır sarar.
 *
 * Kaynak: templates/arac-gerec-detayi-new-render-template-1.html
 *
 *   node scripts/patch-arac-gerec-detayi-responsive.js
 *   node scripts/patch-arac-gerec-detayi-responsive.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const push = process.argv.includes('--push');
const PAGE_ID = '5ffb93104fe5a500783cd6a2';
const CONTENT_FILE = path.join(
  __dirname,
  '../templates/arac-gerec-detayi-content.json'
);
const FRAGMENT_FILE = path.join(
  __dirname,
  '../templates/arac-gerec-detayi-new-render-template-1.html'
);

function patchContent(content, html) {
  let patched = 0;
  function walk(nodes) {
    for (const n of nodes || []) {
      if (
        n.type === 'render-template' &&
        String(n.content || '').includes('inventory-card')
      ) {
        n.content = html;
        patched += 1;
      }
      walk(n.children);
    }
  }
  walk(content);
  return patched;
}

(async () => {
  const html = fs.readFileSync(FRAGMENT_FILE, 'utf8').replace(/\s+$/, '');

  const raw = JSON.parse(fs.readFileSync(CONTENT_FILE, 'utf8'));
  const localPatched = patchContent(raw.content, html);
  fs.writeFileSync(CONTENT_FILE, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  console.log('Yerel şablon güncellendi. Patch edilen blok:', localPatched);

  if (!push) {
    console.log('DB push atlandı. Canlıya almak için: --push');
    return;
  }

  try {
    loadEnv();
    await connect();
    const db = getDb();
    const doc = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
    if (!doc) throw new Error(`pageContents bulunamadı: ${PAGE_ID}`);

    const dbPatched = patchContent(doc.content, html);
    const r = await db
      .collection('pageContents')
      .updateOne({ pageId: PAGE_ID }, { $set: { content: doc.content } });
    console.log('DB güncellendi:', {
      patched: dbPatched,
      matched: r.matchedCount,
      modified: r.modifiedCount,
    });
  } finally {
    await close().catch(() => {});
  }
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
