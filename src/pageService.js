const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongodb');
const { loadEnv } = require('./config');
const { getDb } = require('./db');
const {
  slugify,
  setPropertyValue,
  getPropertyValue,
  pageTitle,
  pageUrl,
  stripMongoIds,
  nowUtcDate,
} = require('./utils');

const DEFAULT_INVENTORY_TEMPLATE_PAGE_ID = '5fef676e4fe5a500117b0852';

async function findPages(query = {}) {
  const db = getDb();
  return db.collection('pages').find(query).toArray();
}

async function findPageByName(name, { parentId } = {}) {
  const db = getDb();
  const regex = new RegExp(name, 'i');
  const filter = {
    $or: [
      { 'properties.0.value': regex },
      { 'properties.1.value': regex },
      { 'properties.value': regex },
    ],
  };
  if (parentId) filter.parent = parentId;
  return db.collection('pages').find(filter).toArray();
}

async function getPageById(id) {
  const db = getDb();
  return db.collection('pages').findOne({ _id: ObjectId(id) });
}

async function listChildren(parentId) {
  const db = getDb();
  return db
    .collection('pages')
    .find({ parent: parentId || '' })
    .toArray();
}

async function getPageContent(pageId) {
  const db = getDb();
  return db.collection('pageContents').findOne({ pageId: String(pageId) });
}

async function grantAdminRole(pageId, userId) {
  const { adminUserId } = loadEnv();
  const db = getDb();
  const uid = userId || adminUserId;
  const pid = String(pageId);
  const existing = await db.collection('roleLogs').findOne({ userId: uid, pageId: pid });
  if (existing) return { granted: false, reason: 'already_exists' };
  await db.collection('roleLogs').insertOne({ userId: uid, pageId: pid });
  return { granted: true, userId: uid };
}

async function ensurePageOrder(pageId, order, { parentId } = {}) {
  const db = getDb();
  const pid = String(pageId);
  const existing = await db.collection('pageOrders').findOne({ pageId: pid });
  if (existing) return { updated: false, order: existing.order };

  let nextOrder = order;
  if (nextOrder == null) {
    const siblingFilter =
      parentId != null ? { parent: String(parentId) } : { parent: '' };
    const siblings = await db.collection('pages').find(siblingFilter).toArray();
    const siblingIds = new Set(siblings.map((s) => String(s._id)));
    const orders = await db
      .collection('pageOrders')
      .find({ pageId: { $in: Array.from(siblingIds) } })
      .toArray();
    const max = orders.reduce(
      (m, o) => Math.max(m, Number(o.order) || 0),
      -1
    );
    nextOrder = String(max + 1);
  } else {
    nextOrder = String(nextOrder);
  }

  await db.collection('pageOrders').insertOne({ pageId: pid, order: nextOrder });
  return { updated: true, order: nextOrder };
}

function applyPageMeta(pageDoc, { title, url, parentId, type }) {
  const doc = stripMongoIds(pageDoc);
  if (parentId != null) doc.parent = String(parentId);
  if (type) doc.type = type;
  doc.createdAt = nowUtcDate();

  // Top-level url/label alanları Haustro panel sayfalarında bulunmaz; sadece
  // properties altında tutulur. Şablondan gelmiş olabilecek artıkları temizle.
  delete doc.url;
  delete doc.label;
  delete doc.delete;

  if (title) {
    setPropertyValue(doc, 'display-name', title);
    setPropertyValue(doc, 'label', title);
    if (getPropertyValue(doc, 'url') || url) {
      setPropertyValue(doc, 'url', url || slugify(title));
    }
  }
  if (url) setPropertyValue(doc, 'url', url);

  return doc;
}

async function insertPageWithContent(pageDoc, contentDoc, options = {}) {
  const db = getDb();
  const { grantAdmin = true, pageOrder } = options;

  const insertPage = await db.collection('pages').insertOne(pageDoc);
  const newPageId = String(insertPage.insertedId);

  let contentInserted = false;
  if (contentDoc && Array.isArray(contentDoc.content) && contentDoc.content.length > 0) {
    const insertDoc = {
      pageId: newPageId,
      content: contentDoc.content,
    };
    if (contentDoc.styles != null) insertDoc.styles = contentDoc.styles;
    await db.collection('pageContents').insertOne(insertDoc);
    contentInserted = true;
  }

  let roleResult = null;
  if (grantAdmin) roleResult = await grantAdminRole(newPageId);

  let orderResult = null;
  if (pageOrder !== false) {
    orderResult = await ensurePageOrder(newPageId, pageOrder, {
      parentId: pageDoc.parent,
    });
  }

  return {
    pageId: newPageId,
    title: pageTitle(pageDoc),
    url: pageUrl(pageDoc),
    parent: pageDoc.parent,
    contentCopied: contentInserted,
    roleLog: roleResult,
    pageOrder: orderResult,
  };
}

/**
 * HaustroBackend duplicatePage.php ile aynı mantık
 */
async function duplicatePage(sourcePageId, { title, url, parentId, grantAdmin = true }) {
  const db = getDb();
  const source = await db.collection('pages').findOne({ _id: ObjectId(sourcePageId) });
  if (!source) throw new Error(`Kaynak sayfa bulunamadı: ${sourcePageId}`);

  const pageDoc = applyPageMeta(source, {
    title: title || `${pageTitle(source)} Kopya`,
    url: url || slugify(title || pageTitle(source)),
    parentId: parentId != null ? parentId : source.parent,
  });

  const sourceContent = await getPageContent(sourcePageId);
  const contentPayload =
    sourceContent && sourceContent.content && sourceContent.content.length
      ? { content: sourceContent.content }
      : null;

  return insertPageWithContent(pageDoc, contentPayload, { grantAdmin });
}

