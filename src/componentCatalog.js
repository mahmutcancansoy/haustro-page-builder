/**
 * Merkezi component kataloğu — tek kaynak: data/component-catalog.json
 * Frontend (Vite alias) ve brief aynı dosyayı kullanır.
 */
const fs = require('fs');
const path = require('path');

const CATALOG_PATH = path.join(__dirname, '../data/component-catalog.json');

function loadRawCatalog() {
  const raw = fs.readFileSync(CATALOG_PATH, 'utf8');
  return JSON.parse(raw);
}

let _raw = null;

function getRawCatalog() {
  if (!_raw) _raw = loadRawCatalog();
  return _raw;
}

/** Eski API uyumu: type → meta objesi */
function buildCatalogMap(raw) {
  const map = {};
  for (const c of raw.components || []) {
    const { type, label, icon, color, category, summary, renders, isContainer, keyProps, docs, whenToUse, example, properties, childrenAllowed, parentTypes, aiPriority, contentField, isTextEditor } = c;
    map[type] = {
      label,
      icon,
      color,
      category,
      summary,
      renders: !!renders,
      isContainer: !!isContainer,
      keyProps: keyProps || [],
      docs: docs || [],
      whenToUse: whenToUse || '',
      example,
      properties: properties || [],
      childrenAllowed,
      parentTypes,
      aiPriority,
      contentField,
      isTextEditor,
    };
  }
  return map;
}

function getCategories(raw) {
  const cats = raw.categories || {};
  const out = {};
  for (const [id, c] of Object.entries(cats)) {
    out[id] = { label: c.label, color: c.color };
  }
  return out;
}

/** Brief ve docs için Markdown tablo + syntax */
function catalogToMarkdown(raw = getRawCatalog()) {
  const lines = [];
  lines.push('## Editör Component Katalogu');
  lines.push('');
  lines.push(
    'Kaynak: `data/component-catalog.json` (v' + (raw.version || '?') + '). Yeni block tipi **uydurma**.'
  );
  lines.push('');
  lines.push('| Type | Kategori | Özet | Zorunlu alanlar |');
  lines.push('|---|---|---|---|');
  for (const c of raw.components) {
    const req = (c.properties || [])
      .filter((p) => p.required === true)
      .map((p) => p.key)
      .join(', ');
    lines.push(
      `| \`${c.type}\` | ${c.category} | ${c.summary} | ${req || (c.keyProps || []).slice(0, 4).join(', ')} |`
    );
  }
  lines.push('');
  lines.push('### Yaygın desenler');
  lines.push('');
  for (const p of raw.patterns || []) {
    lines.push(`- **${p.name}**: \`${(p.blocks || []).join(' → ')}\`${p.templateRef ? ` — örnek: \`${p.templateRef}\`` : ''}`);
  }
  lines.push('');
  lines.push('### Handlebars (' + (raw.handlebars?.engine || 'Handlebars') + ')');
  lines.push('');
  for (const s of raw.handlebars?.syntax || []) {
    lines.push(`- \`${s.pattern}\` — ${s.use}`);
  }
  if (raw.handlebars?.forbidden?.length) {
    lines.push('');
    lines.push('**Yasak:** ' + raw.handlebars.forbidden.map((x) => '`' + x + '`').join(', '));
  }
  lines.push('');
  lines.push('> Varsayılan akış: `data-source` + `render-template`. Tablo için `forTable: true` + `table`.');
  return lines.join('\n');
}

const raw = getRawCatalog();
const COMPONENT_CATALOG = buildCatalogMap(raw);
const COMPONENT_CATEGORIES = getCategories(raw);

module.exports = {
  CATALOG_PATH,
  getRawCatalog,
  loadRawCatalog,
  COMPONENT_CATALOG,
  COMPONENT_CATEGORIES,
  catalogToMarkdown,
  buildCatalogMap,
  getCategories,
};
