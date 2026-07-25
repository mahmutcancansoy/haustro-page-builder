#!/usr/bin/env node
/**
 * Performans değerlendirme sayfasına zorunlu değerlendirme adedi ekler.
 *
 *   node scripts/patch-performans-degerlendirme-mandatory-count.js
 *   node scripts/patch-performans-degerlendirme-mandatory-count.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { PAGE_CONFIG, loadStyles } = require('./lib/pdev-page-design');

const contentFile = path.join(__dirname, '../templates/performans-degerlendirme-content.json');
const heroFile = path.join(__dirname, '../templates/performans-degerlendirme-hero.html');
const mandatoryHintFile = path.join(
  __dirname,
  '../templates/performans-degerlendirme-zorunlu-de-erlendirme-bilgisi.html'
);
const push = process.argv.includes('--push');

function propVal(block, key) {
  return (block?.properties || []).find((p) => p.key === key)?.value;
}

function setProp(block, key, value) {
  const p = (block?.properties || []).find((x) => x.key === key);
  if (p) p.value = value;
}

function patchHero(content) {
  const heroHtml = fs.readFileSync(heroFile, 'utf8');
  function walk(blocks) {
    for (const block of blocks || []) {
      if (block.type === 'render-template' && propVal(block, 'display-name') === 'Sayfa hero') {
        block.content = heroHtml.trim();
        return true;
      }
      if (walk(block.children)) return true;
    }
    return false;
  }
  if (!walk(content)) {
    throw new Error('Sayfa hero bulunamadı');
  }
}

function patchMandatoryHint(content) {
  const hintHtml = fs.readFileSync(mandatoryHintFile, 'utf8');
  function walk(blocks) {
    for (const block of blocks || []) {
      if (
        block.type === 'render-template' &&
        (propVal(block, 'display-name') === 'Zorunlu değerlendirme bilgisi' ||
          String(block.content || '').includes('pdev-mandatory-hint'))
      ) {
        block.content = hintHtml.trim();
        setProp(block, 'display-name', 'Zorunlu değerlendirme bilgisi');
        return true;
      }
      if (walk(block.children)) return true;
    }
    return false;
  }
  walk(content);
}

function patchHiddenStatLabel(content) {
  function walk(blocks) {
    for (const block of blocks || []) {
      if (block.type === 'label') {
        const text = String(propVal(block, 'text') || '');
        if (text.includes('Toplam Değerlendirme') && text.includes('totalUsers')) {
          setProp(
            block,
            'text',
            'Toplam: {{performanceEvaluations.completedReviews}}/{{performanceEvaluationsUsers.totalUsers}} · Zorunlu: {{performanceEvaluationsUsers.mandatoryCompletedUsers}}/{{performanceEvaluationsUsers.mandatoryTotalUsers}}'
          );
        }
      }
      walk(block.children);
    }
  }
  walk(content);
}

(async () => {
  try {
    if (!fs.existsSync(contentFile)) {
      throw new Error('Şablon yok — önce sync-page-from-db çalıştırın');
    }

    const doc = JSON.parse(fs.readFileSync(contentFile, 'utf8'));
    patchHero(doc.content);
    patchMandatoryHint(doc.content);
    patchHiddenStatLabel(doc.content);
    doc.styles = loadStyles();
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
      { pageId: PAGE_CONFIG.pageId },
      { $set: { content: doc.content, styles: doc.styles } }
    );
    console.log('performans-degerlendirme DB push:', r.matchedCount, 'matched,', r.modifiedCount, 'modified');
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
