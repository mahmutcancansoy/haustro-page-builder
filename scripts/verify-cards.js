const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const PAGE_ID = process.argv[2];
if (!PAGE_ID) {
  console.error('Kullanım: node scripts/verify-cards.js <pageId>');
  process.exit(1);
}

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();
    const c = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
    if (!c) {
      console.log('pageContents bulunamadı');
      return;
    }
    console.log('Blok sayısı:', (c.content || []).length);
    (c.content || []).forEach((b, i) => {
      console.log(`#${i + 1} type=${b.type} container=${b.isContainer}`);
      if (b.type === 'render-template') {
        const html = (b.content || '').slice(0, 200).replace(/\n/g, ' ');
        console.log('   HTML preview:', html, '...');
      }
      if (b.type === 'data-source') {
        const props = b.properties || [];
        const v = (k) => (props.find((p) => p.key === k) || {}).value;
        console.log(`   variable=${v('variable-name')} table=${v('table-name')} fn=${v('function')}`);
      }
    });
    console.log('Styles:', (c.styles || '').slice(0, 100), '...');
  } catch (e) {
    console.error(e);
  } finally {
    await close();
  }
})();
