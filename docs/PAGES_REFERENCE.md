# Pages – Kısa Referans (HaustroBackend)

Bu özet `HaustroBackend` panel sayfa sisteminden türetilmiştir.

## Koleksiyonlar

| Koleksiyon | Rol |
|------------|-----|
| `pages` | Sayfa meta (menü, url, parent) |
| `pageContents` | UI builder `content[]` ağacı |
| `pageOrders` | Menü sırası (`pageId` → `order`) |
| `roleLogs` | Kullanıcı → sayfa erişimi |
| `roleTypesLogs` | Rol → sayfa (add/edit) |

`pageId` her zaman **string** (`pages._id.toString()`).

## Yeni sayfa (backend)

`POST general/add` + `tableName=pages` → `roleLogs` admin'e otomatik.

## Kopyalama

`custom/duplicatePage.php` → `pages` + opsiyonel `pageContents` + admin `roleLogs`.

## Bu CLI

Aynı akışı Node ile uygular; canlı DB'ye bağlanır.

Detaylı rehber için HaustroBackend agent checkpoint'indeki `PAGES_COLLECTION_GUIDE` dokümanına bakın.
