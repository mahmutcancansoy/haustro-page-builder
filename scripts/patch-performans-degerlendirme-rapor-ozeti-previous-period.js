#!/usr/bin/env node
/**
 * Rapor özetine önceki dönem puanı satırları ekler.
 *
 *   node scripts/patch-performans-degerlendirme-rapor-ozeti-previous-period.js
 *   node scripts/patch-performans-degerlendirme-rapor-ozeti-previous-period.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { PAGE_CONFIG, loadStyles } = require('./lib/pdro-page-design');

const contentFile = path.join(__dirname, '../templates/performans-degerlendirme-rapor-ozeti-content.json');
const heroFile = path.join(__dirname, '../templates/performans-degerlendirme-rapor-ozeti-hero.html');
const push = process.argv.includes('--push');

const PREVIOUS_PERIOD_ROWS = [
  {
    displayName: 'Önceki Dönem Etiketi',
    formLabel: 'Önceki Dönem',
    text: '{{performanceEvaluations.INDEX.previousPeriodLabel}}',
    classes: 'pdro-summary-row pdro-summary-row--prev',
  },
  {
    displayName: 'Önceki Dönem Puanı',
    formLabel: 'Önceki Dönem Puanı',
    text: '{{#if performanceEvaluations.INDEX.previousPeriodScore}}{{performanceEvaluations.INDEX.previousPeriodScore}}{{else}}—{{/if}}',
    classes: 'pdro-summary-row pdro-summary-row--prev',
  },
  {
    displayName: 'Puan Farkı',
    formLabel: 'Puan Farkı (Δ)',
    text: '{{#if performanceEvaluations.INDEX.scoreDelta}}{{performanceEvaluations.INDEX.scoreDelta}}{{else}}—{{/if}}',
    classes: 'pdro-summary-row pdro-summary-row--delta',
  },
];

function propVal(block, key) {
  return (block?.properties || []).find((p) => p.key === key)?.value;
}

function setProp(block, key, value) {
  const p = (block?.properties || []).find((x) => x.key === key);
  if (p) p.value = value;
}

function findLabelTemplate(blocks) {
  for (const block of blocks || []) {
    if (block.type === 'label' && propVal(block, 'display-name') === 'Alınan Ortalama Puan') {
      return block;
    }
    const found = findLabelTemplate(block.children);
    if (found) return found;
  }
  return null;
}

function makeSummaryLabel(template, { displayName, formLabel, text, classes }, index) {
  const textValue = text.replace(/INDEX/g, String(index));
  const block = JSON.parse(JSON.stringify(template));
  setProp(block, 'display-name', displayName);
  setProp(block, 'classes', classes);
  setProp(block, 'text', textValue);
  setProp(block, 'label', `${formLabel} :`);
  return block;
}

function insertAfterAverageScore(form, template, index) {
  const children = form.children || [];
  const avgIdx = children.findIndex(
    (c) => c.type === 'label' && propVal(c, 'display-name') === 'Alınan Ortalama Puan'
  );
  if (avgIdx < 0) {
    return false;
  }

  const hasPrevious = children.some(
    (c) => c.type === 'label' && propVal(c, 'display-name') === 'Önceki Dönem Puanı'
  );
  if (hasPrevious) {
    return false;
  }

  const rows = PREVIOUS_PERIOD_ROWS.map((row) => makeSummaryLabel(template, row, index));
  children.splice(avgIdx + 1, 0, ...rows);
  return true;
}

function patchForms(content) {
  const template = findLabelTemplate(content);
  if (!template) {
    throw new Error('Alınan Ortalama Puan etiketi bulunamadı');
  }

  let patched = 0;
  function walk(blocks) {
    for (const block of blocks || []) {
      if (block.type === 'form-container') {
        const name = propVal(block, 'display-name');
        if (name === 'Form 1' && insertAfterAverageScore(block, template, 0)) patched++;
        if (name === 'Form 2' && insertAfterAverageScore(block, template, 1)) patched++;
      }
      walk(block.children);
    }
  }
  walk(content);
  return patched;
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
    throw new Error('Dönem hero render-template bulunamadı');
  }
}

(async () => {
  try {
    if (!fs.existsSync(contentFile)) {
      throw new Error('Şablon yok — önce sync-page-from-db çalıştırın');
    }

    const doc = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
    const patchedForms = patchForms(doc.content);
    patchHero(doc.content);
    doc.styles = loadStyles();
    doc.patchedAt = new Date().toISOString();

    fs.writeFileSync(contentFile, JSON.stringify(doc, null, 2) + '\n');
    console.log('Şablon güncellendi:', contentFile);
    console.log('Eklenen form bloğu:', patchedForms);

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
