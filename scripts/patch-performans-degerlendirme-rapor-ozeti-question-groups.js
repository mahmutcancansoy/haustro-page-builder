#!/usr/bin/env node
/**
 * Rapor özetine A–E soru grubu özeti (en düşük / en yüksek + tüm sorular) ekler.
 *
 *   node scripts/patch-performans-degerlendirme-rapor-ozeti-question-groups.js
 *   node scripts/patch-performans-degerlendirme-rapor-ozeti-question-groups.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { PAGE_CONFIG, loadStyles } = require('./lib/pdro-page-design');

const contentFile = path.join(__dirname, '../templates/performans-degerlendirme-rapor-ozeti-content.json');
const groupsFile = path.join(
  __dirname,
  '../templates/performans-degerlendirme-rapor-ozeti-question-groups.html'
);
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

function insertQuestionGroupsTable(form, html, index) {
  const children = form.children || [];
  const reviewersIdx = children.findIndex(
    (c) =>
      c.type === 'render-template' &&
      /de[ğg]erlendiren tablosu/i.test(String(propVal(c, 'display-name') || ''))
  );
  const trendIdx = children.findIndex(
    (c) =>
      c.type === 'render-template' &&
      String(propVal(c, 'display-name') || '').includes('trend tablosu')
  );

  const anchorIdx = reviewersIdx >= 0 ? reviewersIdx : trendIdx;
  if (anchorIdx < 0) {
    return false;
  }

  const insertAt = anchorIdx + 1;
  const existingIdx = children.findIndex(
    (c) =>
      c.type === 'render-template' &&
      /soru grubu/i.test(String(propVal(c, 'display-name') || ''))
  );
  const blockHtml = html.replace(/INDEX/g, String(index));

  if (existingIdx >= 0) {
    children[existingIdx].content = blockHtml.trim();
    setProp(children[existingIdx], 'display-name', `Form ${index + 1} soru grubu özeti`);
    return true;
  }

  children.splice(
    insertAt,
    0,
    makeRenderTemplate(blockHtml, `Form ${index + 1} soru grubu özeti`)
  );
  return true;
}

function patchForms(content) {
  const groupsHtml = fs.readFileSync(groupsFile, 'utf8');
  let patched = 0;

  function walk(blocks) {
    for (const block of blocks || []) {
      if (block.type === 'form-container') {
        const name = propVal(block, 'display-name');
        if (name === 'Form 1' && insertQuestionGroupsTable(block, groupsHtml, 0)) patched++;
        if (name === 'Form 2' && insertQuestionGroupsTable(block, groupsHtml, 1)) patched++;
      }
      walk(block.children);
    }
  }

  walk(content);
  return patched;
}

(async () => {
  try {
    if (!fs.existsSync(contentFile)) {
      throw new Error('Şablon yok — önce sync-page-from-db çalıştırın');
    }

    const doc = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
    const patchedForms = patchForms(doc.content);
    doc.styles = loadStyles();
    doc.patchedAt = new Date().toISOString();

    fs.writeFileSync(contentFile, JSON.stringify(doc, null, 2) + '\n');
    console.log('Şablon güncellendi:', contentFile);
    console.log('Soru grubu özeti eklenen form:', patchedForms);

    if (!push) {
      console.log('DB push atlandı. Canlıya almak için: --push');
      return;
    }

    loadEnv();
    await connect();
    const db = getDb();
    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content: doc.content, styles: doc.styles } }
    );
    console.log('performans-degerlendirme-rapor-ozeti DB push:', r.matchedCount, 'matched,', r.modifiedCount, 'modified');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
