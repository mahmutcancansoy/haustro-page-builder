/**
 * Brief generator
 *
 * Frontend formundan gelen yapılandırılmış girdileri alır ve bir AI asistanının
 * okuyabileceği detaylı bir Markdown brief üretir. Brief sadece
 * `templates/<slug>-page.json` + `templates/<slug>-content.json` dosyalarının
 * oluşturulmasını ister; DB'ye yazma adımını kullanıcı manuel olarak
 * `npm run create-from-template` ile yapar.
 */
const fs = require('fs');
const path = require('path');
const { slugify } = require('../src/utils');
const { catalogToMarkdown } = require('../src/componentCatalog');

function buildBrief({ pageType, parentId, parentLabel, label, url, description, notes, references }) {
  const isSub = pageType === 'sub';
  const finalSlug = slugify(label || 'page');
  const finalUrl = url && url.trim() ? url.trim() : finalSlug;

  const md = `# Haustro Page Brief — ${label}

> Bu brief bir AI asistanı için yazılmıştır. Aşağıdaki "Talimat" bölümünü olduğu
> gibi takip et; çıktı **sadece** \`templates/${finalSlug}-page.json\` ve
> \`templates/${finalSlug}-content.json\` dosyaları olmalı. DB'ye dokunma.

## Sayfa Metadata

| Alan | Değer |
|---|---|
| **Tip** | \`${pageType}\` |
| **Parent** | ${isSub ? `${parentLabel || '(belirtilmedi)'}  →  \`${parentId}\`` : '*(root — main sayfa)*'} |
| **Label / display-name** | ${label} |
| **URL slug** | \`${finalUrl}\` |
| **Şablon adı (üretilecek)** | \`${finalSlug}\` |

## Brief (kullanıcıdan)

${description.trim()}

${notes && notes.trim() ? `## Ek Notlar\n\n${notes.trim()}\n` : ''}

${references && references.trim() ? `## Referans Sayfalar / Şablonlar\n\n${references.trim()}\n` : ''}

## Talimat

1. **Bu brief'in "Brief" bölümünü dikkatle oku.** Kullanıcının ne istediğini
   anla — hangi veri gösterilecek, hangi etkileşimler olacak, kart mı tablo mu
   liste mi, hangi alanlar görünecek?