async function createInventoryListPage({
  parentId,
  title,
  url,
  templatePageId = DEFAULT_INVENTORY_TEMPLATE_PAGE_ID,
  grantAdmin = true,
}) {
  if (!parentId) throw new Error('parentId zorunlu (ör. mahmutcan test sayfa id)');
  if (!title) throw new Error('title zorunlu');

  const parent = await getPageById(parentId);
  if (!parent) throw new Error(`Üst sayfa bulunamadı: ${parentId}`);

  const finalUrl = url || slugify(title);
  const existing = await findPageByName(title, { parentId: String(parentId) });
  if (existing.length) {
    throw new Error(
      `Bu parent altında benzer isimli sayfa var: ${existing.map((p) => p._id).join(', ')}`
    );
  }

  return duplicatePage(templatePageId, {
    title,
    url: finalUrl,
    parentId: String(parentId),
    grantAdmin,
  });
}

/**
 * Yerel JSON şablon dosyalarından (templates/<name>-page.json ve
 * templates/<name>-content.json) yeni bir sayfa oluşturur.
 * duplicatePage'e benzer akış izler ama kaynak DB'den değil dosyadan gelir.
 */
async function createPageFromTemplate({
  templateName,
  parentId,
  title,
  url,
  grantAdmin = true,
}) {
  if (!templateName) throw new Error('templateName zorunlu');
  if (!parentId) throw new Error('parentId zorunlu');
  if (!title) throw new Error('title zorunlu');

  const parent = await getPageById(parentId);
  if (!parent) throw new Error(`Üst sayfa bulunamadı: ${parentId}`);

  const finalUrl = url || slugify(title);
  const existing = await findPageByName(title, { parentId: String(parentId) });
  if (existing.length) {
    throw new Error(
      `Bu parent altında benzer isimli sayfa var: ${existing.map((p) => p._id).join(', ')}`
    );
  }

  const { page: pageTpl, content: contentTpl } = loadTemplateFiles(templateName);

  const pageDoc = applyPageMeta(pageTpl, {
    title,
    url: finalUrl,
    parentId: String(parentId),
  });

  const contentPayload =
    contentTpl && Array.isArray(contentTpl.content) && contentTpl.content.length
      ? { content: contentTpl.content, styles: contentTpl.styles }
      : null;

  return insertPageWithContent(pageDoc, contentPayload, { grantAdmin });
}

async function createInventoryCardsPage({ parentId, title, url, grantAdmin = true }) {
  return createPageFromTemplate({
    templateName: 'inventory-cards',
    parentId,
    title: title || 'Envanter Kartları',
    url,
    grantAdmin,
  });
}

/**
 * Mevcut bir sayfanın pageContents kaydını yerel JSON şablonundan günceller.
 * Şablondan sadece content (ve varsa styles) güncellenir; pages dokümanına dokunulmaz.
 */
async function updatePageContentFromTemplate({ pageId, templateName }) {
  if (!pageId) throw new Error('pageId zorunlu');
  if (!templateName) throw new Error('templateName zorunlu');

  const { content: contentTpl } = loadTemplateFiles(templateName);
  if (!contentTpl || !Array.isArray(contentTpl.content)) {
    throw new Error(`Şablon content geçersiz: ${templateName}`);
  }

  const db = getDb();
  const update = { content: contentTpl.content };
  if (contentTpl.styles != null) update.styles = contentTpl.styles;

  const existing = await db
    .collection('pageContents')
    .findOne({ pageId: String(pageId) });

  if (existing) {
    const r = await db
      .collection('pageContents')
      .updateOne({ pageId: String(pageId) }, { $set: update });
    return { matched: r.matchedCount, modified: r.modifiedCount, inserted: false };
  }
  await db
    .collection('pageContents')
    .insertOne({ pageId: String(pageId), ...update });
  return { matched: 0, modified: 0, inserted: true };
}

function loadTemplateFiles(name) {
  const { templatesDir } = loadEnv();
  const pagePath = path.join(templatesDir, `${name}-page.json`);
  const contentPath = path.join(templatesDir, `${name}-content.json`);
  if (!fs.existsSync(pagePath)) {
    throw new Error(`Şablon bulunamadı: ${pagePath}`);
  }
  const page = JSON.parse(fs.readFileSync(pagePath, 'utf8'));
  let content = null;
  if (fs.existsSync(contentPath)) {
    content = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
  }
  return { page, content };
}

async function exportTemplate(pageId, templateName) {
  const { templatesDir } = loadEnv();
  const page = await getPageById(pageId);
  if (!page) throw new Error(`Sayfa yok: ${pageId}`);
  const content = await getPageContent(pageId);

  const base = templateName || slugify(pageTitle(page));
  fs.mkdirSync(templatesDir, { recursive: true });
  const pagePath = path.join(templatesDir, `${base}-page.json`);
  const contentPath = path.join(templatesDir, `${base}-content.json`);
  fs.writeFileSync(pagePath, JSON.stringify(page, null, 2));
  if (content) fs.writeFileSync(contentPath, JSON.stringify(content, null, 2));
  return { pagePath, contentPath };
}

module.exports = {
  DEFAULT_INVENTORY_TEMPLATE_PAGE_ID,
  findPages,
  findPageByName,
  getPageById,
  listChildren,
  getPageContent,
  duplicatePage,
  createInventoryListPage,
  createPageFromTemplate,
  createInventoryCardsPage,
  updatePageContentFromTemplate,
  exportTemplate,
  grantAdminRole,
  pageTitle,
  pageUrl,
};
