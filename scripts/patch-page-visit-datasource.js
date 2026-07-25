#!/usr/bin/env node
/**
 * Editörden sayfa ziyaret logu — her pageContents'e custom data-source ekler.
 *
 * Angular değişikliği yok. Sayfa yüklenince mevcut data-source mekanizması
 * POST /custom/pageVisitLog { action: enter, pageId } atar.
 *
 * Kullanım:
 *   node scripts/patch-page-visit-datasource.js --url admin-sistem-durumu
 *   node scripts/patch-page-visit-datasource.js --page-id 6a4e3b63811889b624701420 --push
 *   node scripts/patch-page-visit-datasource.js --all
 *   node scripts/patch-page-visit-datasource.js --all --push
 *
 * Varsayılan: DB yazmaz (dry-run). --push ile yazar.
 */
const { ObjectId } = require('mongodb');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { pageUrl, pageTitle } = require('../src/utils');

const VARIABLE = '_pageVisitEnter';
const CUSTOM_FN = 'pageVisitLog';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? null : process.argv[i + 1];
}

function makePageVisitDataSource(pageId, url) {
  const path = url ? `/d/${String(url).replace(/^\/d\//, '')}` : '';
  return {
    type: 'data-source',
    isContainer: false,
    children: [],
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: 'Sayfa ziyaret logu',
      },
      {
        key: 'variable-name',
        header: 'Variable name',
        type: 'input-text-property',
        value: VARIABLE,
      },
      {
        key: 'function',
        header: 'Function',
        type: 'select-property',
        options: [
          { label: 'Get', value: 'get' },
          { label: 'Custom', value: 'custom' },
        ],
        value: 'custom',
      },
      {
        key: 'table-name',
        header: 'Table name',
        type: 'input-text-property',
        value: '',
        conditions: [{ key: 'function', rule: "value == 'get'" }],
      },
      {
        key: 'custom-function-name',
        header: 'Custom function name',
        type: 'input-text-property',
        value: CUSTOM_FN,
        conditions: [{ key: 'function', rule: "value == 'custom'" }],
      },
      {
        key: 'table-filters',
        header: 'Table filters',
        type: 'code-editor',
        value: '{\n\n}',
        autoComplete: true,
        autoCompleteMode: 'template',
      },
      {
        key: 'post-params',
        header: 'Post',
        type: 'code-editor',
        value: JSON.stringify(
          {
            action: 'enter',
            pageId: String(pageId),
            pageUrl: url || '',
            path,
          },
          null,
          2
        ),
        autoComplete: true,
        autoCompleteMode: 'template',
        conditions: [{ key: 'function', rule: "value == 'custom'" }],
      },
      {
        key: 'debug-type',
        header: 'Debug type',
        type: 'select-property',
        options: [
          { label: 'Log', value: 'log' },
          { label: 'Table', value: 'table' },
        ],
        value: 'log',
        conditions: [{ key: 'settings', rule: 'value.debug' }],
      },
      {
        key: 'settings',
        type: 'checkbox-property',
        header: 'Settings',
        options: [
          { label: 'Single data', name: 'single' },
          { label: 'Debug', name: 'debug' },
          { label: 'Can reload', name: 'canReload' },
          { label: 'For table', name: 'forTable' },
        ],
        // single:true — endpoint [{...}] döner; canReload:false — form reload'da tekrar enter yok
        value: {
          single: true,
          debug: false,
          canReload: false,
          forTable: false,
        },
      },
    ],
  };
}

function propVal(block, key) {
  return (block?.properties || []).find((p) => p.key === key)?.value;
}

function hasPageVisitDataSource(content) {
  function walk(blocks) {
    for (const b of blocks || []) {
      if (b.type === 'data-source') {
        if (
          propVal(b, 'variable-name') === VARIABLE ||
          propVal(b, 'custom-function-name') === CUSTOM_FN
        ) {
          return true;
        }
      }
      if (walk(b.children)) return true;
    }
    return false;
  }
  return walk(content);
}

function ensurePageVisitDataSource(content, pageId, url) {
  const next = Array.isArray(content) ? content.slice() : [];
  if (hasPageVisitDataSource(next)) {
    return { content: next, action: 'skip' };
  }
  next.unshift(makePageVisitDataSource(pageId, url));
  return { content: next, action: 'insert' };
}

async function resolveTargets(db) {
  const doAll = process.argv.includes('--all');
  const pageIdArg = arg('page-id');
  const urlArg = arg('url');

  if (doAll) {
    // Her pageContents belgesi ayrı (aynı pageId birden fazla olabilir)
    return db
      .collection('pageContents')
      .find({})
      .project({ _id: 1, pageId: 1 })
      .toArray();
  }

  if (pageIdArg) {
    const docs = await db
      .collection('pageContents')
      .find({ pageId: String(pageIdArg) })
      .project({ _id: 1, pageId: 1 })
      .toArray();
    if (!docs.length) throw new Error(`pageContents yok: ${pageIdArg}`);
    return docs;
  }

  if (urlArg) {
    const slug = urlArg.replace(/^\/d\//, '');
    const pages = await db.collection('pages').find({}).toArray();
    const match = pages.find((p) => pageUrl(p) === slug);
    if (!match) throw new Error(`URL ile sayfa bulunamadı: ${slug}`);
    const docs = await db
      .collection('pageContents')
      .find({ pageId: String(match._id) })
      .project({ _id: 1, pageId: 1 })
      .toArray();
    if (!docs.length) throw new Error(`pageContents yok: ${slug}`);
    return docs;
  }

  throw new Error('Kullanım: --url <slug> | --page-id <id> | --all  (+ isteğe bağlı --push)');
}

async function main() {
  const doPush = process.argv.includes('--push');
  loadEnv();
  await connect();
  const db = getDb();

  const targets = await resolveTargets(db);

  const pages = await db.collection('pages').find({}).toArray();
  const pageById = new Map();
  for (const p of pages) {
    pageById.set(String(p._id), p);
  }

  const summary = { insert: 0, skip: 0, missing: 0, errors: 0 };

  for (const target of targets) {
    const pageId = String(target.pageId || '');
    try {
      const doc = await db.collection('pageContents').findOne({ _id: target._id });
      if (!doc) {
        summary.missing += 1;
        continue;
      }

      const page = pageById.get(pageId);
      const url = page ? pageUrl(page) || '' : '';
      const title = page ? pageTitle(page) || '' : '';

      const { content, action } = ensurePageVisitDataSource(doc.content, pageId, url);
      if (action === 'skip') {
        summary.skip += 1;
        continue;
      }

      summary.insert += 1;
      if (summary.insert <= 20 || summary.insert % 50 === 0) {
        console.log(`${doPush ? 'push' : 'dry '} ${pageId}  ${url || title}`);
      }

      if (doPush) {
        await db.collection('pageContents').updateOne(
          { _id: doc._id },
          { $set: { content, updatedAt: new Date() } }
        );
      }
    } catch (e) {
      summary.errors += 1;
      console.error(`error ${pageId}:`, e.message);
    }
  }

  console.log('\nÖzet:', summary);
  if (!doPush) {
    console.log('DB yazılmadı. Canlıya almak için: --push');
  }

  await close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
