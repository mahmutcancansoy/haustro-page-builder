#!/usr/bin/env node
/**
 * İş akışı dokümantasyon sayfaları — Sabit Veriler altında admin-only
 *
 * Kullanım:
 *   node scripts/setup-is-akislari.js                    # yalnızca şablonları yaz
 *   node scripts/setup-is-akislari.js --push             # DB'ye kategori + sayfaları oluştur/güncelle
 *   node scripts/setup-is-akislari.js --push --parent <pageId>
 *   node scripts/setup-is-akislari.js --update
 */
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const {
  createPageFromTemplate,
  getPageById,
  findPageByName,
  grantAdminRole,
} = require('../src/pageService');
const { nowUtcDate } = require('../src/utils');
const {
  SABIT_VERILER_ID,
  INDEX_PAGE,
  IS_AKISLARI_CATEGORY,
  CATEGORY,
  WORKFLOW_DOCS,
  loadStyles,
  buildIndexContent,
  buildDetailContent,
  makeCategoryPageMeta,
  menuIcon,
  writeTemplateFiles,
} = require('./lib/wfd-page-design');

const templatesDir = path.join(__dirname, '../templates');

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

async function upsertPageContent(db, pageId, content, styles) {
  const existing = await db.collection('pageContents').findOne({ pageId: String(pageId) });
  const payload = { content, styles };
  if (existing) {
    const r = await db.collection('pageContents').updateOne(
      { pageId: String(pageId) },
      { $set: payload }
    );
    return { action: 'updated', matched: r.matchedCount, modified: r.modifiedCount };
  }
  await db.collection('pageContents').insertOne({ pageId: String(pageId), ...payload });
  return { action: 'inserted' };
}

async function ensurePageOrder(db, pageId, parentId) {
  const pid = String(pageId);
  const existing = await db.collection('pageOrders').findOne({ pageId: pid });
  if (existing) return existing.order;

  const siblings = await db.collection('pages').find({ parent: String(parentId) }).toArray();
  const siblingIds = siblings.map((s) => String(s._id));
  const orders = await db
    .collection('pageOrders')
    .find({ pageId: { $in: siblingIds } })
    .toArray();
  const max = orders.reduce((m, o) => Math.max(m, Number(o.order) || 0), -1);
  const nextOrder = String(max + 1);
  await db.collection('pageOrders').insertOne({ pageId: pid, order: nextOrder });
  return nextOrder;
}

async function findOrCreateCategory(db, parentId) {
  const existing = await findPageByName(CATEGORY.title, { parentId: String(parentId) });
  if (existing.length) {
    const categoryId = String(existing[0]._id);
    console.log('Kategori mevcut:', categoryId);
    return categoryId;
  }

  const pageDoc = makeCategoryPageMeta();
  pageDoc.parent = String(parentId);
  pageDoc.createdAt = nowUtcDate();
  pageDoc.children = [];

  const r = await db.collection('pages').insertOne(pageDoc);
  const categoryId = String(r.insertedId);
  await grantAdminRole(categoryId);
  await ensurePageOrder(db, categoryId, parentId);
  console.log('Kategori oluşturuldu:', categoryId);
  return categoryId;
}

async function setPageShowInMenu(db, pageId, showInMenu) {
  const page = await db.collection('pages').findOne({ _id: require('mongodb').ObjectId(pageId) });
  if (!page) return { updated: false, reason: 'not_found' };

  const props = [...(page.properties || [])];
  const settingsIdx = props.findIndex((p) => p.key === 'settings');
  if (settingsIdx >= 0) {
    props[settingsIdx] = {
      ...props[settingsIdx],
      value: { ...(props[settingsIdx].value || {}), showInMenu, showHeader: true },
    };
  } else {
    props.push({
      key: 'settings',
      type: 'checkbox-property',
      header: 'Settings',
      options: [
        { label: 'Show in menu', name: 'showInMenu' },
        { label: 'Show header', name: 'showHeader' },
      ],
      value: { showInMenu, showHeader: true },
    });
  }

  await db.collection('pages').updateOne(
    { _id: require('mongodb').ObjectId(pageId) },
    { $set: { properties: props } }
  );
  return { updated: true, showInMenu };
}

async function setPageIcon(db, pageId, icon) {
  const page = await db.collection('pages').findOne({ _id: require('mongodb').ObjectId(pageId) });
  if (!page) return { updated: false, reason: 'not_found' };

  const props = [...(page.properties || [])];
  const iconIdx = props.findIndex((p) => p.key === 'icon');
  if (iconIdx >= 0) {
    props[iconIdx] = { ...props[iconIdx], value: icon };
  } else {
    props.push({
      key: 'icon',
      type: 'input-text-property',
      header: 'Icon',
      value: icon,
    });
  }

  await db.collection('pages').updateOne(
    { _id: require('mongodb').ObjectId(pageId) },
    { $set: { properties: props } }
  );
  return { updated: true, icon };
}

