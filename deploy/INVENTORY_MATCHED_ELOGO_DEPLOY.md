# inventoryMatchedElogoInvoices — Deploy

Envanter detayı (`arac-gerec-detayi`) Tedarik Faturaları sekmesi için hafif custom endpoint.

## Sunucuya kopyala

```bash
cp deploy/inventoryMatchedElogoInvoices.php \
  /path/to/HaustroBackend/Backend/src/routes/custom/inventoryMatchedElogoInvoices.php
```

veya bu repodaki kardeş klasöre:

```bash
cp deploy/inventoryMatchedElogoInvoices.php \
  ../HaustroBackend/Backend/src/routes/custom/inventoryMatchedElogoInvoices.php
```

## Panel

```bash
node scripts/patch-arac-gerec-detayi-elogo-invoices.js --push
```

Data-source: `custom` → `inventoryMatchedElogoInvoices`  
Filtre: `{ "inventory": "{{params._id}}" }`  
Detay linki: `/d/tedarik-faturasi-detay`

## Not

Önce PHP dosyasını backend’e koy; sonra panel push. Aksi halde custom route 404 verir.
