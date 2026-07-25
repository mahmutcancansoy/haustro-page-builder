#!/usr/bin/env node
/**
 * arac-gerec-envanteri kart görünümünü etkileşimli hale getirir:
 *  - Kartlar tıklanınca /d/arac-gerec-detayi?_id=... detay sayfasına gider.
 *  - Kategori filtresi (dropdown) + serbest metin araması eklenir (client-side JS).
 *  - Envanter görseli düzeltilir: globals.resources + name başarısız olursa
 *    photo.0.original mutlak URL'ine düşer (onerror fallback).
 *
 *   node scripts/patch-arac-gerec-envanteri-cards-interactive.js
 *   node scripts/patch-arac-gerec-envanteri-cards-interactive.js --push
 */
const fs = require('fs');
const path = require('path');
const { loadEnv } = require('../src/config');
const { connect, getDb, close } = require('../src/db');

const push = process.argv.includes('--push');
const PAGE_ID = '5fef676e4fe5a500117b0852';
const LIST_FILE = path.join(__dirname, '../templates/inventory-list-content.json');

const NEW_CONTENT = `<style>
.inv-cards-wrapper{padding:16px;font-family:'Inter',-apple-system,sans-serif}
.inv-cards-header{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:16px;flex-wrap:wrap}
.inv-cards-title{margin:0;font-size:18px;font-weight:700;color:#1e293b}
.inv-cards-count{font-size:12px;color:#64748b;background:#f1f5f9;padding:4px 10px;border-radius:999px;font-weight:600;white-space:nowrap}
.inv-filter{display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
.inv-filter__search,.inv-filter__cat{height:38px;border:1px solid #e2e8f0;border-radius:10px;padding:0 12px;font-size:13px;color:#334155;background:#fff;outline:none;transition:border-color .15s ease,box-shadow .15s ease}
.inv-filter__search{flex:1;min-width:200px}
.inv-filter__search:focus,.inv-filter__cat:focus{border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.12)}
.inv-filter__cat{min-width:180px;cursor:pointer}
.inv-cards-empty{padding:32px;text-align:center;color:#94a3b8;background:#f8fafc;border:1px dashed #e2e8f0;border-radius:12px}
.inv-cards-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
.inv-card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;display:flex;flex-direction:column;transition:transform .15s ease,box-shadow .15s ease;box-shadow:0 1px 2px rgba(15,23,42,.04);text-decoration:none;color:inherit;cursor:pointer}
.inv-card:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(15,23,42,.08);border-color:#c7d2fe}
.inv-card__media{position:relative;width:100%;height:160px;background:#f1f5f9;overflow:hidden}
.inv-card__img{width:100%;height:100%;object-fit:cover;display:block}
.inv-card__img-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px;background:linear-gradient(135deg,#f1f5f9,#e2e8f0)}
.inv-card__no{position:absolute;top:8px;left:8px;background:rgba(15,23,42,.8);color:#fff;font-size:11px;padding:3px 8px;border-radius:999px;letter-spacing:.3px;font-weight:600}
.inv-card__cat{position:absolute;top:8px;right:8px;background:rgba(99,102,241,.92);color:#fff;font-size:11px;padding:3px 8px;border-radius:999px;font-weight:600;max-width:60%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.inv-card__body{padding:12px 14px 14px;display:flex;flex-direction:column;gap:6px;flex:1}
.inv-card__title{font-size:14px;font-weight:700;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.inv-card__subtitle{font-size:12px;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.inv-card__meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:4px}
.inv-card__chip{display:inline-flex;align-items:center;gap:4px;background:#f1f5f9;border-radius:8px;padding:3px 8px;font-size:11px;color:#334155}
.inv-card__chip-label{color:#94a3b8;font-weight:600}
.inv-card__chip-value{font-weight:700}
.inv-card__desc{font-size:12px;color:#475569;line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.inv-card__footer{margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:8px;border-top:1px dashed #e2e8f0}
.inv-card__price{font-size:14px;font-weight:800;color:#0f172a}
.inv-card__price small{font-weight:500;color:#64748b;margin-left:2px}
.inv-card__dims{font-size:11px;color:#64748b;font-weight:500}
.inv-cards-noresult{display:none;padding:32px;text-align:center;color:#94a3b8;background:#f8fafc;border:1px dashed #e2e8f0;border-radius:12px}
</style>

<div class="inv-cards-wrapper" id="inv-cards-root">
  <div class="inv-cards-header">
    <h3 class="inv-cards-title">Araç Gereç Envanteri</h3>
    <span class="inv-cards-count">{{inventory.length}} kayıt</span>
  </div>

  {{#if inventory.length}}
  <div class="inv-filter">
    <input class="inv-filter__search" type="text" placeholder="Ara: isim, model, kod, cins..." />
    <select class="inv-filter__cat">
      <option value="">Tüm kategoriler</option>
    </select>
  </div>

  <div class="inv-cards-grid">
    {{#each inventory}}
    <a class="inv-card" href="/d/arac-gerec-detayi?_id={{this._id}}" data-cat="{{this.:inventoryCats:category._id}}" data-catname="{{this.:inventoryCats:category.name}}" data-search="{{this.name}} {{this.model}} {{this.code}} {{this.cins}} {{this.no}} {{this.:inventoryCats:category.name}}">
      <div class="inv-card__media">
        {{#if this.photo.0.name}}
          <img class="inv-card__img" src="{{globals.resources}}{{this.photo.0.name}}" alt="{{this.name}}" loading="lazy" onerror="this.onerror=null;this.src='{{this.photo.0.original}}';" />
        {{else}}
          {{#if this.photo.0.original}}
          <img class="inv-card__img" src="{{this.photo.0.original}}" alt="{{this.name}}" loading="lazy" />
          {{else}}
          <div class="inv-card__img-placeholder"><span>Görsel Yok</span></div>
          {{/if}}
        {{/if}}
        {{#if this.no}}<span class="inv-card__no">{{this.no}}</span>{{/if}}
        {{#if this.:inventoryCats:category.name}}<span class="inv-card__cat">{{this.:inventoryCats:category.name}}</span>{{/if}}
      </div>

      <div class="inv-card__body">
        <div class="inv-card__title" title="{{this.name}}">{{#if this.name}}{{this.name}}{{else}}-{{/if}}</div>
        {{#if this.model}}<div class="inv-card__subtitle">{{this.model}}</div>{{/if}}

        <div class="inv-card__meta">
          {{#if this.code}}
          <span class="inv-card__chip">
            <span class="inv-card__chip-label">Kod</span>
            <span class="inv-card__chip-value">{{this.code}}</span>
          </span>
          {{/if}}
          {{#if this.cins}}
          <span class="inv-card__chip">
            <span class="inv-card__chip-label">Cins</span>
            <span class="inv-card__chip-value">{{this.cins}}</span>
          </span>
          {{/if}}
        </div>

        {{#if this.description}}<div class="inv-card__desc">{{this.description}}</div>{{/if}}

        <div class="inv-card__footer">
          {{#if this.basePrice}}<span class="inv-card__price">{{this.basePrice}} <small>₺</small></span>{{/if}}
          {{#if this.width}}<span class="inv-card__dims">{{this.width}} × {{this.height}} × {{this.depth}}</span>{{/if}}
        </div>
      </div>
    </a>
    {{/each}}
  </div>
  <div class="inv-cards-noresult">Filtreye uygun envanter bulunamadı.</div>
  {{else}}
  <div class="inv-cards-empty">Henüz envanter kaydı bulunmuyor.</div>
  {{/if}}
</div>

<script>
(function(){
  var root=document.getElementById('inv-cards-root');
  if(!root||root.dataset.invBound==='1')return;
  root.dataset.invBound='1';
  var search=root.querySelector('.inv-filter__search');
  var catSel=root.querySelector('.inv-filter__cat');
  var grid=root.querySelector('.inv-cards-grid');
  var noResult=root.querySelector('.inv-cards-noresult');
  var countEl=root.querySelector('.inv-cards-count');
  if(!grid)return;
  var cards=[].slice.call(grid.querySelectorAll('.inv-card'));
  var total=cards.length;

  var seen={};
  cards.forEach(function(c){
    var id=c.getAttribute('data-cat')||'';
    var name=(c.getAttribute('data-catname')||'').trim();
    if(id&&name&&!seen[id]){seen[id]=name;}
  });
  Object.keys(seen).sort(function(a,b){return seen[a].localeCompare(seen[b],'tr');}).forEach(function(id){
    var opt=document.createElement('option');
    opt.value=id;opt.textContent=seen[id];
    if(catSel)catSel.appendChild(opt);
  });

  function apply(){
    var q=(search&&search.value?search.value:'').trim().toLocaleLowerCase('tr');
    var cat=catSel&&catSel.value?catSel.value:'';
    var visible=0;
    cards.forEach(function(c){
      var okCat=!cat||c.getAttribute('data-cat')===cat;
      var hay=(c.getAttribute('data-search')||'').toLocaleLowerCase('tr');
      var okSearch=!q||hay.indexOf(q)>=0;
      var show=okCat&&okSearch;
      c.style.display=show?'':'none';
      if(show)visible++;
    });
    if(countEl)countEl.textContent=visible+' / '+total+' kayıt';
    if(noResult)noResult.style.display=visible?'none':'block';
  }

  if(search)search.addEventListener('input',apply);
  if(catSel)catSel.addEventListener('change',apply);
  apply();
})();
</script>`;

function patchContent(content) {
  const block = (content || []).find(
    (b) => b.type === 'render-template' && String(b.content || '').includes('inv-cards-grid')
  );
  if (!block) return { patched: 0 };
  block.content = NEW_CONTENT;
  return { patched: 1 };
}

async function main() {
  const raw = JSON.parse(fs.readFileSync(LIST_FILE, 'utf8'));
  const localResult = patchContent(raw.content);
  fs.writeFileSync(LIST_FILE, `${JSON.stringify(raw, null, 2)}\n`, 'utf8');
  console.log('Yerel şablon güncellendi:', localResult);

  if (!push) {
    console.log('DB push atlandı. Canlıya almak için: --push');
    return;
  }

  loadEnv();
  await connect();
  const db = getDb();
  const doc = await db.collection('pageContents').findOne({ pageId: PAGE_ID });
  if (!doc) throw new Error(`pageContents bulunamadı: ${PAGE_ID}`);

  const dbResult = patchContent(doc.content);
  const r = await db
    .collection('pageContents')
    .updateOne({ pageId: PAGE_ID }, { $set: { content: doc.content } });
  console.log('DB güncellendi:', {
    ...dbResult,
    matched: r.matchedCount,
    modified: r.modifiedCount,
  });
  await close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
