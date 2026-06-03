# Haustro Page Builder

HaustroBackend projesinin kullandığı **canlı MongoDB** (`galliardDb`) üzerinde panel sayfalarını (`pages`, `pageContents`, `roleLogs`) programatik olarak oluşturmak için araç. Üç farklı arayüz:

1. **Web UI** (React + Vite) — `npm run web` → `http://localhost:5173`
2. **Interaktif shell** (REPL) — `npm run shell`
3. **Klasik CLI komutları** — `npm run create-inventory-cards -- ...`

Docker gerekmez; bağlantı doğrudan `HaustroBackend/.env` dosyasındaki `DATABASE_IP` ile yapılır.

## Kurulum

```bash
cd ~/Desktop/haustro-page-builder
npm install
cp .env.example .env
# .env içinde HAUSTRO_ENV_PATH zaten HaustroBackend'i gösteriyor
```

> **Not:** Sunucu MongoDB **3.4/3.6** olduğu için `mongodb@3.7.4` kullanılır (yeni sürücüler bağlanamaz).

## Web UI — React + Vite

Tam yönetim arayüzü: dinamik form ile sayfa oluşturma, listeleme, içerik güncelleme, kopyalama ve şablon export.

```bash
# İlk kurulum
npm install
npm --prefix web install

# Geliştirme (API:3000 + Vite:5173 paralel)
npm run web
# → http://localhost:5173
```

Vite proxy `/api/*` isteklerini `http://localhost:3000` arkasındaki Express'e iletir. Tek MongoDB bağlantısı paylaşılır.

### Production build

```bash
npm run web:build       # web/dist üretilir
npm run server          # → http://localhost:3000 (statik UI + API)
```

### Sekmeler

| Sekme | Ne yapar |
|---|---|
| **AI Brief** | Doğal dilde "ne istediğini" anlat → backend `briefs/<ts>-<slug>.md` markdown brief + kopyalanabilir prompt üretir. Prompt'u kullandığın AI aracına yapıştırırsın; template'ler yazıldıktan sonra `create-from-template` ile DB'ye atarsın. |
| **Componentler** | Editördeki tüm component tipleri (katalog). Tıkla → canlı DB taraması: toplam kullanım adedi, hangi sayfalarda geçtiği, her örnekte aldığı veri alanları (`table-name`, `variable-name`, filtreler, …). |
| **Listele** | Parent altındaki alt sayfaları kart grid'iyle gör, isimle ara. Bir karta tıklayınca modalda **Componentler**, **Önizleme**, **Ham JSON** sekmeleri. |

> Eski **Oluştur / İçerik Güncelle / Kopyala / Şablon Export** sekmeleri kaldırıldı. CLI shell (`npm run shell`) hâlâ tüm bu işlemleri destekler.

#### AI Brief akışı (özet)

1. **Form doldur**: sub/main → parent → label → (opsiyonel) URL slug → **Açıklama** (örn. "inventory'leri kategoriye göre accordion ile grupla, her satırda ad + adet badge'i göster").
2. **"Brief Oluştur"** → `briefs/2026-…-<slug>.md` yazılır, sağda kopyalanabilir prompt çıkar.
3. **Prompt'u Kopyala** → kullandığın AI aracına yapıştır (brief dosyasına `@briefs/...` referansı prompt içinde yer alır).
4. AI brief'i okur, `templates/<slug>-page.json` + `<slug>-content.json` dosyalarını yazar.
5. Çıktıyı incele, sonra UI'da gösterilen komutu çalıştır:
   ```bash
   npm run create-from-template -- -n <slug> -p <parentId> -t "<Label>" -u <url>
   ```
   Sayfa canlı `galliardDb`'ye düşer.

Tüm alias'lar (`mahmutcan`, `parent`, `cards`, `envanter`) UI'da otomatik tamamlanır. Yeni alias eklemek için shell modunda `alias myPage 6abc...` çalıştır; UI otomatik okur.

### API (Express)

`server/server.js` `pageService.js` üzerine kuruludur:

| Endpoint | Açıklama |
|---|---|
| `GET /api/health` | Sağlık kontrolü |
| `GET /api/aliases` | `~/.haustro-aliases.json` |
| `GET /api/templates` | `templates/` JSON dosyalarını listele |
| `GET /api/templates/:name` | Tek şablon (page + content) |
| `GET /api/pages?parent=<id>` | `listChildren` |
| `GET /api/pages/search?q=<name>` | `findPageByName` |
| `GET /api/pages/:id` | Sayfa + içerik özeti |
| `POST /api/pages` | `createPageFromTemplate` + `propertyOverrides` |
| `POST /api/pages/duplicate` | `duplicatePage` |
| `PUT /api/pages/:id/content` | `updatePageContentFromTemplate` |
| `POST /api/templates/export` | `exportTemplate` (DB → dosya) |
| `POST /api/brief` | Form girdisi → `briefs/<ts>-<slug>.md` + kopyalanabilir prompt |
| `POST /api/data-source/sample` | `tableName + filter` → ilk N kayıt (önizleme için) |
| `GET /api/components/catalog` | Statik component kataloğu (`data/component-catalog.json`) |
| `GET /api/components/usage` | Tüm `pageContents` taraması → component tipi bazında kullanım özeti |

### Component Katalog

Tüm block tipleri tek kaynakta tanımlı:

| Dosya | Rol |
|---|---|
| `data/component-catalog.json` | **Tek kaynak** — property şeması, örnek JSON, Handlebars kuralları, yaygın desenler |
| `docs/COMPONENTS_REFERENCE.md` | AI için okunabilir referans (`node scripts/generate-component-docs.js` ile üretilir) |
| `src/componentCatalog.js` | Backend + brief — JSON yükler |
| `web/src/lib/componentCatalog.js` | Web UI — aynı JSON (Vite alias `@haustro/catalog`) |

**Web:** Componentler sekmesi → her tip için kullanım rehberi, property tablosu, örnek JSON, canlı DB kullanımı.

**API:** `GET /api/components/catalog` (statik katalog), `GET /api/components/usage` (DB taraması).

Yeni block tipi: yalnızca `data/component-catalog.json` güncelle → `node scripts/generate-component-docs.js` → brief otomatik yeni tabloyu alır.

Tüm `id` veya `parent` parametreleri alias adıyla da gönderilebilir.

## Hızlı kullanım — interaktif shell (tavsiye edilen)

Her `npm run ...` çağrısı yeni bir MongoDB bağlantısı açtığı için ~600-900 ms gider. Bunun yerine **tek bağlantı, tek process** üzerinden ardışık komut çalıştıran shell:

```bash
npm run shell
```

```
MongoDB bağlandı (430ms)
Haustro Shell. 'help' yaz, 'exit' ile çık. Alias örneği: list mahmutcan
haustro> list mahmutcan
... (124ms)
haustro> find Render
... (62ms)
haustro> show cards
... (116ms)
haustro> content cards
... (57ms)
haustro> exit
```

İlk komuttan sonra her sorgu **~50-200 ms** (per-call modunda ~600-900 ms idi).

### Shell komutları (`help`)

| Komut | Açıklama |
|---|---|
| `list [parentId]` | Alt sayfaları listele |
| `find <name> [parentId]` | Sayfa ara |
| `show <pageId>` | Sayfa + içerik özeti |
| `content <pageId>` | `pageContents` blok özeti (type, variable-name) |
| `orders <parentId>` | Kardeş `pageOrders` listesi (sıralı) |
| `raw <coll> <id>` | Tek doc ham JSON (`pages`, `pageContents`, ...) |
| `query <coll> <jsonFilter> [limit]` | Ad-hoc Mongo find |
| `create-cards <parentId> <title> [url]` | Envanter kartları sayfası |
| `create-from-template <tpl> <parentId> <title> [url]` | Şablondan sayfa |
| `update-content <pageId> <templateName>` | pageContents'i şablondan güncelle |
| `duplicate <sourceId> <title> [url] [parentId]` | Sayfa kopyala |
| `export <pageId> [name]` | Şablon dışa aktar |
| `alias [name] [id]` | Alias listele / set et / sil (id boşsa siler) |
| `exit \| quit` | Çık |

### Aliases

Varsayılan kısayollar (Mongo `_id` yerine isim kullan):

