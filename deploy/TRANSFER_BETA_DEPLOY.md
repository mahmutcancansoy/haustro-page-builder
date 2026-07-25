# Transfer Beta — Backend Deploy

`transfer-olustur-beta` ve `transfer-detay-beta` sayfaları aşağıdaki custom endpointleri kullanır.

## Deploy paketini hazırlama

```bash
npm run deploy:prepare-transfer-beta
```

Bu komut güncel backend kaynaklarını `deploy/` klasörüne kopyalar.

## Sunucuya kopyalanacak dosyalar

```bash
cp deploy/multiTransfer.php /path/to/HaustroBackend/Backend/src/routes/custom/multiTransfer.php
cp deploy/transferCreateBeta.php /path/to/HaustroBackend/Backend/src/routes/custom/transferCreateBeta.php
cp deploy/fastTransfer.php /path/to/HaustroBackend/Backend/src/routes/custom/fastTransfer.php
cp deploy/getNotifications.php /path/to/HaustroBackend/Backend/src/routes/custom/getNotifications.php
cp deploy/getWaitingReports.php /path/to/HaustroBackend/Backend/src/routes/custom/getWaitingReports.php
```

## Panel sayfaları

Panel içeriğini canlı DB'den senkronize et:

```bash
node scripts/sync-page-from-db.js --url transfer-olustur-beta
node scripts/sync-page-from-db.js --url transfer-detay-beta
```

Gerekli yamaları DB'ye uygula:

```bash
node scripts/patch-transfer-olustur-beta-a1-mode.js --push
node scripts/patch-transfer-detay-beta-kargo-flow.js --push
node scripts/patch-transfer-a0-links.js --push
```

## Beklenen durum geçişleri

- Kargo: `0 → 2 → 3 → 1`
  - onay → kargo çıkışı → varış şubesinde teslim
- Şoför: `0 → 2 → 3 → 4 → 1`
  - onay → şoför teslim aldı → şoför teslim etti → varış şubesi teslim aldı
- Ret: `0 → 5`
- Express: doğrudan `1`

## Deploy sonrası kontrol

```bash
php -l /path/to/HaustroBackend/Backend/src/routes/custom/multiTransfer.php
php -l /path/to/HaustroBackend/Backend/src/routes/custom/transferCreateBeta.php
php -l /path/to/HaustroBackend/Backend/src/routes/custom/fastTransfer.php
php -l /path/to/HaustroBackend/Backend/src/routes/custom/getNotifications.php
php -l /path/to/HaustroBackend/Backend/src/routes/custom/getWaitingReports.php
```

Ardından bir kargo ve bir şoför transferiyle durum geçişleri uçtan uca doğrulanmalıdır.
