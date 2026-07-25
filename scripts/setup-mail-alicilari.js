#!/usr/bin/env node
/**
 * Mail alıcıları: seed + panel sayfaları oluştur/güncelle
 *
 * Kullanım:
 *   node scripts/setup-mail-alicilari.js --parent <pageId>
 *   node scripts/setup-mail-alicilari.js --parent <pageId> --seed --force
 *   node scripts/setup-mail-alicilari.js --update --list-page-id <id> --edit-page-id <id>
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const {
  createPageFromTemplate,
  updatePageContentFromTemplate,
  getPageById,
  findPageByName,
} = require('../src/pageService');
const {
  LIST_PAGE,
  EDIT_PAGE,
  MAIL_YONETIMI_CATEGORY,
  buildListContent,
  buildEditContent,
  loadStyles,
  makePageMeta,
} = require('./lib/mr-page-design');
const { MAIL_RECIPIENT_RULES, recipientsText } = require('./lib/mail-recipients-seed-data');

const templatesDir = path.join(__dirname, '../templates');

function arg(name) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return null;
  return process.argv[idx + 1] || null;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function writeTemplateFiles() {
  const styles = loadStyles();

  const listPage = makePageMeta({ title: LIST_PAGE.title, url: LIST_PAGE.url });
  const editPage = makePageMeta({ title: EDIT_PAGE.title, url: EDIT_PAGE.url, showInMenu: false });

  const listContent = {
    pageId: '',
    content: buildListContent(),
    styles,
  };
  const editContent = {
    pageId: '',
    content: buildEditContent(),
    styles,
  };

  fs.writeFileSync(
    path.join(templatesDir, `${LIST_PAGE.templateName}-page.json`),
    JSON.stringify(listPage, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(templatesDir, `${LIST_PAGE.templateName}-content.json`),
    JSON.stringify(listContent, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(templatesDir, `${EDIT_PAGE.templateName}-page.json`),
    JSON.stringify(editPage, null, 2) + '\n'
  );
  fs.writeFileSync(
    path.join(templatesDir, `${EDIT_PAGE.templateName}-content.json`),
    JSON.stringify(editContent, null, 2) + '\n'
  );

  console.log('Şablonlar yazıldı:', LIST_PAGE.templateName, EDIT_PAGE.templateName);
}

async function seedCollection(db, force) {
  const col = db.collection('mailRecipients');
  let inserted = 0;
  let updated = 0;

  for (const rule of MAIL_RECIPIENT_RULES) {
    const doc = {
      key: rule.key,
      label: rule.label,
      category: rule.category,
      categoryLabel: rule.categoryLabel,
      sourceFile: rule.sourceFile,
      recipientMode: rule.recipientMode || 'fixed',
      roleNote: rule.roleNote || '',
      roleKey: rule.roleKey || '',
      recipients: rule.recipients || [],
      recipientsText: recipientsText(rule.recipients || []),
      active: true,
      delete: 0,
      order: rule.order || 0,
      updatedAt: new Date(),
    };

    const existing = await col.findOne({ key: rule.key });
    if (!existing) {
      doc.createdAt = new Date();
      await col.insertOne(doc);
      inserted += 1;
    } else if (force) {
      await col.updateOne({ key: rule.key }, { $set: doc });
      updated += 1;
    }
  }

  await col.createIndex({ key: 1 }, { unique: true });
  await col.createIndex({ category: 1, order: 1 });

  console.log('mailRecipients seed:', { inserted, updated, total: MAIL_RECIPIENT_RULES.length });
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

(async () => {
  try {
    writeTemplateFiles();

    const needsDb =
      hasFlag('seed') ||
      hasFlag('force') ||
      hasFlag('update') ||
      arg('parent');

    if (!needsDb) {
      console.log('\nŞablonlar hazır. DB işlemleri için:');
      console.log(`  node scripts/setup-mail-alicilari.js --parent ${MAIL_YONETIMI_CATEGORY.id} --seed`);
      return;
    }

    loadEnv();
    await connect();
    const db = getDb();

    if (hasFlag('seed') || hasFlag('force')) {
      await seedCollection(db, hasFlag('force'));
    }

    const parentId = arg('parent') || MAIL_YONETIMI_CATEGORY.id;
    const listPageId = arg('list-page-id');
    const editPageId = arg('edit-page-id');
    const updateOnly = hasFlag('update');

    const styles = loadStyles();
    const listContent = buildListContent();
    const editContent = buildEditContent();

    if (updateOnly) {
      if (!listPageId || !editPageId) {
        throw new Error('--update için --list-page-id ve --edit-page-id gerekli');
      }
      console.log('Liste içerik:', await upsertPageContent(db, listPageId, listContent, styles));
      console.log('Düzenle içerik:', await upsertPageContent(db, editPageId, editContent, styles));
      return;
    }

    if (!arg('parent') && !hasFlag('update')) {
      console.log('Parent (varsayılan Mail Yönetimi):', parentId);
    }

    if (!parentId && hasFlag('update')) {
      console.log('\nSayfa oluşturulmadı. Parent id verin:');
      console.log('  node scripts/setup-mail-alicilari.js --parent <pageId> --seed');
      return;
    }

    const parent = await getPageById(parentId);
    if (!parent) throw new Error(`Parent bulunamadı: ${parentId}`);

    let listResult;
    const existingList = await findPageByName(LIST_PAGE.title, { parentId: String(parentId) });
    if (existingList.length) {
      const pid = String(existingList[0]._id);
      listResult = { pageId: pid, existed: true };
      await upsertPageContent(db, pid, listContent, styles);
      console.log('Liste sayfası güncellendi:', pid);
    } else {
      listResult = await createPageFromTemplate({
        templateName: LIST_PAGE.templateName,
        parentId: String(parentId),
        title: LIST_PAGE.title,
        url: LIST_PAGE.url,
      });
      await upsertPageContent(db, listResult.pageId, listContent, styles);
      console.log('Liste sayfası oluşturuldu:', listResult.pageId);
    }

    let editResult;
    const existingEdit = await findPageByName(EDIT_PAGE.title, { parentId: String(parentId) });
    if (existingEdit.length) {
      const pid = String(existingEdit[0]._id);
      editResult = { pageId: pid, existed: true };
      await upsertPageContent(db, pid, editContent, styles);
      console.log('Düzenle sayfası güncellendi:', pid);
    } else {
      editResult = await createPageFromTemplate({
        templateName: EDIT_PAGE.templateName,
        parentId: String(parentId),
        title: EDIT_PAGE.title,
        url: EDIT_PAGE.url,
      });
      await upsertPageContent(db, editResult.pageId, editContent, styles);
      console.log('Düzenle sayfası oluşturuldu:', editResult.pageId);
    }

    console.log('\nDeploy (HaustroBackend):');
    console.log('  deploy/mailRecipientsHelper.php → Backend/src/resources/mailRecipientsHelper.php');
    console.log('  deploy/mailRecipients.php         → Backend/src/routes/custom/mailRecipients.php');
    console.log('\nPanel URL: /d/mail-alicilari');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
