<?php
/**
 * Şube listesi + son denetleme özeti (tarih, puan).
 * Panel data-source: custom → departmentsLastInspection
 *
 * Deploy: Backend/src/routes/custom/departmentsLastInspection.php
 */

$data = $params['data'] ?? [];
$filters = $data['filters'] ?? [];

$query = ['status' => 'active'];

if (!empty($filters['_id'])) {
    $deptId = trim((string) $filters['_id']);
    if ($deptId !== '') {
        try {
            $query['_id'] = new MongoDB\BSON\ObjectId($deptId);
        } catch (Exception $e) {
            $query['_id'] = $deptId;
        }
    }
}

$resultTextFromPoint = function ($point) {
    $p = (float) $point;
    if ($p < 2) return 'KÖTÜ';
    if ($p < 3) return 'VASAT';
    if ($p < 4) return 'GEÇER';
    if ($p < 4.5) return 'İYİ';
    return 'ÇOK İYİ';
};

$rows = [];
$cursor = $db->departments->find($query, ['sort' => ['label' => 1]]);

foreach ($cursor as $dept) {
    $deptId = trim((string) $dept['_id']);

    $lastInspection = $db->inspections->findOne(
        [
            ':departments:' => $deptId,
            'status'        => '1',
        ],
        [
            'sort' => ['datetime' => -1],
        ]
    );

    $last = null;
    if ($lastInspection) {
        $point = 0;
        $pointPercent = 0;
        if (isset($lastInspection['total']) && is_array($lastInspection['total'])) {
            $point = (float) ($lastInspection['total']['point'] ?? 0);
            $pointPercent = (float) ($lastInspection['total']['pointPercent'] ?? 0);
        }
        $last = [
            '_id'        => trim((string) $lastInspection['_id']),
            'datetime'   => $lastInspection['datetime'] ?? '',
            'total'      => [
                'point'        => number_format($point, 2),
                'pointPercent' => number_format($pointPercent, 2),
            ],
            'resultText' => $resultTextFromPoint($point),
        ];
    }

    $row = $dept;
    $row['_id'] = $deptId;
    $row['lastInspection'] = $last;

    $rows[] = $row;
}

$return['response'] = $rows;
$return['info']     = responseInfo('true');
