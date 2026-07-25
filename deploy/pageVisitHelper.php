<?php
/**
 * Sayfa ziyaret logları — ortak yardımcılar.
 *
 * Koleksiyon: pageVisitLogs
 * Deploy: Backend/src/resources/pageVisitHelper.php
 *         (veya get.php / custom route içinden require)
 *
 * Akış:
 *  - Kullanıcı bir sayfanın pageContents'ini yüklediğinde trackPageVisitEnter çağrılır.
 *  - Aynı kullanıcının açık (status=open) ziyareti varsa exitedAt ile kapatılır.
 *  - Yeni sayfa için open kayıt açılır.
 */

if (!function_exists('pageVisitNow')) {
    function pageVisitNow()
    {
        return date('Y-m-d H:i:s');
    }
}

if (!function_exists('pageVisitExcludedUserIds')) {
    /**
     * Log / anlık listeden hariç tutulan userId listesi.
     * Koleksiyon: pageVisitExcludedUsers
     * Panelden pageVisitExcludedUsers custom endpoint ile yönetilir.
     *
     * @return string[]
     */
    function pageVisitExcludedUserIds($db, $resetCache = false)
    {
        static $cached = null;
        if ($resetCache) {
            $cached = null;
        }
        if ($cached !== null) {
            return $cached;
        }

        $cached = array();
        try {
            $cursor = $db->pageVisitExcludedUsers->find(
                array(),
                array('projection' => array('userId' => 1))
            );
            foreach ($cursor as $doc) {
                $uid = isset($doc['userId']) ? trim((string) $doc['userId']) : '';
                if ($uid !== '') {
                    $cached[$uid] = true;
                }
            }
        } catch (Exception $e) {
            $cached = array();
        }

        return array_keys($cached);
    }
}

if (!function_exists('isPageVisitUserExcluded')) {
    function isPageVisitUserExcluded($db, $userId)
    {
        $userId = trim((string) $userId);
        if ($userId === '') {
            return false;
        }
        $ids = pageVisitExcludedUserIds($db);
        return in_array($userId, $ids, true);
    }
}

if (!function_exists('listPageVisitExcludedUsers')) {
    /**
     * @return array
     */
    function listPageVisitExcludedUsers($db)
    {
        $items = array();
        try {
            $cursor = $db->pageVisitExcludedUsers->find(
                array(),
                array('sort' => array('createdAt' => -1, '_id' => -1))
            );
            foreach ($cursor as $doc) {
                $userId = isset($doc['userId']) ? trim((string) $doc['userId']) : '';
                if ($userId === '') {
                    continue;
                }
                $createdAt = isset($doc['createdAt']) ? (string) $doc['createdAt'] : '';
                $createdTs = $createdAt !== '' ? strtotime($createdAt) : false;
                $items[] = array(
                    '_id' => isset($doc['_id']) ? trim((string) $doc['_id']) : '',
                    'userId' => $userId,
                    'userName' => isset($doc['userName']) ? trim((string) $doc['userName']) : '',
                    'userEmail' => isset($doc['userEmail']) ? trim((string) $doc['userEmail']) : '',
                    'note' => isset($doc['note']) ? trim((string) $doc['note']) : '',
                    'createdAt' => $createdAt,
                    'createdAtLabel' => $createdTs !== false
                        ? date('d.m.Y H:i', $createdTs)
                        : ($createdAt !== '' ? $createdAt : '—'),
                    'createdBy' => isset($doc['createdBy']) ? trim((string) $doc['createdBy']) : '',
                    'createdByName' => isset($doc['createdByName'])
                        ? trim((string) $doc['createdByName'])
                        : '',
                );
            }
        } catch (Exception $e) {
            return array();
        }

        return $items;
    }
}

