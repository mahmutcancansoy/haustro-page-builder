<?php
/**
 * Panel data-source: mail alıcı kuralları listesi / güncelleme.
 *
 * Deploy: Backend/src/routes/custom/mailRecipients.php
 *
 * post-params örnekleri:
 *   Liste:  { "oprType": "list" }
 *   Tek:    { "oprType": "get", "key": "cron.checklist_report" }
 *   Güncelle: { "oprType": "update", "_id": "...", "recipients": "mgunduz, mtenekeci, test@example.com" }
 *   Ekle:    { "oprType": "addRecipient", "_id": "...", "recipient": "test@example.com" }
 *   Sil:     { "oprType": "removeRecipient", "_id": "...", "recipient": "mgunduz" }
 */

require_once __DIR__ . '/../../resources/mailRecipientsHelper.php';

$post    = is_array($params['post'] ?? null) ? $params['post'] : [];
$data    = is_array($params['data'] ?? null) ? $params['data'] : [];
$payload = array_merge($data, $post);
$oprType = $payload['oprType'] ?? 'list';

function normalizeRecipientEntry($entry)
{
    if (is_string($entry)) {
        $value = trim($entry);
        if ($value === '') {
            return null;
        }
        return [
            'kind'  => strpos($value, '@') !== false ? 'email' : 'username',
            'value' => $value,
        ];
    }

    if (!is_array($entry)) {
        return null;
    }

    $value = trim((string) ($entry['value'] ?? ''));
    if ($value === '') {
        return null;
    }

    $kind = trim((string) ($entry['kind'] ?? ''));
    if ($kind === '') {
        $kind = strpos($value, '@') !== false ? 'email' : 'username';
    }

    return ['kind' => $kind, 'value' => $value];
}

function parseRecipientsInput($raw)
{
    if (is_array($raw)) {
        $out = [];
        foreach ($raw as $entry) {
            $normalized = normalizeRecipientEntry($entry);
            if ($normalized) {
                $out[] = $normalized;
            }
        }
        return $out;
    }

    $text = trim((string) $raw);
    if ($text === '') {
        return [];
    }

    $parts = preg_split('/[\s,;]+/', $text, -1, PREG_SPLIT_NO_EMPTY);
    $out   = [];

    foreach ($parts as $part) {
        $normalized = normalizeRecipientEntry($part);
        if ($normalized) {
            $out[] = $normalized;
        }
    }

    return $out;
}

function recipientsTextFromEntries(array $recipients)
{
    $parts = [];
    foreach ($recipients as $entry) {
        if (!is_array($entry)) {
            continue;
        }
        $value = trim((string) ($entry['value'] ?? ''));
        if ($value !== '') {
            $parts[] = $value;
        }
    }
    return implode(', ', $parts);
}

function enrichMailRecipientRule($db, $rule)
{
    $row = $rule;
    $row['_id'] = trim((string) $rule['_id']);
    $entries = getMailRecipientEntries($rule);
    $row['recipientDisplay'] = formatMailRecipientDisplay($db, $entries);
    $row['recipientCount']   = count($entries);
    $row['resolvedEmails']   = getMailRecipients($db, $rule['key']);
    if (empty($row['recipientsText'])) {
        $row['recipientsText'] = recipientsTextFromEntries($entries);
    }
    return $row;
}

function recipientValueExists(array $recipients, $value)
{
    $needle = strtolower(trim((string) $value));
    if ($needle === '') {
        return false;
    }
    foreach ($recipients as $entry) {
        $current = strtolower(trim((string) ($entry['value'] ?? '')));
        if ($current === $needle) {
            return true;
        }
    }
    return false;
}

function buildMailRecipientQuery($payload)
{
    $query = ['delete' => ['$ne' => 1]];

    if (!empty($payload['_id'])) {
        try {
            $query['_id'] = new MongoDB\BSON\ObjectId((string) $payload['_id']);
            return $query;
        } catch (Exception $e) {
            return null;
        }
    }

    if (!empty($payload['key'])) {
        $query['key'] = (string) $payload['key'];
        return $query;
    }

    return null;
}

function saveMailRecipients($db, $query, array $recipients)
{
    $set = [
        'recipients'     => $recipients,
        'recipientsText' => recipientsTextFromEntries($recipients),
        'updatedAt'      => date('c'),
    ];

    $result = $db->mailRecipients->updateOne($query, ['$set' => $set]);
    if ($result->getMatchedCount() === 0) {
        return null;
    }

    return $db->mailRecipients->findOne($query);
}