async function syncWorkflowPageIcons(db) {
  for (const wf of WORKFLOW_DOCS) {
    if (!wf.pageId) continue;
    const icon = menuIcon(wf.icon);
    const r = await setPageIcon(db, wf.pageId, icon);
    console.log(`${wf.title} menü ikonu:`, r);
  }
}

async function ensureCategoryDefaultUrl(db, categoryId) {
  const page = await db.collection('pages').findOne({ _id: require('mongodb').ObjectId(categoryId) });
  if (!page) return { updated: false, reason: 'not_found' };

  const props = [...(page.properties || [])];
  const defaultIdx = props.findIndex((p) => p.key === 'default-url');
  if (defaultIdx >= 0) {
    props[defaultIdx] = { ...props[defaultIdx], value: INDEX_PAGE.url };
  } else {
    props.push({
      key: 'default-url',
      header: 'Default Url',
      type: 'input-text-property',
      value: INDEX_PAGE.url,
    });
  }

  await db.collection('pages').updateOne(
    { _id: require('mongodb').ObjectId(categoryId) },
    { $set: { properties: props } }
  );
  return { updated: true, defaultUrl: INDEX_PAGE.url };
}

async function applyMenuStructure(db) {
  const categoryId = arg('category-id') || IS_AKISLARI_CATEGORY.id;
  const indexPageId = arg('index-page-id') || INDEX_PAGE.pageId;

  console.log('Kategori default-url:', await ensureCategoryDefaultUrl(db, categoryId));
  console.log('Index menü gizle:', await setPageShowInMenu(db, indexPageId, false));
}

async function updateAllContents(db, styles) {
  const indexPageId = arg('index-page-id') || INDEX_PAGE.pageId;
  console.log('Index:', await upsertPageContent(db, indexPageId, buildIndexContent(), styles));

  for (const wf of WORKFLOW_DOCS) {
    const pageId = arg(`${wf.slug}-page-id`) || wf.pageId;
    if (!pageId) {
      console.warn('Atlandı (page-id yok):', wf.title);
      continue;
    }
    console.log(
      wf.title + ':',
      await upsertPageContent(db, pageId, buildDetailContent(wf), styles)
    );
  }

  await syncWorkflowPageIcons(db);
}

async function findOrCreatePage(db, { templateName, parentId, title, url }) {
  const existing = await findPageByName(title, { parentId: String(parentId) });
  if (existing.length) {
    const pageId = String(existing[0]._id);
    return { pageId, created: false };
  }

  const result = await createPageFromTemplate({
    templateName,
    parentId: String(parentId),
    title,
    url,
    grantAdmin: true,
  });
  return { pageId: result.pageId, created: true };
}

(async () => {
  try {
    const { count } = writeTemplateFiles(templatesDir);
    console.log(`Şablonlar yazıldı: index + ${count - 1} akış sayfası`);

    if (!hasFlag('push') && !hasFlag('update')) {
      console.log('\nDB işlemleri için:');
      console.log(`  node scripts/setup-is-akislari.js --push`);
      console.log(`  node scripts/setup-is-akislari.js --push --parent ${SABIT_VERILER_ID}`);
      return;
    }

    loadEnv();
    await connect();
    const db = getDb();
    const styles = loadStyles();

    if (hasFlag('update')) {
      await applyMenuStructure(db);
      await updateAllContents(db, styles);
      return;
    }

    const parentId = arg('parent') || SABIT_VERILER_ID;
    const parent = await getPageById(parentId);
    if (!parent) throw new Error(`Parent bulunamadı: ${parentId}`);

    const categoryId = await findOrCreateCategory(db, parentId);

    const indexResult = await findOrCreatePage(db, {
      templateName: INDEX_PAGE.templateName,
      parentId: categoryId,
      title: INDEX_PAGE.title,
      url: INDEX_PAGE.url,
    });
    console.log(
      indexResult.created ? 'Index oluşturuldu:' : 'Index güncelleniyor:',
      indexResult.pageId
    );
    console.log('Index içerik:', await upsertPageContent(db, indexResult.pageId, buildIndexContent(), styles));
    await applyMenuStructure(db);

    for (const wf of WORKFLOW_DOCS) {
      const wfResult = await findOrCreatePage(db, {
        templateName: wf.templateName,
        parentId: categoryId,
        title: wf.title,
        url: wf.url,
      });
      console.log(
        (wfResult.created ? 'Oluşturuldu:' : 'Güncelleniyor:') + ' ' + wf.title,
        wfResult.pageId
      );
      console.log(
        wf.title + ' içerik:',
        await upsertPageContent(db, wfResult.pageId, buildDetailContent(wf), styles)
      );
    }

    console.log('\nPanel menü: Sabit Veriler → İş Akışları');
    console.log('URL örnekleri:');
    console.log('  /d/is-akislari');
    WORKFLOW_DOCS.forEach((wf) => console.log(`  /d/${wf.url}`));
    console.log('\nNot: Sayfalar yalnızca admin roleLogs ile erişilebilir (grantAdminRole).');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
