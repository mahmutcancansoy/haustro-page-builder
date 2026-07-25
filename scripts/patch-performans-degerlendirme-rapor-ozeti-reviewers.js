#!/usr/bin/env node
/**
 * Rapor ozetine degerlendiren kisi sayisi (senior/junior/same) tablosu ekler.
 *
 *   node scripts/patch-performans-degerlendirme-rapor-ozeti-reviewers.js
 *   node scripts/patch-performans-degerlendirme-rapor-ozeti-reviewers.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { PAGE_CONFIG, loadStyles } = require('./lib/pdro-page-design');

const contentFile = path.join(__dirname, '../templates/performans-degerlendirme-rapor-ozeti-content.json');
const reviewersFile = path.join(__dirname, '../templates/performans-degerlendirme-rapor-ozeti-reviewers.html');
const heroFile = path.join(__dirname, '../templates/performans-degerlendirme-rapor-ozeti-hero.html');
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

function insertReviewersTable(form, html, index) {
  const children = form.children || [];
  const trendIdx = children.findIndex(
    (c) =>
      c.type === 'render-template' &&
      String(propVal(c, 'display-name') || '').includes('trend tablosu')
  );
  const anchorIdx =
    trendIdx >= 0
      ? trendIdx
      : children.findIndex(
          (c) => c.type === 'label' && propVal(c, 'display-name') === 'Puan Farkı'
        );
  if (anchorIdx < 0) {
    return false;
  }

  const insertAt = trendIdx >= 0 ? anchorIdx + 1 : anchorIdx + 1;
  const existingIdx = children.findIndex(
    (c) =>
      c.type === 'render-template' &&
      String(propVal(c, 'display-name') || '').includes('degerlendiren tablosu')
  );
  const blockHtml = html.replace(/INDEX/g, String(index));

  if (existingIdx >= 0) {
    children[existingIdx].content = blockHtml.trim();
    setProp(children[existingIdx], 'display-name', `Form ${index + 1} degerlendiren tablosu`);
    return true;
  }

  children.splice(
    insertAt,
    0,
    makeRenderTemplate(blockHtml, `Form ${index + 1} degerlendiren tablosu`)
  );
  return true;
}

function updateSummaryLabels(form, index) {
  const prefix = `performanceEvaluations.${index}.`;
  for (const child of form.children || []) {
    if (child.type !== 'label') continue;
    const dn = propVal(child, 'display-name');
    const text = propVal(child, 'text');
    if (dn === 'Değerlendirme Sayısı' || text === `{{performanceEvaluations.${index}.insertCount}}`) {
      setProp(child, 'display-name', 'Toplam değerlendiren kişi');
      setProp(child, 'label', 'Toplam değerlendiren kişi :');
    }
    if (dn === 'Junior Değerlendirme Sayısı') {
      setProp(child, 'display-name', 'Junior — değerlendiren kişi');
      setProp(child, 'label', 'Junior — değerlendiren kişi :');
    }
    if (dn === 'Senior Değerlendirme Sayısı') {
      setProp(child, 'display-name', 'Senior — değerlendiren kişi');
      setProp(child, 'label', 'Senior — değerlendiren kişi :');
    }
    if (dn === 'Same Değerlendirme Sayısı') {
      setProp(child, 'display-name', 'Same — değerlendiren kişi');
      setProp(child, 'label', 'Same — değerlendiren kişi :');
    }
  }
}

function patchHero(content) {
  const heroHtml = fs.readFileSync(heroFile, 'utf8');
  function walk(blocks) {
    for (const block of blocks || []) {
      if (block.type === 'render-template' && propVal(block, 'display-name') === 'Dönem hero') {
        block.content = heroHtml.trim();
        return true;
      }
      if (walk(block.children)) return true;
    }
    return false;
  }
  if (!walk(content)) {
    throw new Error('Donem hero bulunamadi');
  }
}

function patchForms(content) {
  const reviewersHtml = fs.readFileSync(reviewersFile, 'utf8');
  let patched = 0;

  function walk(blocks) {
    for (const block of blocks || []) {
      if (block.type === 'form-container') {
        const name = propVal(block, 'display-name');
        if (name === 'Form 1') {
          if (insertReviewersTable(block, reviewersHtml, 0)) patched++;
          updateSummaryLabels(block, 0);
        }
        if (name === 'Form 2') {
          if (insertReviewersTable(block, reviewersHtml, 1)) patched++;
          updateSummaryLabels(block, 1);
        }
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
      throw new Error('Sablon yok — once sync-page-from-db calistirin');
    }

    const doc = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
    const patchedForms = patchForms(doc.content);
    patchHero(doc.content);
    doc.styles = loadStyles();
    doc.patchedAt = new Date().toISOString();

    fs.writeFileSync(contentFile, JSON.stringify(doc, null, 2) + '\n');
    console.log('Sablon guncellendi:', contentFile);
    console.log('Degerlendiren tablosu eklenen form:', patchedForms);

    if (!push) {
      console.log('DB push atlandi. Canliya almak icin: --push');
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
