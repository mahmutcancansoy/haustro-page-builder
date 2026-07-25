#!/usr/bin/env node
/**
 * tedarik-faturalari: styles + buton severity/ikon/sınıf (içerik ağacı aynı)
 *
 * Kullanım:
 *   node scripts/patch-tedarik-faturalari-design.js
 *   node scripts/patch-tedarik-faturalari-design.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = '68c3dde045c7ed00947116d5';
const PUSH = process.argv.includes('--push');
const ROOT = path.join(__dirname, '..');
const TEMPLATE_PATH = path.join(ROOT, 'templates/tedarik-faturalari-content.json');
const STYLES_PATH = path.join(ROOT, 'templates/tedarik-faturalari-page-styles.css');

function prop(block, key) {
  return (block.properties || []).find((p) => p.key === key);
}

function propVal(block, key) {
  const p = prop(block, key);
  return p == null ? undefined : p.value;
}

function setProp(block, key, value) {
  const p = prop(block, key);
  if (p) {
    p.value = value;
    return;
  }
  block.properties = block.properties || [];
  block.properties.push({
    key,
    header: key,
    type: 'input-text-property',
    value,
  });
}

function patchButtonSettings(block, patch) {
  const settings = prop(block, 'settings');
  if (!settings) return;
  if (!settings.value || typeof settings.value !== 'object') {
    settings.value = {};
  }
  Object.assign(settings.value, patch);
}

function applyButton(block, cfg) {
  if (cfg.classes != null) setProp(block, 'classes', cfg.classes);
  if (cfg.severity != null) setProp(block, 'severity', cfg.severity);
  if (cfg.size != null) setProp(block, 'size', cfg.size);
  if (cfg.icon != null) setProp(block, 'icon', cfg.icon);
  if (cfg.iconPosition != null) setProp(block, 'icon-position', cfg.iconPosition);
  if (cfg.settings) patchButtonSettings(block, cfg.settings);
}

function patchContent(content) {
  const stats = { buttons: 0, toolbar: 0 };

  function walk(nodes) {
    for (const n of nodes || []) {
      const name = String(propVal(n, 'display-name') || '');

      if (n.type === 'grid' && /toolbar/i.test(name)) {
        const settings = prop(n, 'settings');
        if (settings?.value && typeof settings.value === 'object') {
          settings.value.customClasses = true;
        }
        setProp(n, 'custom-classes', 'ass__toolbar');
        stats.toolbar += 1;
      }

      if (n.type === 'button') {
        if (name === 'Geri') {
          applyButton(n, {
            classes: '',
            severity: 'p-button-secondary',
            size: 'p-button',
            icon: 'pi pi-chevron-left',
            iconPosition: 'left',
            settings: {
              hasIcon: true,
              textButton: true,
              hasOutline: false,
              rounded: false,
            },
          });
          stats.buttons += 1;
        } else if (name === 'Yeni Tedarik Faturası') {
          applyButton(n, {
            classes: 'tf-cta-btn',
            severity: 'p-button-secondary',
            size: 'p-button-sm',
            icon: 'pi pi-plus',
            iconPosition: 'left',
            settings: {
              hasIcon: true,
              textButton: false,
              hasOutline: false,
              rounded: false,
            },
          });
          stats.buttons += 1;
        } else if (name === 'Yeni Tedarik Faturası Hizmet') {
          applyButton(n, {
            classes: 'tf-cta-btn-outline',
            severity: 'p-button-secondary',
            size: 'p-button-sm',
            icon: 'pi pi-plus',
            iconPosition: 'left',
            settings: {
              hasIcon: true,
              textButton: false,
              hasOutline: true,
              rounded: false,
            },
          });
          stats.buttons += 1;
        } else if (name === 'Görüntüle') {
          applyButton(n, {
            classes: 'tf-detail-btn',
            severity: 'p-button-secondary',
            size: 'p-button-sm',
            icon: 'pi pi-arrow-right',
            iconPosition: 'right',
            settings: {
              hasIcon: true,
              textButton: false,
              hasOutline: false,
              rounded: false,
            },
          });
          stats.buttons += 1;
        } else if (name === 'Senkronizasyonu Başlat') {
          applyButton(n, {
            classes: 'tf-cta-btn',
            severity: 'p-button-secondary',
            size: 'p-button',
            icon: 'pi pi-sync',
            iconPosition: 'left',
            settings: {
              hasIcon: true,
              textButton: false,
              hasOutline: false,
              rounded: false,
              inForm: true,
            },
          });
          stats.buttons += 1;
        }
      }

      walk(n.children);
      if (n.customContents) {
        for (const cc of n.customContents) walk(cc.children);
      }
    }
  }

  walk(content);
  return stats;
}

(async () => {
  try {
    const styles = fs.readFileSync(STYLES_PATH, 'utf8').trim() + '\n';

    let doc;
    if (fs.existsSync(TEMPLATE_PATH)) {
      doc = JSON.parse(fs.readFileSync(TEMPLATE_PATH, 'utf8'));
    } else {
      throw new Error(`Şablon yok: ${TEMPLATE_PATH} — önce sync-page-from-db çalıştır`);
    }

    const stats = patchContent(doc.content || []);
    doc.styles = styles;
    doc.pageId = doc.pageId || PAGE_ID;
    doc.updatedAt = new Date().toISOString();
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    console.log('şablon güncellendi:', TEMPLATE_PATH);
    console.log('toolbar:', stats.toolbar, 'buton:', stats.buttons);
    console.log('styles bytes:', styles.length);

    if (!PUSH) {
      console.log('DB yazılmadı ( --push ile yazılır )');
      return;
    }

    loadEnv();
    await connect();
    const db = getDb();
    const existing = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
    if (!existing) throw new Error(`pageContents yok: ${PAGE_ID}`);

    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_ID },
      { $set: { content: doc.content, styles } }
    );

    console.log('DB push: matched', r.matchedCount, 'modified', r.modifiedCount);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
