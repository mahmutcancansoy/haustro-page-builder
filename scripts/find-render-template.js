const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

(async () => {
  try {
    loadEnv();
    await connect();
    const db = getDb();
    const docs = await db
      .collection('pageContents')
      .find({ 'content.type': 'render-template' })
      .toArray();
    console.log('render-template içeren sayfa sayısı:', docs.length);
    docs.forEach((d, i) => {
      const blocks = (d.content || []).filter((b) => b.type === 'render-template');
      blocks.forEach((b, j) => {
        console.log(`\n--- pageId=${d.pageId} blok#${j + 1} ---`);
        console.log('keys:', Object.keys(b).join(', '));
        console.log('isContainer:', b.isContainer, 'isTextEditor:', b.isTextEditor);
        console.log('content (full):\n', b.content);
      });
      if (i >= 9) return;
    });
  } catch (e) {
    console.error(e);
  } finally {
    await close();
  }
})();
