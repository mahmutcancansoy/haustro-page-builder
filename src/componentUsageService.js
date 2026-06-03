const { getDb } = require('./db');
const { pageTitle, pageUrl } = require('./utils');
const { COMPONENT_CATALOG, getRawCatalog, COMPONENT_CATEGORIES } = require('./componentCatalog');

function propsToMap(properties = []) {
  const out = {};
  for (const p of properties || []) {
    if (p && p.key) out[p.key] = p.value;
  }
  return out;
}

function truncate(val, max = 200) {
  if (val == null) return null;
  if (typeof val === 'string') {
    return val.length > max ? val.slice(0, max) + '…' : val;
  }
  const s = JSON.stringify(val);
  return s.length > max ? s.slice(0, max) + '…' : val;
}

/** Tip bazlı öne çıkan veri alanları (UI'da "aldığı veriler"). */
function extractDataFields(type, props) {
  const fields = {};
  const keys =
    COMPONENT_CATALOG[type]?.keyProps ||
    ['display-name', 'variable-name', 'table-name'];

  for (const k of keys) {
    if (props[k] !== undefined && props[k] !== null && props[k] !== '') {
      fields[k] = truncate(props[k], type === 'render-template' ? 80 : 300);
    }
  }

  if (type === 'data-source') {
    if (props['table-filters']) fields['table-filters'] = truncate(props['table-filters'], 400);
    if (props.settings) fields.settings = props.settings;
    if (props.function === 'custom' && props['custom-function-name']) {
      fields['custom-function-name'] = props['custom-function-name'];
    }
  }

  if (type === 'render-template' && props.content) {
    fields['html-length'] = String(props.content).length + ' char';
  }

  return fields;
}

function walkBlocks(blocks, pageInfo, usageByType) {
  let n = 0;
  for (const b of blocks || []) {
    if (!b || !b.type) continue;
    n += 1;
    const type = b.type;
    const props = propsToMap(b.properties);
    const instance = {
      pageId: pageInfo._id,
      pageTitle: pageInfo.title,
      pageUrl: pageInfo.url,
      pageType: pageInfo.type,
      parent: pageInfo.parent || '',
      displayName: props['display-name'] || null,
      variableName: props['variable-name'] || null,
      tableName: props['table-name'] || null,
      dataFields: extractDataFields(type, {
        ...props,
        content: typeof b.content === 'string' ? b.content : props.content,
      }),
    };

    if (!usageByType[type]) {
      usageByType[type] = { count: 0, pageIds: new Set(), instances: [] };
    }
    usageByType[type].count += 1;
    usageByType[type].pageIds.add(pageInfo._id);
    usageByType[type].instances.push(instance);

    if (Array.isArray(b.children) && b.children.length) {
      n += walkBlocks(b.children, pageInfo, usageByType);
    }
  }
  return n;
}

let cache = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Tüm `pages` + `pageContents` taranır; component tipi bazında kullanım özeti.
 * Sonuç 5 dk bellekte önbelleğe alınır (tarama ~30 sn sürebilir).
 */
async function scanComponentUsage({ refresh = false } = {}) {
  if (!refresh && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return { ...cache.data, cached: true };
  }

  const db = getDb();
  const [pages, contents] = await Promise.all([
    db.collection('pages').find({}, { projection: { properties: 1, type: 1, parent: 1 } }).toArray(),
    db
      .collection('pageContents')
      .find({}, { projection: { pageId: 1, content: 1 } })
      .toArray(),
  ]);

  const pageMap = new Map();
  for (const p of pages) {
    pageMap.set(String(p._id), {
      _id: String(p._id),
      title: pageTitle(p),
      url: pageUrl(p),
      type: p.type || 'sub',
      parent: p.parent || '',
    });
  }

  const usageByType = {};
  let totalBlocks = 0;
  let pagesWithContent = 0;

  for (const doc of contents) {
    const blocks = doc.content;
    if (!Array.isArray(blocks) || !blocks.length) continue;
    const page = pageMap.get(String(doc.pageId));
    if (!page) continue;
    pagesWithContent += 1;
    totalBlocks += walkBlocks(blocks, page, usageByType);
  }

  const catalogTypes = Object.keys(COMPONENT_CATALOG);
  const components = [];

  for (const type of catalogTypes) {
    const u = usageByType[type];
    components.push({
      type,
      inCatalog: true,
      count: u ? u.count : 0,
      pageCount: u ? u.pageIds.size : 0,
      instances: u ? u.instances : [],
    });
  }

  const unknownTypes = Object.keys(usageByType).filter(
    (t) => !catalogTypes.includes(t)
  );
  for (const type of unknownTypes.sort()) {
    const u = usageByType[type];
    components.push({
      type,
      inCatalog: false,
      count: u.count,
      pageCount: u.pageIds.size,
      instances: u.instances,
    });
  }

  components.sort((a, b) => b.count - a.count);

  const result = {
    scannedAt: new Date().toISOString(),
    stats: {
      totalPages: pages.length,
      pagesWithContent,
      totalBlocks,
      catalogSize: catalogTypes.length,
      typesInUse: components.filter((c) => c.count > 0).length,
    },
    categories: COMPONENT_CATEGORIES,
    catalog: COMPONENT_CATALOG,
    catalogFull: getRawCatalog(),
    components,
    cached: false,
  };

  cache = { at: Date.now(), data: result };
  return result;
}

module.exports = { scanComponentUsage, propsToMap, extractDataFields };