if (!function_exists('addPageVisitExcludedUser')) {
    /**
     * @return array{ok:bool,error?:string,item?:array}
     */
    function addPageVisitExcludedUser($db, $userId, $options = array())
    {
        $userId = trim((string) $userId);
        if ($userId === '') {
            return array('ok' => false, 'error' => 'userId zorunlu.');
        }
        if (isPageVisitUserExcluded($db, $userId)) {
            return array('ok' => false, 'error' => 'Kullanıcı zaten listede.');
        }

        $userName = isset($options['userName']) ? trim((string) $options['userName']) : '';
        $userEmail = isset($options['userEmail']) ? trim((string) $options['userEmail']) : '';
        $note = isset($options['note']) ? trim((string) $options['note']) : '';

        try {
            $user = $db->users->findOne(array('_id' => new MongoDB\BSON\ObjectId($userId)));
        } catch (Exception $e) {
            $user = null;
        }

        if ($user) {
            if ($userName === '') {
                $userName = trim(
                    (isset($user['name']) ? (string) $user['name'] : '')
                    . ' '
                    . (isset($user['surname']) ? (string) $user['surname'] : '')
                );
            }
            if ($userEmail === '' && isset($user['email'])) {
                $userEmail = trim((string) $user['email']);
            }
        }

        $createdBy = isset($_SESSION['id']) ? trim((string) $_SESSION['id']) : '';
        $createdByName = trim(
            (isset($_SESSION['name']) ? (string) $_SESSION['name'] : '')
            . ' '
            . (isset($_SESSION['surname']) ? (string) $_SESSION['surname'] : '')
        );

        $doc = array(
            'userId' => $userId,
            'userName' => $userName,
            'userEmail' => $userEmail,
            'note' => $note,
            'createdAt' => pageVisitNow(),
            'createdBy' => $createdBy,
            'createdByName' => $createdByName,
        );

        try {
            $insert = $db->pageVisitExcludedUsers->insertOne($doc);
            if (function_exists('pageVisitCloseOpenVisits')) {
                pageVisitCloseOpenVisits($db, $userId, pageVisitNow(), null);
            }
            pageVisitExcludedUserIds($db, true);
            $doc['_id'] = $insert->getInsertedId()
                ? trim((string) $insert->getInsertedId())
                : '';
            return array('ok' => true, 'item' => $doc);
        } catch (Exception $e) {
            return array('ok' => false, 'error' => $e->getMessage());
        }
    }
}

if (!function_exists('removePageVisitExcludedUser')) {
    /**
     * @return array{ok:bool,error?:string,deleted?:int}
     */
    function removePageVisitExcludedUser($db, $userId)
    {
        $userId = trim((string) $userId);
        if ($userId === '') {
            return array('ok' => false, 'error' => 'userId zorunlu.');
        }
        try {
            $r = $db->pageVisitExcludedUsers->deleteMany(array('userId' => $userId));
            pageVisitExcludedUserIds($db, true);
            return array(
                'ok' => true,
                'deleted' => method_exists($r, 'getDeletedCount') ? (int) $r->getDeletedCount() : 1,
            );
        } catch (Exception $e) {
            return array('ok' => false, 'error' => $e->getMessage());
        }
    }
}

if (!function_exists('pageVisitToScalar')) {
    /**
     * Mongo BSON / array / object değerlerini güvenli stringe çevirir.
     * PHP 7.2: (string) BSONDocument → Recoverable fatal → boş 200 body.
     */
    function pageVisitToScalar($value)
    {
        if ($value === null || $value === false) {
            return '';
        }
        if (is_string($value) || is_int($value) || is_float($value) || is_bool($value)) {
            return trim((string) $value);
        }
        // BSONArray / BSONDocument / array — scalar değil, atla
        return '';
    }
}

if (!function_exists('pageVisitResolveMeta')) {
    /**
     * pages koleksiyonundan display-name / url okur.
     */
    function pageVisitResolveMeta($db, $pageId)
    {
        $title = '';
        $url = '';
        if ($pageId === '') {
            return array('title' => '', 'url' => '');
        }

        try {
            $page = $db->pages->findOne(array(
                '_id' => new MongoDB\BSON\ObjectId($pageId),
            ));
        } catch (Exception $e) {
            return array('title' => '', 'url' => '');
        }

        if (!$page || !isset($page['properties'])) {
            return array('title' => '', 'url' => '');
        }

        foreach ($page['properties'] as $prop) {
            // BSONDocument → dizi; iç value hâlâ BSON olabilir
            if (is_object($prop) && method_exists($prop, 'getArrayCopy')) {
                $prop = $prop->getArrayCopy();
            } else {
                $prop = (array) $prop;
            }
            $key = pageVisitToScalar(isset($prop['key']) ? $prop['key'] : '');
            $value = pageVisitToScalar(isset($prop['value']) ? $prop['value'] : '');
            if ($value === '') {
                continue;
            }
            if (($key === 'display-name' || $key === 'label') && $title === '') {
                $title = $value;
            }
            if ($key === 'url') {
                $url = $value;
            }
        }

        return array(
            'title' => $title,
            'url' => $url,
        );
    }
}

