<?php
/**
 * Sayfa ziyaret logları — custom endpoint.
 *
 * POST /custom/pageVisitLog
 * post.action: enter | exit | list
 *
 * KRİTİK: Data-source allSourcesReady() zincirinde. HTTP hata / boş cevap
 * olursa panel render takılır. Bu dosya her durumda $return set eder.
 */

$return = array(
    'response' => array(array('ok' => true)),
    'count' => 1,
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
    $action = isset($payload['action']) ? trim((string) $payload['action']) : 'enter';

    $sessionUserId = isset($_SESSION['id']) ? trim((string) $_SESSION['id']) : '';

    if (!function_exists('trackPageVisitEnter')) {
        $return['response'] = array(array(
            'ok' => false,
            'error' => 'pageVisitHelper yüklenemedi.',
        ));
    } elseif ($sessionUserId === '' && ($action === 'enter' || $action === 'exit')) {
        // Custom route loginCheck bypass edilebiliyor; SESSION boşsa log yazılamaz
        $return['response'] = array(array(
            'ok' => false,
            'error' => 'Oturum yok. Panel cookie (PHPSESSID) ile giriş yapılı istek atın.',
            'hint' => 'Postman: browserdan login ol → cookie kopyala → withCredentials',
        ));
    } elseif ($action === 'enter') {
        $pageId = isset($payload['pageId']) ? trim((string) $payload['pageId']) : '';
        if ($pageId === '') {
            $return['response'] = array(array('ok' => false, 'error' => 'pageId zorunlu.'));
        } else {
            $result = trackPageVisitEnter($db, $pageId, array(
                'pageUrl' => isset($payload['pageUrl']) ? $payload['pageUrl'] : '',
                'pageTitle' => isset($payload['pageTitle']) ? $payload['pageTitle'] : '',
                'path' => isset($payload['path']) ? $payload['path'] : '',
            ));
            $return['response'] = array($result ? $result : array(
                'ok' => false,
                'error' => 'enter yazılamadı (debounce / noPerm / db).',
            ));
        }
    } elseif ($action === 'exit') {
        $visitId = isset($payload['visitId']) ? trim((string) $payload['visitId']) : null;
        $closed = trackPageVisitExit($db, $visitId ?: null);
        $return['response'] = array(array('closed' => $closed, 'ok' => true));
    } elseif ($action === 'list') {
        $userId = isset($payload['userId']) ? trim((string) $payload['userId']) : '';
        if ($userId === '') {
            $return['response'] = array(array('ok' => false, 'error' => 'userId zorunlu.'));
        } else {
            $days = isset($payload['days']) ? (int) $payload['days'] : 30;
            $limit = isset($payload['limit']) ? (int) $payload['limit'] : 100;
            $items = listUserPageVisits($db, $userId, array(
                'days' => $days,
                'limit' => $limit,
            ));
            $return['response'] = array(array(
                'ok' => true,
                'userId' => $userId,
                'days' => $days,
                'count' => count($items),
                'items' => $items,
            ));
        }
    } else {
        $return['response'] = array(array(
            'ok' => false,
            'error' => 'Geçersiz action: ' . $action,
        ));
    }
} catch (\Throwable $e) {
    $return['response'] = array(array(
        'ok' => false,
        'error' => $e->getMessage(),
    ));
    $return['count'] = 1;
    $return['info'] = responseInfo('true');
}
