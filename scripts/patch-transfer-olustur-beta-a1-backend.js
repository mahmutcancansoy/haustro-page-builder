#!/usr/bin/env node
/**
 * Aşama 1: transfer-olustur-beta form → multiTransfer API
 *
 *   node scripts/patch-transfer-olustur-beta-a1-backend.js
 *   node scripts/patch-transfer-olustur-beta-a1-backend.js --push
 */
console.error(
  'Bu script kullanımdan kaldırıldı. Bunun yerine patch-transfer-olustur-beta-a1-mode.js çalıştırın.'
);
process.exit(1);

const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const { PAGE_CONFIG } = require('./lib/tob-page-design');

const PAGE_ID = PAGE_CONFIG.pageId;
const TEMPLATE_PATH = path.join(
  __dirname,
  '../templates/transfer-olustur-beta-content.json'
);

const push = process.argv.includes('--push');

function prop(block, key) {
  return (block.properties || []).find((p) => p.key === key);
}

function setProp(block, key, value) {
  const p = prop(block, key);
  if (p) p.value = value;
}

function setGroupChild(groupProp, childKey, value) {
  const child = groupProp?.children?.find((c) => c.key === childKey);
  if (child) child.value = value;
}

function findTransfersFormContainer(nodes) {
  for (const n of nodes || []) {
    if (n.type === 'form-container') {
      const key = prop(n, 'key')?.value;
      const name = prop(n, 'display-name')?.value;
      if (key === 'transfersExpo' || name === 'transfers') return n;
    }
    const found = findTransfersFormContainer(n.children);
    if (found) return found;
  }
  return null;
}

function patchTransfersForm(form) {
  setProp(form, 'action', 'custom');
  setProp(form, 'custom-function-name', 'multiTransfer');

  setProp(
    form,
    'hidden-values',
    '{\n    "operationType": "request",\n    ":roleTypes:approvell": "606a1b029837370015518ffc",\n    ":users:Creator": "{{info._id}}"\n}'
  );

  setProp(form, 'on-success', 'route');
  setProp(form, 'url', '/d/transfer-detay-beta');
  setProp(
    form,
    'query-params',
    '{\n    "_id": "{{response.multiTransfer.transferId}}"\n}'
  );
  setProp(form, 'response-name', 'multiTransfer');

  const msg = prop(form, 'on-success-message');
  if (msg?.children) {
    setGroupChild(msg, 'header', 'Başarılı');
    setGroupChild(msg, 'text', 'Transfer talebi oluşturuldu. Onay sürecine alındı.');
  }
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const existing = await getPageContent(PAGE_ID);
    if (!existing?.content?.length) {
      throw new Error(`pageContents bulunamadı: ${PAGE_ID}`);
    }

    const content = JSON.parse(JSON.stringify(existing.content));
    const form = findTransfersFormContainer(content);
    if (!form) {
      throw new Error('transfersExpo form-container bulunamadı');
    }

    patchTransfersForm(form);

    const doc = {
      _id: existing._id,
      pageId: PAGE_ID,
      content,
      styles: existing.styles || '',
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    if (!push) {
      console.log('DB push atlandı. Canlıya almak için: --push');
      console.log('template:', TEMPLATE_PATH);
      return;
    }

    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_ID },
      { $set: { content } }
    );

    console.log('sayfa: transfer-olustur-beta (Aşama 1 backend bağlantısı)');
    console.log('pageId:', PAGE_ID);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('template:', TEMPLATE_PATH);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
