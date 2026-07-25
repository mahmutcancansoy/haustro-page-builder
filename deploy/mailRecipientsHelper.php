<?php
/**
 * Sabit mail alıcıları — yardımcı fonksiyonlar.
 *
 * Deploy:
 *   Backend/src/resources/mailRecipientsHelper.php
 *
 * Kullanım (cron / custom route içinde):
 *   require_once __DIR__ . '/../resources/mailRecipientsHelper.php';
 *   $to = getMailRecipients($db, 'cron.checklist_report');
 */

if (!function_exists('mailRecipientDefaultDomain')) {
    function mailRecipientDefaultDomain()
    {
        return '@thegalliard.com';
    }
}

if (!function_exists('resolveMailRecipientEntry')) {
    /**
     * @param object $db
     * @param array  $entry ['kind' => 'username'|'email', 'value' => string]
     */
    function resolveMailRecipientEntry($db, array $entry)
    {
        $kind  = $entry['kind'] ?? 'email';
        $value = trim((string) ($entry['value'] ?? ''));

        if ($value === '') {
            return null;
        }

        if ($kind === 'email' || strpos($value, '@') !== false) {
            return strtolower($value);
        }

        $username = str_replace(mailRecipientDefaultDomain(), '', $value);

        $user = $db->users->findOne(
            [
                'username' => $username,
                'delete'   => ['$ne' => 1],
            ],
            ['projection' => ['email' => 1, 'username' => 1]]
        );

        if ($user && !empty($user['email'])) {
            return strtolower(trim((string) $user['email']));
        }

        return strtolower($username . mailRecipientDefaultDomain());
    }
}

if (!function_exists('parseMailRecipientsText')) {
    function parseMailRecipientsText($raw)
    {
        if (is_array($raw)) {
            return $raw;
        }

        $text = trim((string) $raw);
        if ($text === '') {
            return [];
        }

        $parts = preg_split('/[\s,;]+/', $text, -1, PREG_SPLIT_NO_EMPTY);
        $out   = [];

        foreach ($parts as $part) {
            $part = trim($part);
            if ($part === '') {
                continue;
            }
            if (strpos($part, '@') !== false) {
                $out[] = ['kind' => 'email', 'value' => $part];
            } else {
                $out[] = ['kind' => 'username', 'value' => $part];
            }
        }

        return $out;
    }
}

if (!function_exists('getMailRecipientEntries')) {
    function getMailRecipientEntries(array $rule)
    {
        $text = trim((string) ($rule['recipientsText'] ?? ''));
        if ($text !== '') {
            return parseMailRecipientsText($text);
        }

        return $rule['recipients'] ?? [];
    }
}

if (!function_exists('getMailRecipientRule')) {
    function getMailRecipientRule($db, $key)
    {
        return $db->mailRecipients->findOne([
            'key'    => (string) $key,
            'active' => true,
            'delete' => ['$ne' => 1],
        ]);
    }
}

if (!function_exists('getMailRecipients')) {
    /**
     * Kural anahtarına göre çözümlenmiş e-posta listesi döner.
     *
     * @param object $db
     * @param string $key   mailRecipients.key
     * @return string[]
     */
    function getMailRecipients($db, $key)
    {
        $rule = getMailRecipientRule($db, $key);
        if (!$rule) {
            return [];
        }

        $emails = [];
        foreach (getMailRecipientEntries($rule) as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $resolved = resolveMailRecipientEntry($db, $entry);
            if ($resolved) {
                $emails[] = $resolved;
            }
        }

        return array_values(array_unique($emails));
    }
}

if (!function_exists('getMailRecipientsWithRoleUsers')) {
    /**
     * role_plus_fixed veya role_only modları için IK rol kullanıcılarını da ekler.
     * Mevcut dailyAttendanceExcel / attendanceReminderCheck mantığına uyumlu.
     *
     * @param object $db
     * @param string $key
     * @param array  $roleUserEmails  Rol sorgusundan gelen ek e-postalar
     * @return string[]
     */
    function getMailRecipientsWithRoleUsers($db, $key, array $roleUserEmails = [])
    {
        $rule = getMailRecipientRule($db, $key);
        if (!$rule) {
            return array_values(array_unique(array_filter($roleUserEmails)));
        }

        $mode = $rule['recipientMode'] ?? 'fixed';
        $fixed = getMailRecipients($db, $key);

        if ($mode === 'role_only') {
            return array_values(array_unique(array_filter($roleUserEmails)));
        }

        if ($mode === 'role_plus_fixed') {
            return array_values(array_unique(array_merge($roleUserEmails, $fixed)));
        }

        return $fixed;
    }
}

if (!function_exists('formatMailRecipientDisplay')) {
    function formatMailRecipientDisplay($db, array $recipients)
    {
        $out = [];
        foreach ($recipients as $entry) {
            if (!is_array($entry)) {
                continue;
            }
            $kind  = $entry['kind'] ?? 'email';
            $value = trim((string) ($entry['value'] ?? ''));
            if ($value === '') {
                continue;
            }
            if ($kind === 'username') {
                $resolved = resolveMailRecipientEntry($db, $entry);
                $out[] = $value . ' → ' . $resolved;
            } else {
                $out[] = $value;
            }
        }
        return $out;
    }
}
