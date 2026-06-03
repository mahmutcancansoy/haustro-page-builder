const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = process.argv[2];
const TEMPLATE = process.argv[3];

if (!PAGE_ID || !TEMPLATE) {
  console.error('Kullanım: node scripts/update-page-content.js <pageId> <templateName>');
  console.error('  templateName örn: inventory-cards');
  process.exit(1);
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();

    const tplPath = path.join(__dirname, '..', 'templates', `${TEMPLATE}-content.json`);
    if (!fs.existsSync(tplPath)) throw new Error(`Şablon bulunamadı: ${tplPath}`);
    const tpl = JSON.parse(fs.readFileSync(tplPath, 'utf8'));

    const update = { content: tpl.content };
    if (tpl.styles != null) update.styles = tpl.styles;

    const r = await db.collection('pageContents').updateOne(
      { pageId: PAGE_ID },
      { $set: update }
    );
    console.log('matched:', r.matchedCount, 'modified:', r.modifiedCount);
    const c = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
    console.log('Bloklar:', (c.content || []).map((b) => b.type).join(', '));
    const rt = (c.content || []).find((b) => b.type === 'render-template');
    if (rt) {
      console.log('render-template content (ilk 200 char):');
      console.log(rt.content.slice(0, 200));
    }
  } catch (e) {
    console.error(e);
  } finally {
    await close();
  }
})();
