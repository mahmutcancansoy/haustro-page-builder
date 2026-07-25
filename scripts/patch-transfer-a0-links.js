#!/usr/bin/env node
/**
 * Aşama 0: transfer link düzeltmeleri
 * - arac-gerec-detayi: oluştur + liste linkleri beta sayfalarına
 * - satin-alim-detayi: Transfer Talebi Oluştur → transfer-olustur-beta
 *
 *   node scripts/patch-transfer-a0-links.js
 *   node scripts/patch-transfer-a0-links.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const push = process.argv.includes('--push');

const PAGES = [
  {
    template: 'arac-gerec-detayi',
    pageId: '5ffb93104fe5a500783cd6a2',
    file: path.join(__dirname, '../templates/arac-gerec-detayi-content.json'),
  },
  {
    template: 'satin-alim-detayi',
    pageId: '6788396da01c3524305d1dc0',
    file: path.join(__dirname, '../templates/satin-alim-detayi-content.json'),
  },
];

function propVal(block, key) {
  return (block?.properties || []).find((p) => p.key === key)?.value;
}

function setProp(block, key, value) {
  const p = (block?.properties || []).find((x) => x.key === key);
  if (p) p.value = value;
}

function patchAracGerecDetayi(content) {
  let createBtn = 0;
  let listLink = 0;

  function walk(nodes) {
    for (const node of nodes || []) {
      if (node.type === 'button') {
        const name = propVal(node, 'display-name');
        if (name === 'Yeni Transfer Oluştur') {
          setProp(node, 'url', '/d/transfer-olustur-beta');
          setProp(
            node,
            'query-params',
            '{\n    "inventoryId" : "{{params._id}}"\n}'
          );
          createBtn++;
        }
      }
      if (node.type === 'button' && propVal(node, 'action') === 'route') {
        const url = propVal(node, 'url');
        if (url === '/d/transfer-detayi') {
          setProp(node, 'url', '/d/transfer-detay-beta');
          listLink++;
        }
      }
      walk(node.children);
    }
  }

  walk(content);
  return { createBtn, listLink };
}

function patchSatinAlimDetayi(content) {
  let transferBtn = 0;

  function walk(nodes) {
    for (const node of nodes || []) {
      if (node.type === 'button' && propVal(node, 'display-name') === 'Transfer Talebi Oluştur') {
        setProp(node, 'action', 'route');
        setProp(node, 'url', '/d/transfer-olustur-beta');
        setProp(
          node,
          'query-params',
          [
            '{',
            '    "inventoryId": "{{purchases.:inventory:._id}}",',
            '    "amount": "{{purchases.count}}",',
            '    "purchaseId": "{{params._id}}",',
            '    "mode": "interBranch"',
            '}',
          ].join('\n')
        );
        const settings = propVal(node, 'settings') || {};
        settings.inForm = false;
        settings.disabled = false;
        setProp(node, 'settings', settings);
        transferBtn++;
      }
      walk(node.children);
    }
  }

  walk(content);
  return { transferBtn };
}

async function main() {
  for (const page of PAGES) {
    const raw = JSON.parse(fs.readFileSync(page.file, 'utf8'));
    const result =
      page.template === 'arac-gerec-detayi'
        ? patchAracGerecDetayi(raw.content)
        : patchSatinAlimDetayi(raw.content);

    fs.writeFileSync(page.file, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
    console.log(`${page.template}:`, result);
  }

  if (!push) {
    console.log('DB push atlandı. Canlıya almak için: --push');
    return;
  }

  loadEnv();
  await connect();
  const db = getDb();
  for (const page of PAGES) {
    const raw = JSON.parse(fs.readFileSync(page.file, 'utf8'));
    const update = { content: raw.content };
    if (raw.styles != null) update.styles = raw.styles;
    const r = await db
      .collection('pageContents')
      .updateOne({ pageId: page.pageId }, { $set: update });
    console.log(`DB push ${page.template}:`, {
      matched: r.matchedCount,
      modified: r.modifiedCount,
    });
  }
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