if (!function_exists('pageVisitCloseOpenVisits')) {
    /**
     * Kullanıcının açık ziyaretlerini kapatır.
     */
    function pageVisitCloseOpenVisits($db, $userId, $exitedAt = null, $excludePageId = null)
    {
        if ($userId === '') {
            return 0;
        }
        if ($exitedAt === null) {
            $exitedAt = pageVisitNow();
        }

        $filter = array(
            'userId' => (string) $userId,
            'status' => 'open',
        );
        if ($excludePageId !== null && $excludePageId !== '') {
            $filter['pageId'] = array('$ne' => (string) $excludePageId);
        }

        $closed = 0;
        try {
            $cursor = $db->pageVisitLogs->find($filter);
            foreach ($cursor as $doc) {
                // BSONDocument'i (array) ile cast etme — key'ler bozulur
                $enteredAt = isset($doc['enteredAt']) ? (string) $doc['enteredAt'] : '';
                $durationSeconds = null;
                $enteredTs = $enteredAt !== '' ? strtotime($enteredAt) : false;
                $exitedTs = strtotime($exitedAt);
                if ($enteredTs !== false && $exitedTs !== false && $exitedTs >= $enteredTs) {
                    $durationSeconds = (int) ($exitedTs - $enteredTs);
                }

                if (!isset($doc['_id'])) {
                    continue;
                }

                $db->pageVisitLogs->updateOne(
                    array('_id' => $doc['_id']),
                    array('$set' => array(
                        'exitedAt' => $exitedAt,
                        'durationSeconds' => $durationSeconds,
                        'status' => 'closed',
                    ))
                );
                $closed++;
            }
        } catch (Exception $e) {
            return $closed;
        }

        return $closed;
    }
}

if (!function_exists('trackPageVisitEnter')) {
    /**
     * Sayfa girişini kaydeder. Önceki açık ziyaretleri kapatır.
     * Aynı sayfada zaten open kayıt varsa (refresh) yeni kayıt açmaz.
     *
     * @return array|null Oluşturulan veya mevcut açık kayıt özeti
     */
    function trackPageVisitEnter($db, $pageId, $extra = array())
    {
        $userId = isset($_SESSION['id']) ? trim((string) $_SESSION['id']) : '';
        if ($userId === '' || $pageId === '') {
            return null;
        }

        // Panelden hariç tutulan kullanıcılar loglanmaz
        if (isPageVisitUserExcluded($db, $userId)) {
            return array(
                'ok' => true,
                'skipped' => true,
                'reason' => 'excluded',
            );
        }

        // Yetkisiz sayfa şablonunu loglama
        global $defs;
        if (isset($defs['noPermisionPage']) && (string) $pageId === (string) $defs['noPermisionPage']) {
            return null;
        }

        $now = pageVisitNow();
        $meta = pageVisitResolveMeta($db, $pageId);
        $pageTitle = $meta['title'] !== '' ? $meta['title'] : (string) $pageId;
        $pageUrl = $meta['url'];

        if (isset($extra['pageTitle']) && trim((string) $extra['pageTitle']) !== '') {
            $pageTitle = trim((string) $extra['pageTitle']);
        }
        if (isset($extra['pageUrl']) && trim((string) $extra['pageUrl']) !== '') {
            $pageUrl = trim((string) $extra['pageUrl']);
        }

        $path = isset($extra['path']) ? trim((string) $extra['path']) : '';
        if ($path === '' && $pageUrl !== '') {
            $path = '/d/' . ltrim($pageUrl, '/');
        }

        try {
            // Refresh / aynı sayfa tekrar yükleme: open kayıt varsa yeni açma
            $openSame = $db->pageVisitLogs->findOne(
                array(
                    'userId' => $userId,
                    'pageId' => (string) $pageId,
                    'status' => 'open',
                ),
                array('sort' => array('enteredAt' => -1, '_id' => -1))
            );
            if ($openSame && isset($openSame['_id'])) {
                return array(
                    '_id' => trim((string) $openSame['_id']),
                    'debounced' => true,
                    'refreshed' => true,
                );
            }

            // Kısa debounce: open kapanıp hemen aynı sayfa tekrar gelirse çift kayıt olmasın
            $recent = $db->pageVisitLogs->findOne(
                array(
                    'userId' => $userId,
                    'pageId' => (string) $pageId,
                    'enteredAt' => array(
                        '$gte' => date('Y-m-d H:i:s', time() - 3),
                    ),
                ),
                array('sort' => array('enteredAt' => -1, '_id' => -1))
            );
            if ($recent && isset($recent['_id'])) {
                return array(
                    '_id' => trim((string) $recent['_id']),
                    'debounced' => true,
                    'refreshed' => false,
                );
            }

            // Diğer sayfalardaki open ziyaretleri kapat; mevcut pageId'yi koru
            pageVisitCloseOpenVisits($db, $userId, $now, (string) $pageId);

            $doc = array(
                'userId' => $userId,
                'userEmail' => isset($_SESSION['email']) ? (string) $_SESSION['email'] : '',
                'userName' => trim(
                    (isset($_SESSION['name']) ? (string) $_SESSION['name'] : '')
                    . ' '
                    . (isset($_SESSION['surname']) ? (string) $_SESSION['surname'] : '')
                ),
                'pageId' => (string) $pageId,
                'pageUrl' => $pageUrl,
                'pageTitle' => $pageTitle,
                'path' => $path,
                'enteredAt' => $now,
                'exitedAt' => null,
                'durationSeconds' => null,
                'status' => 'open',
            );

            $insert = $db->pageVisitLogs->insertOne($doc);
            $insertedId = $insert->getInsertedId();
            return array(
                '_id' => $insertedId ? trim((string) $insertedId) : '',
                'debounced' => false,
                'refreshed' => false,
            );
        } catch (Exception $e) {
            return null;
        } catch (\Throwable $e) {
            return null;
        }
    }
}

