<?php
/**
 * Admin kullanıcı özeti — aktif kullanıcılar, son giriş, bekleyen bildirimler, saatlik yoğunluk.
 * Panel data-source: custom → adminUserOverview (single)
 *
 * Deploy: Backend/src/routes/custom/adminUserOverview.php
 *
 * Not: MongoDB 3.4 uyumlu ( $toInt yok ). Ağır loginLogs taraması 90 günle sınırlı.
 */

function buildAdminOverviewUserProfile($db, $userId)
{
    try {
        $userObjectId = new MongoDB\BSON\ObjectId($userId);
    } catch (Exception $e) {
        throw new Exception('Geçersiz kullanıcı kimliği.');
    }

    $user = $db->users->findOne(array('_id' => $userObjectId));
    if (!$user) {
        throw new Exception('Kullanıcı bulunamadı.');
    }

    $uid = trim((string) $user['_id']);
    $email = isset($user['email']) ? trim((string) $user['email']) : '';
    $username = isset($user['username']) ? trim((string) $user['username']) : '';
    $name = isset($user['name']) ? trim((string) $user['name']) : '';
    $surname = isset($user['surname']) ? trim((string) $user['surname']) : '';

    $employmentDate = isset($user['employmentDate'])
        ? trim((string) $user['employmentDate'])
        : '';
    $employmentDateLabel = '-';
    $employmentDuration = '-';
    $employmentYears = 0;
    $employmentMonths = 0;

    if ($employmentDate !== '') {
        $employmentTs = strtotime($employmentDate);
        if ($employmentTs !== false) {
            $employmentDateLabel = date('d.m.Y', $employmentTs);
            $start = new DateTime(date('Y-m-d', $employmentTs));
            $today = new DateTime(date('Y-m-d'));
            $diff = $start->diff($today);
            $employmentYears = (int) $diff->y;
            $employmentMonths = (int) $diff->m;
            $parts = array();
            if ($employmentYears > 0) {
                $parts[] = $employmentYears . ' yıl';
            }
            if ($employmentMonths > 0 || !$employmentYears) {
                $parts[] = $employmentMonths . ' ay';
            }
            $employmentDuration = implode(' ', $parts);
        }
    }

    $identifiers = array();
    if ($email !== '') {
        $identifiers[] = $email;
    }
    if ($username !== '' && !in_array($username, $identifiers, true)) {
        $identifiers[] = $username;
    }

    $lastLogin = '-';
    $lastLoginLabel = '-';
    $loginCount90Days = 0;
    if (count($identifiers)) {
        $loginFilter = array(
            'email' => array('$in' => $identifiers),
            'status' => true,
        );
        $lastLoginDoc = $db->loginLogs->findOne(
            $loginFilter,
            array('sort' => array('datetime' => -1, '_id' => -1))
        );
        if ($lastLoginDoc && isset($lastLoginDoc['datetime'])) {
            $lastLogin = trim((string) $lastLoginDoc['datetime']);
            $lastLoginTs = strtotime($lastLogin);
            $lastLoginLabel = $lastLoginTs !== false
                ? date('d.m.Y H:i', $lastLoginTs)
                : $lastLogin;
        }
        $loginFilter['datetime'] = array(
            '$gte' => date('Y-m-d', strtotime('-90 days')) . ' 00:00:00',
        );
        $loginCount90Days = (int) $db->loginLogs->count($loginFilter);
    }

    $pageVisitDays = 30;
    $pageVisits = array();
    $pageVisitCount = 0;
    $pageVisitHelper = __DIR__ . '/../../resources/pageVisitHelper.php';
    if (!file_exists($pageVisitHelper)) {
        $pageVisitHelper = __DIR__ . '/../resources/pageVisitHelper.php';
    }
    if (file_exists($pageVisitHelper)) {
        require_once $pageVisitHelper;
        $pageVisits = listUserPageVisits($db, $uid, array(
            'days' => $pageVisitDays,
            'limit' => 150,
        ));
        $pageVisitCount = count($pageVisits);
    }

    $department = array(
        '_id' => '',
        'label' => '-',
        'short' => '',
        'status' => '',
    );
    $departmentId = isset($user[':departments:'])
        ? trim((string) $user[':departments:'])
        : '';
    if ($departmentId !== '') {
        try {
            $departmentDoc = $db->departments->findOne(array(
                '_id' => new MongoDB\BSON\ObjectId($departmentId),
            ));
            if ($departmentDoc) {
                $department = array(
                    '_id' => trim((string) $departmentDoc['_id']),
                    'label' => isset($departmentDoc['label'])
                        ? (string) $departmentDoc['label']
                        : '-',
                    'short' => isset($departmentDoc['short'])
                        ? (string) $departmentDoc['short']
                        : '',
                    'status' => isset($departmentDoc['status'])
                        ? (string) $departmentDoc['status']
                        : '',
                );
            }
        } catch (Exception $e) {
            // Şube bulunamazsa profil yine gösterilir.
        }
    }

    $roles = array();
    if (isset($user[':roleTypes:'])) {
        foreach ($user[':roleTypes:'] as $roleRef) {
            $roleId = trim((string) $roleRef);
            if ($roleId === '') {
                continue;
            }
            try {
                $roleDoc = $db->roleTypes->findOne(array(
                    '_id' => new MongoDB\BSON\ObjectId($roleId),
                ));
                if ($roleDoc) {
                    $roles[] = array(
                        '_id' => trim((string) $roleDoc['_id']),
                        'label' => isset($roleDoc['description'])
                            ? (string) $roleDoc['description']
                            : (isset($roleDoc['name']) ? (string) $roleDoc['name'] : '-'),
                        'name' => isset($roleDoc['name'])
                            ? (string) $roleDoc['name']
                            : '',
                        'score' => isset($roleDoc['role'])
                            ? (string) $roleDoc['role']
                            : '',
                    );
                }
            } catch (Exception $e) {
                // Geçersiz rol referansını atla.
            }
        }
    }

    $pendingItems = array();
    $unreadMessageCount = 0;
    $messageCursor = $db->messageLogs->find(
        array(':users:to' => $uid, 'status' => 0),
        array('sort' => array('datetime' => -1))
    );
    foreach ($messageCursor as $message) {
        $messageId = trim((string) $message['_id']);
        $pendingItems[] = array(
            '_id' => $messageId,
            'type' => 'message',
            'typeLabel' => 'Okunmamış mesaj',
            'title' => isset($message['message'])
                ? substr((string) $message['message'], 0, 120)
                : 'Okunmamış mesaj',
            'datetime' => isset($message['datetime'])
                ? (string) $message['datetime']
                : '',
            'url' => '/d/mesaj-detay?_id=' . $messageId,
        );
        $unreadMessageCount++;
    }

    $pendingNotificationCount = 0;
    $notificationCursor = $db->notifications->find(
        array('userId' => $uid),
        array('sort' => array('datetime' => -1))
    );
    foreach ($notificationCursor as $notification) {
        $pageUrl = isset($notification['pageUrl'])
            ? trim((string) $notification['pageUrl'])
            : '';
        $objectId = isset($notification['objectId'])
            ? trim((string) $notification['objectId'])
            : '';
        $url = $pageUrl !== '' ? '/d/' . $pageUrl : '';
        if ($url !== '' && $objectId !== '') {
            $url .= '?_id=' . $objectId;
        }
        $pendingItems[] = array(
            '_id' => trim((string) $notification['_id']),
            'type' => 'notification',
            'typeLabel' => 'Bildirim',
            'title' => isset($notification['checker'])
                ? (string) $notification['checker']
                : 'Bekleyen bildirim',
            'datetime' => isset($notification['datetime'])
                ? (string) $notification['datetime']
                : '',
            'url' => $url,
        );
        $pendingNotificationCount++;
    }

    usort($pendingItems, function ($a, $b) {
        return strcmp($b['datetime'], $a['datetime']);
    });

    $photoName = '';
    if (isset($user['photo'])) {
        $photos = (array) $user['photo'];
        if (isset($photos[0]['name'])) {
            $photoName = (string) $photos[0]['name'];
        }
    }

    return array(
        '_id' => $uid,
        'fullName' => trim($name . ' ' . $surname),
        'name' => $name,
        'surname' => $surname,
        'email' => $email !== '' ? $email : '-',
        'username' => $username !== '' ? $username : '-',
        'phone' => isset($user['phone']) && $user['phone'] !== ''
            ? (string) $user['phone']
            : '-',
        'photoName' => $photoName,
        'employmentDate' => $employmentDate,
        'employmentDateLabel' => $employmentDateLabel,
        'employmentDuration' => $employmentDuration,
        'employmentYears' => $employmentYears,
        'employmentMonths' => $employmentMonths,
        'lastLogin' => $lastLogin,
        'lastLoginLabel' => $lastLoginLabel,
        'loginCount90Days' => $loginCount90Days,
        'department' => $department,
        'roles' => $roles,
        'roleCount' => count($roles),
        'unreadMessageCount' => $unreadMessageCount,
        'pendingNotificationCount' => $pendingNotificationCount,
        'pendingTotal' => $unreadMessageCount + $pendingNotificationCount,
        'pendingItems' => $pendingItems,
        'pageVisits' => $pageVisits,
        'pageVisitCount' => $pageVisitCount,
        'pageVisitDays' => $pageVisitDays,
        'statusLabel' => isset($user['terminationDate']) ? 'İşten ayrıldı' : 'Aktif',
        'isActive' => isset($user['terminationDate']) ? '0' : '1',
    );
}

