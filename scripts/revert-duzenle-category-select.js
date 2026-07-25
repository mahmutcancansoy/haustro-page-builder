#!/usr/bin/env node
/**
 * Yanlış kategori patch'ini geri alır — Category Select Final kaldırılır,
 * eski False condition + Envanter Kategorisi select geri gelir.
 * Kullanım: node scripts/revert-duzenle-category-select.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = '5ffa14bf4fe5a5010a30d142';
const RESTORE = path.join(
  __dirname,
  '../templates/fragments/duzenle-category-condition-restore.json'
);

function propVal(block, key) {
  const p = (block.properties || []).find((x) => x.key === key);
  return p == null ? '' : p.value;
}

function setPropVal(block, key, value) {
  const p = (block.properties || []).find((x) => x.key === key);
  if (p) p.value = value;
}

function findWithParent(blocks, pred) {
  for (let i = 0; i < (blocks || []).length; i++) {
    const b = blocks[i];
    if (pred(b)) return { block: b, parent: blocks, index: i };
    const nested = findWithParent(b.children, pred, b);
    if (nested) return nested;
  }
  return null;
}

function findMainForm(content) {
  return findWithParent(
    content,
    (b) =>
      b.type === 'form-container' &&
      /Kategori Düzenleme/i.test(JSON.stringify(b))
  );
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();
    const doc = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
    if (!doc?.content) throw new Error('Sayfa içeriği yok');

    const content = doc.content;
    const restore = JSON.parse(fs.readFileSync(RESTORE, 'utf8'));

    const tpl = findWithParent(
      content,
      (b) =>
        b.type === 'template' &&
        /Category Select Final/i.test(String(propVal(b, 'display-name')))
    );
    if (tpl) {
      tpl.parent.splice(tpl.index, 1);
      console.log('Category Select Final kaldırıldı');
    }

    const formHit = findMainForm(content);
    if (!formHit) throw new Error('Ana form bulunamadı');

    const already = formHit.block.children?.some(
      (c) =>
        c.type === 'condition' &&
        c.children?.some(
          (ch) =>
            ch.type === 'input-select' &&
            String(propVal(ch, 'label')).includes('Envanter Kategorisi')
        )
    );
    if (!already) {
      formHit.block.children.unshift(JSON.parse(JSON.stringify(restore)));
      console.log('False condition + Envanter Kategorisi geri eklendi (form başı)');
    }

    const ds = findWithParent(
      content,
      (b) => b.type === 'data-source' && propVal(b, 'variable-name') === 'inventoryCats'
    );
    if (ds) {
      setPropVal(ds.block, 'table-filters', '{\n    "delete" : 0\n}');
      console.log('inventoryCats filtresi eski haline alındı');
    }

    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_ID },
      { $set: { content } }
    );

    console.log('pageId:', PAGE_ID);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close();
  }
})();
