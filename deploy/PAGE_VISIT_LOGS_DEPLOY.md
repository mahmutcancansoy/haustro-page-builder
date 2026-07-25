# Sayfa Ziyaret Logları — Deploy

Kullanıcıların hangi sayfalara girip çıktığını `pageVisitLogs` koleksiyonunda tutar.
Admin **Sistem Durumu** sayfasında kullanıcı satırındaki **Loglar** ile görüntülenir.

## Mimari

| Parça | Görev |
|-------|--------|
| `pageVisitHelper.php` | Giriş/çıkış yazma + listeleme yardımcıları |
| `pageVisitLog.php` | Custom API (`enter` / `exit` / `list`) — **tek yazma yolu** |
| `get.php` | `pageContents` düz array döner; **loglama yok** |
| `adminUserOverview.php` | Profil cevabına `pageVisits[]` + özet istatistikleri |

> **Önemli:** `pageContents` get isteğine ziyaret logu bağlama. Daha önce senkron hook panelde takılma / spinner üretti.

### Editör yolu (önerilen)

Her sayfada bir **data-source** (Custom → `pageVisitLog`) sayfa yüklenince `enter` atar.
Angular değişikliği yok; editörde “Sayfa ziyaret logu” olarak görünür.

> **Dikkat:** Bu data-source `allSourcesReady()` zincirine girer. Endpoint 500 verirse veya
> asılı kalırsa sayfa render’ı takılır. `pageVisitLog.php` soft-fail ile her zaman
> `login.status=true` + 200 dönmeli (deploy dosyası buna göre güncellendi).

```bash
# Tek sayfa
node scripts/patch-page-visit-datasource.js --url admin-sistem-durumu --push

# Tüm sayfalar
node scripts/patch-page-visit-datasource.js --all --push
```

Manuel (editör): Data Source ekle → Function: Custom → `pageVisitLog` → Post:
`{ "action": "enter", "pageId": "<bu sayfanın id>" }` · Can reload: kapalı · Single: açık

Login (`/auth/login`) tek başına `pageVisitLogs` yazmaz.

## Backend deploy

```bash
# Helper
cp deploy/pageVisitHelper.php \
  /path/to/HaustroBackend/Backend/src/resources/pageVisitHelper.php

# Custom endpoint
cp deploy/pageVisitLog.php \
  /path/to/HaustroBackend/Backend/src/routes/custom/pageVisitLog.php

# Admin özet (pageVisits alanları)
cp deploy/adminUserOverview.php \
  /path/to/HaustroBackend/Backend/src/routes/custom/adminUserOverview.php
```

### get.php (zorunlu) — index.php hook YOK

**`Backend/src/routes/general/get.php`**

`pageContents` için düz yol + plain array encode (local’de uygulanmış olmalı):

```php
if($treeMode == "none" || $tableName == "pageContents"){
   foreach($cursor as $each){
      if($tableName == "pageContents"){
         $each = json_decode(json_encode($each), true);
         ...
      }
```

**`index.php` içine ziyaret logu ekleme.** Snippet dosyası arşiv amaçlı; get path’ine bağlamak takılma üretir.
Log yazma: yalnızca `POST /custom/pageVisitLog`.

Index'ler: `node scripts/ensure-page-visit-indexes.js`

## Panel UI

```bash
# Şablonları güncelle (DB yazmaz)
node scripts/patch-admin-sistem-durumu-page-logs.js

# Canlı pageContents'e yaz
node scripts/patch-admin-sistem-durumu-page-logs.js --push
```

## Koleksiyon: `pageVisitLogs`

```js
{
  userId, userEmail, userName,
  pageId, pageUrl, pageTitle, path,
  enteredAt,   // "Y-m-d H:i:s"
  exitedAt,    // null | "Y-m-d H:i:s"
  durationSeconds,
  status       // "open" | "closed"
}
```

Önerilen index:

```js
db.pageVisitLogs.createIndex({ userId: 1, enteredAt: -1 })
db.pageVisitLogs.createIndex({ userId: 1, status: 1 })
db.pageVisitLogs.createIndex({ pageId: 1, enteredAt: -1 })
```

## Kullanım

1. Ana özet: **Sayfa ziyaretleri** kartı — hangi sayfalar kaç kez ziyaret edildi
2. Kullanıcı listesinde **Loglar** → profil + `#sayfa-loglari`
3. Profilde **Sayfa logları** tablosu: giriş / çıkış / süre
4. Açık ziyaretler yeşil rozet: "Hâlâ sayfada"
