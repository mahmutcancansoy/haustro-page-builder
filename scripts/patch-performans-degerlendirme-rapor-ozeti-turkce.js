#!/usr/bin/env node
/**
 * Rapor özetinde Türkçe karakterler, delta açıklaması ve okunaklı stil.
 *
 *   node scripts/patch-performans-degerlendirme-rapor-ozeti-turkce.js
 *   node scripts/patch-performans-degerlendirme-rapor-ozeti-turkce.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { PAGE_CONFIG, loadStyles } = require('./lib/pdro-page-design');

const contentFile = path.join(__dirname, '../templates/performans-degerlendirme-rapor-ozeti-content.json');
const heroFile = path.join(__dirname, '../templates/performans-degerlendirme-rapor-ozeti-hero.html');
const trendFile = path.join(__dirname, '../templates/performans-degerlendirme-rapor-ozeti-trend.html');
const reviewersFile = path.join(__dirname, '../templates/performans-degerlendirme-rapor-ozeti-reviewers.html');
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
    throw new Error('Dönem hero bulunamadı');
  }
}

function patchFormTemplates(form, index) {
  const trendHtml = fs.readFileSync(trendFile, 'utf8').replace(/INDEX/g, String(index));
  const reviewersHtml = fs.readFileSync(reviewersFile, 'utf8').replace(/INDEX/g, String(index));
  const children = form.children || [];

  const trendIdx = children.findIndex(
    (c) =>
      c.type === 'render-template' &&
      String(propVal(c, 'display-name') || '').includes('trend tablosu')
  );
  if (trendIdx >= 0) {
    children[trendIdx].content = trendHtml.trim();
  }

  const reviewersIdx = children.findIndex(
    (c) =>
      c.type === 'render-template' &&
      /de[ğg]erlendiren tablosu/i.test(String(propVal(c, 'display-name') || ''))
  );
  if (reviewersIdx >= 0) {
    children[reviewersIdx].content = reviewersHtml.trim();
    setProp(children[reviewersIdx], 'display-name', `Form ${index + 1} değerlendiren tablosu`);
  } else if (trendIdx >= 0) {
    children.splice(
      trendIdx + 1,
      0,
      makeRenderTemplate(reviewersHtml, `Form ${index + 1} değerlendiren tablosu`)
    );
  }
}

const LABEL_MAP = {
  'Puan Farkı': 'Önceki döneme göre puan farkı',
  'Puan Farkı (Δ) :': 'Önceki döneme göre puan farkı :',
  'Junior — değerlendiren kişi': 'Alt rol — değerlendiren kişi',
  'Junior — değerlendiren kişi :': 'Alt rol — değerlendiren kişi :',
  'Senior — değerlendiren kişi': 'Üst rol — değerlendiren kişi',
  'Senior — değerlendiren kişi :': 'Üst rol — değerlendiren kişi :',
  'Same — değerlendiren kişi': 'Aynı seviye — değerlendiren kişi',
  'Same — değerlendiren kişi :': 'Aynı seviye — değerlendiren kişi :',
  'Junior Ortalama Puanı': 'Alt rol ortalama puanı',
  'Junior Ortalama Puanı :': 'Alt rol ortalama puanı :',
  'Senior Ortalama Puanı': 'Üst rol ortalama puanı',
  'Senior Ortalama Puanı :': 'Üst rol ortalama puanı :',
  'Same Ortalama Puanı': 'Aynı seviye ortalama puanı',
  'Same Ortalama Puanı :': 'Aynı seviye ortalama puanı :',
  'Toplam değerlendiren kişi': 'Toplam değerlendiren kişi',
  'Toplam değerlendiren kişi :': 'Toplam değerlendiren kişi :',
};

function patchDeltaText(text, index) {
  const re = new RegExp(
    `\\{\\{#if performanceEvaluations\\.${index}\\.scoreDelta\\}\\}\\{\\{performanceEvaluations\\.${index}\\.scoreDelta\\}\\}\\{\\{else\\}\\}—\\{\\{/if\\}\\}`
  );
  const replacement = `{{#if performanceEvaluations.${index}.scoreDelta}}{{performanceEvaluations.${index}.scoreDelta}}<span class="pdro-delta-hint">önceki döneme göre fark</span>{{else}}—{{/if}}`;
  if (re.test(text)) {
    return text.replace(re, replacement);
  }
  return text;
}

function patchLabels(form, index) {
  for (const child of form.children || []) {
    if (child.type !== 'label') continue;
    const dn = propVal(child, 'display-name');
    const label = propVal(child, 'label');
    const text = propVal(child, 'text');

    if (LABEL_MAP[dn]) setProp(child, 'display-name', LABEL_MAP[dn]);
    if (LABEL_MAP[label]) setProp(child, 'label', LABEL_MAP[label]);

    if (dn === 'Önceki döneme göre puan farkı' || dn === 'Puan Farkı') {
      setProp(child, 'display-name', 'Önceki döneme göre puan farkı');
      setProp(child, 'label', 'Önceki döneme göre puan farkı :');
      if (typeof text === 'string') {
        setProp(child, 'text', patchDeltaText(text, index));
      }
    }
  }
}

function patchForms(content) {
  let count = 0;
  function walk(blocks) {
    for (const block of blocks || []) {
      if (block.type === 'form-container') {
        const name = propVal(block, 'display-name');
        if (name === 'Form 1') {
          patchFormTemplates(block, 0);
          patchLabels(block, 0);
          count++;
        }
        if (name === 'Form 2') {
          patchFormTemplates(block, 1);
          patchLabels(block, 1);
          count++;
        }
      }
      walk(block.children);
    }
  }
  walk(content);
  return count;
}

(async () => {
  try {
    if (!fs.existsSync(contentFile)) {
      throw new Error('Şablon yok — önce sync-page-from-db çalıştırın');
    }

    const doc = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
    patchHero(doc.content);
    const forms = patchForms(doc.content);
    doc.styles = loadStyles();
    doc.patchedAt = new Date().toISOString();

    fs.writeFileSync(contentFile, JSON.stringify(doc, null, 2) + '\n');
    console.log('Şablon güncellendi:', contentFile);
    console.log('Güncellenen form:', forms);

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
