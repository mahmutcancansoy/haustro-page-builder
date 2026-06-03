# Haustro Component Referansı

> Otomatik üretim: `node scripts/generate-component-docs.js`  
> Kaynak: `data/component-catalog.json` (v1.0.0)

Bu dosyayı AI araçlarına `@docs/COMPONENTS_REFERENCE.md` ile verebilirsiniz.

## Editör Component Katalogu

Kaynak: `data/component-catalog.json` (v1.0.0). Yeni block tipi **uydurma**.

| Type | Kategori | Özet | Zorunlu alanlar |
|---|---|---|---|
| `data-source` | data | MongoDB koleksiyonundan veri çekip Handlebars değişkenine atar. | variable-name, function |
| `render-template` | view | HTML + Handlebars + inline CSS render eder. | content |
| `condition` | logic | Koşula göre children[] alt ağacını gösterir/gizler. | rule |
| `template` | data | Handlebars çıktısını değişkene yazar; doğrudan render etmez. | variable-name, template |
| `grid` | layout | Çok kolonlu layout container. | display-name, columns |
| `column` | layout | grid altında tek kolon. | display-name, width, content-direction |
| `content-header` | layout | Sayfa üst başlık bandı (metin + renkler). | text |
| `form-container` | form | Form alanları + submit container. | display-name, submit-url, submit-type |
| `input-select` | form | Dropdown select. | variable-name |
| `input-text` | form | Tek satır metin. | variable-name |
| `input-number` | form | Sayısal input. | variable-name |
| `textarea` | form | Çok satırlı metin. | variable-name |
| `button` | action | Submit, link veya custom aksiyon. | label |
| `table` | view | Veri tablosu — forTable data-source ile. | variable-name |
| `table-column` | view | table altında tek kolon tanımı. | display-name |
| `label` | view | Tablo hücresi veya metin — Handlebars text ile. | text |
| `chart` | view | Grafik görünümü. | variable-name |
| `statistic` | view | Tek metrik kartı. | display-name, value |
| `text` | view | Statik metin bloğu. | content |
| `image` | view | Statik veya değişkenden görsel. | src |

### Yaygın desenler

- **Veri + HTML şablon**: `data-source → render-template` — örnek: `templates/inventory-cards-content.json`
- **Veri + tablo**: `data-source → table → table-column → label` — örnek: `templates/inventory-list-content.json`
- **Grid + form**: `grid → column → form-container → input-text → button`

### Handlebars (Handlebars (Angular DEĞİL))

- `{{#each variableName}} ... {{/each}}` — Dizi döngüsü
- `{{this.field}}` — Döngüde kayıt alanı
- `{{#if x}} ... {{else}} ... {{/if}}` — Koşul
- `{{#cIf a "==" b}} ... {{/cIf}}` — Karşılaştırma
- `{{this.photo.0.name}}` — Dizi index (nokta, parantez yok)
- `{{globals.resources}}{{this.photo.0.name}}` — Görsel (render-template)
- `{{globals.resources}}{{input.photo.0.name}}` — Görsel (table bağlamı)
- `{{this.:refField:sub.name}}` — Mongo referans alanı

**Yasak:** `*ngFor`, `*ngIf`, `[src]`, `ng-container`, `ng-template`, `trackBy`

> Varsayılan akış: `data-source` + `render-template`. Tablo için `forTable: true` + `table`.

## Tüm component'ler (detay)

### `data-source` — Veri Kaynağı

**Kategori:** data · **Özet:** MongoDB koleksiyonundan veri çekip Handlebars değişkenine atar.

**Ne zaman:** Her gösterilecek koleksiyon için; render-template veya table'dan önce.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `display-name` | — | Editör etiketi |
| `variable-name` | evet | Handlebars değişkeni (örn. inventory) |
| `function` | evet | Veri kaynağı tipi |
| `table-name` | if function=get | Koleksiyon adı |
| `custom-function-name` | if function=custom | Custom route adı |
| `table-filters` | — | JSON filtre string — {"delete":0} |
| `post-params` | — | Custom POST body (JSON) |
| `settings` | — | single | debug | canReload | forTable |

**Notlar:**
- function=get → table-name + table-filters.
- render-template için forTable: false.
- table için forTable: true olan ayrı data-source.

**Örnek:**

```json
{
  "type": "data-source",
  "isContainer": false,
  "children": [],
  "properties": [
    {
      "key": "variable-name",
      "value": "inventory"
    },
    {
      "key": "function",
      "value": "get"
    },
    {
      "key": "table-name",
      "value": "inventory"
    },
    {
      "key": "table-filters",
      "value": "{\n    \"delete\" : 0\n}"
    },
    {
      "key": "settings",
      "value": {
        "single": false,
        "debug": false,
        "canReload": true,
        "forTable": false
      }
    }
  ]
}
```

### `render-template` — Render Template

