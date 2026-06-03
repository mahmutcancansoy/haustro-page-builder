/**
 * `render-template` bloklarını tarayıcıda Handlebars ile render eder.
 *
 * - Haustro'nun custom helper'larından `cIf` ve birkaç format helper'ını
 *   taklit eder (production render'a yakın çıktı verir).
 * - Mock/live data context'ini hazırlar.
 * - Çıktıyı sandbox iframe içine srcdoc olarak basmak için string döner.
 */
import Handlebars from 'handlebars';
import DOMPurify from 'dompurify';

let registered = false;
function ensureHelpers() {
  if (registered) return;

  // cIf — karşılaştırmalı if helper'ı (Haustro panel'de mevcut)
  Handlebars.registerHelper('cIf', function (a, op, b, opts) {
    let truthy = false;
    switch (op) {
      case '==':
        truthy = a == b; // eslint-disable-line eqeqeq
        break;
      case '===':
        truthy = a === b;
        break;
      case '!=':
        truthy = a != b; // eslint-disable-line eqeqeq
        break;
      case '!==':
        truthy = a !== b;
        break;
      case '>':
        truthy = a > b;
        break;
      case '<':
        truthy = a < b;
        break;
      case '>=':
        truthy = a >= b;
        break;
      case '<=':
        truthy = a <= b;
        break;
      case '&&':
        truthy = !!(a && b);
        break;
      case '||':
        truthy = !!(a || b);
        break;
      default:
        truthy = false;
    }
    return truthy ? opts.fn(this) : opts.inverse(this);
  });

  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('lt', (a, b) => a < b);
  Handlebars.registerHelper('gt', (a, b) => a > b);
  Handlebars.registerHelper('add', (a, b) => Number(a) + Number(b));
  Handlebars.registerHelper('json', (v) => JSON.stringify(v));
  Handlebars.registerHelper('upper', (v) =>
    typeof v === 'string' ? v.toUpperCase() : v
  );
  Handlebars.registerHelper('lower', (v) =>
    typeof v === 'string' ? v.toLowerCase() : v
  );
  Handlebars.registerHelper('fmtPrice', (v) => {
    const n = Number(v);
    if (isNaN(n)) return v;
    return n.toLocaleString('tr-TR');
  });

  registered = true;
}

/**
 * Render-template HTML'ini güvenli bir şekilde render et.
 * @param {string} html
 * @param {Record<string, any>} context  Handlebars context (data-source verileri)
 * @returns {{ html: string, error: string | null }}
 */
export function renderTemplate(html, context = {}) {
  ensureHelpers();
  try {
    const tpl = Handlebars.compile(html || '', { noEscape: false });
    const rendered = tpl(context);
    // sandbox iframe içinde render ediyoruz, yine de DOMPurify ile bir kademe
    // koruma; <style>, <img>, <table> serbest, script bloklarını temizler.
    const clean = DOMPurify.sanitize(rendered, {
      ADD_TAGS: ['style'],
      ADD_ATTR: ['target'],
      FORBID_TAGS: ['script'],
    });
    return { html: clean, error: null };
  } catch (e) {
    return { html: '', error: e.message };
  }
}

/**
 * Bir pageContent.blocks ağacından Handlebars context'i kur.
 * - Live data: { [variableName]: rows }
 * - Yoksa: data-source variable-name'lere mock array koy.
 *
 * @param {Array} blocks
 * @param {Record<string, any[]>} liveData  variable-name -> rows
 * @returns {Record<string, any>}
 */
export function buildContext(blocks, liveData = {}) {
  const ctx = {
    globals: {
      resources: 'https://backend.haustro.net/resources/',
      preview: true,
    },
  };
  function walk(list) {
    for (const b of list) {
      if (!b) continue;
      if (b.type === 'data-source' && b.variableName) {
        const live = liveData[b.variableName];
        if (Array.isArray(live)) {
          ctx[b.variableName] = live;
        } else {
          ctx[b.variableName] = mockRowsFor(b.tableName) || [];
        }
      }
      if (b.children?.length) walk(b.children);
    }
  }
  walk(blocks || []);
  return ctx;
}

/**
 * Bilinen koleksiyonlar için minimal mock veri. Live data yokken render-template
 * şablonunun boş olmaması için 2-3 örnek satır üretir.
 */
function mockRowsFor(tableName) {
  if (!tableName) return [];
  const t = String(tableName).toLowerCase();
  if (t.includes('inventory')) {
    return [
      {
        _id: 'mock1',
        name: 'Örnek Envanter A',
        model: 'Model-001',
        code: 'INV-001',
        cins: 'Demirbaş',
        no: '101',
        basePrice: 1250,
        width: 120,
        height: 80,
        depth: 60,
        description: 'Önizleme için örnek envanter kaydı.',
        photo: [
          {
            original: 'https://backend.haustro.net/resources/file4744-01032021-000251.png',
            name: 'file4744-01032021-000251.png',
            compressed: 'file4744-01032021-000251.png',
          },
        ],
      },
      {
        _id: 'mock2',
        name: 'Örnek Envanter B',
        model: 'Model-002',
        code: 'INV-002',
        cins: 'Sarf',
        no: '102',
        basePrice: 480,
        description: 'İkinci mock envanter.',
        photo: [
          {
            original: 'https://backend.haustro.net/resources/file4744-01032021-000251.png',
            name: 'file4744-01032021-000251.png',
            compressed: 'file4744-01032021-000251.png',
          },
        ],
      },
    ];
  }
  if (t.includes('department')) {
    return [
      { _id: 'd1', name: 'Mühendislik', code: 'ENG' },
      { _id: 'd2', name: 'Operasyon', code: 'OPS' },
    ];
  }
  if (t.includes('user')) {
    return [
      { _id: 'u1', name: 'Ada Lovelace', email: 'ada@example.com' },
      { _id: 'u2', name: 'Alan Turing', email: 'alan@example.com' },
    ];
  }
  // generic fallback
  return [
    { _id: 'x1', name: 'Örnek 1', value: 100 },
    { _id: 'x2', name: 'Örnek 2', value: 200 },
  ];
}

/**
 * Tek bir render-template'i tam HTML belgesi içinde iframe srcdoc için
 * paketle. Page styles ve light tema body wrapper'ı ekler.
 */
export function wrapForIframe(innerHtml, pageStyles = '') {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html,body{margin:0;padding:0;background:#fff;color:#0f172a;font-family:-apple-system,'Segoe UI',Inter,sans-serif}
  body{padding:8px}
  img{max-width:100%}
  ${pageStyles || ''}
</style>
</head>
<body>
${innerHtml}
</body>
</html>`;
}
