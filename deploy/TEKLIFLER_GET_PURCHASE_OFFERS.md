# getPurchaseOffers — deploy notu

## Değişiklik
Yeni satın alma akışına göre teklif onay listesi artık **status = 2 (Teklifler Yüklendi)** kayıtlarını döner (eski: status = 1).

Dosya: `Backend/src/routes/custom/getPurchaseOffers.php`

## Deploy
Sunucuya kopyala:

```bash
# kaynak (bu repo)
deploy/getPurchaseOffers.php
# hedef
Backend/src/routes/custom/getPurchaseOffers.php
```

## Panel
`/d/onaylanan-teklifler` (başlık: Teklifler) — stil + status pill güncellemesi DB'ye yazıldı.