| Alias | ID |
|---|---|
| `mahmutcan` / `parent` | `6802646ca01c352cdf350342` (mahmutcan test) |
| `cards` | `6a0f082613a466b79aa65c98` (Envanter Kartları) |
| `envanter` | `5fef676e4fe5a500117b0852` (Araç Gereç Envanteri şablonu) |

Yeni alias eklemek için:

```
haustro> alias myPage 6abc1234...
haustro> show myPage
```

Aliaslar `~/.haustro-aliases.json` içinde kalıcı, komut tarihçesi `~/.haustro-history` (ok tuşlarıyla geçmiş komutlara erişim).

## Tek tek komut çalıştırma (klasik)


### mahmutcan test altında envanter listesi sayfası

```bash
# Önce parent sayfayı bul
npm run find -- mahmutcan

# Alt sayfaları listele
npm run list -- -p 6802646ca01c352cdf350342

# Envanter listesi sayfası oluştur (şablon: Araç Gereç Envanteri)
npm run create-inventory-list -- \
  -p 6802646ca01c352cdf350342 \
  -t "Envanter Listesi Test" \
  -u envanter-listesi-test
```

### Envanter kartları sayfası (render-template)

`inventory` koleksiyonunu `data-source` ile çekip her envanteri **card** olarak listeleyen, tek bir `render-template` componentinden oluşan optimize sayfa:

```bash
npm run create-inventory-cards -- \
  -p 6802646ca01c352cdf350342 \
  -t "Envanter Kartları" \
  -u envanter-kartlari
```

Şablon dosyaları: `templates/inventory-cards-page.json` (sayfa metadata), `templates/inventory-cards-content.json` (data-source + render-template + styles).

### Şablondan sayfa oluştur (generic)

```bash
npm run create-from-template -- \
  -n inventory-cards \
  -p 6802646ca01c352cdf350342 \
  -t "Envanter Kartları" \
  -u envanter-kartlari
```

### Genel sayfa kopyalama

```bash
node src/cli.js duplicate \
  -s 5fef676e4fe5a500117b0852 \
  -p 6802646ca01c352cdf350342 \
  -t "Benim Envanter Sayfam" \
  -u benim-envanter-sayfam
```

## Komutlar

| Komut | Açıklama |
|--------|----------|
| `find <isim>` | İsme göre `pages` ara |
| `list -p <parentId>` | Alt sayfaları listele |
| `show <pageId>` | Sayfa + içerik özeti |
| `duplicate` | `duplicatePage.php` ile aynı mantık |
| `create-inventory-list` | Envanter listesi şablonundan yeni sayfa |
| `create-inventory-cards` | `render-template` ile envanter kartları sayfası |
| `create-from-template` | `templates/<name>-page.json` + `<name>-content.json` şablonundan sayfa |
| `export-template` | DB'den `templates/` JSON dışa aktar |

## Ne yapar?

1. **`pages`** — Kaynak sayfayı kopyalar, `title` / `url` / `parent` günceller, `createdAt` ekler.
2. **`pageContents`** — Kaynak içerik boş değilse aynı `content` ağacını yeni `pageId` ile ekler.
3. **`roleLogs`** — Admin kullanıcıya erişim verir (`ADMIN_USER_ID`, varsayılan Haustro admin).
4. **`pageOrders`** — Yeni sayfa için sıra kaydı ekler (yoksa).

## Referans

- Şablon dosyaları: `templates/sample-inventory-list-*.json` (Araç Gereç Envanteri sayfasından export).
- Backend mantığı: `HaustroBackend/Backend/src/routes/custom/duplicatePage.php`, `general/add.php`.
- Koleksiyon rehberi: `docs/PAGES_REFERENCE.md`

## Ortam değişkenleri

| Değişken | Açıklama |
|----------|----------|
| `HAUSTRO_ENV_PATH` | HaustroBackend `.env` yolu |
| `DATABASE_IP` | `mongodb://host:port` |
| `DB_NAME` | `galliardDb` |
| `DB_USER` / `DB_PASS` | Mongo auth |
| `ADMIN_USER_ID` | Yeni sayfalara `roleLogs` atanacak kullanıcı |

## Güvenlik

- `.env` ve şifreleri repoya commit etmeyin.
- `create-inventory-list` canlı veritabanına yazar; önce `find` / `list` ile parent id doğrulayın.
