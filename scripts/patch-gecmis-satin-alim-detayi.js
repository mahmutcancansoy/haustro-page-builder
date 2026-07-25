#!/usr/bin/env node
/**
 * gecmis-satin-alim-detayi: geçmiş satın alım detayı — salt okunur görünüm.
 * - stock / departmentsOfInventory kaldırılır
 * - purchases için status koşulu yok
 * - offers: status=1 (onaylanan teklif), üst koşul true
 * - fatura: yalnızca elogoDocumentId
 *
 * Kullanım: node scripts/patch-gecmis-satin-alim-detayi.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = '6a218e755170eb00d1750a02';
const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/gecmis-satin-alim-detayi-content.json'
);

const OFFERS_FILTER = '{\n "status":"1",\n ":purchases:":"{{params._id}}"\n}';
// confirmOffer kök seviyede yüklenmeli; koşul içinde _id kontrolü veri kaynağını hiç çalıştırmaz.
const CONFIRM_OFFER_CONDITION = '"{{confirmOffer._id}}" != ""';
const INVOICE_CONDITION = '"{{purchases.elogoDocumentId}}" != ""';

const DEPT_BADGE =
  '<span class="badge text-light"><i class="pi pi-building me-1"></i>{{departmentsOfInventory.departments}}</span>\n                    ';

const QTY_STOCK_OLD =
  '<label>Miktar / Aktif Stok</label>\n                                <span>{{purchases.count}} Adet / <strong class="text-primary">{{stock.length}} Mevcut</strong></span>';
const QTY_STOCK_NEW =
  '<label>Talep Miktarı</label>\n                                <span>{{purchases.count}} Adet</span>';

function isExtraDsCondition(block) {
  if (block.type !== 'condition' || !Array.isArray(block.children)) return false;
  const dsChildren = block.children.filter((c) => c.type === 'data-source');
  if (dsChildren.length !== block.children.length || dsChildren.length !== 1) return false;
  const vn = dsChildren[0].properties?.find((p) => p.key === 'variable-name')?.value;
  return vn === 'departmentsOfInventory' || vn === 'stock';
}

function extractConfirmOfferDs(content) {
  for (let i = 0; i < content.length; i++) {
    const block = content[i];
    if (block.type !== 'condition' || !Array.isArray(block.children)) continue;
    const dsIdx = block.children.findIndex(
      (ch) =>
        ch.type === 'data-source' &&
        (ch.properties || []).some((p) => p.key === 'variable-name' && p.value === 'confirmOffer')
    );
    if (dsIdx < 0) continue;
    const [ds] = block.children.splice(dsIdx, 1);
    return { ds, conditionBlock: block, index: i };
  }
  return null;
}

function hoistConfirmOfferDataSource(content) {
  const existingRoot = content.some(
    (b) =>
      b.type === 'data-source' &&
      (b.properties || []).some((p) => p.key === 'variable-name' && p.value === 'confirmOffer')
  );
  if (existingRoot) return 0;

  const extracted = extractConfirmOfferDs(content);
  if (!extracted) return 0;

  const purchasesIdx = content.findIndex(
    (b) =>
      b.type === 'data-source' &&
      (b.properties || []).some((p) => p.key === 'variable-name' && p.value === 'purchases')
  );
  const insertAt = purchasesIdx >= 0 ? purchasesIdx + 1 : 1;
  content.splice(insertAt, 0, extracted.ds);
  return 1;
}

function patchContent(content) {
  const stats = {
    removedDataSources: 0,
    confirmOfferHoisted: 0,
    confirmOfferCondition: 0,
    invoiceCondition: 0,
    offersFilter: 0,
    templateCleanup: 0,
  };

  stats.confirmOfferHoisted = hoistConfirmOfferDataSource(content);

  const filtered = content.filter((block) => {
    if (!isExtraDsCondition(block)) return true;
    stats.removedDataSources += 1;
    return false;
  });
  content.length = 0;
  content.push(...filtered);

  function walk(blocks) {
    for (const b of blocks || []) {
      if (b.type === 'data-source') {
        const vn = (b.properties || []).find((p) => p.key === 'variable-name')?.value;
        if (vn === 'confirmOffer') {
          const filters = (b.properties || []).find((p) => p.key === 'table-filters');
          if (filters && filters.value !== OFFERS_FILTER) {
            filters.value = OFFERS_FILTER;
            stats.offersFilter += 1;
          }
          const settings = (b.properties || []).find((p) => p.key === 'settings');
          if (settings?.value) settings.value.single = true;
        }
        if (vn === 'purchases') {
          const settings = (b.properties || []).find((p) => p.key === 'settings');
          if (settings?.value) settings.value.single = true;
        }
      }

      if (b.type === 'condition') {
        const condProp = (b.properties || []).find((p) => p.key === 'condition');
        const hasConfirmDs = (b.children || []).some(
          (ch) =>
            ch.type === 'data-source' &&
            (ch.properties || []).some((p) => p.key === 'variable-name' && p.value === 'confirmOffer')
        );
        if (hasConfirmDs && condProp && condProp.value !== CONFIRM_OFFER_CONDITION) {
          condProp.value = CONFIRM_OFFER_CONDITION;
          const dn = (b.properties || []).find((p) => p.key === 'display-name');
          if (dn) dn.value = 'Onaylanan teklif';
          stats.confirmOfferCondition += 1;
        }

        const dn = (b.properties || []).find((p) => p.key === 'display-name');
        if (dn?.value === 'Invoice' && condProp && condProp.value !== INVOICE_CONDITION) {
          condProp.value = INVOICE_CONDITION;
          stats.invoiceCondition += 1;
        }
      }

      if (b.type === 'render-template' && typeof b.content === 'string') {
        let c = b.content;
        let changed = false;
        if (c.includes(DEPT_BADGE)) {
          c = c.replace(DEPT_BADGE, '');
          changed = true;
        }
        if (c.includes(QTY_STOCK_OLD)) {
          c = c.replace(QTY_STOCK_OLD, QTY_STOCK_NEW);
          changed = true;
        }
        if (changed) {
          b.content = c;
          stats.templateCleanup += 1;
        }
      }

      walk(b.children);
    }
  }

  walk(content);
  return stats;
}

(async () => {
  try {
    const doc = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
    const stats = patchContent(doc.content || []);

    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    loadEnv();
    await connect();
    const db = getDb();
    const r = await db
      .collection('pageContents')
      .updateOne({ pageId: PAGE_ID }, { $set: { content: doc.content } });

    console.log('pageId:', PAGE_ID);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('stats:', stats);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
