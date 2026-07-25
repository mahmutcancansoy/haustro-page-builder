#!/usr/bin/env node
/**
 * Herhangi bir panel sayfasını DB'den templates/ altına çeker.
 * Paneldeki manuel düzenlemeler canlıdır; repo şablonları geride kalabilir.
 *
 * Kullanım:
 *   node scripts/sync-page-from-db.js --page-id 6a3bc0e743f4623d22b4042f
 *   node scripts/sync-page-from-db.js --url mail-alici-duzenle
 *   node scripts/sync-page-from-db.js --template mail-alici-duzenle
 *   node scripts/sync-page-from-db.js --url rol-duzenle --json
 */
const { ObjectId } = require('mongodb');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { pageTitle, pageUrl } = require('../src/utils');
const {
  syncPageFromDb,
  inspectPageContent,
  extractAllRenderTemplates,
} = require('./lib/sync-page-from-db');

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

const jsonOut = process.argv.includes('--json');

async function resolvePage(db) {
  const pageId = arg('page-id');
  const url = arg('url');
  const template = arg('template');

  if (pageId) {
    const page = await db.collection('pages').findOne({ _id: ObjectId.createFromHexString(pageId) });
    if (!page) throw new Error(`Sayfa bulunamadı: ${pageId}`);
    return { page, templateName: template || pageUrl(page) || pageId };
  }

  const slug = url || template;
  if (!slug) {
    throw new Error('--page-id, --url veya --template gerekli');
  }

  const pages = await db.collection('pages').find({}).toArray();
  const match = pages.find((p) => {
    const u = pageUrl(p);
    return u === slug || u === slug.replace(/^\/d\//, '');
  });
  if (!match) throw new Error(`URL ile sayfa bulunamadı: ${slug}`);
  return { page: match, templateName: template || pageUrl(match) };
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const { page, templateName } = await resolvePage(db);
    const pageId = String(page._id);
    const pageDoc = await db.collection('pageContents').findOne({ pageId });
    if (!pageDoc) throw new Error(`pageContents yok: ${pageId} (${templateName})`);

    const stylesFile = `${templateName}-page-styles.css`;
    const result = syncPageFromDb(pageDoc, {
      templateName,
      stylesFile: pageDoc.styles ? stylesFile : null,
    });
    const extracted = extractAllRenderTemplates(pageDoc.content, templateName);
    const inspection = inspectPageContent(pageDoc.content);

    const summary = {
      syncedAt: new Date().toISOString(),
      pageId,
      templateName,
      title: pageTitle(page),
      url: pageUrl(page),
      changed: result.changed,
      contentHash: result.contentHash,
      contentPath: result.contentPath,
      extractedFragments: extracted,
      inspection,
    };

    if (jsonOut) {
      console.log(JSON.stringify(summary, null, 2));
    } else {
      console.log('DB → şablon:', templateName, `(${pageTitle(page)})`);
      console.log('pageId:', pageId, '| değişiklik:', result.changed ? 'evet' : 'hayır');
      if (extracted.length) {
        console.log('render-template parçaları:', extracted.map((e) => e.file).join(', '));
      }
      if (inspection.forms.length) {
        console.log('formlar:', JSON.stringify(inspection.forms, null, 2));
      }
      if (inspection.dataSources.length) {
        console.log('data-source:', JSON.stringify(inspection.dataSources, null, 2));
      }
    }
  } catch (e) {
    console.error(e.message || e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