$overviewPost = isset($params['post']) && is_array($params['post'])
    ? $params['post']
    : array();
$overviewData = isset($params['data']) && is_array($params['data'])
    ? $params['data']
    : array();
$overviewPayload = array_merge($overviewData, $overviewPost);
$selectedUserId = isset($overviewPayload['userId'])
    ? trim((string) $overviewPayload['userId'])
    : '';
$selectedPageId = isset($overviewPayload['pageId'])
    ? trim((string) $overviewPayload['pageId'])
    : '';
$overviewFilterEarly = isset($overviewPayload['filter'])
    ? trim((string) $overviewPayload['filter'])
    : '';

// Panel tablo (forTable) — sayfa ziyaret satırları
if ($overviewFilterEarly === 'pageVisitRows') {
    $pageVisitHelper = __DIR__ . '/../../resources/pageVisitHelper.php';
    if (!file_exists($pageVisitHelper)) {
        $pageVisitHelper = __DIR__ . '/../resources/pageVisitHelper.php';
    }
    $pages = array();
    try {
        if (file_exists($pageVisitHelper)) {
            require_once $pageVisitHelper;
            $stats = listPageVisitStats($db, array(
                'days' => 30,
                'limit' => 100,
            ));
            $pages = isset($stats['pages']) && is_array($stats['pages'])
                ? $stats['pages']
                : array();
        }
    } catch (Exception $e) {
        $pages = array();
    }
    $return['response'] = $pages;
    $return['count'] = count($pages);
    $return['info'] = responseInfo('true');
    return;
}

