#!/usr/bin/env node
/**
 * satin-alim-talebi-olustur kopyası — yalnızca render-template + emptyResponse
 */
const { loadEnv } = require('../src/config');
const { connect, close } = require('../src/db');
const { duplicatePage, updatePageContentFromTemplate } = require('../src/pageService');

const SOURCE_ID = '6345b838b03e36002738783a';
const PARENT_ID = '67883cf5a01c352361350085';
const TITLE = 'Satın Alım Talebi Oluştur (Render)';
const URL = 'satin-alim-talebi-olustur-render';
const TEMPLATE = 'satin-alim-talebi-olustur-rt';

loadEnv();

(async () => {
  await connect();
  const created = await duplicatePage(SOURCE_ID, {
    title: TITLE,
    url: URL,
    parentId: PARENT_ID,
  });
  await updatePageContentFromTemplate({
    pageId: created.pageId,
    templateName: TEMPLATE,
  });
  console.log(JSON.stringify({ ...created, url: URL, template: TEMPLATE }, null, 2));
  await close();
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
