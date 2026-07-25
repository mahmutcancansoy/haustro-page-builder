#!/usr/bin/env node
/**
 * personeller / personeller-arsiv: filtreler + modern liste tasarımı
 * Kullanım:
 *   node scripts/patch-personeller-design.js
 *   node scripts/patch-personeller-design.js arsiv
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const {
  applyLayout,
  loadStyles,
  patchFilters,
  buildDeptOptions,
  buildRoleOptions,
  getConfig,
} = require('./lib/per-page-design');

const PAGE_KEY = process.argv[2] || 'personeller';
const config = getConfig(PAGE_KEY);
const TEMPLATE_PATH = path.join(__dirname, `../templates/${config.templateBase}-content.json`);
const BACKUP_PATH = path.join(__dirname, `../templates/${config.templateBase}-content.original.json`);

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const existing = await getPageContent(config.pageId);
    if (!existing?.content?.length) {
      throw new Error(`pageContents bulunamadı: ${config.pageId}`);
    }

    if (!fs.existsSync(BACKUP_PATH)) {
      fs.writeFileSync(
        BACKUP_PATH,
        JSON.stringify(
          {
            _id: existing._id,
            pageId: config.pageId,
            content: existing.content,
            styles: existing.styles || '',
          },
          null,
          2
        ) + '\n'
      );
    }

    const depts = await db.collection('departments').find({ delete: { $ne: 1 } }).toArray();
    const roles = await db.collection('roleTypes').find({ delete: { $ne: 1 } }).toArray();
    const deptOptions = buildDeptOptions(depts);
    const roleOptions = buildRoleOptions(roles);
    console.log(`Filtre seçenekleri: ${deptOptions.length} departman, ${roleOptions.length} rol`);

    const content = applyLayout(JSON.parse(JSON.stringify(existing.content)), config);
    patchFilters(content, { deptOptions, roleOptions });
    const styles = loadStyles();

    const doc = {
      _id: existing._id,
      pageId: config.pageId,
      content,
      styles,
    };
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(doc, null, 2) + '\n');

    const r = await db.collection('pageContents').updateOne(
      { pageId: config.pageId },
      { $set: { content, styles } }
    );

    console.log('sayfa:', PAGE_KEY);
    console.log('pageId:', config.pageId);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('styles bytes:', styles.length);
    console.log('template:', TEMPLATE_PATH);
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
