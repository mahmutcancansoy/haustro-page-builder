<?php 

$data = $params['data'];
$post = $params['post'];

if ((int)($_SESSION['roleScore'] ?? 0) < 500) {
   $return['response'] = ['message' => 'Express transfer yetkiniz bulunmuyor'];
   $return['info'] = responseInfo('false');
   return;
}

if (!empty($post['dateTime']) && empty($post['datetime'])) {
   $post['datetime'] = $post['dateTime'];
}

// POST verilerini al
$newDepartments = $post[':departments:new'];
$oldDepartments = $post[':departments:old'];
$transferInventory = $post[':inventory:'];
$transferAmount = $post['amount'];
$transferDescription = $post['description'] ?? '';
$transferDateTime = $post['datetime'] ?? '';
$transferFiles = $post['file'] ?? [];

// Eski departmandan belirtilen miktarda stock bul
$availableStocks = $db->stock->find([
    ":inventory:" => $transferInventory,
    ":departments:" => $oldDepartments,
    "status" => "1",
    "delete" => 0,
    ":users:assigned" => ['$exists' => false]
], ['limit' => (int)$transferAmount, 'sort' => ["_id" => 1]]);

$stockCount = 0;
$transferredStocks = [];

foreach($availableStocks as $stock) {
    $transferredStocks[] = $stock['_id'];
    $stockCount++;
}

$requestedAmount = (int)$transferAmount;
if ($stockCount < $requestedAmount) {
   $return['response'] = [
      'message' => 'Yetersiz stok. Mevcut: ' . $stockCount . ', istenen: ' . $requestedAmount
   ];
   $return['info'] = responseInfo('false');
   return;
}

// Stockları yeni departmana transfer et
$transferResult = $db->stock->updateMany(
    [
        "_id" => ['$in' => $transferredStocks]
    ],
    [
        '$set' => [
            ":departments:" => $newDepartments,
            ":subDepartments:" => "",
            ":thirdDepartments:" => ""
        ]
    ]
);

// Transfer kaydı oluştur
$transferData = [
    ":inventory:" => $transferInventory,
    ":departments:old" => $oldDepartments,
    ":departments:new" => $newDepartments,
    ":subDepartments:old" => $post[':subDepartments:old'] ?? '',
    ":subDepartments:new" => '',
    ":thirdDepartments:old" => $post[':thirdDepartments:old'] ?? '',
    ":thirdDepartments:new" => '',
    "amount" => (int)$transferAmount,
    "description" => $transferDescription,
    "datetime" => $transferDateTime ?: date('Y-m-d\TH:i:s.v\Z'),
    "files" => $transferFiles ?: [],
    "status" => 1, // Tamamlandı
    "delete" => 0,
    "transferType" => "express",
    "transferredStocks" => $transferredStocks
];

$insertTransfer = $db->transfers->insertOne($transferData);

// Başarılı response döndür
$return['response'] = [
    "message" => "Transfer başarıyla tamamlandı",
    "transferredAmount" => $stockCount,
    "transferId" => (string)$insertTransfer->getInsertedId(),
    "fromDepartment" => $oldDepartments,
    "toDepartment" => $newDepartments
];
$return['info'] = responseInfo("true");