try {
    if ($oprType === 'list') {
        $cursor = $db->mailRecipients->find(
            ['delete' => ['$ne' => 1]],
            ['sort' => ['category' => 1, 'order' => 1, 'label' => 1]]
        );

        $rows = [];
        foreach ($cursor as $doc) {
            $rows[] = enrichMailRecipientRule($db, $doc);
        }

        $return['response'] = $rows;
        $return['info']     = responseInfo('true');
        return;
    }

    if ($oprType === 'get') {
        $query = ['delete' => ['$ne' => 1]];

        if (!empty($payload['_id'])) {
            try {
                $query['_id'] = new MongoDB\BSON\ObjectId((string) $payload['_id']);
            } catch (Exception $e) {
                $return['info'] = responseInfo('false', 'Geçersiz _id');
                return;
            }
        } elseif (!empty($payload['key'])) {
            $query['key'] = (string) $payload['key'];
        } else {
            $return['info'] = responseInfo('false', '_id veya key gerekli');
            return;
        }

        $doc = $db->mailRecipients->findOne($query);
        if (!$doc) {
            $return['info'] = responseInfo('false', 'Kayıt bulunamadı');
            return;
        }

        $row = enrichMailRecipientRule($db, $doc);
        $parts = [];
        foreach ($doc['recipients'] ?? [] as $entry) {
            $parts[] = $entry['value'] ?? '';
        }
        $row['recipientsText'] = implode(', ', array_filter($parts));

        $return['response'] = $row;
        $return['info']       = responseInfo('true');
        return;
    }

    if ($oprType === 'update') {
        if (empty($payload['_id']) && empty($payload['key'])) {
            $return['info'] = responseInfo('false', '_id veya key gerekli');
            return;
        }

        $query = ['delete' => ['$ne' => 1]];
        if (!empty($payload['_id'])) {
            try {
                $query['_id'] = new MongoDB\BSON\ObjectId((string) $payload['_id']);
            } catch (Exception $e) {
                $return['info'] = responseInfo('false', 'Geçersiz _id');
                return;
            }
        } else {
            $query['key'] = (string) $payload['key'];
        }

        $recipients = parseRecipientsInput($payload['recipients'] ?? $payload['recipientsText'] ?? '');
        $set = [
            'recipients'     => $recipients,
            'recipientsText' => recipientsTextFromEntries($recipients),
            'updatedAt'      => date('c'),
        ];

        if (isset($payload['active'])) {
            $set['active'] = (bool) $payload['active'];
        }

        $result = $db->mailRecipients->updateOne($query, ['$set' => $set]);

        if ($result->getMatchedCount() === 0) {
            $return['info'] = responseInfo('false', 'Kayıt bulunamadı');
            return;
        }

        $doc = $db->mailRecipients->findOne($query);
        $return['response'] = enrichMailRecipientRule($db, $doc);
        $return['info']     = responseInfo('true');
        return;
    }

    if ($oprType === 'addRecipient') {
        $query = buildMailRecipientQuery($payload);
        if (!$query) {
            $return['info'] = responseInfo('false', '_id veya key gerekli');
            return;
        }

        $doc = $db->mailRecipients->findOne($query);
        if (!$doc) {
            $return['info'] = responseInfo('false', 'Kayıt bulunamadı');
            return;
        }

        $newEntry = normalizeRecipientEntry($payload['recipient'] ?? '');
        if (!$newEntry) {
            $return['info'] = responseInfo('false', 'Geçerli bir alıcı girin');
            return;
        }

        $recipients = parseRecipientsInput(getMailRecipientEntries($doc));
        if (recipientValueExists($recipients, $newEntry['value'])) {
            $return['info'] = responseInfo('false', 'Bu alıcı zaten listede');
            return;
        }

        $recipients[] = $newEntry;
        $saved = saveMailRecipients($db, $query, $recipients);
        if (!$saved) {
            $return['info'] = responseInfo('false', 'Kayıt bulunamadı');
            return;
        }

        $return['response'] = enrichMailRecipientRule($db, $saved);
        $return['info']     = responseInfo('true');
        return;
    }

    if ($oprType === 'removeRecipient') {
        $query = buildMailRecipientQuery($payload);
        if (!$query) {
            $return['info'] = responseInfo('false', '_id veya key gerekli');
            return;
        }

        $doc = $db->mailRecipients->findOne($query);
        if (!$doc) {
            $return['info'] = responseInfo('false', 'Kayıt bulunamadı');
            return;
        }

        $removeValue = strtolower(trim((string) ($payload['recipient'] ?? '')));
        if ($removeValue === '') {
            $return['info'] = responseInfo('false', 'Silinecek alıcı gerekli');
            return;
        }

        $recipients = [];
        foreach (parseRecipientsInput(getMailRecipientEntries($doc)) as $entry) {
            if (strtolower(trim((string) ($entry['value'] ?? ''))) === $removeValue) {
                continue;
            }
            $recipients[] = $entry;
        }

        $saved = saveMailRecipients($db, $query, $recipients);
        if (!$saved) {
            $return['info'] = responseInfo('false', 'Kayıt bulunamadı');
            return;
        }

        $return['response'] = enrichMailRecipientRule($db, $saved);
        $return['info']     = responseInfo('true');
        return;
    }

    $return['info'] = responseInfo('false', 'Bilinmeyen oprType: ' . $oprType);
} catch (Exception $e) {
    $return['info'] = responseInfo('false', $e->getMessage());
}