**Kategori:** view · **Özet:** HTML + Handlebars + inline CSS render eder.

**Ne zaman:** Kart, liste, özel UI — data-source değişkenlerini göstermek için.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `display-name` | — | Editör etiketi |
| `content` | evet | Kök content alanı: HTML + <style> + Handlebars |

**Notlar:**
- content kök seviyede string; styles alanı boş kalır.
- Sadece Handlebars — Angular directive yasak.

**Örnek:**

```json
{
  "type": "render-template",
  "isContainer": false,
  "content": "<style>.card{padding:12px}</style><div>{{#each inventory}}<p>{{this.name}}</p>{{/each}}</div>",
  "properties": [
    {
      "key": "display-name",
      "value": "Liste"
    }
  ]
}
```

### `condition` — Koşul

**Kategori:** logic · **Özet:** Koşula göre children[] alt ağacını gösterir/gizler.

**Ne zaman:** Veriye bağlı koşullu UI parçaları.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `variable-name` | — | Bağlı değişken |
| `rule` | evet | Koşul ifadesi |

**Notlar:**
- children[] zorunlu container.

### `template` — Variable Template

**Kategori:** data · **Özet:** Handlebars çıktısını değişkene yazar; doğrudan render etmez.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `variable-name` | evet | Hedef değişken |
| `template` | evet | Handlebars şablon metni |

**Notlar:**
- Sonra başka render-template içinde {{variable-name}} ile kullanılır.

### `grid` — Grid

**Kategori:** layout · **Özet:** Çok kolonlu layout container.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `display-name` | — | Editör etiketi |
| `columns` | — | Kolon sayısı / düzen |

### `column` — Column

**Kategori:** layout · **Özet:** grid altında tek kolon.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `display-name` | — | Kolon adı |
| `width` | — | Genişlik |
| `content-direction` | — | İçerik yönü |

### `content-header` — İçerik Başlığı

**Kategori:** layout · **Özet:** Sayfa üst başlık bandı (metin + renkler).

| Property | Zorunlu | Açıklama |
|---|---|---|
| `text` | evet | Başlık metni (Handlebars destekli) |
| `bg-color` | — | Arka plan rengi |
| `text-color` | — | Metin rengi |

**Notlar:**
- Genelde column içinde sayfa başlığı için.

### `form-container` — Form

**Kategori:** form · **Özet:** Form alanları + submit container.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `submit-url` | — | POST hedef URL |
| `submit-type` | — | Submit tipi |

### `input-select` — Select Input

**Kategori:** form · **Özet:** Dropdown select.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `variable-name` | evet | Form alan adı |
| `label` | — | Etiket |
| `options-source` | — | Seçenek kaynağı / data-source bağlantısı |

### `input-text` — Text Input

**Kategori:** form · **Özet:** Tek satır metin.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `variable-name` | evet | Alan adı |
| `label` | — | Etiket |

### `input-number` — Number Input

**Kategori:** form · **Özet:** Sayısal input.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `variable-name` | evet | Alan adı |
| `min` | — | Minimum |
| `max` | — | Maksimum |

### `textarea` — Textarea

**Kategori:** form · **Özet:** Çok satırlı metin.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `variable-name` | evet | Alan adı |

### `button` — Button

**Kategori:** action · **Özet:** Submit, link veya custom aksiyon.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `label` | evet | Buton metni |
| `action` | — | Aksiyon tipi |
| `url` | — | Hedef URL (link/route) |

### `table` — Table

**Kategori:** view · **Özet:** Veri tablosu — forTable data-source ile.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `variable-name` | evet | forTable data-source değişkeni |

**Notlar:**
- Bağlı data-source settings.forTable = true olmalı.
- children: table-column blokları.

### `table-column` — Tablo Kolonu

**Kategori:** view · **Özet:** table altında tek kolon tanımı.

### `label` — Label / Hücre

**Kategori:** view · **Özet:** Tablo hücresi veya metin — Handlebars text ile.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `text` | evet | Hücre içeriği — {{input.name}} gibi |
| `action` | — | Tıklama aksiyonu |

**Notlar:**
- Tablo bağlamında input = satır kaydı.

### `chart` — Chart

**Kategori:** view · **Özet:** Grafik görünümü.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `variable-name` | evet | Veri değişkeni |
| `chart-type` | — | Grafik tipi |

### `statistic` — Statistic

**Kategori:** view · **Özet:** Tek metrik kartı.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `value` | — | Gösterilen değer (Handlebars) |

### `text` — Text

**Kategori:** view · **Özet:** Statik metin bloğu.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `content` | evet | Metin içeriği |

### `image` — Image

**Kategori:** view · **Özet:** Statik veya değişkenden görsel.

| Property | Zorunlu | Açıklama |
|---|---|---|
| `src` | evet | Görsel URL |
| `alt` | — | Alt metin |