if ($selectedUserId !== '') {
    try {
        $return['response'] = array(
            buildAdminOverviewUserProfile($db, $selectedUserId),
        );
        $return['info'] = responseInfo('true');
    } catch (Exception $e) {
        $return['response'] = array(array(
            '_id' => 'error',
            'fullName' => 'Profil yüklenemedi',
            'error' => $e->getMessage(),
            'roles' => array(),
            'pendingItems' => array(),
            'pageVisits' => array(),
            'pageVisitCount' => 0,
            'pageVisitDays' => 30,
            'pendingTotal' => 0,
        ));
        $return['info'] = responseInfo('true');
    }
    return;
}

if ($selectedPageId !== '') {
    $pageVisitHelper = __DIR__ . '/../../resources/pageVisitHelper.php';
    if (!file_exists($pageVisitHelper)) {
        $pageVisitHelper = __DIR__ . '/../resources/pageVisitHelper.php';
    }
    try {
        if (!file_exists($pageVisitHelper)) {
            throw new Exception('pageVisitHelper yüklenemedi.');
        }
        require_once $pageVisitHelper;
        if (!function_exists('listPageVisitDetailByPage')) {
            throw new Exception('listPageVisitDetailByPage bulunamadı.');
        }
        $days = isset($overviewPayload['days']) ? (int) $overviewPayload['days'] : 30;
        $return['response'] = array(
            listPageVisitDetailByPage($db, $selectedPageId, array(
                'days' => $days,
                'visitLimit' => 100,
            )),
        );
        $return['info'] = responseInfo('true');
    } catch (Exception $e) {
        $return['response'] = array(array(
            'view' => 'page-visit',
            '_id' => 'page-visit-error',
            'pageId' => $selectedPageId,
            'pageTitle' => 'Sayfa ziyaret detayı',
            'pageUrl' => '',
            'path' => '—',
            'days' => 30,
            'totalVisits' => 0,
            'uniqueUserCount' => 0,
            'users' => array(),
            'visits' => array(),
            'hasUsers' => '0',
            'hasVisits' => '0',
            'error' => $e->getMessage(),
        ));
        $return['info'] = responseInfo('true');
    }
    return;
}

