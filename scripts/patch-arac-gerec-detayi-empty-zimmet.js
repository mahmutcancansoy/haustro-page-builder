#!/usr/bin/env node
/**
 * arac-gerec-detayi: zimmet miktarı 0 iken boş kutu yerine bilgi mesajı gösterir.
 * Kullanım: node scripts/patch-arac-gerec-detayi-empty-zimmet.js
 */
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = '5ffb93104fe5a500783cd6a2';

const OLD_RT_BLOCK =
  '<div class="info-row">\n                <span class="info-label">Şubelerdeki Zimmetler:</span>\n                <div class="info-value">\n                    <span class="location-tag">{{departmentsOfInventory.assignedDepartments}}</span>\n                </div>\n            </div>';

const NEW_RT_BLOCK =
  '<div class="info-row">\n                <span class="info-label">Şubelerdeki Zimmetler:</span>\n                <div class="info-value">\n                    {{#if departmentsOfInventory.assignedCount}}\n                    <span class="location-tag">{{departmentsOfInventory.assignedDepartments}}</span>\n                    {{else}}\n                    <span class="empty-zimmet-msg">Hiçbir şubede zimmet bulunmamaktadır.</span>\n                    {{/if}}\n                </div>\n            </div>';

const EMPTY_ZIMMET_CSS =
  '\n    .empty-zimmet-msg {\n        color: #94a3b8;\n        font-size: 14px;\n        font-style: italic;\n    }\n';

const OLD_LABEL_TEXT = '{{departmentsOfInventory.assignedDepartments}}';
const NEW_LABEL_TEXT =
  '{{#if departmentsOfInventory.assignedCount}}{{departmentsOfInventory.assignedDepartments}}{{else}}Hiçbir şubede zimmet bulunmamaktadır.{{/if}}';

function patchLabels(blocks, stats) {
  for (const b of blocks || []) {
    if (b.type === 'label') {
      const textProp = (b.properties || []).find((p) => p.key === 'text');
      if (textProp && textProp.value === OLD_LABEL_TEXT) {
        textProp.value = NEW_LABEL_TEXT;
        stats.labels += 1;
      }
    }
    patchLabels(b.children, stats);
  }
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const doc = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
    if (!doc) throw new Error(`pageContents bulunamadı: ${PAGE_ID}`);

    const stats = { renderTemplate: 0, labels: 0, css: 0 };

    for (const block of doc.content || []) {
      if (block.type !== 'render-template' || !block.content) continue;
      if (!block.content.includes(OLD_RT_BLOCK)) continue;

      block.content = block.content.replace(OLD_RT_BLOCK, NEW_RT_BLOCK);
      stats.renderTemplate += 1;

      if (!block.content.includes('.empty-zimmet-msg')) {
        block.content = block.content.replace('</style>', `${EMPTY_ZIMMET_CSS}</style>`);
        stats.css += 1;
      }
    }

    patchLabels(doc.content, stats);

    if (!stats.renderTemplate && !stats.labels) {
      console.log('Değişiklik yapılmadı — hedef metin bulunamadı (sayfa zaten güncellenmiş olabilir).');
      return;
    }

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
    await close();
  }
})();
