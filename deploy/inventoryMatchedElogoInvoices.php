<?php
/**
 * Envantere eşleşmiş e-logo faturaları (hafif liste).
 * Panel data-source: custom → inventoryMatchedElogoInvoices
 *
 * Deploy:
 *   Backend/src/routes/custom/inventoryMatchedElogoInvoices.php
 *
 * Beklenen istek:
 * {
 *   "data": {
 *     "filters": { "inventory": "<inventoryId>" }
 *   }
 * }
 */

$data = $params['data'] ?? [];
$filters = $data['filters'] ?? [];

$inventoryId = '';
if (!empty($filters['inventory'])) {
    $inventoryId = trim((string) $filters['inventory']);
} elseif (!empty($filters['_id'])) {
    $inventoryId = trim((string) $filters['_id']);
}

$rows = [];

if ($inventoryId !== '') {
    // matchedItems._id panelde string tutuluyor; yine de her iki biçimi dene
    $idCandidates = [$inventoryId];
    try {
        $oid = new MongoDB\BSON\ObjectId($inventoryId);
        $idCandidates[] = $oid;
        $idCandidates[] = (string) $oid;
    } catch (Exception $e) {
        // string id yeterli
    }
    $idCandidates = array_values(array_unique($idCandidates, SORT_REGULAR));

    $cursor = $db->elogoDocuments->find(
        [
            'matchedItems._id' => ['$in' => $idCandidates],
        ],
        [
            'projection' => [
                'xml' => 0,
                'invoiceLines' => 0,
                'taxDetails' => 0,
                'hash' => 0,
                'matchedItems' => 0,
            ],
            'sort' => ['invoiceDate' => -1],
            'limit' => 100,
        ]
    );

    foreach ($cursor as $doc) {
        $doc = (array) $doc;
        $doc['_id'] = trim((string) $doc['_id']);

        $rows[] = [
            '_id' => $doc['_id'],
            'invoiceNumber' => $doc['invoiceNumber'] ?? '',
            'invoiceDate' => $doc['invoiceDate'] ?? '',
            'supplierName' => $doc['supplierName'] ?? '',
            'supplierVKN' => $doc['supplierVKN'] ?? '',
            'taxInclusiveAmount' => $doc['taxInclusiveAmount'] ?? '',
            'currencyCode' => $doc['currencyCode'] ?? '',
            'documentType' => $doc['documentType'] ?? '',
            'matchStatus' => $doc['matchStatus'] ?? null,
        ];
    }
}

$return['response'] = $rows;
if (function_exists('responseInfo')) {
    $return['info'] = responseInfo('true');
}
