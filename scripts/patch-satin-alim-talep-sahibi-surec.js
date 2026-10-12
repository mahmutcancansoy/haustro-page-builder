#!/usr/bin/env node
/**
 * Talep sahibi satın alma sürecini Satın Alım Talepleri listesinden takip eder.
 * Kendisine düşen teslim alma alanları talep detayında açılır.
 *
 *   node scripts/patch-satin-alim-talep-sahibi-surec.js
 *   node scripts/patch-satin-alim-talep-sahibi-surec.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');
const { getPageContent } = require('../src/pageService');
const { inspectPageContent } = require('./lib/sync-page-from-db');

const PUSH = process.argv.includes('--push');
const TEMPLATES = path.join(__dirname, '../templates');

const PAGES = {
  list: '620efaa1b03e36003b6cf060',
  inventoryDetail: '6788396da01c3524305d1dc0',
  serviceDetail: '6914b7315170eb00171816d2',
};

const STEPS = ['Talep', 'Onay', 'Teklif', 'Sipariş', 'Yolda', 'Teslim', 'Fatura', 'Bitti'];
const FLOW_TITLE = STEPS.join(' → ');

const STATUS_VIEW = {
  0: { index: 1, name: 'Onay bekleniyor' },
  1: { index: 2, name: 'Teklif toplanıyor' },
  2: { index: 2, name: 'Teklifler yüklendi' },
  3: { index: 2, name: 'Teklif onaylandı' },
  4: { index: 3, name: 'Sipariş verildi' },
  5: { index: 4, name: 'Sipariş yolda' },
  6: { index: 6, name: 'Fatura bekleniyor' },
  7: { index: 6, name: 'Fatura yüklendi' },
  8: { index: 7, name: 'Tamamlandı', done: true },
  9: { badge: 'Reddedildi' },
  10: { badge: 'İptal edildi' },
};

function deepClone(v) {
  return JSON.parse(JSON.stringify(v));
}

function prop(block, key) {
  return (block?.properties || []).find((p) => p.key === key);
}

function propVal(block, key) {
  const p = prop(block, key);
  return p == null ? '' : p.value;
}

function setProp(block, key, value) {
  const p = prop(block, key);
  if (!p) throw new Error(`Özellik yok: ${key}`);
  p.value = value;
}

function walk(blocks, fn, ancestors) {
  for (const b of blocks || []) {
    const name = String(propVal(b, 'display-name') || '');
    const next = (ancestors || []).concat(name);
    fn(b, next);
    if (b.children) walk(b.children, fn, next);
  }
}

function renderBlock(displayName, content) {
  return {
    type: 'render-template',
    isContainer: false,
    isTextEditor: true,
    content,
    properties: [
      {
        key: 'display-name',
        header: 'Display name',
        type: 'input-text-property',
        value: displayName,
      },
    ],
  };
}

function flowCss() {
  return `<style>
.sat-flow{min-width:168px;line-height:1.3}
.sat-flow__dots{display:flex;gap:4px;align-items:center}
.sat-flow__dots i{width:8px;height:8px;border-radius:99px;background:#e2e8f0;display:block}
.sat-flow__dots i.is-done{background:#16a34a}
.sat-flow__dots i.is-now{background:#4557a3;width:10px;height:10px;box-shadow:0 0 0 3px rgba(69,87,163,.18)}
.sat-flow__name{margin-top:4px;font-size:12px;font-weight:650;color:#1e293b}
.sat-flow__mine{margin-top:4px;display:inline-block;font-size:11px;font-weight:700;color:#9a3412;background:#ffedd5;border-radius:999px;padding:2px 8px}
.sat-flow__bad{font-size:12px;font-weight:700;color:#b91c1c}
.sat-legend{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;margin:0 0 8px;color:#64748b;font-size:12px}
.sat-legend b{color:#1e293b;font-weight:650}
.sat-legend span{white-space:nowrap}
.sat-legend span+span:before{content:"→";margin-right:10px;color:#cbd5e1}
.sat-owner-act{margin:12px 0;padding:12px 14px;border-radius:12px;background:#fff7ed;border:1px solid #fdba74;color:#9a3412}
.sat-owner-act strong{display:block;margin-bottom:4px}
</style>`;
}

function dots(view) {
  if (view.badge) return '';
  return STEPS.map((label, i) => {
    let cls = 'is-wait';
    if (view.done || i < view.index) cls = 'is-done';
    else if (i === view.index) cls = 'is-now';
    return `<i class="${cls}" title="${label}"></i>`;
  }).join('');
}

function flowTemplate({ statusPath, userPath, mineByStatus }) {
  const blocks = Object.entries(STATUS_VIEW).map(([status, view]) => {
    const mine = mineByStatus[status]
      ? `{{#cIf ${userPath} "==" info._id}}<div class="sat-flow__mine">${mineByStatus[status]}</div>{{/cIf}}`
      : '';
    const body = view.badge
      ? `<div class="sat-flow__bad">${view.badge}</div>`
      : `<div class="sat-flow__dots" title="${FLOW_TITLE}">${dots(view)}</div><div class="sat-flow__name">${view.name}</div>${mine}`;
    return `{{#cIf ${statusPath} "==" "${status}"}}<div class="sat-flow">${body}</div>{{/cIf}}`;
  });
  return `${blocks.join('\n')}\n${flowCss()}`;
}

function legendTemplate() {
  const steps = STEPS.map((s) => `<span>${s}</span>`).join('');
  return `<div class="sat-legend"><b>Süreç</b>${steps}</div>
<p class="sat-legend" style="margin-top:0">Oluşturduğunuz talepler tamamlanana kadar bu listede kalır. Size düşen işlem, talebin detayında açılır.</p>
${flowCss()}`;
}

function ownerFilters(purchaseType) {
  const typeLine = purchaseType
    ? `\n    "purchaseType": ${purchaseType},`
    : '';
  return `{
    "delete" : "0",
    "sort" : {"datetime": -1},${typeLine}
    "$or": [
        {"status": "0"},
        {":users:demander": "{{info._id}}"}
    ]
}`;
}

function patchList(content) {
  let filters = 0;
  let columns = 0;
  let legends = 0;

  walk(content, (block, ancestors) => {
    if (block.type === 'data-source' && propVal(block, 'variable-name') === 'purchases') {
      const parent = ancestors[ancestors.length - 2];
      const current = String(propVal(block, 'table-filters') || '');
      if (current.includes('":users:demander"')) return;
      if (parent === 'Tümü') {
        setProp(block, 'table-filters', ownerFilters(null));
        filters += 1;
      } else if (parent === 'Envanter') {
        setProp(block, 'table-filters', ownerFilters('{"$ne":"service"}'));
        filters += 1;
      } else if (parent === 'Hizmet') {
        setProp(block, 'table-filters', ownerFilters('"service"'));
        filters += 1;
      }
    }

    const header = propVal(block, 'header');
    if (block.type !== 'table-column' || (header !== 'Durumu' && header !== 'Süreç')) return;
    const service = ancestors.includes('Hizmet Talep');
    setProp(block, 'header', 'Süreç');
    block.children = [
      renderBlock(
        'Süreç takibi',
        flowTemplate({
          statusPath: 'input.status',
          userPath: 'input.:users:demander._id',
          mineByStatus: service
            ? { 3: 'Sizin işleminiz: Hizmeti tamamlayın' }
            : { 5: 'Sizin işleminiz: Teslim alma' },
        })
      ),
    ];
    columns += 1;
  });

  walk(content, (block) => {
    if (block.type !== 'condition') return;
    const name = propVal(block, 'display-name');
    if (name !== 'Envanter' && name !== 'Hizmet Talep') return;
    if ((block.children || []).some((c) => propVal(c, 'display-name') === 'Süreç açıklaması')) return;
    const hasTable = (block.children || []).some((c) => c.type === 'table');
    if (!hasTable) return;
    block.children.unshift(renderBlock('Süreç açıklaması', legendTemplate()));
    legends += 1;
  });

  return { filters, columns, legends };
}

function findDeliveredForm() {
  const doc = JSON.parse(fs.readFileSync(path.join(TEMPLATES, 'satin-alim-teslimat-content.json'), 'utf8'));
  let found = null;
  walk(doc.content, (block) => {
    if (block.type === 'form-container' && propVal(block, 'display-name') === 'deliveredForm') found = block;
  });
  if (!found) throw new Error('Teslimat formu bulunamadı');
  return deepClone(found);
}

function deliveryFormForDetail() {
  const form = findDeliveredForm();
  setProp(
    form,
    'hidden-values',
    '{\n    "oprType":"delivered",\n    "userId":"{{info._id}}",\n    "purchaseId":"{{params._id}}"\n}'
  );
  setProp(form, 'on-success', 'route');
  setProp(form, 'url', '/d/satin-alim-talepleri');
  return form;
}

function patchInventoryDetail(content) {
  let stepper = 0;
  let form = 0;
  const flow = flowTemplate({
    statusPath: 'purchases.status',
    userPath: 'purchases.:users:demander._id',
    mineByStatus: { 5: 'Teslim alma alanları bu sayfada' },
  });

  walk(content, (block) => {
    if (block.type === 'condition' && String(propVal(block, 'condition')).replace(/\s/g, '') === '"{{purchases._id}}"!=""') {
      const existing = (block.children || []).find((c) => propVal(c, 'display-name') === 'Talep sahibi süreç');
      if (existing) existing.content = flow;
      else block.children.unshift(renderBlock('Talep sahibi süreç', flow));
      stepper += 1;
    }
    if (block.type === 'condition' && propVal(block, 'display-name') === 'Talep Sahibi Teslim Alabilir') {
      const already = (block.children || []).some(
        (c) => c.type === 'form-container' && propVal(c, 'display-name') === 'deliveredForm'
      );
      if (!already) {
        block.children = [
          renderBlock(
            'Teslim alma açıklaması',
            `<div class="sat-owner-act"><strong>Sizin işleminiz: Teslim alma</strong><span>Eksiksiz veya eksik geldiğini burada işaretleyin. Ayrı bir teslimat ekranına geçmeniz gerekmez.</span></div>${flowCss()}`
          ),
          deliveryFormForDetail(),
        ];
      }
      form += 1;
    }
  });

  return { stepper, form };
}

function patchServiceDetail(content) {
  let stepper = 0;
  let redirect = 0;
  const flow = flowTemplate({
    statusPath: 'purchases.status',
    userPath: 'purchases.:users:demander._id',
    mineByStatus: { 3: 'Tamamlama alanları bu sayfada' },
  });

  walk(content, (block) => {
    if (block.type === 'condition' && String(propVal(block, 'condition')).replace(/\s/g, '') === '"{{purchases._id}}"!=""') {
      const existing = (block.children || []).find((c) => propVal(c, 'display-name') === 'Talep sahibi süreç');
      if (existing) existing.content = flow;
      else block.children.unshift(renderBlock('Talep sahibi süreç', flow));
      stepper += 1;
    }
    if (block.type === 'form-container' && propVal(block, 'display-name') === 'deliveredForm') {
      if (propVal(block, 'url') !== '/d/satin-alim-talepleri') {
        setProp(block, 'url', '/d/satin-alim-talepleri');
      }
      redirect += 1;
    }
  });

  return { stepper, redirect };
}

function assertPatched(list, inventory, service) {
  let ownerFilters = 0;
  let processColumns = 0;
  walk(list, (block) => {
    if (block.type === 'data-source' && propVal(block, 'variable-name') === 'purchases') {
      const filters = String(propVal(block, 'table-filters') || '');
      if (filters.includes('":users:demander"') && filters.includes('"$or"')) ownerFilters += 1;
    }
    if (block.type === 'table-column' && propVal(block, 'header') === 'Süreç') processColumns += 1;
  });
  if (ownerFilters !== 3 || processColumns !== 2) {
    throw new Error(`Liste doğrulanamadı: filtre ${ownerFilters}, sütun ${processColumns}`);
  }

  let deliveryReady = false;
  let stillLeavesPage = false;
  walk(inventory, (block) => {
    if (block.type === 'condition' && propVal(block, 'display-name') === 'Talep Sahibi Teslim Alabilir') {
      deliveryReady = (block.children || []).some(
        (c) => c.type === 'form-container' && String(propVal(c, 'hidden-values') || '').includes('{{params._id}}')
      );
    }
    if (String(propVal(block, 'url') || '').includes('satin-alim-teslimat')) stillLeavesPage = true;
  });
  if (!deliveryReady || stillLeavesPage) {
    throw new Error('Envanter detayında teslim alma formu hazır değil');
  }

  let serviceBack = false;
  walk(service, (block) => {
    if (block.type === 'form-container' && propVal(block, 'display-name') === 'deliveredForm') {
      serviceBack = propVal(block, 'url') === '/d/satin-alim-talepleri';
    }
  });
  if (!serviceBack) throw new Error('Hizmet tamamlama dönüş adresi güncellenmedi');
}

function writeTemplate(pageId, slug, content, styles) {
  const file = path.join(TEMPLATES, `${slug}-content.json`);
  const payload = {
    pageId,
    content,
    styles: styles || '',
    syncedAt: new Date().toISOString(),
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
  return file;
}

async function loadPage(pageId) {
  const doc = await getPageContent(pageId);
  if (!doc?.content?.length) throw new Error(`pageContents bulunamadı: ${pageId}`);
  return doc;
}

(async () => {
  try {
    loadEnv();
    await connect();

    const listDoc = await loadPage(PAGES.list);
    const inventoryDoc = await loadPage(PAGES.inventoryDetail);
    const serviceDoc = await loadPage(PAGES.serviceDetail);

    const list = deepClone(listDoc.content);
    const inventory = deepClone(inventoryDoc.content);
    const service = deepClone(serviceDoc.content);

    const listResult = patchList(list);
    const inventoryResult = patchInventoryDetail(inventory);
    const serviceResult = patchServiceDetail(service);

    const files = [
      writeTemplate(PAGES.list, 'satin-alim-talepleri', list, listDoc.styles),
      writeTemplate(PAGES.inventoryDetail, 'satin-alim-detayi', inventory, inventoryDoc.styles),
      writeTemplate(PAGES.serviceDetail, 'hizmet-satin-alim-detayi', service, serviceDoc.styles),
    ];

    console.log('liste:', JSON.stringify(listResult));
    console.log('envanter detay:', JSON.stringify(inventoryResult));
    console.log('hizmet detay:', JSON.stringify(serviceResult));
    console.log('şablonlar:', files.join('\n'));
    console.log('liste inspect data-source:', JSON.stringify(inspectPageContent(list).dataSources, null, 2));

    assertPatched(list, inventory, service);

    if (!PUSH) {
      console.log('DB yazılmadı ( --push ile yazılır )');
      return;
    }

    const db = getDb();
    for (const [pageId, content, styles] of [
      [PAGES.list, list, listDoc.styles],
      [PAGES.inventoryDetail, inventory, inventoryDoc.styles],
      [PAGES.serviceDetail, service, serviceDoc.styles],
    ]) {
      const r = await db.collection('pageContents').updateOne({ pageId }, { $set: { content, styles: styles || '' } });
      console.log('DB push', pageId, 'matched', r.matchedCount, 'modified', r.modifiedCount);
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
  } finally {
    await close().catch(() => {});
  }
})();