if (!function_exists('trackPageVisitExit')) {
    /**
     * Belirli bir ziyareti veya kullanıcının tüm açık ziyaretlerini kapatır.
     */
    function trackPageVisitExit($db, $visitId = null)
    {
        $userId = isset($_SESSION['id']) ? trim((string) $_SESSION['id']) : '';
        if ($userId === '') {
            return 0;
        }

        $now = pageVisitNow();

        if ($visitId) {
            try {
                $doc = $db->pageVisitLogs->findOne(array(
                    '_id' => new MongoDB\BSON\ObjectId($visitId),
                    'userId' => $userId,
                    'status' => 'open',
                ));
            } catch (Exception $e) {
                return 0;
            }
            if (!$doc) {
                return 0;
            }
            $enteredAt = isset($doc['enteredAt']) ? (string) $doc['enteredAt'] : '';
            $durationSeconds = null;
            $enteredTs = $enteredAt !== '' ? strtotime($enteredAt) : false;
            $exitedTs = strtotime($now);
            if ($enteredTs !== false && $exitedTs !== false && $exitedTs >= $enteredTs) {
                $durationSeconds = (int) ($exitedTs - $enteredTs);
            }
            $db->pageVisitLogs->updateOne(
                array('_id' => $doc['_id']),
                array('$set' => array(
                    'exitedAt' => $now,
                    'durationSeconds' => $durationSeconds,
                    'status' => 'closed',
                ))
            );
            return 1;
        }

        return pageVisitCloseOpenVisits($db, $userId, $now, null);
    }
}

if (!function_exists('formatPageVisitDuration')) {
    function formatPageVisitDuration($seconds)
    {
        if ($seconds === null || $seconds === '') {
            return '—';
        }
        $seconds = (int) $seconds;
        if ($seconds < 0) {
            return '—';
        }
        if ($seconds < 60) {
            return $seconds . ' sn';
        }
        $minutes = (int) floor($seconds / 60);
        $remain = $seconds % 60;
        if ($minutes < 60) {
            return $remain > 0
                ? $minutes . ' dk ' . $remain . ' sn'
                : $minutes . ' dk';
        }
        $hours = (int) floor($minutes / 60);
        $mins = $minutes % 60;
        return $mins > 0
            ? $hours . ' sa ' . $mins . ' dk'
            : $hours . ' sa';
    }
}

if (!function_exists('listUserPageVisits')) {
    /**
     * Kullanıcının sayfa ziyaret geçmişini döner (yeni → eski).
     */
    function listUserPageVisits($db, $userId, $options = array())
    {
        $limit = isset($options['limit']) ? (int) $options['limit'] : 100;
        if ($limit < 1) {
            $limit = 100;
        }
        if ($limit > 500) {
            $limit = 500;
        }

        $days = isset($options['days']) ? (int) $options['days'] : 30;
        if ($days < 1) {
            $days = 30;
        }

        $since = date('Y-m-d', strtotime('-' . $days . ' days')) . ' 00:00:00';
        $items = array();

        try {
            $cursor = $db->pageVisitLogs->find(
                array(
                    'userId' => (string) $userId,
                    'enteredAt' => array('$gte' => $since),
                ),
                array(
                    'sort' => array('enteredAt' => -1, '_id' => -1),
                    'limit' => $limit,
                )
            );

            foreach ($cursor as $doc) {
                $enteredAt = isset($doc['enteredAt']) ? (string) $doc['enteredAt'] : '';
                $exitedAt = isset($doc['exitedAt']) && $doc['exitedAt'] !== null
                    ? (string) $doc['exitedAt']
                    : '';
                $durationSeconds = isset($doc['durationSeconds'])
                    ? $doc['durationSeconds']
                    : null;
                $status = isset($doc['status']) ? (string) $doc['status'] : 'closed';
                $pageUrl = isset($doc['pageUrl']) ? (string) $doc['pageUrl'] : '';
                $path = isset($doc['path']) ? (string) $doc['path'] : '';
                if ($path === '' && $pageUrl !== '') {
                    $path = '/d/' . ltrim($pageUrl, '/');
                }

                $enteredTs = $enteredAt !== '' ? strtotime($enteredAt) : false;
                $exitedTs = $exitedAt !== '' ? strtotime($exitedAt) : false;

                // Hâlâ açıksa süreyi şimdiye kadar hesapla
                if ($status === 'open' && $enteredTs !== false) {
                    $durationSeconds = time() - $enteredTs;
                    if ($durationSeconds < 0) {
                        $durationSeconds = 0;
                    }
                }

                $items[] = array(
                    '_id' => isset($doc['_id']) ? trim((string) $doc['_id']) : '',
                    'pageId' => isset($doc['pageId']) ? (string) $doc['pageId'] : '',
                    'pageUrl' => $pageUrl,
                    'pageTitle' => isset($doc['pageTitle']) && $doc['pageTitle'] !== ''
                        ? (string) $doc['pageTitle']
                        : ($pageUrl !== '' ? $pageUrl : 'Bilinmeyen sayfa'),
                    'path' => $path !== '' ? $path : '—',
                    'enteredAt' => $enteredAt,
                    'enteredAtLabel' => $enteredTs !== false
                        ? date('d.m.Y H:i:s', $enteredTs)
                        : ($enteredAt !== '' ? $enteredAt : '—'),
                    'exitedAt' => $exitedAt,
                    'exitedAtLabel' => $status === 'open'
                        ? 'Hâlâ sayfada'
                        : ($exitedTs !== false
                            ? date('d.m.Y H:i:s', $exitedTs)
                            : ($exitedAt !== '' ? $exitedAt : '—')),
                    'durationSeconds' => $durationSeconds,
                    'durationLabel' => formatPageVisitDuration($durationSeconds),
                    'status' => $status,
                    'isOpen' => $status === 'open' ? '1' : '0',
                );
            }
        } catch (Exception $e) {
            return array();
        }

        return $items;
    }
}

