# pageContents spinner / takılma — DÜZELTME

## Kök nedenler

1. **`get.php` tree≠none yolu:** `(array)` + `checkId` → `content` array yerine object → frontend spinner
2. **Ziyaret logunu get isteğine bağlamak:** `trackPageVisitEnter` senkron çalışırsa istek uzar / takılır; BSON serialize sorunları da tetiklenebilir

## Doğru kalıcı çözüm (local uygulandı)

### `get.php`
- `pageContents` her zaman düz yoldan döner (`tree=none` gibi)
- Yanıt `json_decode(json_encode(...), true)` ile **düz PHP array** olur → JSON’da `content` gerçek array

### `index.php`
- **Sayfa ziyaret logu YOK** — get route’una tekrar ekleme
- Loglama sadece `POST /custom/pageVisitLog` (`enter` / `exit` / `list`)

## Kontrol
1. Hard refresh
2. Network → `general/get` pageContents → 200, hızlı
3. `response[0].content` **array** olmalı
4. Spinner kapanmalı

## Ziyaret logu nasıl dolar?
Panel veya Postman: `POST /custom/pageVisitLog` + `action: enter` + `pageId`  
Otomatik get-hook **bilinçli olarak kapalı** (bu takılmayı tekrar üretmesin diye).
