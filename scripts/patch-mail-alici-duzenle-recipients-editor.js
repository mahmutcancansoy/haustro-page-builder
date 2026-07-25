#!/usr/bin/env node
/**
 * Mail alıcı düzenle: recipientsText textarea + update formu
 *
 *   node scripts/patch-mail-alici-duzenle-recipients-editor.js
 *   node scripts/patch-mail-alici-duzenle-recipients-editor.js --push-edit
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const {
  EDIT_PAGE,
  buildEditContent,
  loadEditStyles,
} = require('./lib/mr-page-design');

const contentFile = path.join(__dirname, '../templates/mail-alici-duzenle-content.json');
const pushEdit = process.argv.includes('--push-edit');

(async () => {
  try {
    const content = buildEditContent();
    const styles = loadEditStyles();

    const doc = {
      pageId: EDIT_PAGE.pageId,
      content,
      styles,
      patchedAt: new Date().toISOString(),
    };

    if (fs.existsSync(contentFile)) {
      const existing = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
      doc.pageId = existing.pageId || EDIT_PAGE.pageId;
    }

    fs.writeFileSync(contentFile, JSON.stringify(doc, null, 2) + '\n');
    console.log('Şablon güncellendi:', contentFile);

    if (!pushEdit) {
      console.log('DB push atlandı. Canlıya almak için: --push-edit');
      return;
    }

    loadEnv();
    await connect();
    const db = getDb();
    const r = await db.collection('pageContents').updateOne(
      { pageId: EDIT_PAGE.pageId },
      { $set: { content, styles } }
    );
    console.log('mail-alici-duzenle DB push:', r.matchedCount, 'matched,', r.modifiedCount, 'modified');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
