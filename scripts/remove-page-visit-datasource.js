#!/usr/bin/env node
/**
 * Sayfalardan "Sayfa ziyaret logu" (_pageVisitEnter / pageVisitLog) data-source'unu kaldırır.
 *
 *   node scripts/remove-page-visit-datasource.js
 *   node scripts/remove-page-visit-datasource.js --push
 */
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const VARIABLE = '_pageVisitEnter';
const CUSTOM_FN = 'pageVisitLog';

function propVal(block, key) {
  return (block?.properties || []).find((p) => p.key === key)?.value;
}

function isPageVisitDs(block) {
  if (!block || block.type !== 'data-source') return false;
  return (
    propVal(block, 'variable-name') === VARIABLE ||
    propVal(block, 'custom-function-name') === CUSTOM_FN ||
    propVal(block, 'display-name') === 'Sayfa ziyaret logu'
  );
}

function stripPageVisit(blocks) {
  if (!Array.isArray(blocks)) return { blocks, removed: 0 };
  let removed = 0;
  const next = [];
  for (const b of blocks) {
    if (isPageVisitDs(b)) {
      removed += 1;
      continue;
    }
    if (b.children) {
      const child = stripPageVisit(b.children);
      b.children = child.blocks;
      removed += child.removed;
    }
    next.push(b);
  }
  return { blocks: next, removed };
}

async function main() {
  const doPush = process.argv.includes('--push');
  loadEnv();
  await connect();
  const db = getDb();

  const summary = { scanned: 0, updated: 0, removed: 0, skipped: 0 };

  const cursor = db.collection('pageContents').find({});
  while (await cursor.hasNext()) {
    const doc = await cursor.next();
    summary.scanned += 1;
    const { blocks, removed } = stripPageVisit(doc.content || []);
    if (!removed) {
      summary.skipped += 1;
      continue;
    }
    summary.updated += 1;
    summary.removed += removed;
    if (summary.updated <= 15 || summary.updated % 100 === 0) {
      console.log(`${doPush ? 'push' : 'dry '} ${doc.pageId}  -${removed}`);
    }
    if (doPush) {
      await db.collection('pageContents').updateOne(
        { _id: doc._id },
        { $set: { content: blocks, updatedAt: new Date() } }
      );
    }
  }

  console.log('\nÖzet:', summary);
  if (!doPush) console.log('DB yazılmadı. Canlıya almak için: --push');
  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
