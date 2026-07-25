#!/usr/bin/env node
/**
 * arac-gerec-detayi: Tedarik Faturaları → matched elogo (custom, hafif)
 * Detay linki → /d/tedarik-faturasi-detay
 *
 * Önkoşul: Backend'e inventoryMatchedElogoInvoices.php deploy edilmiş olmalı.
 *   cp deploy/inventoryMatchedElogoInvoices.php \
 *     ../HaustroBackend/Backend/src/routes/custom/inventoryMatchedElogoInvoices.php
 *
 *   node scripts/patch-arac-gerec-detayi-elogo-invoices.js
 *   node scripts/patch-arac-gerec-detayi-elogo-invoices.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PUSH = process.argv.includes('--push');
const PAGE_ID = '5ffb93104fe5a500783cd6a2';
const TEMPLATE_PATH = path.join(__dirname, '../templates/arac-gerec-detayi-content.json');

const CUSTOM_FILTER = `{
    "inventory" : "{{params._id}}"
}`;

function prop(block, key) {
  return (block.properties || []).find((p) => p.key === key);
}

function propVal(block, key) {
  return prop(block, key)?.value;
}

function setProp(block, key, value) {
  const p = prop(block, key);
  if (p) {
    p.value = value;
    return;
  }
  block.properties = block.properties || [];
  block.properties.push({
    key,
    header: key,
    type: 'input-text-property',
    value,
  });
}

function walk(nodes, fn) {
  for (const n of nodes || []) {
    fn(n);
    walk(n.children, fn);
    if (n.customContents) {
      for (const cc of n.customContents) walk(cc.children, fn);
    }
  }
}

function findTedarikTab(content) {
  let found = null;
  walk(content, (n) => {
    if (found) return;
    if (
      (n.type === 'acordion-tab' || n.type === 'accordion-tab') &&
      (propVal(n, 'display-name') === 'Tedarik Faturaları' ||
        propVal(n, 'header') === 'Tedarik Faturaları')
    ) {
      found = n;
    }
  });
  return found;
}

function isInvoiceDs(n) {
  if (n.type !== 'data-source') return false;
  const vn = String(propVal(n, 'variable-name') || '');
  const dn = String(propVal(n, 'display-name') || '');
  return (
    vn === 'supplyInvoice' ||
    vn === 'elogoDocuments' ||
    dn === 'SupplyInvoice' ||
    dn === 'ElogoDocumentsMatched'
  );
}

function patchInvoiceTableSubtree(root, stats) {
  walk([root], (n) => {
    if (n.type === 'table' && propVal(n, 'display-name') === 'Tedarik Faturaları') {
      setProp(n, 'data-source', 'elogoDocuments');
      setProp(n, 'empty-message', 'Bu envantere eşleşmiş tedarik faturası bulunmuyor.');
      stats.table += 1;
    }

    if (n.type === 'table-column') {
      const name = String(propVal(n, 'display-name') || '');
      const header = String(propVal(n, 'header') || '');
      if (name === 'Şube / Depo' || header === 'Şube / Depo') {
        setProp(n, 'display-name', 'Fatura No');
        setProp(n, 'header', 'Fatura No');
        stats.headers += 1;
      } else if (name === 'Tedarikçi Firma' || header === 'Tedarikçi Firma') {
        setProp(n, 'display-name', 'Cari Adı');
        setProp(n, 'header', 'Cari Adı');
        stats.headers += 1;
      }
    }

    if (n.type === 'label') {
      const text = String(propVal(n, 'text') || '');
      if (text.includes('input.:departments:')) {
        setProp(n, 'display-name', 'Fatura No');
        setProp(n, 'text', '{{input.invoiceNumber}}');
        stats.labels += 1;
      } else if (text.includes('input.:suppliers:')) {
        setProp(n, 'display-name', 'Cari Adı');
        setProp(n, 'text', '{{input.supplierName}}');
        stats.labels += 1;
      } else if (
        text.includes('input.datetime') ||
        text.includes('{{renderDateTime input.datetime}}')
      ) {
        setProp(n, 'display-name', 'Fatura Tarihi');
        setProp(n, 'text', '{{input.invoiceDate}}');
        stats.labels += 1;
      }
    }

    if (n.type === 'button') {
      const url = String(propVal(n, 'url') || '');
      if (url.includes('tedarik-faturasi-detay')) {
        setProp(n, 'url', '/d/tedarik-faturasi-detay');
        setProp(n, 'query-params', '{\n    "_id" : "{{input._id}}"\n}');
        stats.buttons += 1;
      }
    }
  });
}

function patch(content) {
  const stats = { ds: 0, table: 0, labels: 0, buttons: 0, headers: 0, tab: 0 };

  walk(content, (n) => {
    if (!isInvoiceDs(n)) return;

    setProp(n, 'display-name', 'ElogoDocumentsMatched');
    setProp(n, 'variable-name', 'elogoDocuments');
    setProp(n, 'function', 'custom');
    setProp(n, 'custom-function-name', 'inventoryMatchedElogoInvoices');
    setProp(n, 'table-name', '');
    setProp(n, 'table-filters', CUSTOM_FILTER);
    setProp(n, 'post-params', '{\n    \n}');

    const settings = prop(n, 'settings');
    if (settings?.value && typeof settings.value === 'object') {
      settings.value.single = false;
      settings.value.forTable = false;
      settings.value.canReload = false;
      settings.value.debug = false;
    }
    stats.ds += 1;
  });

  const tab = findTedarikTab(content);
  if (!tab) throw new Error('Tedarik Faturaları accordion-tab bulunamadı');
  stats.tab = 1;
  patchInvoiceTableSubtree(tab, stats);

  return stats;
}

(async () => {
  try {
    const doc = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
    const stats = patch(doc.content || []);
    doc.updatedAt = new Date().toISOString();
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');
    console.log('şablon güncellendi:', TEMPLATE_PATH);
    console.log(stats);
    console.log('custom:', 'inventoryMatchedElogoInvoices');

    if (!PUSH) {
      console.log('DB yazılmadı ( --push ile yazılır )');
      console.log('ÖNCE backend PHP deploy et, SONRA --push');
      return;
    }

    loadEnv();
    await connect();
    const db = getDb();
    const update = { content: doc.content };
    if (doc.styles != null) update.styles = doc.styles;
    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_ID },
      { $set: update }
    );
    console.log('DB push: matched', r.matchedCount, 'modified', r.modifiedCount);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
