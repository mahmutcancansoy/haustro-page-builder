#!/usr/bin/env node
/**
 * Mail alıcıları bakım scripti.
 *
 * Varsayılan: DB → repo senkron (paneldeki manuel düzenlemeler korunur, DB ezilmez).
 *
 * Kullanım:
 *   node scripts/patch-mail-alicilari-fix.js              # yalnızca DB → şablon
 *   node scripts/patch-mail-alicilari-fix.js --push-list  # liste sayfasını DB'ye yaz
 *   node scripts/patch-mail-alicilari-fix.js --push-edit  # düzenle sayfasını DB'ye yaz (dikkat!)
 *   node scripts/patch-mail-alicilari-fix.js --seed-text    # recipientsText alanlarını seed ile hizala
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const {
  LIST_PAGE,
  EDIT_PAGE,
  buildListContent,
  buildEditContent,
  loadStyles,
  loadEditStyles,
} = require('./lib/mr-page-design');
const { inspectPageContent } = require('./lib/sync-page-from-db');
const { recipientsText } = require('./lib/mail-recipients-seed-data');

const pushList = process.argv.includes('--push-list');
const pushEdit = process.argv.includes('--push-edit');
const seedText = process.argv.includes('--seed-text');

function syncFromDb() {
  execSync('node scripts/sync-mail-alicilari-from-db.js', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  });
}

(async () => {
  try {
    syncFromDb();

    const editFile = path.join(__dirname, '../templates/mail-alici-duzenle-content.json');
    if (fs.existsSync(editFile)) {
      const manual = inspectPageContent(
        JSON.parse(fs.readFileSync(editFile, 'utf8')).content
      );
      console.log('manuel form (şablondan):', JSON.stringify(manual, null, 2));
    }

    if (!pushList && !pushEdit && !seedText) {
      console.log('DB push atlandı. Push için: --push-list | --push-edit | --seed-text');
      return;
    }

    loadEnv();
    await connect();
    const db = getDb();
    const styles = loadStyles();

    if (pushList) {
      const listContent = buildListContent();
      const r = await db.collection('pageContents').updateOne(
        { pageId: LIST_PAGE.pageId },
        { $set: { content: listContent, styles } }
      );
      console.log('mail-alicilari DB push:', r.matchedCount, 'matched,', r.modifiedCount, 'modified');
    }

    if (pushEdit) {
      const editContent = buildEditContent();
      const r = await db.collection('pageContents').updateOne(
        { pageId: EDIT_PAGE.pageId },
        { $set: { content: editContent, styles: loadEditStyles() } }
      );
      console.log('mail-alici-duzenle DB push:', r.matchedCount, 'matched,', r.modifiedCount, 'modified');
    }

    if (seedText) {
      const cursor = db.collection('mailRecipients').find({});
      let textUpdated = 0;
      while (await cursor.hasNext()) {
        const doc = await cursor.next();
        const text = recipientsText(doc.recipients || []);
        if (doc.recipientsText !== text) {
          await db.collection('mailRecipients').updateOne(
            { _id: doc._id },
            { $set: { recipientsText: text } }
          );
          textUpdated += 1;
        }
      }
      console.log('recipientsText güncellendi:', textUpdated);
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
