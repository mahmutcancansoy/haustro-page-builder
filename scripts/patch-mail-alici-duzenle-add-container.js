#!/usr/bin/env node
/**
 * Alıcı ekle formunu ayrı container'a sarar (panel yapısı korunur).
 *
 *   node scripts/patch-mail-alici-duzenle-add-container.js
 *   node scripts/patch-mail-alici-duzenle-add-container.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { EDIT_PAGE, loadEditStyles } = require('./lib/mr-page-design');

const contentFile = path.join(__dirname, '../templates/mail-alici-duzenle-content.json');
const addHeadFile = path.join(__dirname, '../templates/mail-alici-duzenle-add-head.html');
const push = process.argv.includes('--push');

function propVal(block, key) {
  return (block?.properties || []).find((p) => p.key === key)?.value;
}

function setProp(block, key, value) {
  const p = (block?.properties || []).find((x) => x.key === key);
  if (p) p.value = value;
}

function makeRenderTemplate(content, displayName) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content: content.trim(),
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
    ],
  };
}

function makeSimpleContainer(children, displayName, classes = '') {
  return {
    type: 'simple-container',
    isContainer: true,
    children,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
      {
        key: 'classes',
        header: 'Classes',
        type: 'textarea-property',
        value: classes,
      },
      {
        key: 'styles',
        header: 'Styles',
        type: 'code-editor',
        value: '{\n\n}',
      },
    ],
  };
}

function findFormCard(blocks) {
  for (const block of blocks || []) {
    if (
      block.type === 'simple-container' &&
      String(propVal(block, 'classes') || '').includes('mr-edit__form-card')
    ) {
      return block;
    }
    const found = findFormCard(block.children);
    if (found) return found;
  }
  return null;
}

function wrapAddRecipientForm(content) {
  const card = findFormCard(content);
  if (!card) throw new Error('Alıcı formu kartı bulunamadı');

  const idx = card.children.findIndex(
    (c) =>
      c.type === 'form-container' &&
      propVal(c, 'display-name') === 'Mail alıcı güncelleme formu'
  );
  if (idx < 0) {
    const wrappedIdx = card.children.findIndex(
      (c) =>
        c.type === 'simple-container' &&
        String(propVal(c, 'classes') || '').includes('mr-add-recipient-card')
    );
    if (wrappedIdx >= 0) {
      console.log('Alıcı ekle kartı zaten mevcut, atlandı.');
      return content;
    }
    throw new Error('Mail alıcı güncelleme formu bulunamadı');
  }

  const addForm = card.children[idx];
  setProp(addForm, 'classes', 'mr-form mr-recipient-add-form');

  const addHeadHtml = fs.readFileSync(addHeadFile, 'utf8');
  card.children[idx] = makeSimpleContainer(
    [makeRenderTemplate(addHeadHtml, 'Alıcı ekle başlık'), addForm],
    'Alıcı ekle kartı',
    'mr-add-recipient-card'
  );

  return content;
}

(async () => {
  try {
    if (!fs.existsSync(contentFile)) {
      throw new Error('Şablon yok — önce sync-page-from-db çalıştırın');
    }

    const doc = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
    doc.content = wrapAddRecipientForm(doc.content);
    doc.styles = loadEditStyles();
    doc.patchedAt = new Date().toISOString();

    fs.writeFileSync(contentFile, JSON.stringify(doc, null, 2) + '\n');
    console.log('Şablon güncellendi:', contentFile);

    if (!push) {
      console.log('DB push atlandı. Canlıya almak için: --push');
      return;
    }

    loadEnv();
    await connect();
    const db = getDb();
    const r = await db.collection('pageContents').updateOne(
      { pageId: EDIT_PAGE.pageId },
      { $set: { content: doc.content, styles: doc.styles } }
    );
    console.log('mail-alici-duzenle DB push:', r.matchedCount, 'matched,', r.modifiedCount, 'modified');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