if (!function_exists('listPageVisitStats')) {
    /**
     * Sayfa bazlı ziyaret özeti (en çok ziyaret edilenler önce).
     * MongoDB 3.4 uyumlu aggregate.
     *
     * @return array{days:int,totalVisits:int,distinctPages:int,topPageTitle:string,topPageCount:int,pages:array}
     */
    function listPageVisitStats($db, $options = array())
    {
        $days = isset($options['days']) ? (int) $options['days'] : 30;
        if ($days < 1) {
            $days = 30;
        }
        $limit = isset($options['limit']) ? (int) $options['limit'] : 40;
        if ($limit < 1) {
            $limit = 40;
        }
        if ($limit > 100) {
            $limit = 100;
        }

        $empty = array(
            'days' => $days,
            'totalVisits' => 0,
            'distinctPages' => 0,
            'topPageTitle' => '-',
            'topPageCount' => 0,
            'pages' => array(),
        );

        $since = date('Y-m-d', strtotime('-' . $days . ' days')) . ' 00:00:00';
        $pages = array();
        $totalVisits = 0;

        try {
            $cursor = $db->pageVisitLogs->aggregate(array(
                array('$match' => array(
                    'enteredAt' => array('$gte' => $since),
                )),
                array('$group' => array(
                    '_id' => '$pageId',
                    'count' => array('$sum' => 1),
                    'uniqueUsers' => array('$addToSet' => '$userId'),
                    'pageTitle' => array('$last' => '$pageTitle'),
                    'pageUrl' => array('$last' => '$pageUrl'),
                    'lastVisit' => array('$max' => '$enteredAt'),
                )),
                array('$sort' => array('count' => -1)),
            ));

            foreach ($cursor as $row) {
                $row = is_array($row) ? $row : json_decode(json_encode($row), true);
                $pageId = isset($row['_id']) ? (string) $row['_id'] : '';
                $count = isset($row['count']) ? (int) $row['count'] : 0;
                $totalVisits += $count;

                $uniqueUsers = isset($row['uniqueUsers']) && is_array($row['uniqueUsers'])
                    ? $row['uniqueUsers']
                    : array();
                $pageUrl = isset($row['pageUrl']) ? trim((string) $row['pageUrl']) : '';
                $pageTitle = isset($row['pageTitle']) ? trim((string) $row['pageTitle']) : '';
                if ($pageTitle === '') {
                    $pageTitle = $pageUrl !== '' ? $pageUrl : ($pageId !== '' ? $pageId : 'Bilinmeyen sayfa');
                }
                $path = $pageUrl !== '' ? '/d/' . ltrim($pageUrl, '/') : '—';
                $lastVisit = isset($row['lastVisit']) ? (string) $row['lastVisit'] : '';
                $lastTs = $lastVisit !== '' ? strtotime($lastVisit) : false;

                $pages[] = array(
                    'pageId' => $pageId,
                    'pageTitle' => $pageTitle,
                    'pageUrl' => $pageUrl,
                    'path' => $path,
                    'count' => $count,
                    'uniqueUserCount' => count($uniqueUsers),
                    'lastVisit' => $lastVisit,
                    'lastVisitLabel' => $lastTs !== false
                        ? date('d.m.Y H:i', $lastTs)
                        : ($lastVisit !== '' ? $lastVisit : '—'),
                );
            }
        } catch (Exception $e) {
            return $empty;
        }

        $distinctPages = count($pages);
        $maxCount = 0;
        if ($distinctPages > 0) {
            $maxCount = (int) $pages[0]['count'];
        }
        if ($maxCount < 1) {
            $maxCount = 1;
        }

        $rank = 0;
        foreach ($pages as &$page) {
            $rank++;
            $page['rank'] = $rank;
            $page['percent'] = round(($page['count'] / $maxCount) * 100, 1);
            $page['isTop'] = $rank === 1 ? '1' : '0';
        }
        unset($page);

        $topPages = array_slice($pages, 0, $limit);

        return array(
            'days' => $days,
            'totalVisits' => $totalVisits,
            'distinctPages' => $distinctPages,
            'topPageTitle' => isset($pages[0]['pageTitle']) ? $pages[0]['pageTitle'] : '-',
            'topPageCount' => isset($pages[0]['count']) ? (int) $pages[0]['count'] : 0,
            'pages' => $topPages,
        );
    }
}