2. **Veri kaynaklarını belirle.** İhtiyaç duyduğun MongoDB koleksiyonlarını
   (örn. \`inventory\`, \`departments\`, \`users\`, \`betaPurchase\`, ...) listele.
   Emin değilsen \`npm run shell\` ile bir koleksiyondan örnek kayıt çek:
   \`\`\`
   haustro> query inventory '{"delete":0}' 1
   \`\`\`

3. **İki dosyayı yaz** (template dizinine):
   - \`templates/${finalSlug}-page.json\` — sayfa metadata (mevcut
     \`templates/inventory-cards-page.json\` örnek alabilirsin). Üstteki sayfa
     metadata değerleri kullanılmalı.
   - \`templates/${finalSlug}-content.json\` — \`content\` array'i içinde:
     - Her veri kaynağı için bir \`data-source\` bloğu (variable-name + table-name
       + table-filters).
     - Bir veya birden çok \`render-template\` bloğu. **HTML içinde \`<style>\`
       inline gömülmeli**, \`styles\` field'ı boş kalsın.

4. **Render-template syntax — Handlebars (Angular DEĞİL):**
   - Liste: \`{{#each variableName}} ... {{this.field}} ... {{/each}}\`
   - Koşul: \`{{#if x}} ... {{else}} ... {{/if}}\`
   - Karşılaştırma: \`{{#cIf x "==" y}} ... {{else}} ... {{/cIf}}\`
   - Array index: \`{{this.photo.0.name}}\` (nokta ile, parantez yok)
   - Photo URL (tablo: \`input\`, render-template döngüsü: \`this\`):
     \`<img src="{{globals.resources}}{{input.photo.0.name}}">\` / \`{{globals.resources}}{{this.photo.0.name}}\`
     \`globals.resources\` genelde \`https://backend.haustro.net/resources/\`
   - Field with colons: \`{{this.:inventoryCats:category.name}}\`
   - Angular yapılarını (\`*ngFor\`, \`*ngIf\`, \`[src]\`, \`ng-container\`,
     \`ng-template\`, \`trackBy\`) **KULLANMA** — render engine bunları parse etmez.

5. **JSON'u valide et:**
   \`\`\`bash
   node -e "JSON.parse(require('fs').readFileSync('templates/${finalSlug}-page.json','utf8')); JSON.parse(require('fs').readFileSync('templates/${finalSlug}-content.json','utf8')); console.log('OK')"
   \`\`\`

6. **Bittiğinde dur.** DB'ye yazma. Kullanıcı sonucu inceleyip kendisi şu
   komutu çalıştıracak:
   \`\`\`bash
   npm run create-from-template -- -n ${finalSlug} -p ${parentId || '<parentId>'} -t "${label}" -u ${finalUrl}
   \`\`\`

## Çalışma kuralları (zorunlu)

- **Sadece** \`templates/\` altına yaz. Diğer dosyalara dokunma.
- Mevcut bir şablona benzer ihtiyaç varsa onu kopyalayıp uyarla (örn.
  \`templates/inventory-cards-content.json\`).
- Tüm \`render-template\` örneklerini önce \`grep -r '"type": "render-template"' templates/\`
  ile gözden geçirebilirsin.
- Stiller modern, dark-tema dostu olsun (palet: slate, indigo aksent).
- "for table" data-source'u sadece \`<table>\` componenti için kullanılır;
  \`render-template\` için \`forTable: false\` bırak.

${catalogToMarkdown()}

## Bilinen referans şablonlar

- \`templates/inventory-cards-*.json\` — envanter list, Handlebars + responsive card grid
- \`templates/render-template-testi-*.json\` — minimal data-source + render-template
- \`templates/inventory-list-*.json\` — tam envanter detay sayfası (yedek: \`sample-inventory-list-*.json\`)

## Veritabanı kısayolları

| Alias | ID | Açıklama |
|---|---|---|
| \`mahmutcan\` / \`parent\` | \`6802646ca01c352cdf350342\` | mahmutcan test (varsayılan parent) |
| \`cards\` | \`6a0f082613a466b79aa65c98\` | Envanter Kartları (örnek sayfa) |
| \`envanter\` | \`5fef676e4fe5a500117b0852\` | Araç Gereç Envanteri şablonu |

## Inventory tablo örnek alanları

\`name\`, \`model\`, \`code\`, \`no\`, \`cins\`, \`description\`, \`basePrice\`,
\`width\`, \`height\`, \`depth\`, \`bulk\`, \`photo[].original\`,
\`:inventoryCats:category\` (referans, name field'ı var), \`:materiels:.name\`,
\`:colors:.name\`, \`delete\`.

---

*Brief id:* \`${finalSlug}\`  ·  *Oluşturulma:* ${new Date().toISOString()}
`;

  return { md, slug: finalSlug, url: finalUrl };
}

function buildClipboardPrompt(briefPath, slug) {
  return `@${briefPath.replace(/^.*\/briefs\//, 'briefs/')}

Yukarıdaki brief'i baştan sona oku ve içindeki "Talimat" bölümünü adım adım uygula.

Görev: \`templates/${slug}-page.json\` ve \`templates/${slug}-content.json\` dosyalarını yaz. DB'ye dokunma. JSON validasyon adımını atlama. Tamamlandığında bana kullanıcıya hangi \`npm run create-from-template\` komutunu çalıştıracağını söyle.`;
}

function saveBrief({ briefsDir, slug, md }) {
  if (!fs.existsSync(briefsDir)) fs.mkdirSync(briefsDir, { recursive: true });
  const ts = new Date()
    .toISOString()
    .replace(/[:T]/g, '-')
    .replace(/\..*$/, '');
  const filename = `${ts}-${slug}.md`;
  const briefPath = path.join(briefsDir, filename);
  fs.writeFileSync(briefPath, md);
  return briefPath;
}

module.exports = { buildBrief, buildClipboardPrompt, saveBrief };
