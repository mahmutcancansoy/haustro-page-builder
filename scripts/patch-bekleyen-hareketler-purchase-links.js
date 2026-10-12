#!/usr/bin/env node
/**
 * Satın alma bildirimleri ilgili talebin detayına gider.
 * Talep sahibi (Sipariş Yolda dahil) artık aynı bildirim sayfasını açmaz.
 *
 *   node scripts/patch-bekleyen-hareketler-purchase-links.js
 *   node scripts/patch-bekleyen-hareketler-purchase-links.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const { PAGE_CONFIG, purchaseCardHtml } = require('./lib/bh-page-design');

const PUSH = process.argv.includes('--push');
const TEMPLATE_PATH = path.join(__dirname, '../templates/bekleyen-hareketler-content.json');

const PURCHASE_LISTS = [
  'notifications.myPurchases',
  'notifications.purchaseChainPending',
  'notifications.purchaseOffersApproved',
  'notifications.purchaseFollowup',
  'notifications.offers',
  'notifications.pendingOffers',
  'notifications.missingOffers',
];

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function prop(block, key) {
  return (block?.properties || []).find((p) => p.key === key);
}

function walk(blocks, fn) {
  for (const b of blocks || []) {
    fn(b);
    if (b.children) walk(b.children, fn);
  }
}

function patchContent(content) {
  let updated = 0;
  const seen = new Set();
  walk(content, (block) => {
    if (block.type !== 'render-template') return;
    const html = String(block.content || '');
    const each = html.match(/\{\{#each ([^}]+)\}\}/);
    if (!each || !PURCHASE_LISTS.includes(each[1])) return;
    block.content = purchaseCardHtml(each[0]);
    seen.add(each[1]);
    updated += 1;
  });
  const missing = PURCHASE_LISTS.filter((name) => !seen.has(name));
  if (missing.length || updated !== PURCHASE_LISTS.length) {
    throw new Error(`Bildirim kartı eksik: ${missing.join(', ') || updated}`);
  }
  return { updated, lists: [...seen] };
}

(async () => {
  try {
    loadEnv();
    await connect();
    const existing = await getPageContent(PAGE_CONFIG.pageId);
    if (!existing?.content?.length) {
      throw new Error(`pageContents bulunamadı: ${PAGE_CONFIG.pageId}`);
    }

    const content = deepClone(existing.content);
    const result = patchContent(content);

    const payload = {
      pageId: PAGE_CONFIG.pageId,
      content,
      styles: existing.styles || '',
      syncedAt: new Date().toISOString(),
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(payload, null, 2) + '\n');
    console.log('sayfa: bekleyen-hareketler');
    console.log('kartlar:', result.updated, result.lists.join(', '));

    walk(content, (block) => {
      if (block.type !== 'render-template') return;
      const html = String(block.content || '');
      if (!html.includes('notifications.myPurchases')) return;
      if (html.includes('/d/bekleyen-hareketler')) {
        throw new Error('Satın Alımlarım hâlâ bildirim sayfasına gidiyor');
      }
      if (!html.includes('hizmet-satin-alim-detayi') || !html.includes('satin-alim-detayi{{/cIf}}?_id={{_id}}')) {
        throw new Error('Detay linki oluşmadı');
      }
    });

    if (!PUSH) {
      console.log('DB yazılmadı ( --push ile yazılır )');
      return;
    }

    const db = getDb();
    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content, styles: existing.styles || '' } }
    );
    console.log('DB push: matched', r.matchedCount, 'modified', r.modifiedCount);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