if (!function_exists('listPageVisitDetailByPage')) {
    /**
     * Belirli bir sayfanın ziyaret detayı: kullanıcı özeti + son kayıtlar.
     * MongoDB 3.4 uyumlu.
     *
     * @return array
     */
    function listPageVisitDetailByPage($db, $pageId, $options = array())
    {
        $pageId = trim((string) $pageId);
        $days = isset($options['days']) ? (int) $options['days'] : 30;
        if ($days < 1) {
            $days = 30;
        }
        $visitLimit = isset($options['visitLimit']) ? (int) $options['visitLimit'] : 100;
        if ($visitLimit < 1) {
            $visitLimit = 100;
        }
        if ($visitLimit > 300) {
            $visitLimit = 300;
        }

        $meta = pageVisitResolveMeta($db, $pageId);
        $pageTitle = $meta['title'] !== '' ? $meta['title'] : ($pageId !== '' ? $pageId : 'Bilinmeyen sayfa');
        $pageUrl = $meta['url'];
        $path = $pageUrl !== '' ? '/d/' . ltrim($pageUrl, '/') : '—';

        $empty = array(
            'view' => 'page-visit',
            '_id' => 'page-visit-' . ($pageId !== '' ? $pageId : 'unknown'),
            'pageId' => $pageId,
            'pageTitle' => $pageTitle,
            'pageUrl' => $pageUrl,
            'path' => $path,
            'days' => $days,
            'totalVisits' => 0,
            'uniqueUserCount' => 0,
            'users' => array(),
            'visits' => array(),
            'hasUsers' => '0',
            'hasVisits' => '0',
        );

        if ($pageId === '') {
            $empty['error'] = 'pageId zorunlu.';
            return $empty;
        }

        $since = date('Y-m-d', strtotime('-' . $days . ' days')) . ' 00:00:00';
        $users = array();
        $visits = array();
        $totalVisits = 0;

        try {
            $agg = $db->pageVisitLogs->aggregate(array(
                array('$match' => array(
                    'pageId' => $pageId,
                    'enteredAt' => array('$gte' => $since),
                )),
                array('$group' => array(
                    '_id' => '$userId',
                    'visitCount' => array('$sum' => 1),
                    'lastVisit' => array('$max' => '$enteredAt'),
                    'userName' => array('$last' => '$userName'),
                    'userEmail' => array('$last' => '$userEmail'),
                    'pageTitle' => array('$last' => '$pageTitle'),
                    'pageUrl' => array('$last' => '$pageUrl'),
                    'durationSum' => array('$sum' => '$durationSeconds'),
                )),
                array('$sort' => array('visitCount' => -1, 'lastVisit' => -1)),
            ));

            foreach ($agg as $row) {
                $row = is_array($row) ? $row : json_decode(json_encode($row), true);
                $userId = isset($row['_id']) ? trim((string) $row['_id']) : '';
                if ($userId === '') {
                    continue;
                }
                $visitCount = isset($row['visitCount']) ? (int) $row['visitCount'] : 0;
                $totalVisits += $visitCount;
                $lastVisit = isset($row['lastVisit']) ? (string) $row['lastVisit'] : '';
                $lastTs = $lastVisit !== '' ? strtotime($lastVisit) : false;
                $userName = isset($row['userName']) ? trim((string) $row['userName']) : '';
                $userEmail = isset($row['userEmail']) ? trim((string) $row['userEmail']) : '';
                if ($userName === '') {
                    $userName = $userEmail !== '' ? $userEmail : $userId;
                }
                $durationSum = isset($row['durationSum']) ? (int) $row['durationSum'] : 0;
                $avgDuration = $visitCount > 0 ? (int) round($durationSum / $visitCount) : null;

                if (isset($row['pageTitle']) && trim((string) $row['pageTitle']) !== '') {
                    $pageTitle = trim((string) $row['pageTitle']);
                }
                if (isset($row['pageUrl']) && trim((string) $row['pageUrl']) !== '') {
                    $pageUrl = trim((string) $row['pageUrl']);
                    $path = '/d/' . ltrim($pageUrl, '/');
                }

                $users[] = array(
                    'userId' => $userId,
                    'fullName' => $userName,
                    'email' => $userEmail !== '' ? $userEmail : '—',
                    'visitCount' => $visitCount,
                    'lastVisit' => $lastVisit,
                    'lastVisitLabel' => $lastTs !== false
                        ? date('d.m.Y H:i', $lastTs)
                        : ($lastVisit !== '' ? $lastVisit : '—'),
                    'avgDurationSeconds' => $avgDuration,
                    'avgDurationLabel' => formatPageVisitDuration($avgDuration),
                    'profileUrl' => '/d/admin-sistem-durumu?_id=' . rawurlencode($userId),
                    'logsUrl' => '/d/admin-sistem-durumu?_id=' . rawurlencode($userId) . '&view=logs#sayfa-loglari',
                );
            }

            $cursor = $db->pageVisitLogs->find(
                array(
                    'pageId' => $pageId,
                    'enteredAt' => array('$gte' => $since),
                ),
                array(
                    'sort' => array('enteredAt' => -1, '_id' => -1),
                    'limit' => $visitLimit,
                )
            );

            foreach ($cursor as $doc) {
                $enteredAt = isset($doc['enteredAt']) ? (string) $doc['enteredAt'] : '';
                $exitedAt = isset($doc['exitedAt']) && $doc['exitedAt'] !== null
                    ? (string) $doc['exitedAt']
                    : '';
                $durationSeconds = isset($doc['durationSeconds']) ? $doc['durationSeconds'] : null;
                $status = isset($doc['status']) ? (string) $doc['status'] : 'closed';
                $enteredTs = $enteredAt !== '' ? strtotime($enteredAt) : false;
                $exitedTs = $exitedAt !== '' ? strtotime($exitedAt) : false;

                if ($status === 'open' && $enteredTs !== false) {
                    $durationSeconds = time() - $enteredTs;
                    if ($durationSeconds < 0) {
                        $durationSeconds = 0;
                    }
                }

                $uid = isset($doc['userId']) ? trim((string) $doc['userId']) : '';
                $uname = isset($doc['userName']) ? trim((string) $doc['userName']) : '';
                $uemail = isset($doc['userEmail']) ? trim((string) $doc['userEmail']) : '';
                if ($uname === '') {
                    $uname = $uemail !== '' ? $uemail : ($uid !== '' ? $uid : 'Bilinmeyen');
                }

                $visits[] = array(
                    '_id' => isset($doc['_id']) ? trim((string) $doc['_id']) : '',
                    'userId' => $uid,
                    'fullName' => $uname,
                    'email' => $uemail !== '' ? $uemail : '—',
                    'enteredAt' => $enteredAt,
                    'enteredAtLabel' => $enteredTs !== false
                        ? date('d.m.Y H:i:s', $enteredTs)
                        : ($enteredAt !== '' ? $enteredAt : '—'),
                    'exitedAt' => $exitedAt,
                    'exitedAtLabel' => $status === 'open'
                        ? 'Hâlâ sayfada'
                        : ($exitedTs !== false
                            ? date('d.m.Y H:i:s', $exitedTs)
                            : ($exitedAt !== '' ? $exitedAt : '—')),
                    'durationSeconds' => $durationSeconds,
                    'durationLabel' => formatPageVisitDuration($durationSeconds),
                    'status' => $status,
                    'isOpen' => $status === 'open' ? '1' : '0',
                    'profileUrl' => $uid !== ''
                        ? '/d/admin-sistem-durumu?_id=' . rawurlencode($uid)
                        : '/d/admin-sistem-durumu',
                );
            }
        } catch (Exception $e) {
            $empty['error'] = $e->getMessage();
            return $empty;
        }

        return array(
            'view' => 'page-visit',
            '_id' => 'page-visit-' . $pageId,
            'pageId' => $pageId,
            'pageTitle' => $pageTitle,
            'pageUrl' => $pageUrl,
            'path' => $path,
            'days' => $days,
            'totalVisits' => $totalVisits,
            'uniqueUserCount' => count($users),
            'users' => $users,
            'visits' => $visits,
            'hasUsers' => count($users) > 0 ? '1' : '0',
            'hasVisits' => count($visits) > 0 ? '1' : '0',
        );
    }
}

