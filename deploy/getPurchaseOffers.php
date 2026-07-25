<?php
$data = $params['data'];
$post = $params['post'];

// İki nokta ile başlayıp biten alanların değerlerini ilgili koleksiyonlardan çekip dolduran fonksiyon
function populateReferencedFields($data) {
    global $db;
    
    if (!is_array($data)) {
        return $data;
    }
    
    foreach ($data as $key => $value) {
        // İki nokta ile başlayan alanları kontrol et (:users:demander, :inventory:, :suppliers: gibi)
        if (is_string($key) && preg_match('/^:.*:/', $key)) {
            // Koleksiyon adını alan adından türet
            // :users:demander -> users, :suppliers: -> suppliers, :inventory: -> inventory
            // Baştaki : karakterini kaldır, sonra ilk : karakterine kadar olan kısmı al
            $keyWithoutColon = ltrim($key, ':');
            $collectionName = explode(':', $keyWithoutColon)[0];
            
            // Null değerleri atla
            if ($value === null || $value === '') {
                continue;
            }
            
            // Değer bir array ise (birden fazla ID)
            if (is_array($value)) {
                $populatedValues = [];
                foreach ($value as $item) {
                    if (is_string($item) && !empty($item)) {
                        try {
                            $doc = $db->$collectionName->findOne(["_id" => new MongoDB\BSON\ObjectId($item)]);
                            if ($doc) {
                                $doc = (array) $doc;
                                $doc["_id"] = trim($doc['_id']);
                                $populatedValues[] = $doc;
                            } else {
                                $populatedValues[] = $item;
                            }
                        } catch (Exception $e) {
                            // Hata durumunda orijinal değeri koru
                            $populatedValues[] = $item;
                        }
                    } else {
                        $populatedValues[] = $item;
                    }
                }
                $data[$key] = $populatedValues;
            } 
            // Değer tek bir ID ise
            else if (is_string($value) && !empty($value)) {
                try {
                    $doc = $db->$collectionName->findOne(["_id" => new MongoDB\BSON\ObjectId($value)]);
                    if ($doc) {
                        $doc = (array) $doc;
                        $doc["_id"] = trim($doc['_id']);
                        $data[$key] = $doc;
                    }
                } catch (Exception $e) {
                    // Hata durumunda orijinal değeri koru
                }
            }
        } 
        // İç içe array'leri recursive olarak işle
        else if (is_array($value)) {
            $data[$key] = populateReferencedFields($value);
        }
    }
    
    return $data;
}

// Yeni satın alma akışı: teklif onayı geçiş döneminde hem "Teklif Toplanıyor" (1)
// hem "Teklifler Yüklendi" (2) aşamasında listelenir.
// (betaPurchase: 1 Teklif Toplanıyor -> uploadOffers -> 2 Teklifler Yüklendi -> offerConfirm -> 3)
// Onaylı teklif (offer status=1) varsa yine atlanır; bekleyen teklif yoksa gösterilmez.
$purchases = $db->purchases->find(
    [
        "status" => ['$in' => ["1", "2", 1, 2]],
        "delete" => ['$in' => ['0', 0, false, null]],
    ],
    [
        "sort" => ["datetime" => -1] // -1 = azalan sıralama (en yeni önce)
    ]
);

$results = [];

foreach ($purchases as $purchase) {
    $purchase = (array) $purchase;
    $purchaseId = trim($purchase['_id']);
    $purchase['_id'] = $purchaseId;
    
    // Purchase içindeki : ile başlayıp biten değerleri populate et
    $purchase = populateReferencedFields($purchase);
    
    // Bu purchase'a ait offer'ları getir (yeniden eskiye sıralı)
    $purchaseIdStr = (string)$purchaseId;
    $offers = $db->offers->find(
        [
            ":purchases:" => $purchaseIdStr
        ],
        [
            "sort" => ["datetime" => -1] // -1 = azalan sıralama (en yeni önce)
        ]
    );
    
    $purchaseOffers = [];
    $hasApprovedOffer = false;
    
    foreach ($offers as $offer) {
        $offer = (array) $offer;
        $offerId = trim($offer['_id']);
        $offer['_id'] = $offerId;
        
        // Offer içindeki : ile başlayıp biten değerleri populate et
        $offer = populateReferencedFields($offer);

        // Satır pill'leri için status string normalize
        if (!isset($offer['status']) || $offer['status'] === '' || $offer['status'] === null) {
            $offer['status'] = '0';
        } else {
            $offer['status'] = (string) $offer['status'];
        }
        
        // Status değeri 1 olan offer var mı kontrol et (onaylı teklif)
        if ($offer['status'] === '1') {
            $hasApprovedOffer = true;
        }
        
        $purchaseOffers[] = $offer;
    }
    
    // Eğer herhangi bir offer'ın status'ü 1 ise, bu purchase'ı listeleme
    if ($hasApprovedOffer) {
        continue;
    }

    // Onay ekranında bekleyen teklif yoksa gösterme
    $pendingOffers = array_values(array_filter($purchaseOffers, function ($o) {
        $st = $o['status'] ?? null;
        return $st === null || $st === '' || $st === '0' || $st === 0;
    }));
    if (count($pendingOffers) < 1) {
        continue;
    }
    
    // Purchase'a offer'ları ekle (karşılaştırma için tüm teklifler; status pill satırda)
    $purchase['offers'] = $purchaseOffers;
    $purchase['status'] = (string) ($purchase['status'] ?? '2');
    
    $results[] = $purchase;
}

$return['response'] = $results;
$return['info'] = responseInfo("true");
