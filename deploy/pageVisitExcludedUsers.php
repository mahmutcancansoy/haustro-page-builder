<?php
/**
 * Sayfa ziyaret logu — hariç tutulan kullanıcılar.
 *
 * Deploy: Backend/src/routes/custom/pageVisitExcludedUsers.php
 *
 * post-params:
 *   Liste:  { "oprType": "list" }
 *   Ekle:   { "oprType": "add", "userId": "..." }  veya forms.select userId
 *   Sil:    { "oprType": "remove", "userId": "..." }
 */

$return = array(
    'response' => array(),
    'count' => 0,
    'info' => responseInfo('true'),
);

try {
    $helperPath = __DIR__ . '/../../resources/pageVisitHelper.php';
    if (!file_exists($helperPath)) {
        $helperPath = __DIR__ . '/../resources/pageVisitHelper.php';
    }
    if (file_exists($helperPath)) {
        require_once $helperPath;
    }

    if (!is_array($params)) {
        $params = array();
    }
    $post = (isset($params['post']) && is_array($params['post'])) ? $params['post'] : array();
    $data = (isset($params['data']) && is_array($params['data'])) ? $params['data'] : array();
    $payload = array_merge($data, $post);

    // Form alanlarından userId yakala (panel select bazen nested gelir)
    if (empty($payload['userId'])) {
        foreach (array('userId', ':users:', 'user', '_id') as $key) {
            if (!empty($payload[$key])) {
                $payload['userId'] = $payload[$key];
                break;
            }
        }
    }
    if (isset($payload['userId']) && is_array($payload['userId'])) {
        if (isset($payload['userId']['value'])) {
            $payload['userId'] = $payload['userId']['value'];
        } elseif (isset($payload['userId']['_id'])) {
            $payload['userId'] = $payload['userId']['_id'];
        } elseif (isset($payload['userId'][0])) {
            $first = $payload['userId'][0];
            $payload['userId'] = is_array($first)
                ? (isset($first['value']) ? $first['value'] : (isset($first['_id']) ? $first['_id'] : ''))
                : $first;
        } else {
            $payload['userId'] = '';
        }
    }

    $oprType = isset($payload['oprType']) ? trim((string) $payload['oprType']) : '';
    if ($oprType === '' && isset($payload['type'])) {
        $oprType = trim((string) $payload['type']);
    }
    if ($oprType === '' && isset($data['filters']['type'])) {
        $oprType = trim((string) $data['filters']['type']);
    }
    if ($oprType === '' && isset($data['filters']['oprType'])) {
        $oprType = trim((string) $data['filters']['oprType']);
    }
    if ($oprType === '') {
        $oprType = 'list';
    }

    if (!function_exists('listPageVisitExcludedUsers')) {
        $return['response'] = array(array(
            'ok' => false,
            'error' => 'pageVisitHelper yüklenemedi.',
        ));
        $return['count'] = 1;
    } elseif ($oprType === 'list' || $oprType === 'listRows') {
        $items = listPageVisitExcludedUsers($db);
        if ($oprType === 'listRows') {
            $return['response'] = $items;
            $return['count'] = count($items);
        } else {
            $return['response'] = array(array(
                'ok' => true,
                'count' => count($items),
                'excludedCount' => count($items),
                'hasExcluded' => count($items) > 0 ? '1' : '0',
                'items' => $items,
                'excludedUsers' => $items,
            ));
            $return['count'] = 1;
        }
    } elseif ($oprType === 'add') {
        $userId = isset($payload['userId']) ? trim((string) $payload['userId']) : '';
        $result = addPageVisitExcludedUser($db, $userId, array(
            'note' => isset($payload['note']) ? $payload['note'] : '',
        ));
        if (!empty($result['ok'])) {
            $items = listPageVisitExcludedUsers($db);
            $return['response'] = array(array(
                'ok' => true,
                'added' => true,
                'item' => isset($result['item']) ? $result['item'] : null,
                'count' => count($items),
                'excludedCount' => count($items),
                'hasExcluded' => count($items) > 0 ? '1' : '0',
                'items' => $items,
                'excludedUsers' => $items,
            ));
        } else {
            $return['response'] = array(array(
                'ok' => false,
                'error' => isset($result['error']) ? $result['error'] : 'Eklenemedi.',
            ));
        }
        $return['count'] = 1;
    } elseif ($oprType === 'remove') {
        $userId = isset($payload['userId']) ? trim((string) $payload['userId']) : '';
        $result = removePageVisitExcludedUser($db, $userId);
        if (!empty($result['ok'])) {
            $items = listPageVisitExcludedUsers($db);
            $return['response'] = array(array(
                'ok' => true,
                'removed' => true,
                'deleted' => isset($result['deleted']) ? $result['deleted'] : 0,
                'count' => count($items),
                'excludedCount' => count($items),
                'hasExcluded' => count($items) > 0 ? '1' : '0',
                'items' => $items,
                'excludedUsers' => $items,
            ));
        } else {
            $return['response'] = array(array(
                'ok' => false,
                'error' => isset($result['error']) ? $result['error'] : 'Silinemedi.',
            ));
        }
        $return['count'] = 1;
    } else {
        $return['response'] = array(array(
            'ok' => false,
            'error' => 'Geçersiz oprType: ' . $oprType,
        ));
        $return['count'] = 1;
    }
} catch (\Throwable $e) {
    $return['response'] = array(array(
        'ok' => false,
        'error' => $e->getMessage(),
    ));
    $return['count'] = 1;
    $return['info'] = responseInfo('true');
}