if (!function_exists('listCurrentlyOnlineUsers')) {
    /**
     * Anlık (şu an bir sayfada açık ziyareti olan) kullanıcılar.
     * status=open + enteredAt son N dakika (varsayılan 30).
     *
     * @return array{onlineCount:int,staleMinutes:int,staleLabel:string,users:array,hasOnline:string}
     */
    function listCurrentlyOnlineUsers($db, $options = array())
    {
        $staleMinutes = isset($options['staleMinutes'])
            ? (int) $options['staleMinutes']
            : (isset($options['staleHours']) ? ((int) $options['staleHours'] * 60) : 30);
        if ($staleMinutes < 5) {
            $staleMinutes = 5;
        }
        if ($staleMinutes > 240) {
            $staleMinutes = 240;
        }
        $limit = isset($options['limit']) ? (int) $options['limit'] : 80;
        if ($limit < 1) {
            $limit = 80;
        }
        if ($limit > 200) {
            $limit = 200;
        }

        $staleLabel = $staleMinutes < 60
            ? $staleMinutes . ' dk'
            : round($staleMinutes / 60, 1) . ' sa';

        $empty = array(
            'onlineCount' => 0,
            'staleMinutes' => $staleMinutes,
            'staleHours' => (int) max(1, ceil($staleMinutes / 60)),
            'staleLabel' => $staleLabel,
            'users' => array(),
            'hasOnline' => '0',
        );

        $since = date('Y-m-d H:i:s', time() - ($staleMinutes * 60));
        $byUser = array();
        $excludedMap = array_fill_keys(pageVisitExcludedUserIds($db), true);

        try {
            $cursor = $db->pageVisitLogs->find(
                array(
                    'status' => 'open',
                    'enteredAt' => array('$gte' => $since),
                ),
                array(
                    'sort' => array('enteredAt' => -1, '_id' => -1),
                    'limit' => 500,
                )
            );

            foreach ($cursor as $doc) {
                $userId = isset($doc['userId']) ? trim((string) $doc['userId']) : '';
                if ($userId === '' || isset($byUser[$userId])) {
                    continue;
                }
                if (isset($excludedMap[$userId])) {
                    continue;
                }

                $enteredAt = isset($doc['enteredAt']) ? (string) $doc['enteredAt'] : '';
                $enteredTs = $enteredAt !== '' ? strtotime($enteredAt) : false;
                $durationSeconds = null;
                if ($enteredTs !== false) {
                    $durationSeconds = time() - $enteredTs;
                    if ($durationSeconds < 0) {
                        $durationSeconds = 0;
                    }
                }

                $pageId = isset($doc['pageId']) ? trim((string) $doc['pageId']) : '';
                $pageUrl = isset($doc['pageUrl']) ? trim((string) $doc['pageUrl']) : '';
                $pageTitle = isset($doc['pageTitle']) ? trim((string) $doc['pageTitle']) : '';
                if ($pageTitle === '') {
                    $pageTitle = $pageUrl !== '' ? $pageUrl : ($pageId !== '' ? $pageId : 'Bilinmeyen sayfa');
                }
                $path = isset($doc['path']) ? trim((string) $doc['path']) : '';
                if ($path === '' && $pageUrl !== '') {
                    $path = '/d/' . ltrim($pageUrl, '/');
                }

                $userName = isset($doc['userName']) ? trim((string) $doc['userName']) : '';
                $userEmail = isset($doc['userEmail']) ? trim((string) $doc['userEmail']) : '';
                if ($userName === '') {
                    $userName = $userEmail !== '' ? $userEmail : $userId;
                }

                $byUser[$userId] = array(
                    'userId' => $userId,
                    'fullName' => $userName,
                    'email' => $userEmail !== '' ? $userEmail : '—',
                    'pageId' => $pageId,
                    'pageTitle' => $pageTitle,
                    'pageUrl' => $pageUrl,
                    'path' => $path !== '' ? $path : '—',
                    'enteredAt' => $enteredAt,
                    'enteredAtLabel' => $enteredTs !== false
                        ? date('d.m.Y H:i:s', $enteredTs)
                        : ($enteredAt !== '' ? $enteredAt : '—'),
                    'durationSeconds' => $durationSeconds,
                    'durationLabel' => formatPageVisitDuration($durationSeconds),
                    'profileUrl' => '/d/admin-sistem-durumu?_id=' . rawurlencode($userId),
                    'pageDetailUrl' => $pageId !== ''
                        ? '/d/admin-sistem-durumu?pageId=' . rawurlencode($pageId)
                        : '/d/admin-sistem-durumu#sayfa-ziyaretleri',
                );

                if (count($byUser) >= $limit) {
                    break;
                }
            }
        } catch (Exception $e) {
            return $empty;
        }

        $users = array_values($byUser);

        return array(
            'onlineCount' => count($users),
            'staleMinutes' => $staleMinutes,
            'staleHours' => (int) max(1, ceil($staleMinutes / 60)),
            'staleLabel' => $staleLabel,
            'users' => $users,
            'hasOnline' => count($users) > 0 ? '1' : '0',
        );
    }
}
