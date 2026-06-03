#!/usr/bin/env node
/**
 * kullanici-profilim sayfa içeriğini şablondan günceller.
 * Kullanım: node scripts/build-kullanici-profilim-template.js && node scripts/patch-kullanici-profilim.js
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = '6a1f7b59b1ddfb5646dea36f';
const ROOT = path.join(__dirname, '..');

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const tplPath = path.join(ROOT, 'templates/kullanici-profilim-content.json');
    const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'));

    const update = { content: tpl.content };
    if (tpl.styles != null) update.styles = tpl.styles;

    const r = await db.collection('pageContents').updateOne({ pageId: PAGE_ID }, { $set: update });

    console.log('pageId:', PAGE_ID);
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    console.log('top blocks:', (tpl.content || []).map((b) => b.type).join(', '));
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close();
  }
})();
