#!/usr/bin/env node
/**
 * Mail alıcı düzenle: yalnızca stil + form başlık metni güncelle (içerik korunur).
 *
 *   node scripts/patch-mail-alici-duzenle-styles.js
 *   node scripts/patch-mail-alici-duzenle-styles.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { EDIT_PAGE, loadEditStyles } = require('./lib/mr-page-design');

const contentFile = path.join(__dirname, '../templates/mail-alici-duzenle-content.json');
const formHeadFile = path.join(__dirname, '../templates/mail-alici-duzenle-form-head.html');
const push = process.argv.includes('--push');

function findRenderTemplate(blocks, displayName) {
  for (const block of blocks || []) {
    if (block.type === 'render-template') {
      const name = block.properties?.find((p) => p.key === 'display-name')?.value;
      if (name === displayName) return block;
    }
    const found = findRenderTemplate(block.children, displayName);
    if (found) return found;
  }
  return null;
}

(async () => {
  try {
    if (!fs.existsSync(contentFile)) {
      throw new Error('Şablon bulunamadı — önce sync-page-from-db çalıştırın');
    }

    const doc = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
    const formHeadHtml = fs.readFileSync(formHeadFile, 'utf8').trim();
    const formHead = findRenderTemplate(doc.content, 'Form başlık');
    if (formHead) formHead.content = formHeadHtml;

    doc.styles = loadEditStyles();
    doc.stylesPatchedAt = new Date().toISOString();

    fs.writeFileSync(contentFile, JSON.stringify(doc, null, 2) + '\n');
    console.log('Şablon stilleri güncellendi:', contentFile);
    console.log('styles length:', doc.styles.length);

    if (!push) {
      console.log('DB push atlandı. Canlıya almak için: --push');
      return;
    }

    loadEnv();
    await connect();
    const db = getDb();
    const r = await db.collection('pageContents').updateOne(
      { pageId: EDIT_PAGE.pageId },
      {
        $set: {
          content: doc.content,
          styles: doc.styles,
        },
      }
    );
    console.log('mail-alici-duzenle DB push:', r.matchedCount, 'matched,', r.modifiedCount, 'modified');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
