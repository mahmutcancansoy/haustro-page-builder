#!/usr/bin/env node
/**
 * arac-gerec-envanteri: tablo görünümünü kart (render-template) görünümüne çevirir.
 *
 * - inventory data-source korunur, forTable=false yapılır (kart döngüsü için).
 * - Üst düzey `table` bloğu, envanter kart grid'i ile değiştirilir.
 * - Kategori navigasyonu / başlık (template) blokları korunur.
 *
 *   node scripts/patch-arac-gerec-envanteri-cards.js
 *   node scripts/patch-arac-gerec-envanteri-cards.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const push = process.argv.includes('--push');
const PAGE_ID = '5fef676e4fe5a500117b0852';
const LIST_FILE = path.join(__dirname, '../templates/inventory-list-content.json');
const CARDS_FILE = path.join(__dirname, '../templates/inventory-cards-content.json');

function buildCardBlock() {
  const cards = JSON.parse(fs.readFileSync(CARDS_FILE, 'utf8'));
  const tpl = (cards.content || []).find((b) => b.type === 'render-template');
  if (!tpl) throw new Error('inventory-cards-content.json içinde render-template bulunamadı');
  const block = JSON.parse(JSON.stringify(tpl));
  // Başlığı sayfaya uygun hale getir
  block.content = block.content.replace('Envanter Listesi', 'Araç Gereç Envanteri');
  return block;
}

function setForTableFalse(content) {
  let changed = 0;
  for (const node of content || []) {
    if (node.type !== 'data-source') continue;
    const varName = (node.properties || []).find((p) => p.key === 'variable-name')?.value;
    const tableName = (node.properties || []).find((p) => p.key === 'table-name')?.value;
    if (varName === 'inventory' && tableName === 'inventory') {
      const settings = (node.properties || []).find((p) => p.key === 'settings');
      if (settings?.value) {
        settings.value.forTable = false;
        settings.value.canReload = true;
        changed++;
      }
    }
  }
  return changed;
}

function replaceTableWithCards(content, cardBlock) {
  const idx = (content || []).findIndex((b) => b.type === 'table');
  if (idx === -1) {
    // Zaten kart görünümündeyse tekrar eklemeyelim
    const hasCards = (content || []).some(
      (b) => b.type === 'render-template' && String(b.content || '').includes('inv-cards-grid')
    );
    return { replaced: 0, alreadyCards: hasCards };
  }
  content.splice(idx, 1, cardBlock);
  return { replaced: 1, alreadyCards: false };
}

function applyTo(content, cardBlock) {
  const forTable = setForTableFalse(content);
  const res = replaceTableWithCards(content, JSON.parse(JSON.stringify(cardBlock)));
  return { forTable, ...res };
}

async function main() {
  const cardBlock = buildCardBlock();

  // 1) Yerel şablonu güncelle
  const raw = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
  const localResult = applyTo(raw.content, cardBlock);
  fs.writeFileSync(LIST_FILE, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  console.log('Yerel şablon güncellendi:', localResult);

  if (!push) {
    console.log('DB push atlandı. Canlıya almak için: --push');
    return;
  }

  // 2) DB güncelle
  loadEnv();
  await connect();
  const db = getDb();
  const doc = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
  if (!doc) throw new Error(`pageContents bulunamadı: ${PAGE_ID}`);

  const dbResult = applyTo(doc.content, cardBlock);
  const r = await db
    .collection('pageContents')
    .updateOne({ pageId: PAGE_ID }, { $set: { content: doc.content } });
  console.log('DB güncellendi:', {
    ...dbResult,
    matched: r.matchedCount,
    modified: r.modifiedCount,
  });
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