try {
    $today = date('Y-m-d');
    $activityDays = 90;
    $activitySince = date('Y-m-d', strtotime('-' . $activityDays . ' days')) . ' 00:00:00';

    $toArray = function ($doc) {
        if (is_array($doc)) {
            return $doc;
        }
        return json_decode(json_encode($doc), true);
    };

    $hourCounts = array_fill(0, 24, 0);
    try {
        $hourCursor = $db->loginLogs->aggregate(array(
            array('$match' => array(
                'status'   => true,
                'datetime' => array('$gte' => $activitySince),
            )),
            array('$project' => array(
                'hour' => array('$substr' => array('$datetime', 11, 2)),
            )),
            array('$group' => array(
                '_id'   => '$hour',
                'count' => array('$sum' => 1),
            )),
        ));
        foreach ($hourCursor as $row) {
            $row = $toArray($row);
            $hour = isset($row['_id']) ? (int) $row['_id'] : -1;
            if ($hour >= 0 && $hour <= 23) {
                $hourCounts[$hour] = isset($row['count']) ? (int) $row['count'] : 0;
            }
        }
    } catch (Exception $e) {
        // Yoğunluk grafiği başarısız olsa bile sayfa açılsın
        $hourCounts = array_fill(0, 24, 0);
    }

    $formatHourRange = function ($hour) {
        $start = str_pad((string) $hour, 2, '0', STR_PAD_LEFT) . ':00';
        $endHour = ($hour + 1) % 24;
        $end = str_pad((string) $endHour, 2, '0', STR_PAD_LEFT) . ':00';
        return $start . '-' . $end;
    };

    $maxHourCount = max($hourCounts);
    if (!$maxHourCount) {
        $maxHourCount = 1;
    }

    $hourRanking = array();
    for ($h = 0; $h < 24; $h++) {
        $hourRanking[] = array(
            'hour'       => $h,
            'label'      => str_pad((string) $h, 2, '0', STR_PAD_LEFT) . ':00',
            'rangeLabel' => $formatHourRange($h),
            'count'      => $hourCounts[$h],
            'percent'    => round(($hourCounts[$h] / $maxHourCount) * 100, 1),
        );
    }

    usort($hourRanking, function ($a, $b) {
        if ($a['count'] == $b['count']) {
            return 0;
        }
        return ($a['count'] > $b['count']) ? -1 : 1;
    });

    $peakHours = array();
    foreach ($hourRanking as $h) {
        if ($h['count'] > 0) {
            $peakHours[] = $h;
        }
        if (count($peakHours) >= 3) {
            break;
        }
    }
    if (!count($peakHours) && count($hourRanking)) {
        $peakHours = array($hourRanking[0]);
    }

    $quietRanking = $hourRanking;
    usort($quietRanking, function ($a, $b) {
        if ($a['count'] == $b['count']) {
            return 0;
        }
        return ($a['count'] < $b['count']) ? -1 : 1;
    });
    $quietHours = array_slice($quietRanking, 0, 3);

    $peakHourSet = array();
    foreach ($peakHours as $h) {
        $peakHourSet[(int) $h['hour']] = true;
    }
    $quietHourSet = array();
    foreach ($quietHours as $h) {
        $quietHourSet[(int) $h['hour']] = true;
    }

    $activityByHour = array();
    for ($h = 0; $h < 24; $h++) {
        $count = $hourCounts[$h];
        $activityByHour[] = array(
            'hour'       => $h,
            'label'      => str_pad((string) $h, 2, '0', STR_PAD_LEFT) . ':00',
            'rangeLabel' => $formatHourRange($h),
            'count'      => $count,
            'percent'    => round(($count / $maxHourCount) * 100, 1),
            'isPeak'     => !empty($peakHourSet[$h]) ? '1' : '0',
            'isQuiet'    => !empty($quietHourSet[$h]) ? '1' : '0',
        );
    }

    $loginMap = array();
    try {
        // Tüm tarih yerine son 90 gün — MongoDB 3.4'te index'siz full scan timeout riskini azaltır
        $loginCursor = $db->loginLogs->aggregate(array(
            array('$match' => array(
                'status'   => true,
                'datetime' => array('$gte' => $activitySince),
            )),
            array('$group' => array(
                '_id'       => '$email',
                'lastLogin' => array('$max' => '$datetime'),
            )),
        ));
        foreach ($loginCursor as $row) {
            $row = $toArray($row);
            $key = isset($row['_id']) ? trim((string) $row['_id']) : '';
            if ($key !== '') {
                $loginMap[$key] = isset($row['lastLogin']) ? (string) $row['lastLogin'] : '';
            }
        }
    } catch (Exception $e) {
        $loginMap = array();
    }

    $msgMap = array();
    try {
        $msgCursor = $db->messageLogs->aggregate(array(
            array('$match' => array('status' => 0)),
            array('$group' => array(
                '_id'   => '$:users:to',
                'count' => array('$sum' => 1),
            )),
        ));
        foreach ($msgCursor as $row) {
            $row = $toArray($row);
            $key = isset($row['_id']) ? trim((string) $row['_id']) : '';
            if ($key !== '') {
                $msgMap[$key] = isset($row['count']) ? (int) $row['count'] : 0;
            }
        }
    } catch (Exception $e) {
        $msgMap = array();
    }

    $notifMap = array();
    try {
        $notifCursor = $db->notifications->aggregate(array(
            array('$group' => array(
                '_id'   => '$userId',
                'count' => array('$sum' => 1),
            )),
        ));
        foreach ($notifCursor as $row) {
            $row = $toArray($row);
            $key = isset($row['_id']) ? trim((string) $row['_id']) : '';
            if ($key !== '') {
                $notifMap[$key] = isset($row['count']) ? (int) $row['count'] : 0;
            }
        }
    } catch (Exception $e) {
        $notifMap = array();
    }

    $deptMap = array();
    foreach ($db->departments->find(array('status' => 'active')) as $dept) {
        $deptId = trim((string) $dept['_id']);
        $deptMap[$deptId] = isset($dept['label']) ? (string) $dept['label'] : '';
    }

    $roleMap = array();
    foreach ($db->roleTypes->find(array('delete' => array('$ne' => 1))) as $role) {
        $roleId = trim((string) $role['_id']);
        $label = '';
        if (isset($role['description']) && $role['description'] !== '') {
            $label = (string) $role['description'];
        } elseif (isset($role['name'])) {
            $label = (string) $role['name'];
        }
        $roleMap[$roleId] = $label;
    }

    $rows = array();
    $userCursor = $db->users->find(
        array(
            'type'            => 'user',
            'delete'          => array('$ne' => 1),
            'terminationDate' => array('$exists' => false),
        ),
        array('sort' => array('surname' => 1, 'name' => 1))
    );

    foreach ($userCursor as $user) {
        $uid = trim((string) $user['_id']);
        $email = isset($user['email']) ? trim((string) $user['email']) : '';
        $username = isset($user['username']) ? trim((string) $user['username']) : '';
        $name = isset($user['name']) ? (string) $user['name'] : '';
        $surname = isset($user['surname']) ? (string) $user['surname'] : '';

        $lastLogin = null;
        if ($email !== '' && isset($loginMap[$email]) && $loginMap[$email] !== '') {
            $lastLogin = $loginMap[$email];
        } elseif ($username !== '' && isset($loginMap[$username]) && $loginMap[$username] !== '') {
            $lastLogin = $loginMap[$username];
        }

        $unreadMessages = isset($msgMap[$uid]) ? $msgMap[$uid] : 0;
        $pendingNotifications = isset($notifMap[$uid]) ? $notifMap[$uid] : 0;
        $pendingTotal = $unreadMessages + $pendingNotifications;

        $deptId = '';
        if (isset($user[':departments:'])) {
            $deptId = trim((string) $user[':departments:']);
        }

        $roleId = '';
        if (isset($user[':roleTypes:'])) {
            $roleTypes = $user[':roleTypes:'];
            if (is_array($roleTypes) || $roleTypes instanceof Traversable) {
                foreach ($roleTypes as $rt) {
                    $roleId = trim((string) $rt);
                    break;
                }
            } else {
                $roleId = trim((string) $roleTypes);
            }
        }

        $rows[] = array(
            '_id'                  => $uid,
            'fullName'             => trim($name . ' ' . $surname),
            'email'                => $email,
            'username'             => $username,
            'departmentLabel'      => isset($deptMap[$deptId]) ? $deptMap[$deptId] : '-',
            'roleLabel'            => isset($roleMap[$roleId]) ? $roleMap[$roleId] : '-',
            'lastLogin'            => $lastLogin ? $lastLogin : '-',
            'lastLoginToday'       => ($lastLogin && strpos($lastLogin, $today) === 0) ? '1' : '0',
            'unreadMessages'       => $unreadMessages,
            'pendingNotifications' => $pendingNotifications,
            'pendingTotal'         => $pendingTotal,
            'hasPending'           => $pendingTotal > 0 ? '1' : '0',
            'neverLoggedIn'        => !$lastLogin ? '1' : '0',
            'profileUrl'           => '/d/admin-sistem-durumu?_id=' . $uid,
            'logsUrl'              => '/d/admin-sistem-durumu?_id=' . $uid . '&view=logs',
        );
    }

    usort($rows, function ($a, $b) {
        if ($a['hasPending'] != $b['hasPending']) {
            return ($b['hasPending'] === '1') ? 1 : -1;
        }
        if ($a['neverLoggedIn'] != $b['neverLoggedIn']) {
            return ($a['neverLoggedIn'] === '1') ? 1 : -1;
        }
        if ($a['lastLogin'] === '-' && $b['lastLogin'] !== '-') {
            return 1;
        }
        if ($b['lastLogin'] === '-' && $a['lastLogin'] !== '-') {
            return -1;
        }
        return strcmp($b['lastLogin'], $a['lastLogin']);
    });

    $loggedInToday = 0;
    $usersWithPending = 0;
    $neverLoggedIn = 0;
    $totalUnreadMessages = 0;
    $totalPendingNotifications = 0;
    foreach ($rows as $r) {
        if ($r['lastLoginToday'] === '1') {
            $loggedInToday++;
        }
        if ($r['hasPending'] === '1') {
            $usersWithPending++;
        }
        if ($r['neverLoggedIn'] === '1') {
            $neverLoggedIn++;
        }
        $totalUnreadMessages += (int) $r['unreadMessages'];
        $totalPendingNotifications += (int) $r['pendingNotifications'];
    }

    $filter = isset($overviewPayload['filter'])
        ? trim((string) $overviewPayload['filter'])
        : '';
    $allowedFilters = array('active', 'today', 'pending', 'messages', 'never');
    if (!in_array($filter, $allowedFilters, true)) {
        $filter = 'active';
    }

    $filterLabels = array(
        'active'   => 'Tüm aktif kullanıcılar',
        'today'    => 'Bugün giriş yapanlar',
        'pending'  => 'Bekleyen bildirimi olanlar',
        'messages' => 'Okunmamış mesajı olanlar',
        'never'    => 'Hiç giriş yapmamışlar',
    );

    $filteredRows = $rows;
    if ($filter === 'today') {
        $filteredRows = array_values(array_filter($rows, function ($r) {
            return isset($r['lastLoginToday']) && $r['lastLoginToday'] === '1';
        }));
    } elseif ($filter === 'pending') {
        $filteredRows = array_values(array_filter($rows, function ($r) {
            return isset($r['hasPending']) && $r['hasPending'] === '1';
        }));
    } elseif ($filter === 'messages') {
        $filteredRows = array_values(array_filter($rows, function ($r) {
            return isset($r['unreadMessages']) && (int) $r['unreadMessages'] > 0;
        }));
    } elseif ($filter === 'never') {
        $filteredRows = array_values(array_filter($rows, function ($r) {
            return isset($r['neverLoggedIn']) && $r['neverLoggedIn'] === '1';
        }));
    }

    $pageVisitStatsDays = 30;
    $pageVisitStats = array(
        'days' => $pageVisitStatsDays,
        'totalVisits' => 0,
        'distinctPages' => 0,
        'topPageTitle' => '-',
        'topPageCount' => 0,
        'pages' => array(),
    );
    $pageVisitHelper = __DIR__ . '/../../resources/pageVisitHelper.php';
    if (!file_exists($pageVisitHelper)) {
        $pageVisitHelper = __DIR__ . '/../resources/pageVisitHelper.php';
    }
    if (file_exists($pageVisitHelper)) {
        require_once $pageVisitHelper;
        $pageVisitStats = listPageVisitStats($db, array(
            'days' => $pageVisitStatsDays,
            'limit' => 100,
        ));
    }

    $allPageVisitPages = isset($pageVisitStats['pages']) && is_array($pageVisitStats['pages'])
        ? $pageVisitStats['pages']
        : array();
    $pvPageSize = 10;
    $pvTotalRows = count($allPageVisitPages);
    $pvTotalPages = $pvTotalRows > 0 ? (int) ceil($pvTotalRows / $pvPageSize) : 1;
    $pvPage = isset($overviewPayload['pvPage']) ? (int) $overviewPayload['pvPage'] : 1;
    if ($pvPage < 1) {
        $pvPage = 1;
    }
    if ($pvPage > $pvTotalPages) {
        $pvPage = $pvTotalPages;
    }
    $pvOffset = ($pvPage - 1) * $pvPageSize;
    $pageVisitPagesPaged = array_slice($allPageVisitPages, $pvOffset, $pvPageSize);
    $pvHasPager = $pvTotalRows > $pvPageSize ? '1' : '0';
    $pvHasPrev = $pvPage > 1 ? '1' : '0';
    $pvHasNext = $pvPage < $pvTotalPages ? '1' : '0';
    $pvPrevPage = $pvPage > 1 ? $pvPage - 1 : 1;
    $pvNextPage = $pvPage < $pvTotalPages ? $pvPage + 1 : $pvTotalPages;

    $onlineNow = array(
        'onlineCount' => 0,
        'staleMinutes' => 30,
        'staleLabel' => '30 dk',
        'users' => array(),
        'hasOnline' => '0',
    );
    if (function_exists('listCurrentlyOnlineUsers')) {
        $onlineNow = listCurrentlyOnlineUsers($db, array(
            'staleMinutes' => 30,
            'limit' => 80,
        ));
    }

    // Panel custom DS: single=false + liste (notifications / mailRules pattern)
    $payload = array(
        '_id'                       => 'admin-overview',
        'activeUserCount'           => count($rows),
        'loggedInToday'             => $loggedInToday,
        'usersWithPending'          => $usersWithPending,
        'neverLoggedIn'             => $neverLoggedIn,
        'totalUnreadMessages'       => $totalUnreadMessages,
        'totalPendingNotifications' => $totalPendingNotifications,
        'activeFilter'              => $filter,
        'filterLabel'               => isset($filterLabels[$filter]) ? $filterLabels[$filter] : $filterLabels['active'],
        'filteredUserCount'         => count($filteredRows),
        'isFiltered'                => $filter !== 'active' ? '1' : '0',
        'activityDays'              => $activityDays,
        'peakHourLabel'             => isset($peakHours[0]['rangeLabel']) ? $peakHours[0]['rangeLabel'] : '-',
        'peakHourCount'             => isset($peakHours[0]['count']) ? $peakHours[0]['count'] : 0,
        'quietHourLabel'            => isset($quietHours[0]['rangeLabel']) ? $quietHours[0]['rangeLabel'] : '-',
        'quietHourCount'            => isset($quietHours[0]['count']) ? $quietHours[0]['count'] : 0,
        'activityByHour'            => $activityByHour,
        'peakHours'                 => $peakHours,
        'quietHours'                => $quietHours,
        'pageVisitStatsDays'        => isset($pageVisitStats['days']) ? $pageVisitStats['days'] : $pageVisitStatsDays,
        'pageVisitTotal'            => isset($pageVisitStats['totalVisits']) ? $pageVisitStats['totalVisits'] : 0,
        'pageVisitDistinct'         => isset($pageVisitStats['distinctPages']) ? $pageVisitStats['distinctPages'] : 0,
        'topVisitedPageTitle'       => isset($pageVisitStats['topPageTitle']) ? $pageVisitStats['topPageTitle'] : '-',
        'topVisitedPageCount'       => isset($pageVisitStats['topPageCount']) ? $pageVisitStats['topPageCount'] : 0,
        'pageVisitPages'            => $pageVisitPagesPaged,
        'pageVisitPage'             => $pvPage,
        'pageVisitTotalPages'       => $pvTotalPages,
        'pageVisitPageSize'         => $pvPageSize,
        'pageVisitHasPager'         => $pvHasPager,
        'pageVisitHasPrev'          => $pvHasPrev,
        'pageVisitHasNext'          => $pvHasNext,
        'pageVisitPrevPage'         => $pvPrevPage,
        'pageVisitNextPage'         => $pvNextPage,
        'onlineNowCount'            => isset($onlineNow['onlineCount']) ? (int) $onlineNow['onlineCount'] : 0,
        'onlineNowStaleMinutes'     => isset($onlineNow['staleMinutes']) ? (int) $onlineNow['staleMinutes'] : 30,
        'onlineNowStaleLabel'       => isset($onlineNow['staleLabel']) ? $onlineNow['staleLabel'] : '30 dk',
        'onlineNowUsers'            => isset($onlineNow['users']) ? $onlineNow['users'] : array(),
        'hasOnlineNow'              => isset($onlineNow['hasOnline']) ? $onlineNow['hasOnline'] : '0',
        'users'                     => $filteredRows,
    );
    $return['response'] = array($payload);
    $return['info'] = responseInfo('true');
} catch (Exception $e) {
    $return['response'] = array(array(
        '_id'                       => 'admin-overview',
        'activeUserCount'           => 0,
        'loggedInToday'             => 0,
        'usersWithPending'          => 0,
        'neverLoggedIn'             => 0,
        'totalUnreadMessages'       => 0,
        'totalPendingNotifications' => 0,
        'activityDays'              => 90,
        'peakHourLabel'             => '-',
        'peakHourCount'             => 0,
        'quietHourLabel'            => '-',
        'quietHourCount'            => 0,
        'activityByHour'            => array(),
        'peakHours'                 => array(),
        'quietHours'                => array(),
        'pageVisitStatsDays'        => 30,
        'pageVisitTotal'            => 0,
        'pageVisitDistinct'         => 0,
        'topVisitedPageTitle'       => '-',
        'topVisitedPageCount'       => 0,
        'pageVisitPages'            => array(),
        'pageVisitPage'             => 1,
        'pageVisitTotalPages'       => 1,
        'pageVisitPageSize'         => 10,
        'pageVisitHasPager'         => '0',
        'pageVisitHasPrev'          => '0',
        'pageVisitHasNext'          => '0',
        'pageVisitPrevPage'         => 1,
        'pageVisitNextPage'         => 1,
        'onlineNowCount'            => 0,
        'onlineNowStaleMinutes'     => 30,
        'onlineNowStaleLabel'       => '30 dk',
        'onlineNowUsers'            => array(),
        'hasOnlineNow'              => '0',
        'users'                     => array(),
        'error'                     => $e->getMessage(),
    ));
    $return['info'] = responseInfo('true');
}
