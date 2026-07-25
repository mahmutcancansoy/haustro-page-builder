#!/usr/bin/env node
/**
 * Mail alıcı sayfalarını DB'den çeker → templates/ (paneldeki güncel sürüm).
 * Her patch/değişiklik öncesi bunu çalıştırın; manuel panel düzenlemeleri korunur.
 *
 * Kullanım:
 *   node scripts/sync-mail-alicilari-from-db.js
 *   node scripts/sync-mail-alicilari-from-db.js --json   # özet JSON stdout
 */
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { LIST_PAGE, EDIT_PAGE } = require('./lib/mr-page-design');
const {
  syncPageFromDb,
  inspectPageContent,
  extractAllRenderTemplates,
} = require('./lib/sync-page-from-db');

const jsonOut = process.argv.includes('--json');

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const [listDoc, editDoc] = await Promise.all([
      db.collection('pageContents').findOne({ pageId: LIST_PAGE.pageId }),
      db.collection('pageContents').findOne({ pageId: EDIT_PAGE.pageId }),
    ]);

    const list = syncPageFromDb(listDoc, {
      templateName: LIST_PAGE.templateName,
      fragments: [{ displayName: 'Mail alıcı listesi', file: 'mail-alicilari-grid.html' }],
      stylesFile: 'mail-alicilari-page-styles.css',
    });

    const edit = syncPageFromDb(editDoc, {
      templateName: EDIT_PAGE.templateName,
      fragments: [
        { displayName: 'Düzenle hero', file: 'mail-alici-duzenle-hero.html' },
        { displayName: 'Form başlık', file: 'mail-alici-duzenle-form-head.html' },
      ],
      stylesFile: null,
    });

    const manual = inspectPageContent(editDoc.content);
    const summary = {
      syncedAt: new Date().toISOString(),
      list: { changed: list.changed, hash: list.contentHash, extracted: list.extracted },
      edit: { changed: edit.changed, hash: edit.contentHash, extracted: edit.extracted },
      manualFields: manual,
    };

    if (jsonOut) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log('DB → şablon senkronu tamam');
      console.log('liste:', list.changed ? 'değişiklik var' : 'aynı', `(${list.contentHash})`);
      console.log('düzenle:', edit.changed ? 'değişiklik var' : 'aynı', `(${edit.contentHash})`);
      console.log('manuel içerik (düzenle):', JSON.stringify(manual, null, 2));
      if (list.extracted.length) console.log('liste parçaları:', list.extracted.join(', '));
      if (edit.extracted.length) console.log('düzenle parçaları:', edit.extracted.join(', '));
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
